import { describe, expect, it } from "vitest";
import { DEFAULT_MAX_UPLOAD_BYTES, inspectUpload } from "../src/index.js";
import {
	ascii,
	fileWith,
	JPEG_HEADER,
	PDF_HEADER,
	PNG_HEADER,
	WEBP_HEADER,
	ZIP_HEADER,
} from "./fixtures.js";

const png = fileWith(PNG_HEADER, 64);

describe("inspectUpload: happy path", () => {
	it("accepts an allowed PNG and returns the detected type", () => {
		const result = inspectUpload({
			data: png,
			declaredMimeType: "image/png",
			declaredName: "avatar.png",
			allow: ["image/png"],
		});
		expect(result).toEqual({
			ok: true,
			mimeType: "image/png",
			extension: "png",
			safeName: "avatar.png",
			declaredMismatch: false,
		});
	});

	it("accepts WebP, PDF, ZIP and JPEG when they are allowed", () => {
		const cases = [
			[fileWith(WEBP_HEADER, 64), "image/webp", "webp"],
			[fileWith(PDF_HEADER, 64), "application/pdf", "pdf"],
			[fileWith(ZIP_HEADER, 64), "application/zip", "zip"],
			[fileWith(JPEG_HEADER, 64), "image/jpeg", "jpg"],
		] as const;
		for (const [data, mimeType, extension] of cases) {
			const result = inspectUpload({ data, declaredName: "file", allow: [mimeType] });
			expect(result).toMatchObject({ ok: true, mimeType, extension });
		}
	});

	it("accepts a Node Buffer, which is a Uint8Array subclass", () => {
		const result = inspectUpload({ data: Buffer.from(png), allow: ["image/png"] });
		expect(result).toMatchObject({ ok: true, mimeType: "image/png" });
	});
});

describe("inspectUpload: wrong extension and forged content", () => {
	it("rejects HTML with a .png name as UNSUPPORTED_TYPE", () => {
		const html = ascii("<html><body><script>alert(1)</script></body></html>");
		const result = inspectUpload({
			data: html,
			declaredMimeType: "image/png",
			declaredName: "innocent.png",
			allow: ["image/png"],
		});
		expect(result).toEqual({
			ok: false,
			code: "UNSUPPORTED_TYPE",
			message: "The file type could not be identified as a supported type.",
		});
	});

	it("flags a lying client MIME type but still accepts content that is allowed", () => {
		const result = inspectUpload({
			data: png,
			declaredMimeType: "application/pdf",
			declaredName: "photo.png",
			allow: ["image/png"],
		});
		expect(result).toMatchObject({ ok: true, mimeType: "image/png", declaredMismatch: true });
	});

	it("does not accept a file just because the client claims an allowed type", () => {
		const result = inspectUpload({
			data: ascii("<html></html>"),
			declaredMimeType: "image/png",
			allow: ["image/png"],
		});
		expect(result).toMatchObject({ ok: false, code: "UNSUPPORTED_TYPE" });
	});

	it("rejects a PDF that is declared as an allowed PNG when only PNG is allowed", () => {
		const result = inspectUpload({
			data: fileWith(PDF_HEADER, 64),
			declaredMimeType: "image/png",
			allow: ["image/png"],
		});
		expect(result).toMatchObject({ ok: false, code: "NOT_IN_ALLOWLIST" });
	});

	it("treats image/jpg as image/jpeg and ignores MIME parameters", () => {
		const jpeg = fileWith(JPEG_HEADER, 64);
		expect(
			inspectUpload({ data: jpeg, declaredMimeType: "image/jpg", allow: ["image/jpeg"] }),
		).toMatchObject({ ok: true, declaredMismatch: false });
		expect(
			inspectUpload({
				data: png,
				declaredMimeType: "image/png; charset=binary",
				allow: ["image/png"],
			}),
		).toMatchObject({ ok: true, declaredMismatch: false });
	});

	it("does not flag a mismatch when no MIME type was declared", () => {
		expect(inspectUpload({ data: png, declaredMimeType: "", allow: ["image/png"] })).toMatchObject({
			ok: true,
			declaredMismatch: false,
		});
	});
});

describe("inspectUpload: allowlist", () => {
	it("rejects a detected type that is not in the allowlist", () => {
		expect(inspectUpload({ data: png, allow: ["application/pdf"] })).toEqual({
			ok: false,
			code: "NOT_IN_ALLOWLIST",
			message: "The file type is not allowed.",
		});
	});

	it("accepts an allowlist entry written as image/jpg for JPEG files", () => {
		expect(
			inspectUpload({ data: fileWith(JPEG_HEADER, 64), allow: ["image/jpg" as "image/jpeg"] }),
		).toMatchObject({ ok: true, mimeType: "image/jpeg" });
	});

	it("rejects everything when the allowlist is empty", () => {
		expect(inspectUpload({ data: png, allow: [] })).toMatchObject({
			ok: false,
			code: "NOT_IN_ALLOWLIST",
		});
	});
});

