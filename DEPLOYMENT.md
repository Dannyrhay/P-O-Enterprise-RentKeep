# Live deployment

Use a separate production Netlify site and Supabase project for P&O Enterprise. Deploy the repository root. Netlify applies the build settings in netlify.toml. Use the generated HTTPS domain as the sign-in redirect until you have a custom domain.

## Database and access

1. Create PostgreSQL in the Supabase project. In its SQL editor run [backend/schema.sql](backend/schema.sql) as the owner. Alternatively, set a one-time migration owner's DATABASE_URL locally and run `npm run db:migrate`. The private rentkeep schema must not be exposed through the Supabase Data API.
2. Create a dedicated LOGIN role named rentkeep_app with a generated password. Give it no ownership, superuser, role-creation or bypass-RLS privileges. Run [backend/privileges.sql](backend/privileges.sql) as the owner. This permits app updates, append-only audit inserts, and device/delivery operations. Keep the owner's connection out of the application environment.
3. Use the provider's **session-mode pooler** connection URI for rentkeep_app. The reminder scheduler uses a session-scoped advisory lock. Transaction-mode pooling is unsuitable. Use the provider's CA certificate when needed. Certificate verification stays enabled.
4. In Supabase Auth, enable email sign-in and **disable new public sign-ups**. Provision and verify the four individual accounts with the owners. Configure a real SMTP sender for sign-in emails. Set the Site URL and exact permitted redirect URL to the production Netlify origin. Restrict redirect URLs to the actual site.
5. Configure the following Netlify environment variables. Scope server credentials to Functions and production. Do not reuse production credentials in untrusted pull-request previews. The two VITE_SUPABASE variables are intentionally public. Never prefix a database password, Resend secret, provider private key or service-role key with VITE_.

| Name | Scope | Value |
| --- | --- | --- |
| VITE_RENTKEEP_MODE | Build | live (repository default on Netlify) |
| VITE_SUPABASE_URL | Build | Production project HTTPS URL |
| VITE_SUPABASE_PUBLISHABLE_KEY | Build | Supabase publishable client key |
| SUPABASE_URL | Functions | Same project URL |
| SUPABASE_PUBLISHABLE_KEY | Functions | Same publishable key |
| DATABASE_URL | Functions | Dedicated runtime role's PostgreSQL session-pooler URI |
| DATABASE_CA | Functions, if needed | PEM certificate, actual newlines or escaped newlines |
| ADMIN_EMAILS | Functions | Exactly four distinct verified emails, in order: primary, Mum, sibling one, sibling two |

6. Redeploy. Four approved accounts have equal access to the single shared rental workspace. The backend checks every request with the configured Supabase Auth service and its own account allowlist. Removing a user's address from the list revokes API access after configuration takes effect. The first two positions control external reminder eligibility. Role labels are visible in the UI; the server also records the actual verifying account on each payment. The live database starts empty and never imports demo records.

The browser only stores the sign-in session in live mode. Tenant and financial records are loaded from the authenticated API. UI reads refresh on focus and periodically outside forms. Saves use a revision check and operation ID. Financial transactions, receipt assignment and audit entries commit together. PostgreSQL stores the small team's aggregate as JSONB behind a row lock. Reconsider storage granularity if the workspace grows substantially.

## Phone reminders and email

Generate a VAPID key pair on a trusted administrator machine (the installed web-push CLI provides generate-vapid-keys). Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT in Functions. The subject should be the real operator's mailto address. Set RESEND_API_KEY and EMAIL_FROM to a restricted sending key and verified sender. These are separate from the SMTP settings used for sign-in.

On the published HTTPS app, the first two administrators sign in on their own phones, enable reminders in Settings, then register the device and grant notification permission. On iPhone use a supported iOS release and the installed Home Screen app. Check both the iPhone and Android while the app is closed. The sibling accounts have full record access and in-app reminders without device registration or external notifications.

Netlify's scheduled function checks the current tenancy dates and reminder windows every 15 minutes on a published site. Pending events are keyed per recipient, tenancy, end date and window. The worker handles one due event per invocation, suppresses obsolete renewals, tries push first, and uses email if enabled and push is unavailable or rejected. A successful provider response records acceptance, not device delivery or proof of reading. A process crash after provider acceptance can cause a retry. Email requests use provider idempotency keys. Failed events retry hourly for up to 24 attempts. Monitor failed or overdue events through rentkeep.deliveries and Netlify function logs. After resolving a provider problem, the operator can requeue a failed event after checking its acceptance history.

## Backups and acceptance

Enable the database provider's backups and select retention and recovery objectives with the business owner. Periodically export an encrypted PostgreSQL backup with a backup role, for example `pg_dump --format=custom --schema=rentkeep --file=rentkeep.dump` with normal secure PG connection settings. Restore into a new isolated database with `pg_restore --no-owner --no-acl --dbname=<isolated-db> rentkeep.dump`. Reapply runtime grants. Keep secrets out of shell history. Keep notifications disabled on restored copies. A browser JSON export is a readable export, not a complete database backup.

Before real use verify four real logins, denial of a fifth account, shared updates from two phones, conflicts on simultaneous changes, and a partial payment with the correct receipt after a reload. Test archive and renewal, export/print, and restore of the database including balances and the audit log. Confirm push acceptance and actual delivery to both recipient devices, then exercise email fallback. Confirm company identifiers, invoice and receipt wording, accounting treatment and retention requirements with P&O's Ghana adviser. Amounts use GHS and two decimal places; dates are calendar dates using Ghana's UTC day boundary.

Official references: [Netlify scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/), [Supabase passwordless email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Supabase authenticated user lookup](https://supabase.com/docs/reference/javascript/auth-getuser), [Resend email API](https://resend.com/docs/api-reference/emails/send-email).
