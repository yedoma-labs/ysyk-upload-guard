/** MIME types this library can identify from their leading bytes. */
export const SUPPORTED_MIME_TYPES = [
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
	"application/pdf",
	"application/zip",
] as const;

export type MimeKey = (typeof SUPPORTED_MIME_TYPES)[number];

export interface SniffedFileType {
	readonly mimeType: MimeKey;
	readonly extension: string;
}

/** Bytes that must appear at a fixed offset of the file. */
export interface SignaturePart {
	readonly offset: number;
	readonly bytes: readonly number[];
}

/** A file matches a signature when every part matches. */
export interface Signature extends SniffedFileType {
	readonly parts: readonly SignaturePart[];
}

function ascii(text: string): number[] {
	return Array.from(text, (char) => char.charCodeAt(0));
}

/**
 * Signature table. Order does not matter because no two entries can match the same file:
 * the entries are disjoint by their leading bytes, and WebP requires both RIFF and WEBP.
 *
 * Office formats (docx, xlsx, pptx, ...) are ZIP containers and are reported as
 * `application/zip`. They are not told apart from plain ZIP archives.
 */
export const SIGNATURES: readonly Signature[] = [
	{
		mimeType: "image/png",
		extension: "png",
		parts: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
	},
	{
		mimeType: "image/jpeg",
		extension: "jpg",
		parts: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
	},
	{
		mimeType: "image/gif",
		extension: "gif",
		parts: [{ offset: 0, bytes: ascii("GIF87a") }],
	},
	{
		mimeType: "image/gif",
		extension: "gif",
		parts: [{ offset: 0, bytes: ascii("GIF89a") }],
	},
	{
		mimeType: "image/webp",
		extension: "webp",
		parts: [
			{ offset: 0, bytes: ascii("RIFF") },
			{ offset: 8, bytes: ascii("WEBP") },
		],
	},
	{
		mimeType: "application/pdf",
		extension: "pdf",
		parts: [{ offset: 0, bytes: ascii("%PDF-") }],
	},
	{
		mimeType: "application/zip",
		extension: "zip",
		parts: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
	},
];

function matchesPart(data: Uint8Array, part: SignaturePart): boolean {
	if (part.offset + part.bytes.length > data.length) {
		return false;
	}
	return part.bytes.every((expected, index) => data[part.offset + index] === expected);
}

/**
 * Identifies a file from its leading bytes. Returns `undefined` for unknown or truncated input.
 * The declared name and client MIME type are never consulted.
 */
export function sniffFileType(bytes: Uint8Array): SniffedFileType | undefined {
	for (const signature of SIGNATURES) {
		if (signature.parts.every((part) => matchesPart(bytes, part))) {
			return { mimeType: signature.mimeType, extension: signature.extension };
		}
	}
	return undefined;
}
