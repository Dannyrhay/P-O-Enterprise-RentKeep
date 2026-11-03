import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { administrators, database } from "./runtime.js";
const hash = (s) => createHash("sha256").update(s).digest("hex");
const fail = () =>
  Object.assign(Error("Sign in to continue."), { status: 401 });
const cookie = "__Host-rentkeep";
const token = (req) =>
  req.headers
    .get("cookie")
    ?.match(/(?:^|; )__Host-rentkeep=([\w-]{43})(?:;|$)/)?.[1];
export function credentials(env = process.env) {
  const admins = administrators(env),
    hashes = JSON.parse(env.ADMIN_KEY_HASHES || "{}");
  if (
    Object.keys(hashes).length !== 4 ||
    new Set(Object.values(hashes)).size !== 4 ||
    !admins.every((a) => /^[a-f0-9]{64}$/.test(hashes[a.email]))
  )
    throw Error("Configure four distinct administrator key hashes.");
  return hashes;
}
export function makeAuth(db = database, keys = credentials) {
  const verify = async (req, admins) => {
    const t = token(req);
    if (!t) throw fail();
    const row = (
      await db().query(
        "SELECT account,key_hash FROM rentkeep.sessions WHERE digest=$1 AND expires_at>now()",
        [hash(t)],
      )
    ).rows[0];
    const actor =
      row &&
      admins.find(
        (a) => a.email === row.account && keys()[a.email] === row.key_hash,
      );
    if (!actor) throw fail();
    return actor;
  };
  const respond = (value, maxAge) =>
    new Response(null, {
      status: 204,
      headers: {
        "Set-Cookie":
          cookie +
          "=" +
          value +
          "; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=" +
          maxAge,
        "Cache-Control": "no-store",
      },
    });
  const route = async (req, path) => {
    if (
      req.method !== "POST" ||
      req.headers.get("origin") !== new URL(req.url).origin
    )
      return new Response(null, { status: 403 });
    if (path === "/api/logout") {
      const t = token(req);
      if (t)
        await db().query("DELETE FROM rentkeep.sessions WHERE digest=$1", [
          hash(t),
        ]);
      return respond("", 0);
    }
    if (!req.headers.get("content-type")?.startsWith("application/json"))
      return new Response(null, { status: 415 });
    let data;
    try {
      data = await req.json();
    } catch {
      return new Response(null, { status: 400 });
    }
    const email = String(data?.email || "")
        .trim()
        .toLowerCase(),
      key = String(data?.key || ""),
      hashes = keys();
    const known = Object.hasOwn(hashes, email),
      expected = known ? hashes[email] : "0".repeat(64);
    if (
      !timingSafeEqual(Buffer.from(expected), Buffer.from(hash(key))) ||
      !known ||
      !/^[\w-]{43}$/.test(key)
    )
      throw fail();
    const t = randomBytes(32).toString("base64url");
    await db().query("DELETE FROM rentkeep.sessions WHERE expires_at<=now()");
    await db().query(
      "INSERT INTO rentkeep.sessions(digest,account,key_hash,expires_at) VALUES($1,$2,$3,now()+interval '12 hours')",
      [hash(t), email, expected],
    );
    return respond(t, 43200);
  };
  return { verify, route };
}
