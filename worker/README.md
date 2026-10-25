# Gluten Check AU — research service (phase 1)

This Cloudflare Worker implements a barcode-based, source-attributed product research API.

## Endpoints
- `GET /health` — health and configured sources
- `GET /api/products/{barcode}` — product, assessment, source provenance, provider errors

## Current capability
- Open Food Facts barcode lookup with explicit provenance.
- Optional **approved manufacturer/retailer JSON feed** configured with `APPROVED_PRODUCT_FEED_URL` (HTTPS only).
- Cautious classification: a gluten-free claim is **CLAIM**, not automatically certified GREEN. Conflicting ingredients or warnings override the claim to AMBER; a risk without a claim is RED.
- Missing records remain AMBER. No silent assumption of gluten safety.
- Does **not** claim to scrape Coles, Woolworths, or manufacturer sites; no such integrations are active until approved data sources are connected.

## Deploy
1. Create a Cloudflare account and obtain an account ID and Workers edit API token.
2. Add GitHub Actions secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.
3. Run the **Deploy research API** GitHub Actions workflow (or `cd worker && npx wrangler deploy`).
4. Confirm `https://gluten-check-au-research.<your-subdomain>.workers.dev/health`.
5. Add the full deployed Worker origin (no trailing slash) to the frontend `RESEARCH_API_BASE` setting in `index.html` and deploy the page.
6. To enable a legally usable supplier feed, set `APPROVED_PRODUCT_FEED_URL` as a Worker variable to an approved HTTPS JSON source matching the example below.

Example feed:
```json
{"1234567890123":{"name":"Example","brand":"Example","glutenFreeClaim":true,"claimUrl":"https://example.com/product","ingredients":"rice flour, salt","allergens":"","traces":"","source":"Manufacturer","updated":"2026-10-25"}}
```

**Important:** A feed entry must be independently validated to match the exact barcode. No invented product records. Do not use arbitrary web search snippets to issue a GREEN result.
