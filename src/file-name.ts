const MAX_FILE_NAME_LENGTH = 100;
const FALLBACK_NAME = "upload";
const SAFE_CHARACTER = /^[A-Za-z0-9._-]$/;

/** Keeps only the last path segment, which drops "../", "..\", "/" and "\" prefixes. */
function lastPathSegment(name: string): string {
	const segments = name.split(/[\\/]/);
	return segments[segments.length - 1] ?? "";
}

/** Removes C0 control characters (including NUL) and DEL. */
function withoutControlCharacters(text: string): string {
	let result = "";
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0;
		if (code > 0x1f && code !== 0x7f) {
			result += char;
		}
	}
	return result;
}

/** Replaces every character outside [A-Za-z0-9._-] with "_" and applies the length and fallback rules. */
function toSafeName(text: string, maxLength: number): string {
	const replaced = Array.from(text, (char) => (SAFE_CHARACTER.test(char) ? char : "_")).join("");
	const visible = replaced.replace(/^\.+/, "").slice(0, maxLength);
	return visible.length > 0 ? visible : FALLBACK_NAME;
}

/**
 * Turns an arbitrary, client-supplied file name into a name that is safe to store or serve.
 *
 * Path segments are removed, control characters and NUL are dropped, every character outside
 * `[A-Za-z0-9._-]` becomes `_`, leading dots are removed and the result is capped at 100
 * characters. An empty result becomes `"upload"`.
 */
export function sanitizeFileName(name: string): string {
	return toSafeName(withoutControlCharacters(lastPathSegment(name)), MAX_FILE_NAME_LENGTH);
}

/**
 * Builds a safe name whose extension is the detected one. The declared extension is discarded,
 * so `evil.php` uploaded as a PNG becomes `evil.png`.
 */
export function safeNameWithExtension(declaredName: string | undefined, extension: string): string {
	const segment = withoutControlCharacters(lastPathSegment(declaredName ?? ""));
	const dot = segment.lastIndexOf(".");
	const stem = dot > 0 ? segment.slice(0, dot) : segment;
	const maxStemLength = MAX_FILE_NAME_LENGTH - extension.length - 1;
	return `${toSafeName(stem, maxStemLength)}.${extension}`;
}
