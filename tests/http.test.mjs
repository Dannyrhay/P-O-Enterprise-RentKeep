import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { handleApi } from "../netlify/functions/api.mjs";
import { administrators } from "../backend/runtime.js";
test("HTTP boundary denies anonymous requests, enforces account scope, and restores saved records", async () => {
  const admins = administrators({
    ADMIN_EMAILS: "a@example.com,b@example.com,c@example.com,d@example.com",
  });
  const db = new PGlite();
  try {
    await db.exec(
      await readFile(new URL("../backend/schema.sql", import.meta.url), "utf8"),
    );
    const deps = {
      getAdmins: () => admins,
      getDatabase: () => ({
        connect: async () => ({ query: db.query.bind(db), release() {} }),
      }),
      verify: async (req) => {
        if (req.headers.get("Authorization") !== "Bearer fixture")
          throw Object.assign(Error("Sign in."), { status: 401 });
        return admins[2];
      },
    };
    const call = (route, body, token = true) =>
      handleApi(
        new Request("https://rentkeep.invalid/api/" + route, {
          method: body ? "POST" : "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: "Bearer fixture" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        }),
        deps,
      );
    assert.equal((await call("workspace", null, false)).status, 401);
    const initial = await call("workspace");
    assert.match(initial.headers.get("cache-control"), /no-store/);
    assert.equal((await initial.json()).actor.name, "Sibling 1");
    assert.equal((await call("device", {})).status, 403);
    assert.equal((await call("commands", { data: { rooms: [] } })).status, 400);
    const operation = {
      revision: 0,
      requestId: crypto.randomUUID(),
      action: { type: "room", data: { name: "Review room", note: "Test" } },
    };
    assert.equal((await call("commands", operation)).status, 200);
    assert.equal(
      (await call("commands", { ...operation, requestId: crypto.randomUUID() }))
        .status,
      409,
    );
    const restored = new PGlite({ loadDataDir: await db.dumpDataDir() });
    try {
      const {
        rows: [row],
      } = await restored.query("SELECT revision,data FROM rentkeep.workspace");
      assert.equal(row.revision, 1);
      assert.equal(row.data.rooms[0].name, "Review room");
      assert.equal(
        (await restored.query("SELECT actor FROM rentkeep.operations")).rows[0]
          .actor,
        admins[2].id,
      );
    } finally {
      await restored.close();
    }
  } finally {
    await db.close();
  }
});
