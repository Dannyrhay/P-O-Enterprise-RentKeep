# Deploy RentKeep on Railway

Use one Railway project with **two services**: RentKeep (web interface, same-origin API, sign-in and reminder worker) and PostgreSQL (durable shared records). No Netlify, Render, Supabase or external sign-in service is required. Web Push uses the recipients' browser push networks; email fallback is optional. This path starts with an empty workspace. It does not read or migrate demo records from devices.

## 1. Database

Create a Railway project, add PostgreSQL with a persistent volume, and keep both services in the same environment. From the checked-out repository root, connect an interactive **psql** session as the database owner using Railway's PostgreSQL Connect instructions. With the Railway CLI linked to this project, `railway connect Postgres` can open the local psql client. Apply the following in that session (file paths are local to psql):

```sql
\set ON_ERROR_STOP on
\i backend/schema.sql
CREATE ROLE rentkeep_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
\password rentkeep_app
\i backend/privileges.sql
```

Generate a random database-role password in a password manager and enter it at the hidden prompt. On upgrades, skip role creation and password setup; reapply schema and grants before deploying the new app. Enable volume backups with appropriate retention. Test restoring into a separate database; clear restored sessions and disable reminders there. Never point preview environments at production records. If moving existing live records, stop writes and the old scheduler, take a backup, restore and verify balances and receipts before switching traffic. Do not copy authentication sessions.

## 2. App and four administrators

Add a service from this GitHub repository, select main, and use the repository root. Railway reads railway.toml and builds the Dockerfile. In Networking, generate a public HTTPS domain (target the service's PORT; Railway supplies PORT). Use a single always-on replica; **disable serverless sleeping** so reminder checks continue while nobody visits. There is no separate worker to deploy. An initial unconfigured deployment can fail; apply all variables and redeploy.

For phone setup, set RENTKEEP_SETUP_ONLY=true, generate the HTTPS domain and deploy. Only the key setup page is enabled. Each sibling opens it, generates a key there or in their password manager (43 random letters and digits), and saves it under the RentKeep domain. The Save button uses the device credential API where supported; otherwise add the login manually. Each sibling sends the owner **only their email and verification hash** via a trusted channel. Confirm whose hash you received. Set the four hashes below, remove RENTKEEP_SETUP_ONLY and redeploy to enable the workspace and reminders. The generator works locally on the device, does not register accounts and does not retain keys. In normal operation it remains available from the sign-in screen. To replace an existing key, repeat this process for that account and redeploy the new hash.

Alternatively, on a trusted local machine with Node, run this command **once per administrator**:

```sh
node scripts/admin-key.mjs
```

Each run prints a new, random 256-bit private sign-in key and its SHA-256 verification hash. Give only that person's key to them using a password manager's secure share. They use their exact approved email and key in the app; there is no emailed invitation or public registration. Keep keys out of Git, support messages and deploy logs. The app verifies key possession, not mailbox ownership. For a lost key generate a new pair, replace only that email's hash and redeploy. Its old key and active sessions cease working. Browser sessions last 12 hours; signing out revokes the current session. Provision the real credentials yourself; none ship in this repo.

**Set these variables on the app service:**

| Variable | Value |
| --- | --- |
| DATABASE_URL | Private connection URI using the **rentkeep_app** role and its password. Example shape: `postgresql://rentkeep_app:ENCODED_PASSWORD@postgres.railway.internal:5432/railway`. Copy the actual private host, port and database name from your database service. URL-encode the password. Do not use the owner URL as the runtime credential. |
| DATABASE_SSL | `railway-private` only for the private Railway network. This uses private networking without PostgreSQL-level TLS. On other hosts certificate verification remains mandatory; supply DATABASE_CA if necessary. |
| ADMIN_EMAILS | Four distinct emails separated by commas: primary administrator, Mum, sibling one, sibling two. All four can administer records. Only the first two receive external reminders. |
| ADMIN_KEY_HASHES | JSON object mapping those four lowercase email addresses to their four verification hashes. Example shape: `{"one@example.org":"HASH1","two@example.org":"HASH2","three@example.org":"HASH3","four@example.org":"HASH4"}`. Replace every placeholder. |
| PUBLIC_ORIGIN | Optional if using Railway's generated domain (RAILWAY_PUBLIC_DOMAIN). For a custom domain, set its full HTTPS origin, then use that exact address for sign-in and all edits. |

Keep variables private to the production environment. Redeploy and open the generated domain. A ready deployment responds at /healthz only when the session table is readable. The live app has no offline demo fallback. Records and audit history persist in PostgreSQL across app redeploys.

## 3. Background reminders

Generate VAPID keys locally with the installed web-push CLI (`npx --no-install web-push generate-vapid-keys` after npm ci). Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT (operator's mailto address) on the app; keep this key pair stable. For optional email fallback, set RESEND_API_KEY and EMAIL_FROM for a verified sender. Redeploy. In Settings enable the intended channels. Primary and Mum must each sign in over HTTPS on their phone, register that device and grant permission. On iPhone use the installed Home Screen app. The other two admins have in-app reminders.

The app checks on startup and every 15 minutes. PostgreSQL stores due events, attempts and provider acceptance; a database lock prevents simultaneous workers. One pending event is processed per check; a backlog can delay delivery. Keep a single active production scheduler, check service logs and monitor rentkeep.deliveries for failed or overdue entries. Delivery can be delayed by a phone or its push provider. Only a real-device test confirms receipt.

## 4. Before real tenant data

Sign in as each administrator; try a wrong key, sign out, and confirm the workspace is inaccessible. On two devices, enter a fictional room and payment and verify the balance and receipt after refresh and after an app redeploy. Test renewal, the audit trail and a backup restore. Test actual background push with both recipient phones closed and optional email fallback. Do not enable sleeping. The repository tests cover API and data behavior; they do not provision Railway, validate your live credentials or guarantee notification delivery.

Railway references: [PostgreSQL](https://docs.railway.com/guides/postgresql), [public networking](https://docs.railway.com/guides/public-networking), [configuration as code](https://docs.railway.com/reference/config-as-code).
