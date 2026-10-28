import { safeNameWithExtension } from "./file-name.js";
import { type MimeKey, sniffFileType } from "./signatures.js";

export const DEFAULT_MAX_UPLOAD_BYTES: number = 5 * 1024 * 1024;

export type UploadErrorCode = "EMPTY" | "TOO_LARGE" | "UNSUPPORTED_TYPE" | "NOT_IN_ALLOWLIST";

export interface InspectUploadOptions {
	/** Raw file bytes. A Node `Buffer` is accepted because it extends `Uint8Array`. */
	readonly data: Uint8Array;
	/** MIME type sent by the client. It is only compared, never trusted. */
	readonly declaredMimeType?: string;
	/** File name sent by the client. It is sanitized, never used as a path. */
	readonly declaredName?: string;
	/** Detected types that are accepted. An empty list rejects every file. */
	readonly allow: readonly MimeKey[];
	/** Maximum accepted size in bytes. Defaults to 5 MiB. */
	readonly maxBytes?: number;
}

export interface InspectUploadSuccess {
	readonly ok: true;
	/** Type detected from the bytes. */
	readonly mimeType: MimeKey;
	/** Extension matching the detected type, without a leading dot. */
	readonly extension: string;
	/** Sanitized file name that ends in `extension`. */
	readonly safeName: string;
	/**
	 * True when the client-declared MIME type differs from the detected one.
	 * This is a hint only and does not affect `ok`.
	 */
	readonly declaredMismatch: boolean;
}

export interface InspectUploadFailure {
	readonly ok: false;
	readonly code: UploadErrorCode;
	/** Fixed, human-readable text. It never contains file content. */
	readonly message: string;
}

export type InspectUploadResult = InspectUploadSuccess | InspectUploadFailure;

const MESSAGES: Readonly<Record<UploadErrorCode, string>> = {
	EMPTY: "The file is empty.",
	TOO_LARGE: "The file exceeds the maximum allowed size.",
	UNSUPPORTED_TYPE: "The file type could not be identified as a supported type.",
	NOT_IN_ALLOWLIST: "The file type is not allowed.",
};

function fail(code: UploadErrorCode): InspectUploadFailure {
	return { ok: false, code, message: MESSAGES[code] };
}

/** Lowercases the value, strips parameters such as `; charset=...` and maps `image/jpg`. */
function normalizeMimeType(value: string): string {
	const base = (value.split(";")[0] ?? "").trim().toLowerCase();
	return base === "image/jpg" ? "image/jpeg" : base;
}

/**
 * Inspects an uploaded file. The checks run in this order: empty, size, magic bytes,
 * allowlist. The client-declared MIME type and name are used only as hints, and the
 * returned `safeName` always carries the detected extension.
 *
 * @throws {RangeError} when `maxBytes` is not a positive safe integer (a programming error).
 */
export function inspectUpload(options: InspectUploadOptions): InspectUploadResult {
	const maxBytes = options.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
	if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
		throw new RangeError("maxBytes must be a positive safe integer");
	}

	const { data } = options;
	if (data.byteLength === 0) {
		return fail("EMPTY");
	}
	if (data.byteLength > maxBytes) {
		return fail("TOO_LARGE");
	}

	const detected = sniffFileType(data);
	if (detected === undefined) {
		return fail("UNSUPPORTED_TYPE");
	}
	// Entries are normalized like the declared type, so a JavaScript caller that lists
	// "image/jpg" still accepts JPEG files instead of rejecting them silently.
	const allowed = options.allow.map(normalizeMimeType);
	if (!allowed.includes(detected.mimeType)) {
		return fail("NOT_IN_ALLOWLIST");
	}

	const declared = normalizeMimeType(options.declaredMimeType ?? "");
	return {
		ok: true,
		mimeType: detected.mimeType,
		extension: detected.extension,
		safeName: safeNameWithExtension(options.declaredName, detected.extension),
		declaredMismatch: declared !== "" && declared !== detected.mimeType,
	};
}
