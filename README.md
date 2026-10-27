# @yedoma-labs/ysyk-upload-guard

Zero-dependency upload inspection for JavaScript and TypeScript. It identifies files by their
magic bytes, enforces a type allowlist and a size limit, and turns client-supplied file names
into safe ones.

Upload middleware such as Multer trusts the client's `mimetype` header and the file extension.
Both can be forged. This library reads the file's leading bytes instead, and treats the declared
type and name only as hints.

> **Warning: magic-byte checks are not malware scanning.**
> This library confirms that a file has the structure of an allowed type. It does not inspect the
> content for malicious payloads, and a valid PDF, ZIP or image can still contain harmful data.
> Use an antivirus or sandbox scan where that risk matters. Never serve uploads from the same
> origin as your application, and always send `Content-Disposition: attachment` for untrusted files.

## Features

- Detects PNG, JPEG, GIF, WebP, PDF and ZIP from their signatures
- Allowlist of accepted types, with fail-closed behavior for an empty list
- Size limit (default 5 MiB), checked before any content is inspected
- Client MIME type is compared, flagged as `declaredMismatch`, and never trusted
- Safe file names: path segments, control characters and unsafe characters are removed
- Uses only `Uint8Array` APIs and no Node.js built-ins, so it should run on Bun, Deno and edge runtimes. The test suite runs on Node.js only
- No runtime dependencies

## Installation

```sh
pnpm add @yedoma-labs/ysyk-upload-guard
```

Requires Node.js 20 or newer, or another runtime with `Uint8Array`.

## Usage

```ts
import { inspectUpload } from "@yedoma-labs/ysyk-upload-guard";

const result = inspectUpload({
  data: bytes, // Uint8Array or Buffer
  declaredMimeType: "image/png", // from the client, only compared
  declaredName: "../../holiday photo.png", // from the client, sanitized
  allow: ["image/png", "image/jpeg"],
  maxBytes: 2 * 1024 * 1024, // optional, default 5 MiB
});

if (result.ok) {
  // result.mimeType     "image/png"
  // result.extension    "png"
  // result.safeName     "holiday_photo.png"
  // result.declaredMismatch  true if the client's MIME type differed
} else {
  // result.code     "EMPTY" | "TOO_LARGE" | "UNSUPPORTED_TYPE" | "NOT_IN_ALLOWLIST"
  // result.message  fixed text, safe to show to users
}
```

### API

| Export | Description |
| --- | --- |
| `inspectUpload(options)` | Full check: empty, size, magic bytes, allowlist, safe name. Returns a result object and does not throw for bad input. |
| `sniffFileType(bytes)` | Low-level detection. Returns `{ mimeType, extension }` or `undefined`. |
| `sanitizeFileName(name)` | Sanitizes a name without any type check. |
| `SUPPORTED_MIME_TYPES` | The list of detectable MIME types. |
| `DEFAULT_MAX_UPLOAD_BYTES` | The default limit, `5 * 1024 * 1024`. |

The checks run in this order: `EMPTY`, `TOO_LARGE`, `UNSUPPORTED_TYPE`, `NOT_IN_ALLOWLIST`.
Size is checked before sniffing, so oversized input is never inspected.

### Error codes

| Code | Meaning |
| --- | --- |
| `EMPTY` | The file has zero bytes. |
| `TOO_LARGE` | The file is larger than `maxBytes`. |
| `UNSUPPORTED_TYPE` | The bytes match no known signature, or the file is truncated. |
| `NOT_IN_ALLOWLIST` | The detected type is valid but not in `allow`. An empty `allow` rejects every file. |

`MIME_MISMATCH` is not an error. When the client's declared MIME type differs from the detected
one, the successful result has `declaredMismatch: true`.

### Supported types

| MIME type | Extension | Signature |
| --- | --- | --- |
| `image/png` | `png` | `89 50 4E 47 0D 0A 1A 0A` at offset 0 |
| `image/jpeg` | `jpg` | `FF D8 FF` at offset 0 |
| `image/gif` | `gif` | `GIF87a` or `GIF89a` at offset 0 |
| `image/webp` | `webp` | `RIFF` at offset 0 and `WEBP` at offset 8 |
| `application/pdf` | `pdf` | `%PDF-` at offset 0 |
| `application/zip` | `zip` | `50 4B 03 04` at offset 0 |

Office documents (docx, xlsx, pptx) are ZIP containers. They are reported as `application/zip`
and cannot be told apart from plain archives. Use `allow` to decide whether ZIP-based files are
accepted at all.

## Framework examples

### Express with Multer (memory storage)

Multer's `memoryStorage` keeps the file in `req.file.buffer`. Set the size limit in Multer too, so
oversized uploads are cut off before they fill memory.

```ts
import express from "express";
import multer from "multer";
import { inspectUpload } from "@yedoma-labs/ysyk-upload-guard";

const app = express();
const MAX_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

app.post("/avatar", upload.single("avatar"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const result = inspectUpload({
    data: req.file.buffer,
    declaredMimeType: req.file.mimetype,
    declaredName: req.file.originalname,
    allow: ["image/png", "image/jpeg"],
    maxBytes: MAX_BYTES,
  });

  if (!result.ok) {
    res.status(result.code === "TOO_LARGE" ? 413 : 415).json({
      code: result.code,
      message: result.message,
    });
    return;
  }

  // Store under the server-chosen key, never under the client's name.
  // Use result.safeName only as a display name or as a suffix.
  const storageKey = `${crypto.randomUUID()}.${result.extension}`;
  // await storage.put(storageKey, req.file.buffer, { contentType: result.mimeType });
  res.status(201).json({ key: storageKey, mimeType: result.mimeType });
});
```

### Next.js Route Handler (raw body)

This handler accepts the file as the raw request body, with the file's type in `Content-Type`
and an optional name in an `X-File-Name` header. The body is read with `request.arrayBuffer()`.

```ts
// app/api/upload/route.ts
import { inspectUpload } from "@yedoma-labs/ysyk-upload-guard";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  // Reject oversized bodies early, before buffering them.
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BYTES) {
    return Response.json({ code: "TOO_LARGE" }, { status: 413 });
  }

  const data = new Uint8Array(await request.arrayBuffer());

  const result = inspectUpload({
    data,
    declaredMimeType: request.headers.get("content-type") ?? undefined,
    declaredName: request.headers.get("x-file-name") ?? undefined,
    allow: ["image/png", "image/jpeg", "image/webp"],
    maxBytes: MAX_BYTES,
  });

  if (!result.ok) {
    return Response.json(
      { code: result.code, message: result.message },
      { status: result.code === "TOO_LARGE" ? 413 : 415 },
    );
  }

  return Response.json({ mimeType: result.mimeType, safeName: result.safeName }, { status: 201 });
}
```

The `content-length` check is a hint. A client can omit or lie about it, so `inspectUpload` still
enforces `maxBytes` on the bytes actually read. Configure a platform-level body size limit as well
if your host offers one.

## Limitations

- Only the first bytes are checked. A file with a valid header and a broken body is accepted.
- PDF and other signatures must start at offset 0. Files with leading junk are rejected.
- Polyglot files (valid as two formats at once) are not detected.
- SVG, HTML and other active formats are not in the table, so they are always rejected.
- The whole file must be in memory as a `Uint8Array`.

## Development

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## License

MIT. See [LICENSE](LICENSE).
