# Research controls

Current code uses a public IP rate limiter (10 requests/minute), not Supabase JWT
sign-in. `ENABLE_PUBLIC_API` must be `true`; missing limiter fails closed. No paid
search or AI service is configured. Secrets belong in GitHub/Cloudflare settings,
never frontend files. Feature workflow deploys a separate preview Worker.

Search results supply candidate URLs only. Actual product pages must pass identity
checks. Known manufacturer/retailer hosts are allowed; schemes, credentials, ports,
IP literals, redirects, body sizes and timeouts are checked. No authentication-wall
or anti-bot bypass is implemented. Missing declarations and inaccessible pages cannot
produce a safe clearance. Source HTML is escaped before rendering.

Limitations: IP rate limiting is not a durable daily quota. Free public discovery is
unreliable. Ingredient/declaration extraction is conservative and incomplete for
JavaScript-only pages. Name/size matches are weaker than exact GTIN and are labelled.
No laboratory, current-pack or certification verification is performed. Physical
barcode camera behavior still needs device testing after a reviewed deployment.

## Label-photo fallback

Images and OCR text are handled locally in the page and a browser Web Worker. There
is no image-upload or OCR-text endpoint. Tesseract.js is pinned and downloaded lazily
from its public CDN; that is executable third-party dependency code, not a remote OCR
service. Photos/text are not saved to localStorage or the product cache. Blob URLs
are revoked on reset/page exit, recognition is bounded by a timeout, and workers are
terminated on cancellation or a new lookup. Photo text is escaped before display.

OCR can omit a negation or a whole warning. Its confidence value is a recognition
quality measure, not safety probability. Positive photo text never issues a verified
or GREEN result; existing web/database risks remain. A mismatching readable barcode
is flagged and the photo is not treated as evidence for the selected product.
