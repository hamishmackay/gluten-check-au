# Validation status — 25 October 2026

Not complete. Do not promote this draft to production.

- Local rule, parser, rendering and security suite: 16 passed.
- First GitHub Actions unit-test run: passed (run 40177610628).
- Live Worker-handler test against actual upstream websites: 1/4 acceptance products
  returned accepted manufacturer declarations on the recorded run. The test exited 1.
- `9556041613354`: exact barcode found in AYAM's retrieved product container at
  https://ayam.com/products/noodles/product/rice-flake-noodles-200g ; extracted
  white rice (90%), water; gluten-free claim; gluten not detected. Duplicate canonical
  URLs were subsequently deduplicated.
- `9556041610841`: database identified Thai Green Curry Sauce; automatic discovery
  and manufacturer catalog traversal did not yield accepted product-page declarations.
  A separate targeted rerun with the revised traversal also returned no accepted pages.
  A similarly named 195g curry **paste** cannot substitute for this 200g **sauce**.
- `9316401203164`: no database identity or accepted exact-barcode product page found.
  The previous user-photo hardcoded result has been removed; variants are not guessed.
- `9348219002738`: database returned rolled oats, 600g, with oats in ingredients.
  Assessment remains RED; accepted manufacturer/retailer page evidence was not found.
- Public discovery probes: DuckDuckGo challenge; Google HTTP 429; Bing empty or
  irrelevant responses on some queries. UPCitemdb free trial returned HTTP 429 for
  all four probes and has NOT been integrated as a reliable provider.
- Local browser execution could not start: Chromium missing, and Playwright browser
  download returned an invalid/truncated archive. A real browser test is included in
  CI. GitHub run 40177815269 subsequently PASSED both the 16-test suite and
  Chromium browser checks (controlled API fixtures: lookup, source links, ingredient
  display, preferences, save and mobile layout). Real-product browser display and
  physical camera hardware are still unverified.
- Preview deployment run 40177607860 failed before deployment: both CF_TOKEN and
  CF_ACCOUNT were empty. Required repository Actions secrets are
  CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. The production /health URL also
  returned HTTP 403 from this environment; production availability is not established.

## Remaining gates

1. Fix discovery and barcode identity coverage for the remaining three products using
   actual publicly retrievable pages or a reliable permitted discovery service. This
   remains implementation work, independently of the deployment credentials.
2. Pass `npm run test:live` with all four products and preserve the printed evidence.
3. Pass browser tests and review the actual evidence display, then test camera scanning
   on an iPhone. Scanner functions were retained, but hardware has not been exercised.
4. Verify reachability of the existing native Cloudflare preview and rerun the
   live acceptance test against its real endpoint. Builds alone do not satisfy this.
5. Only after all gates pass, review the PR and promote the reviewed frontend/Worker.

## Deployment correction

Subsequent inspection of GitHub check runs confirmed the user's existing native
Cloudflare Workers Builds integration. Commit abeedd136977e5c56cd0eba9fb9323636d2d32d7
has a successful `Workers Builds: gluten-check-au-research` check, with version
b47f601d-89b7-43af-8a42-949719a8d09a and a feature-branch preview alias. The missing
GitHub secrets blocked only the redundant Actions deployment route introduced by
this PR. They are NOT prerequisites for the existing native Cloudflare build route.
The redundant feature deployment job has been removed; unit/browser CI remains.
The live preview and production health URLs still returned HTTP 403 from this
execution environment; this alone does not establish whether Cloudflare access
configuration or the execution network caused it. No access control was weakened.
The three product discovery gaps remain independently unresolved.

## Continued development and live access verification

- GitHub run 40179333803 called the real native Cloudflare preview successfully.
  The API returned HTTP 200 and actual product research, so earlier execution-host
  HTTP 403 responses are not a deployment-credential prerequisite.
- That deployed run still passed only Rice Flake Noodles and failed the other three.
- Subsequent local real-upstream run found an exact-GTIN Woolworths oats page with
  ingredients and `Contains: Gluten`, bringing local coverage to 2/4. Curry sauce
  and Bhuja remain unresolved. This is not a four-product pass.
- Added GTIN contradiction rejection, HTTP-200 screening detection, filtering of
  unsupported links before result limits, concurrent discoveries and source-attempt
  diagnostics. The current local deterministic suite has 19 passing tests.
- Added reproducible static preview assets using the same-origin API, an incomplete
  research banner and a source digest. GitHub checks wait for the exact source digest
  before real browser/API tests, rather than treating a successful build as proof.
- The new real-browser job records screenshots and JSON from actual API calls.
  Any failed acceptance product keeps that job red; no successful clearance is faked.
