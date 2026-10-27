# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x     | :white_check_mark: |

Only the latest published 0.x release receives security fixes.

## Security Model

`@yedoma-labs/ysyk-upload-guard` inspects untrusted file uploads. It assumes:

- **File bytes** come from untrusted clients and are treated as hostile.
- **Client-declared MIME types and file names** are untrusted. They are compared or sanitized, never trusted.
- **Allowlists and size limits** are written by trusted developers.

The library identifies files by leading magic bytes only. It is **not** a malware scanner and does
not validate file structure beyond those signatures.

## Security Features

1. **No trust in client metadata**
   - The declared MIME type never decides acceptance. A mismatch is reported as `declaredMismatch`.
   - The stored extension always comes from the detected type.

2. **Fail-closed allowlist**
   - Detected types must appear in `allow`. An empty list rejects every file.

3. **Size limit before parsing**
   - `maxBytes` (default 5 MiB) is checked before any signature is read.
   - Empty files are rejected.

4. **Safe file names**
   - Path segments (`../`, `..\`, `/`, `\`) are removed.
   - Control characters and NUL are removed.
   - Characters outside `[A-Za-z0-9._-]` are replaced with `_`.
   - Leading dots are removed and names are capped at 100 characters.

5. **No ReDoS exposure**
   - Every regular expression is a single character class or an anchored, non-nested quantifier.

6. **No information leakage in errors**
   - Error messages are fixed strings. They never contain file bytes, stacks or paths.

7. **Zero runtime dependencies**
   - Nothing is loaded at runtime beyond the library itself.

## Known Limitations

- **Not a malware scan.** Valid-looking PDFs, ZIPs and images can contain harmful content.
- **Shallow checks.** Only the leading bytes are validated. Corrupt bodies pass.
- **Office and ZIP are not separated.** docx, xlsx and pptx are reported as `application/zip`.
- **Whole file in memory.** The caller must buffer the upload before inspection.

## Reporting Vulnerabilities

Please do not open a public issue for a suspected vulnerability. Report it privately through
GitHub Security Advisories on the repository (Security tab, "Report a vulnerability").

Please include:

- A description of the vulnerability
- Steps to reproduce, ideally with the input bytes and options used
- The potential impact
- A suggested fix, if you have one

We aim to respond within 48 hours and will coordinate disclosure.

## Security Best Practices

1. **Store files under server-chosen keys.** Use `safeName` only as a display name.
2. **Serve untrusted uploads as attachments** with `Content-Disposition: attachment` and a
   separate origin where possible.
3. **Limit body size at the edge** as well as in `maxBytes`, because `inspectUpload` only sees
   bytes that were already read into memory.
4. **Scan for malware separately** where the risk justifies it.

## Dependency Security

Run `npm audit` or `pnpm audit` regularly. The library has zero runtime dependencies.

## License

MIT. See [LICENSE](LICENSE) for details.
