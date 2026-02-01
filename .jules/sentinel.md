# Sentinel Journal - Security Learnings

- **Regex-only Sanitization**: Content scripts must avoid using `innerHTML` for sanitization as it introduces XSS risks. Use a regex-based approach instead: `str.replace(/<\/?[^>]+(>|$)/g, "")`.
- **Hardened CSP**: Always remove `'unsafe-inline'` from `style-src` in `manifest.json` for extension pages to prevent CSS injection attacks.
- **Data URI Validation**: When converting `data URI` to `Blob`, validate that it starts with `data:image/` to prevent execution of malicious payloads.
- **Icon CSP Compatibility**: When using `lucide-react` with strict CSP, use `absoluteStrokeWidth={true}` to prevent the library from injecting inline styles.
- **IndexedDB Robustness**: Always add `onerror` handlers to Promises wrapping IndexedDB requests to prevent hangs that can be exploited for DoS or cause UI freezes.
