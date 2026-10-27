export const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
export const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];
export const GIF89_HEADER = Array.from("GIF89a", (char) => char.charCodeAt(0));
export const PDF_HEADER = Array.from("%PDF-1.7\n", (char) => char.charCodeAt(0));
export const ZIP_HEADER = [0x50, 0x4b, 0x03, 0x04];
export const WEBP_HEADER = [
	...Array.from("RIFF", (char) => char.charCodeAt(0)),
	0x24,
	0x00,
	0x00,
	0x00,
	...Array.from("WEBP", (char) => char.charCodeAt(0)),
];

/** Builds a file of `size` bytes that starts with `header` and is zero-filled after it. */
export function fileWith(header: readonly number[], size: number): Uint8Array {
	const data = new Uint8Array(size);
	data.set(header.slice(0, size));
	return data;
}

export function ascii(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}
