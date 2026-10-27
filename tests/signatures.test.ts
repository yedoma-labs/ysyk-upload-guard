import { describe, expect, it } from "vitest";
import { sniffFileType } from "../src/index.js";
import {
	ascii,
	fileWith,
	GIF89_HEADER,
	JPEG_HEADER,
	PDF_HEADER,
	PNG_HEADER,
	WEBP_HEADER,
	ZIP_HEADER,
} from "./fixtures.js";

describe("sniffFileType", () => {
	it("detects PNG", () => {
		expect(sniffFileType(fileWith(PNG_HEADER, 32))).toEqual({
			mimeType: "image/png",
			extension: "png",
		});
	});

	it("detects JPEG", () => {
		expect(sniffFileType(fileWith(JPEG_HEADER, 32))).toEqual({
			mimeType: "image/jpeg",
			extension: "jpg",
		});
	});

	it("detects GIF87a", () => {
		expect(sniffFileType(ascii("GIF87a\u0001\u0000\u0001\u0000"))).toEqual({
			mimeType: "image/gif",
			extension: "gif",
		});
	});

	it("detects GIF89a", () => {
		expect(sniffFileType(fileWith(GIF89_HEADER, 32))).toEqual({
			mimeType: "image/gif",
			extension: "gif",
		});
	});

	it("detects WebP only when both RIFF and WEBP match", () => {
		expect(sniffFileType(fileWith(WEBP_HEADER, 32))).toEqual({
			mimeType: "image/webp",
			extension: "webp",
		});
	});

	it("detects PDF", () => {
		expect(sniffFileType(fileWith(PDF_HEADER, 32))).toEqual({
			mimeType: "application/pdf",
			extension: "pdf",
		});
	});

	it("detects ZIP", () => {
		expect(sniffFileType(fileWith(ZIP_HEADER, 32))).toEqual({
			mimeType: "application/zip",
			extension: "zip",
		});
	});

	it("reports Office documents (ZIP containers) as application/zip", () => {
		// docx, xlsx and pptx are ZIP archives and share the PK header, so they are not told apart.
		expect(sniffFileType(fileWith(ZIP_HEADER, 64))?.mimeType).toBe("application/zip");
	});

	it("rejects RIFF files that are not WebP", () => {
		const wave = ascii("RIFF$\u0000\u0000\u0000WAVEfmt ");
		expect(sniffFileType(wave)).toBeUndefined();
	});

	it("rejects a truncated WebP that stops before the WEBP marker", () => {
		expect(sniffFileType(ascii("RIFF$\u0000\u0000\u0000"))).toBeUndefined();
	});

	it("rejects HTML, even when the name would suggest an image", () => {
		expect(sniffFileType(ascii("<!doctype html><html><script>alert(1)</script>"))).toBeUndefined();
	});

	it("rejects a truncated PNG", () => {
		expect(sniffFileType(new Uint8Array(PNG_HEADER.slice(0, 4)))).toBeUndefined();
	});

	it("rejects a PDF marker that is cut short", () => {
		expect(sniffFileType(ascii("%PDF"))).toBeUndefined();
	});

	it("rejects empty input", () => {
		expect(sniffFileType(new Uint8Array(0))).toBeUndefined();
	});
});
