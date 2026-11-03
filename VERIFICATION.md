# Verification record

Checked 3 November 2026. The local checks cover a release candidate for deployment. The live Netlify environment, four real sign-ins and actual phone and email delivery require acceptance on the deployed site.

## Checks completed

- Nine automated tests passed using Node 24. Tests cover calendar thresholds, leap dates, four-account allowlisting, verified identity, overpayment and unverified-payment rejection, partial receipts, duplicate references, idempotent request replay, stale revision rejection, archived history, recipient deduplication, obsolete reminders and push endpoint restrictions.
- The HTTP handler was exercised with fixture identities and a PostgreSQL-compatible PGlite database. Anonymous access, unauthorized device registration and malformed commands were denied. A data-directory backup restored the test record, revision and audit actor in a fresh database.
- Both the standalone demo build and Netlify live build succeeded. The live build was checked with and without public auth configuration. Without configuration, visitors see a setup message and can explicitly open a fictional local demo.
- The official Netlify function packager bundled the shared-record API and the scheduled renewal function. No site was deployed as part of these checks.
- Browser review covered Overview, Rooms & tenants, Payments, Reminders and Settings at 320, 390, 768, 1024 and 1440 CSS pixels. No page overflowed horizontally. The phone tenancy dialog fit the viewport and closed by keyboard. No page runtime errors occurred in this review.
- The earlier browser workflow checks exercised partial payment, receipt download, persistence, search, reminder settings and two-year renewal. The new backend tests separately exercise those financial and tenancy rules.
- The P&O splash is limited to the first visit in a tab and respects reduced motion. Navigation, form controls and room tiles provide hover or keyboard focus feedback as appropriate.
- npm audit reported zero known vulnerabilities in the audited dependency tree. Security review covered server-verified identity and role checks, parameterized database queries, certificate verification, archive-only record history, append-only audit grants, payload validation, recipient restrictions, same-origin bearer APIs, private/no-store API responses and static response security headers.

## Before live tenant data

Follow [DEPLOYMENT.md](DEPLOYMENT.md). Real identity-provider email, deployed cross-device access, actual push and fallback email delivery, provider backup recovery, and the final business wording of Ghana invoices and receipts must be verified by the operator. A provider acceptance response does not verify delivery to a handset. This review was not an independent penetration test.

## Railway release

The Railway production frontend built successfully on Node 24. All ten automated tests passed, including a real loopback HTTP server backed by an in-process PostgreSQL engine: four sign-ins, cross-account shared data, denial of anonymous and unapproved access, cross-origin write rejection, logout and key rotation. The production dependency audit returned zero known vulnerabilities. A browser check exercised key generation and verification hashing without printing credentials. Password-manager integration depends on browser support and still needs verification on the actual phones.

The Railway container has not been deployed or tested against a live Railway database. Docker Desktop's engine was unavailable locally. Before entering real data, follow RAILWAY.md to validate the image, database grants, backups, cross-device access, and background push on both phones. Current login is email plus a high-entropy key, not mailbox verification or invitation-based onboarding. Review the global login throttle (per replica), single-row workspace write contention, one-reminder-per-check throughput, and actual delivery monitoring before expanding beyond the family workspace.
