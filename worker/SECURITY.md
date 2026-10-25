# Security and cost controls — launch gate

## Current state
- The research API is **disabled by default**: ENABLE_PUBLIC_API must be exactly `true` to enable lookups.
- Deployment is **manual** via GitHub Actions workflow_dispatch.
- No paid third-party AI or retailer API integration is configured.
- Product endpoint now requires a valid Supabase **ES256** access JWT and a configured Cloudflare rate-limiter binding (10 requests per minute per authenticated user). Both fail closed if unconfigured. This is code only until redeployed and tested.
- **No daily per-user quota or absolute third-party spending cap is implemented yet.** Cloudflare rate limiting is not a guaranteed exact quota; additional protection is required before launch.
- The frontend has no deployed research API URL configured.
- The /health endpoint is public but does not call product sources.

## Before enabling public API
1. Create Cloudflare account on **Workers Free**; do not add a paid plan or payment method unless deliberately approved.
2. Set Cloudflare account-level security and alerts; check current Free plan quotas and behavior in the dashboard.
3. Create a Supabase project using asymmetric **ES256** JWT signing keys. Configure the Worker's `SUPABASE_URL` as `https://<project-ref>.supabase.co`. The Worker validates signature, issuer, audience, role and expiry; no shared secret is placed in public JavaScript. Test a valid user token and invalid/expired tokens.
4. Verify the Cloudflare rate limiter binding deploys successfully and rejects bursts. Implement **durable daily per-user quotas** (e.g. Durable Objects) and a global upstream request budget. Limits must account for distributed abuse. Do not assume rate limiting alone is an absolute spend cap.
5. Cache product lookups and use a source request budget with fail-closed handling.
6. Review privacy, logging and data retention.
7. Test invalid barcodes, replay, bypass attempts, rate limits and provider outages.
8. Only after review set ENABLE_PUBLIC_API=true and configure RESEARCH_API_BASE in index.html.
9. Never put API tokens, secrets or paid vendor credentials in public GitHub or GitHub Pages.
10. Do not activate paid services without an explicit owner-approved budget and a provider-enforced spend cap.

Copying this public repository does **not** grant access to Cloudflare or GitHub secrets. A public endpoint, once enabled, can be called directly regardless of whether someone copies the repository.

## Current deployment caution
The Cloudflare dashboard has a production variable `ENABLE_PUBLIC_API=false` and both Worker URLs disabled. Keep them that way. Repository `wrangler.toml` also declares the flag false, which can override dashboard vars on subsequent deploys. GitHub integration may trigger deployments automatically; verify Cloudflare build settings before relying on manual-only deployment.

## Remaining setup
- Supply a Supabase project URL (not a secret); set up signup/signin on the frontend and securely pass a user's access JWT in the Authorization header.
- Implement daily quota and cache before enabling the product endpoint.
- Test the Worker deployment with URLs disabled and confirm syntax/build success.
- Keep Cloudflare Free and no paid third-party providers until an explicit budget is approved.
