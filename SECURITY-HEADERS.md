# HTTP security headers

The HTML pages already provide a restrictive Content Security Policy and a
strict referrer policy. GitHub Pages does not support repository-defined custom
response headers. The live response should additionally be protected at the
CDN/proxy layer with:

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
X-Frame-Options: DENY
```

Do not enable HSTS `preload` until every subdomain is permanently available via
HTTPS. When Cloudflare proxies the domain, these values can be added with one
Response Header Transform Rule.
