import pg from "pg";
import { z } from "zod";
const roles = ["You", "Mum", "Sibling 1", "Sibling 2"];
export function administrators(env = process.env) {
  const raw = (env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase());
  if (
    raw.length !== 4 ||
    new Set(raw).size !== 4 ||
    raw.some((x) => !z.email().safeParse(x).success)
  )
    throw Error("Configure four distinct administrator emails.");
  return raw.map((email, i) => ({
    id: email,
    name: roles[i],
    email,
    notify: i < 2,
  }));
}
export async function authenticate(
  request,
  admins,
  env = process.env,
  fetcher = fetch,
) {
  const token = request.headers.get("authorization");
  if (!token?.startsWith("Bearer ") || token.length > 12000)
    throw Object.assign(Error("Sign in to continue."), { status: 401 });
  const url = new URL("/auth/v1/user", env.SUPABASE_URL);
  if (url.protocol !== "https:") throw Error("Configure HTTPS authentication.");
  const response = await fetcher(url, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: token },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok)
    throw Object.assign(Error("Sign in again to continue."), {
      status: response.status >= 500 ? 503 : 401,
    });
  const user = await response.json();
  const admin =
    user.email_confirmed_at &&
    admins.find((a) => a.email === user.email?.toLowerCase());
  if (!admin)
    throw Object.assign(
      Error("This account does not have administrator access."),
      { status: 403 },
    );
  return admin;
}
let pool;
export function database() {
  if (!process.env.DATABASE_URL) throw Error("Database connection is missing.");
  const connection = new URL(process.env.DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(connection.protocol))
    throw Error("Expected a PostgreSQL connection.");
  // pg otherwise lets URL SSL options override certificate verification.
  for (const key of [...connection.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("ssl"))
      connection.searchParams.delete(key);
  }
  return (pool ??= new pg.Pool({
    connectionString: connection.href,
    max: 2,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 15000,
    ssl: {
      rejectUnauthorized: true,
      ...(process.env.DATABASE_CA
        ? { ca: process.env.DATABASE_CA.replaceAll("\\n", "\n") }
        : {}),
    },
  }));
}
