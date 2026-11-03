import { z } from "zod";
import {
  administrators,
  authenticate,
  database,
} from "../../backend/runtime.js";
import { snapshot, writeCommand } from "../../backend/store.js";
import { validateSubscription } from "../../backend/notifications.js";
const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });
const envelope = z.object({
  requestId: z.uuid(),
  revision: z.number().int().nonnegative(),
  action: z.object({
    type: z.string().max(20),
    id: z.string().max(64).nullable().optional(),
    data: z.record(z.string(), z.unknown()),
  }),
});
export async function handleApi(
  req,
  {
    getDatabase = database,
    getAdmins = administrators,
    verify = authenticate,
  } = {},
) {
  let db;
  try {
    const admins = getAdmins(),
      actor = await verify(req, admins);
    const path = new URL(req.url).pathname.split("/").pop();
    if (req.method === "GET" && path === "workspace") {
      db = await getDatabase().connect();
      return json({
        ...(await snapshot(db, admins)),
        actor,
        delivery: {
          push: Boolean(
            process.env.VAPID_PUBLIC_KEY &&
            process.env.VAPID_PRIVATE_KEY &&
            process.env.VAPID_SUBJECT,
          ),
          email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
          publicKey: process.env.VAPID_PUBLIC_KEY || "",
        },
      });
    }
    if (req.method !== "POST" || !["commands", "device"].includes(path))
      return json({ error: "Unknown operation." }, 404);
    if (!req.headers.get("content-type")?.startsWith("application/json"))
      return json({ error: "Expected JSON." }, 415);
    const text = await req.text();
    if (text.length > 24000) return json({ error: "Request too large." }, 413);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: "Invalid JSON." }, 400);
    }
    if (path === "device") {
      if (!actor.notify)
        return json(
          {
            error:
              "External reminders are limited to the first two administrators.",
          },
          403,
        );
      let subscription;
      try {
        subscription = validateSubscription(body);
      } catch {
        return json({ error: "Invalid device subscription." }, 400);
      }
      db = await getDatabase().connect();
      await db.query(
        "INSERT INTO rentkeep.devices VALUES($1,$2,$3) ON CONFLICT(endpoint) DO UPDATE SET account=EXCLUDED.account,subscription=EXCLUDED.subscription",
        [subscription.endpoint, actor.id, JSON.stringify(subscription)],
      );
      return json({ ok: true });
    }
    const parsed = envelope.safeParse(body);
    if (!parsed.success) return json({ error: "Invalid command." }, 400);
    db = await getDatabase().connect();
    return json(await writeCommand(db, admins, actor, parsed.data));
  } catch (e) {
    const known = e.status || (!e.code && db ? 422 : 503);
    return json(
      {
        error:
          known === 503
            ? "Service configuration or connection unavailable."
            : e.message,
      },
      known,
    );
  } finally {
    db?.release();
  }
}
export default function handler(req) {
  return handleApi(req);
}
export const config = { path: "/api/*" };
