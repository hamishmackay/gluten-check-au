# Page-evidence research (feature branch; acceptance not yet passed)

`GET /api/products/{barcode}` returns the database identity, retrieved page declarations,
source URLs, match basis, retrieval time, rule-based assessment and source failures.

The backend performs barcode discovery followed by brand/name/pack-size discovery. It
also follows configured manufacturer catalog structures. The AYAM HikaShop adapter
checks the actual barcode-bearing product container and extracts description and
nutrition/ingredient tabs, excluding recipes and menus. No individual product result
is hardcoded. Other pages require a single Product JSON-LD record with matching GTIN,
or a product heading with barcode in the product body, or brand + name + known pack
size. Search excerpts never count as evidence. Missing pack size cannot be guessed.

Discovery uses public DuckDuckGo HTML with Bing HTML fallback, not Bing RSS. These
services may challenge or return irrelevant/empty results. This is a material reliability
limitation, not a configured guaranteed search service. The supported source-host list
in `research.js` restricts fetched product pages to known manufacturer/retailer sites.
Catalog configuration is in `catalogs.js`; unsupported stores remain unsupported.
Redirects, response sizes, HTTPS destinations and fetch timeouts are bounded. Rendering
escapes source text and only permits HTTPS links. Sites returning 403/429 or challenges
remain unavailable; no bypass proxies, AI API, paid search API or credentials are used.

Claims remain CLAIM, never GREEN. Ingredient/warning risks override preferences;
claim/risk conflicts remain AMBER. Oats are treated conservatively. Missing warnings
remain unknown. “Gluten not detected” is displayed according to the existing strict,
gluten-avoidance and reduced-gluten choices without certification.

## Test and deploy

From repository root: `npm test`; `npm run test:live` exercises the real Worker handler
against external sources and fails if any of the four acceptance products lacks a
retrieved declaration. `RESEARCH_API_BASE=https://... npm run test:live` checks an
actual deployed endpoint and checks the shared UI renderer includes the evidence links
and excerpts for all preferences. These rendering assertions are not a physical-camera
or on-device Safari test.

The feature push workflow tests, then attempts an isolated preview Worker deployment.
It requires existing GitHub secrets `CLOUDFLARE_API_TOKEN` (Workers edit) and
`CLOUDFLARE_ACCOUNT_ID`. It fails explicitly if either is missing and then runs the
live acceptance gate against the deployed preview. Production Pages remains on main;
no production-complete claim is justified by a preview build or unit tests alone.

Public discovery has no availability guarantee. Do not merge/promote while the four
live acceptance products fail. An unavailable upstream does not mean gluten-free.
