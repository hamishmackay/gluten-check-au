# Security and cost controls — launch gate

## Current state
- The research API is **disabled by default**: ENABLE_PUBLIC_API must be exactly `true` to enable lookups.
- Deployment is **manual** via GitHub Actions workflow_dispatch.
- No paid third-party AI or retailer API integration is configured.
- No user authentication, enforceable rate limiting, or per-user quota is implemented.
- The frontend has no deployed research API URL configured.
- The /health endpoint is public but does not call product sources.

## Before enabling public API
1. Create Cloudflare account on **Workers Free**; do not add a paid plan or payment method unless deliberately approved.
2. Set Cloudflare account-level security and alerts; check current Free plan quotas and behavior in the dashboard.
3. Implement user authentication and **server-side** access checks (do not embed shared bearer tokens in public JavaScript).
4. Add per-user quotas and edge rate limiting; limits must account for distributed abuse. Do not assume rate limiting alone is an absolute spend cap.
5. Cache product lookups and use a source request budget with fail-closed handling.
6. Review privacy, logging and data retention.
7. Test invalid barcodes, replay, bypass attempts, rate limits and provider outages.
8. Only after review set ENABLE_PUBLIC_API=true and configure RESEARCH_API_BASE in index.html.
9. Never put API tokens, secrets or paid vendor credentials in public GitHub or GitHub Pages.
10. Do not activate paid services without an explicit owner-approved budget and a provider-enforced spend cap.

Copying this public repository does **not** grant access to Cloudflare or GitHub secrets. A public endpoint, once enabled, can be called directly regardless of whether someone copies the repository.
