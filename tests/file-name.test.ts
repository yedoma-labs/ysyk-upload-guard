import { describe, expect, it } from "vitest";
import { sanitizeFileName } from "../src/index.js";

describe("sanitizeFileName", () => {
	it("keeps names that are already safe", () => {
		expect(sanitizeFileName("report-2026.v2_final.pdf")).toBe("report-2026.v2_final.pdf");
	});

	it("drops path segments for both separator styles", () => {
		expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
		expect(sanitizeFileName("..\\..\\windows\\system32\\cmd.exe")).toBe("cmd.exe");
		expect(sanitizeFileName("/var/tmp/x.gif")).toBe("x.gif");
	});

	it("returns 'upload' for empty or dot-only input", () => {
		expect(sanitizeFileName("")).toBe("upload");
		expect(sanitizeFileName("....")).toBe("upload");
		expect(sanitizeFileName("/")).toBe("upload");
	});

	it("removes control characters and NUL", () => {
		expect(sanitizeFileName("a\u0000b\u0007c\td\u007f.txt")).toBe("abcd.txt");
	});

	it("replaces spaces, shell metacharacters and unicode with underscores", () => {
		expect(sanitizeFileName("a b&c;d.png")).toBe("a_b_c_d.png");
		expect(sanitizeFileName("Größe 日本.png")).toBe("Gr__e___.png");
	});

	it("caps the result at 100 characters", () => {
		const result = sanitizeFileName("x".repeat(500));
		expect(result).toHaveLength(100);
		expect(result).toBe("x".repeat(100));
	});

	it("handles very long dot runs without backtracking", () => {
		expect(sanitizeFileName(`${"..".repeat(50_000)}x.png`)).toBe("x.png");
	});
});
