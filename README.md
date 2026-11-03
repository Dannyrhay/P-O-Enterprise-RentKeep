# RentKeep

Rental administration for P&O Enterprise in Ghana. RentKeep tracks rooms, tenancy terms, contacts, renewals, invoices, externally verified payments and receipts. Live accounting uses Ghana cedis (GHS) stored as integer pesewas. The four administrator slots are the primary administrator, Mum and two siblings. Each signs in with their own email. All four can administer records. Only the first two receive external renewal reminders.

## Deploy from GitHub to Netlify

1. Import this repository into Netlify and deploy the main branch. The root `netlify.toml` sets Node 24, the build command, the publish directory, the API and the scheduled function. A Netlify-provided HTTPS address is sufficient.
2. On a first deployment without sign-in configuration the site offers an explicitly fictional browser-local demo. You can use this to review the mobile interface immediately.
3. For shared records, follow [the live setup guide](DEPLOYMENT.md). Configure Supabase Auth, a PostgreSQL database and the four approved emails. Redeploy after setting build variables.
4. Verify the live acceptance checks in the guide before entering real tenant data. The GitHub repository contains deployable code and example configuration. Credentials, tenant records and provider accounts are provisioned separately.

## Workflows

- Add any number of rooms. Record tenant contacts, rental amount, billing period and a one-, two- or three-year tenancy. Inspect days remaining, edit terms and archive a departed tenant without deleting history.
- Renewing closes the old administrative record and opens the agreed new term immediately. Its start and end dates remain explicit. Historical invoices and receipts stay linked to the original tenancy.
- Create an invoice, verify receipt in the bank or mobile money account, and then record the amount received, date, method and external transaction reference. Each verified partial or full payment has its own printable or downloadable receipt. RentKeep never processes money.
- Review renewal notices in-app. The default windows are six and three calendar months before end. Configure push as primary and email as fallback. Tenant messaging is disabled.
- Shared-mode saves validate on the server. Concurrent edits refresh the stale view for review. A signed-in identity determines who verified a payment.
- The P&O opening animation respects reduced motion. Phone layouts use a bottom navigation bar and invoice cards.

## Local development

Use Node 24 and npm. Run `npm ci`, `npm start`, then open the local address printed by Vite. The default development mode is the fictional demo. No secrets are needed. The original demo data key is supported. Historical invoices retain their denomination, including any old demo “units”.

Run `npm test` for domain, authorization and PostgreSQL-backed transaction tests. Run `npm run build` for a static bundle or set `VITE_RENTKEEP_MODE=live` to build the connected interface. The live interface calls same-origin Netlify Functions. A plain static file server cannot provide those APIs.

## Source orientation

The React interface and shared date/payment logic are in `src/`. The business commands, authorization, transactional persistence and reminder delivery are in `backend/`. Netlify handlers are in `netlify/functions/`. Review the [verification record](VERIFICATION.md) for tested behavior and remaining deployment gates.

Use Graft in local structural mode (`DO_NOT_TRACK=1`). Run `graft build .`, `graft map .`, `graft ask recordPayment --source` or `graft callers recordPayment`. Refresh the graph after code changes. No deep mode is needed.
