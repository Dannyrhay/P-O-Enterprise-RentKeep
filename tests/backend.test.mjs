import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { administrators, authenticate } from "../backend/runtime.js";
import { writeCommand, snapshot } from "../backend/store.js";
import {
  enqueue,
  dispatch,
  validateSubscription,
} from "../backend/notifications.js";
import { today, shiftMonths } from "../src/domain.js";

const env = {
  ADMIN_EMAILS:
    "one@example.com,mum@example.com,three@example.com,four@example.com",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "test",
};
const admins = administrators(env),
  actor = admins[3];
const db = new PGlite();
const request = (revision, type, data, id = null) => ({
  revision,
  requestId: crypto.randomUUID(),
  action: { type, id, data },
});
before(async () => {
  await db.exec(
    await readFile(new URL("../backend/schema.sql", import.meta.url), "utf8"),
  );
});
after(() => db.close());
test("identity requires verified provider response and one of four allowed accounts", async () => {
  assert.throws(() =>
    administrators({
      ...env,
      ADMIN_EMAILS: "a@b.test,a@b.test,c@b.test,d@b.test",
    }),
  );
  const req = new Request("https://demo.invalid/api/workspace", {
    headers: { Authorization: "Bearer example" },
  });
  const mock = (email) => async () =>
    Response.json({ email, email_confirmed_at: new Date().toISOString() });
  for (const a of admins)
    assert.equal(
      (await authenticate(req, admins, env, mock(a.email))).name,
      a.name,
    );
  await assert.rejects(
    authenticate(req, admins, env, mock("other@example.com")),
    (e) => e.status === 403,
  );
  await assert.rejects(
    authenticate(req, admins, env, async () =>
      Response.json({ email: actor.email }),
    ),
    (e) => e.status === 403,
  );
  await assert.rejects(
    authenticate(
      req,
      admins,
      env,
      async () => new Response(null, { status: 401 }),
    ),
    (e) => e.status === 401,
  );
  await assert.rejects(
    authenticate(new Request(req.url), admins, env, mock(actor.email)),
    (e) => e.status === 401,
  );
});
test("database transaction, stale writes, duplicate receipts, identity and renewal history", async () => {
  const start = await snapshot(db, admins);
  assert.equal(start.data.rooms.length, 0);
  assert.equal(start.data.settings.currency, "GHS");
  let v = 0;
  const change = async (type, data, id) => {
    const r = await writeCommand(db, admins, actor, request(v, type, data, id));
    v = r.revision;
    return r;
  };
  const added = await change("room", { name: "Test room", note: "" }),
    roomId = added.data.rooms[0].id;
  await assert.rejects(
    writeCommand(
      db,
      admins,
      actor,
      request(0, "room", { name: "Conflict", note: "" }),
    ),
    (e) => e.status === 409,
  );
  const tenancy = {
    name: "Demo Tenant",
    roomId,
    email: "tenant@example.com",
    phone: "",
    start: shiftMonths(today(), -10),
    term: 1,
    rent: "1200",
    frequency: "year",
  };
  const record = await change("tenancy", tenancy);
  const tenancyId = record.data.tenancies[0].id;
  await assert.rejects(change("tenancy", tenancy), /unavailable/);
  const inv = await change("invoice", {
    tenancyId,
    description: "Annual rent",
    amount: "1200",
    due: today(),
  });
  const invoiceId = inv.data.invoices[0].id;
  const payment = {
    amount: "500",
    reference: "BANK-EXAMPLE",
    method: "Bank transfer",
    date: today(),
    verified: true,
    admin: "Mum",
  };
  await assert.rejects(
    change("payment", { ...payment, verified: false }, invoiceId),
  );
  await assert.rejects(
    change("payment", { ...payment, amount: "1200.01" }, invoiceId),
  );
  const pay = request(v, "payment", payment, invoiceId),
    result = await writeCommand(db, admins, actor, pay);
  v = result.revision;
  assert.equal(result.data.payments[0].admin, "Sibling 2");
  assert.equal(result.data.payments[0].verifiedBy, actor.id);
  assert.equal(result.data.payments[0].amount, 50000);
  assert.equal(
    (await writeCommand(db, admins, actor, pay)).data.payments.length,
    1,
  );
  await assert.rejects(writeCommand(db, admins, admins[0], pay), /reused/);
  await assert.rejects(
    change("payment", payment, invoiceId),
    /already recorded/,
  );
  await assert.rejects(change("delete", {}, invoiceId));
  assert.equal((await snapshot(db, admins)).revision, v);
  await enqueue(db, result.data, admins);
  await enqueue(db, result.data, admins);
  const events = await db.query("SELECT * FROM rentkeep.deliveries");
  assert.equal(events.rows.length, 2);
  assert.deepEqual(
    events.rows.map((e) => e.recipient).sort(),
    admins
      .slice(0, 2)
      .map((a) => a.email)
      .sort(),
  );
  const r = await change(
    "renew",
    { start: shiftMonths(today(), 3), term: 2 },
    tenancyId,
  );
  assert.equal(r.data.tenancies.filter((t) => t.archived).length, 1);
  assert.equal(r.data.payments.length, 1);
  await dispatch(db, r.data, admins, async () => {
    throw Error("should be cancelled");
  });
  await dispatch(db, r.data, admins, async () => {
    throw Error("should be cancelled");
  });
  assert.ok(
    (await db.query("SELECT status FROM rentkeep.deliveries")).rows.every(
      (e) => e.status === "superseded",
    ),
  );
  assert.equal(
    (await db.query("SELECT * FROM rentkeep.operations")).rows.length,
    v,
  );
});
test("push endpoints cannot target arbitrary or local services", () => {
  const keys = { auth: "a".repeat(22), p256dh: "b".repeat(87) };
  for (const endpoint of [
    "http://127.0.0.1",
    "https://fcm.googleapis.com.evil.test/send/x",
    "https://user@fcm.googleapis.com:123/x",
  ])
    assert.throws(() => validateSubscription({ endpoint, keys }));
  assert.equal(
    validateSubscription({
      endpoint: "https://web.push.apple.com/example",
      keys,
    }).keys.auth,
    keys.auth,
  );
});
