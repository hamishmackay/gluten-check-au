# Automatic deeper product research — implementation plan

Status: PLANNED, not live. Current GitHub Pages app only queries Open Food Facts.

## User flow
1. Scan barcode and immediately show Open Food Facts evidence.
2. If ingredients, allergen declarations, or precautionary statements are missing, automatically request a deeper lookup from a backend.
3. Backend checks permitted retailer/manufacturer data sources and records provenance, dates and exact evidence.
4. Show the revised evidence without silently upgrading uncertain products to safe.
5. Only when online evidence is insufficient, offer an optional photo of the entire ingredient/allergen panel for automatic OCR (never require manual transcription).

## Safety
- RED if gluten/wheat/barley/rye/oats/malt or related risky terms occur in relevant evidence; distinguish 'gluten-free' claims from ingredient/warning mentions before classifying.
- AMBER if no detected risk but evidence is incomplete, conflicting, outdated or cannot be tied to current packaging.
- GREEN disabled until a validated, independently reviewed standard exists.
- Missing 'may contain' data is UNKNOWN, never equivalent to 'none'.
- Do not send product label images to AI services without clear disclosure/consent.
- Record source URL, retrieval timestamp, fields extracted, and evidence snippets.
- Never trust an AI-generated classification alone; use rule-based validation and independent test cases.

## Technical design
GitHub Pages is static. A backend (e.g. Cloudflare Worker or Supabase Edge Function) is needed for secrets, rate limiting, licensed retailer APIs and optional AI research/OCR.
Endpoint proposal: POST /api/product/deep-check with {barcode, observedProductName}.
Return: {barcode, sources:[{name,url,retrievedAt,ingredients,allergens,mayContain,confidence}], discrepancies:[], assessment:{status,reason}}.
Do not expose service API keys to the browser.
Do not scrape retailers in violation of access conditions. Check source licensing and permissions before integration.
Cache lookups with short expiry and allow invalidation when packaging changes.
No paid AI, subscriptions or live billing without explicit approval.

## Next implementation prerequisites
1. Choose and provision a backend project and hosting endpoint.
2. Identify an authorised second source with meaningful allergen coverage.
3. Implement source adapters, strict parsing and test fixtures for Australian products.
4. Add an automatic fallback call in the web app only after a working backend exists.
5. Run device tests, including vertically oriented EAN-13 barcodes and iPhone Safari.
