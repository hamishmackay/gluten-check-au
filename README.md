# Gluten Check AU

Gluten Check AU is a mobile-first Progressive Web App for Australian shoppers who need to avoid gluten. It helps users scan or lookup a product barcode, review the ingredient and allergen statements, and classify the product using a cautious Australian gluten-free assessment.

## Current priority

The immediate product priority is the core product safety experience:

- live barcode scanning on iPhone Safari
- manual barcode entry fallback
- product lookup with Open Food Facts
- ingredient, allergen declaration and precautionary statement review
- strict Australian gluten-free classification
- saved catalogue and search
- installable PWA for home-screen use

Payment, user accounts and subscriptions are deliberately planned as a second-phase layer after the safety tool is working reliably.

## Features

- Live barcode scanning using the phone camera with ZXing in the browser
- Manual barcode entry fallback
- Product lookup using Open Food Facts
- Product details for name, brand, barcode, ingredients, allergen wording and precautionary warnings
- Safety classification:
  - GREEN: explicit gluten-free claim confirmed by current packaging information and no conflicts
  - RED: gluten present or relevant may-contain clues such as wheat, barley, rye, oats, malt or relevant warnings
  - AMBER: missing, conflicting, outdated or insufficient information
- Saved product list stored locally on device
- Searchable product catalogue within saved items
- PWA installability with a home-screen icon and install prompt support
- GitHub Pages deployment with automated CI/CD

## Data sources and architecture

This initial version uses Open Food Facts as the primary product data source. The app is structured so additional retailers or data adapters can be added later without rewriting the product screen.

The data source layer is intentionally separated from the classification layer, allowing future support for Coles, Woolworths or retailer-specific feed providers while keeping the risk logic consistent.

## Strict safety approach

This app is intended for people following a strict gluten-avoidance plan.

- It does not assume a product is safe just because allergen information is absent.
- It treats uncertain or incomplete ingredient and allergen information as unsafe to rely on.
- It requires users to check their current packaging for final decisions.
- It is not a substitute for medical or food-safety advice.

## Development plan

### Phase 1: Core scanner and classification (current priority)

Deliver the core mobile experience first:

1. Barcode scan using the rear camera with a browser-compatible library such as ZXing.
2. Manual barcode input fallback.
3. Product lookup via Open Food Facts.
4. Display product name, brand, barcode, ingredients, allergen declarations and may-contain statements.
5. Apply strict Australian gluten classification with GREEN / RED / AMBER rules.
6. Save products locally and provide searchable saved catalogue.
7. Validate installability and GitHub Pages deployment.

This phase must be stable and tested before any user-account or payment work begins.

### Phase 2: Secure authentication with Supabase

After the scanner and classification are stable, add user accounts with Supabase.

Requirements:

- registration
- login
- logout
- password reset
- user profile records for account metadata
- production-safe session handling via Supabase Auth
- role-based gating for premium access
- environment-based configuration for development and production

Security rules:

- Never expose Supabase service-role keys in frontend code.
- Store credentials in environment variables only.
- Use server-side or secure Edge functions for privileged actions.
- Restrict database access using Row Level Security (RLS) policies.

### Phase 3: Subscription model with Stripe Billing (TEST MODE only)

Add subscription support only after the app is working reliably and the user-account layer is in place.

Requirements:

- Free tier for core product scanning and saved catalogue
- Premium tier for advanced access, if needed for future product features
- Stripe Billing in TEST MODE only
- no live Stripe API keys or live checkout activation
- server-side subscription verification before granting access
- billing status and cancellation support
- authorisation for selected test users to access premium features during development

Important constraints:

- Never expose Stripe secret keys or Supabase service-role keys in frontend code.
- No production payments are enabled without explicit approval.
- Do not use live Stripe keys in this repository.
- Do not charge real customers.

### Phase 4: Commercial launch gate (disabled by default)

Add a configuration switch to control future commercial launch.

Production launch flag:

- ENABLE_COMMERCIAL_LAUNCH=false by default

This switch must prevent checkout and subscription activation until an explicit production decision is made and credentials are verified.

## Authentication and subscription architecture

### Supabase auth

Use Supabase for:

