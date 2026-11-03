import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { administrators } from "../backend/runtime.js";
import { makeAuth, credentials } from "../backend/railway-auth.js";
import { createApp } from "../railway-server.mjs";
test("Railway HTTP: four identities share persisted records, enforce origin, revoke on logout and rotation", async () => {
  const pg = new PGlite();
  await pg.exec(
    await readFile(new URL("../backend/schema.sql", import.meta.url), "utf8"),
  );
  const db = () => ({
    query: pg.query.bind(pg),
    connect: async () => ({ query: pg.query.bind(pg), release() {} }),
  });
  const emails = ["one", "two", "three", "four"].map(
      (x) => x + "@example.test",
    ),
    keys = emails.map(() => randomBytes(32).toString("base64url"));
  const hashes = Object.fromEntries(
    emails.map((e, i) => [
      e,
      createHash("sha256").update(keys[i]).digest("hex"),
    ]),
  );
  const env = {
    ADMIN_EMAILS: emails.join(","),
    ADMIN_KEY_HASHES: JSON.stringify(hashes),
  };
  const origin = "https://rent.example",
    app = createApp({
      origin,
      db,
      getAdmins: () => administrators(env),
      auth: makeAuth(db, () => credentials(env)),
    });
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + app.address().port;
  const post = (path, data, cookie = "", o = origin) =>
    fetch(base + "/api/" + path, {
      method: "POST",
      headers: { origin: o, cookie, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  const get = (cookie) =>
    fetch(base + "/api/workspace", { headers: { cookie } });
  try {
    assert.equal((await fetch(base + "/healthz")).status, 200);
    assert.equal((await get("")).status, 401);
    assert.equal(
      (
        await post(
          "login",
          { email: emails[0], key: keys[0] },
          "",
          "https://other.test",
        )
      ).status,
      403,
    );
    assert.equal(
      (await post("login", { email: "outside@example.test", key: keys[0] }))
        .status,
      401,
    );
    const cookies = [];
    for (let i = 0; i < 4; i++) {
      const res = await post("login", { email: emails[i], key: keys[i] });
      assert.equal(res.status, 204);
      const h = res.headers.get("set-cookie");
      assert.match(h, /Secure; HttpOnly; SameSite=Strict/);
      cookies.push(h.split(";")[0]);
      assert.equal(
        (await (await get(cookies[i])).json()).actor.email,
        emails[i],
      );
    }
    assert.equal(
      (
        await post(
          "commands",
          {
            requestId: crypto.randomUUID(),
            revision: 0,
            action: { type: "room", data: { name: "Shared test", note: "" } },
          },
          cookies[2],
        )
      ).status,
      200,
    );
    assert.equal(
      (await (await get(cookies[0])).json()).data.rooms[0].name,
      "Shared test",
    );
    assert.equal((await post("logout", {}, cookies[1])).status, 204);
    assert.equal((await get(cookies[1])).status, 401);
    env.ADMIN_KEY_HASHES = JSON.stringify({
      ...hashes,
      [emails[0]]: "b".repeat(64),
    });
    assert.equal((await get(cookies[0])).status, 401);
  } finally {
    await new Promise((r) => app.close(r));
    await pg.close();
  }
});