describe("inspectUpload: size limits", () => {
	it("accepts a file of exactly maxBytes", () => {
		const data = fileWith(PNG_HEADER, 16);
		expect(inspectUpload({ data, allow: ["image/png"], maxBytes: 16 })).toMatchObject({ ok: true });
	});

	it("rejects a file one byte over maxBytes", () => {
		const data = fileWith(PNG_HEADER, 17);
		expect(inspectUpload({ data, allow: ["image/png"], maxBytes: 16 })).toMatchObject({
			ok: false,
			code: "TOO_LARGE",
		});
	});

	it("uses a 5 MiB default limit", () => {
		expect(DEFAULT_MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
		const atLimit = fileWith(PDF_HEADER, DEFAULT_MAX_UPLOAD_BYTES);
		const overLimit = fileWith(PDF_HEADER, DEFAULT_MAX_UPLOAD_BYTES + 1);
		expect(inspectUpload({ data: atLimit, allow: ["application/pdf"] })).toMatchObject({
			ok: true,
		});
		expect(inspectUpload({ data: overLimit, allow: ["application/pdf"] })).toMatchObject({
			ok: false,
			code: "TOO_LARGE",
		});
	});

	it("checks size before sniffing, so oversized garbage is TOO_LARGE", () => {
		const garbage = ascii("x".repeat(17));
		expect(inspectUpload({ data: garbage, allow: ["image/png"], maxBytes: 16 })).toMatchObject({
			ok: false,
			code: "TOO_LARGE",
		});
	});

	it("rejects a non-positive or non-integer maxBytes as a programming error", () => {
		expect(() => inspectUpload({ data: png, allow: ["image/png"], maxBytes: 0 })).toThrow(
			RangeError,
		);
		expect(() => inspectUpload({ data: png, allow: ["image/png"], maxBytes: 1.5 })).toThrow(
			RangeError,
		);
	});
});

describe("inspectUpload: empty and truncated input", () => {
	it("rejects an empty file as EMPTY, even with an empty allowlist", () => {
		expect(inspectUpload({ data: new Uint8Array(0), allow: [] })).toEqual({
			ok: false,
			code: "EMPTY",
			message: "The file is empty.",
		});
	});

	it("rejects a truncated file as UNSUPPORTED_TYPE", () => {
		expect(
			inspectUpload({ data: new Uint8Array(PNG_HEADER.slice(0, 4)), allow: ["image/png"] }),
		).toMatchObject({ ok: false, code: "UNSUPPORTED_TYPE" });
	});

	it("never puts file bytes into error messages", () => {
		const result = inspectUpload({ data: ascii("secret-content-here"), allow: ["image/png"] });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.message).not.toContain("secret");
		}
	});
});

describe("inspectUpload: safe file names", () => {
	it("strips path traversal and keeps the base name", () => {
		expect(
			inspectUpload({ data: png, declaredName: "../../etc/avatar.png", allow: ["image/png"] }),
		).toMatchObject({ safeName: "avatar.png" });
		expect(
			inspectUpload({ data: png, declaredName: "..\\..\\windows\\evil.png", allow: ["image/png"] }),
		).toMatchObject({ safeName: "evil.png" });
		expect(
			inspectUpload({ data: png, declaredName: "C:\\Users\\me\\photo.png", allow: ["image/png"] }),
		).toMatchObject({ safeName: "photo.png" });
	});

	it("replaces the declared extension with the detected one", () => {
		expect(
			inspectUpload({ data: png, declaredName: "shell.php", allow: ["image/png"] }),
		).toMatchObject({ safeName: "shell.png" });
		expect(
			inspectUpload({
				data: fileWith(PDF_HEADER, 64),
				declaredName: "a.tar.gz",
				allow: ["application/pdf"],
			}),
		).toMatchObject({ safeName: "a.tar.pdf" });
	});

	it("removes control characters and NUL", () => {
		expect(
			inspectUpload({ data: png, declaredName: "bad\u0000na\u0007me\n.png", allow: ["image/png"] }),
		).toMatchObject({ safeName: "badname.png" });
	});

	it("replaces unicode characters with underscores", () => {
		expect(
			inspectUpload({ data: png, declaredName: "Größe 日本.png", allow: ["image/png"] }),
		).toMatchObject({ safeName: "Gr__e___.png" });
		expect(
			inspectUpload({ data: png, declaredName: "🙂.png", allow: ["image/png"] }),
		).toMatchObject({
			safeName: "_.png",
		});
	});

	it("caps very long names at 100 characters including the extension", () => {
		const result = inspectUpload({
			data: png,
			declaredName: `${"a".repeat(300)}.png`,
			allow: ["image/png"],
		});
		expect(result).toMatchObject({ ok: true });
		if (result.ok) {
			expect(result.safeName).toHaveLength(100);
			expect(result.safeName.endsWith(".png")).toBe(true);
		}
	});

	it("removes leading dots", () => {
		expect(
			inspectUpload({ data: png, declaredName: "...hidden.png", allow: ["image/png"] }),
		).toMatchObject({ safeName: "hidden.png" });
	});

	it("falls back to 'upload' when nothing usable remains", () => {
		expect(inspectUpload({ data: png, declaredName: "....", allow: ["image/png"] })).toMatchObject({
			safeName: "upload.png",
		});
		expect(inspectUpload({ data: png, allow: ["image/png"] })).toMatchObject({
			safeName: "upload.png",
		});
		expect(inspectUpload({ data: png, declaredName: "", allow: ["image/png"] })).toMatchObject({
			safeName: "upload.png",
		});
	});
});