- account creation
- login / logout
- password reset
- user session management
- secure account lookup and role metadata

Recommended approach:

- Browser uses Supabase anon/public key only for client-side auth flows.
- Server-side or Edge functions handle anything requiring trust, permissions or database writes.
- RLS policies protect user-owned records.

### Stripe Billing in TEST MODE

Use Stripe Billing only in test mode.

Required setup:

- Stripe test API keys only
- Stripe test products and prices
- test checkout sessions
- test webhook endpoints for subscription status updates
- server-side validation of subscription status with Stripe API

Security rules:

- Do not hardcode Stripe secret keys in frontend code.
- Do not use live keys, live products or live webhook endpoints.
- Treat all payment work as non-production until approval is given.

### Server-side entitlements

Entitlements must be verified on the server, not just in the browser.

Recommended logic:

1. User logs in via Supabase.
2. Server or Edge Function checks user subscription status from Stripe.
3. The server returns access status and plan details.
4. The client uses the server response to enable features.

This avoids browser tampering and ensures a user cannot bypass premium gating by editing client logic.

## Test-user access

During development, allow specifically authorised test accounts to access premium features while Stripe remains in TEST MODE.

This should be managed by:

- admin-controlled test user allowlisting
- secure server-side checks against Stripe test subscriptions
- a clearly labelled development-only entitlement override, not a production-ready commercial system

## Environment variables

Use environment variables for all secrets and credentials.

Example:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
STRIPE_SECRET_KEY=your-stripe-test-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-test-webhook-secret
STRIPE_PUBLISHABLE_KEY=your-stripe-test-publishable-key
ENABLE_COMMERCIAL_LAUNCH=false
```

Important:

- Frontend code should only use the public / anon keys.
- Secret keys and service-role keys belong in server-side or deployment environment variables only.
- Never commit secrets to the repository.

## Local environment setup

1. Install project dependencies:
   npm install
2. Configure environment variables in a local `.env` file or deployment secrets manager.
3. Enable Supabase auth for development users.
4. Create Stripe test products and prices.
5. Configure Stripe test webhooks.
6. Use test-only checkout flows.
7. Validate functions with development accounts only.

## Safe production migration checklist

The following steps are required before any production launch is considered:

1. Confirm the scanner and strict allergen classification are stable in the live app.
2. Verify the app works correctly on iPhone Safari and does not rely on unsupported browser APIs.
3. Confirm all authentication flows are secure and tested.
4. Set Stripe to TEST MODE and validate all flows with test data only.
5. Verify all server-side subscription checks are in place.
6. Review all environment variables and confirm secrets are not exposed.
7. Confirm the commercial launch switch is ENABLE_COMMERCIAL_LAUNCH=false unless explicitly approved.
8. Review accessibility, privacy, consent and compliance requirements.
9. Require explicit approval before enabling live Stripe keys or production payments.
10. Do not activate production payments without a direct user authorisation step.

## Important caution

This application is intended for strict gluten avoidance. It must not be treated as a guarantee of food safety. The classification logic must remain conservative and require users to check current packaging where information is unclear or incomplete.

The payment and subscription layer should never be introduced ahead of the core safety checks, and it must remain test-only until the commercial launch is explicitly authorised.

## Local development

1. Install dependencies:
   npm install
2. Start the app in development mode:
   npm run dev
3. Build the production bundle:
   npm run build
4. Run tests:
   npm test

## GitHub Pages deployment

The repository includes a GitHub Actions workflow that builds the app and deploys it to GitHub Pages.

1. Open the repository on GitHub.
2. Go to Settings > Pages.
3. Set the source to GitHub Actions.
4. Push to the main branch. The workflow will deploy automatically.

## Repository setup notes

- The repo is configured for a public GitHub Pages site.
- The app is designed primarily for iPhone Safari and installs as a Progressive Web App.
- No paid APIs or secret keys are required for the initial version.

## Limitations

- Open Food Facts data can be incomplete or outdated for some products.
- Barcode scans may fail if a product is not present in the database.
- Retailer-specific labels, current packaging changes and local manufacturing differences can affect final safety decisions.
- This app is a decision support tool, not a legal guarantee or a replacement for label reading.
