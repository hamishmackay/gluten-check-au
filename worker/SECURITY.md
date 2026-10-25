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
