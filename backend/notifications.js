import { z } from "zod";
import webpush from "web-push";
import { createHash } from "node:crypto";
import { reminder, shiftMonths, today } from "../src/domain.js";

export function validateSubscription(raw) {
  const sub = z
    .object({
      endpoint: z.url().max(4096),
      keys: z.object({
        auth: z.string().regex(/^[\w-]{22}$/),
        p256dh: z.string().regex(/^[\w-]{87}$/),
      }),
    })
    .parse(raw);
  const url = new URL(sub.endpoint);
  const allowed = [
    "fcm.googleapis.com",
    "updates.push.services.mozilla.com",
    "web.push.apple.com",
    "notify.windows.com",
  ];
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    !allowed.some(
      (host) => url.hostname === host || url.hostname.endsWith("." + host),
    )
  )
    throw Error("Unrecognised push service.");
  return sub;
}
export async function enqueue(db, state, admins, now = today()) {
  for (const tenancy of state.tenancies) {
    if (
      tenancy.archived ||
      tenancy.end < now ||
      !reminder(tenancy, state.settings.months, now)
    )
      continue;
    const window = state.settings.months
      .filter((m) => shiftMonths(tenancy.end, -m) <= now)
      .sort((a, b) => a - b)[0];
    for (const person of admins.filter((a) => a.notify)) {
      const key = createHash("sha256")
        .update(JSON.stringify([tenancy.id, tenancy.end, window, person.id]))
        .digest("hex");
      await db.query(
        "INSERT INTO rentkeep.deliveries(event_key,recipient,tenancy_id,end_date,window_months) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
        [key, person.email, tenancy.id, tenancy.end, window],
      );
    }
  }
}
export async function deliver(db, event, settings, env = process.env) {
  const payload = JSON.stringify({
    title: "RentKeep renewal reminder",
    body: "A tenancy needs review. Open RentKeep for details.",
  });
  if (
    settings.push &&
    env.VAPID_PRIVATE_KEY &&
    env.VAPID_PUBLIC_KEY &&
    env.VAPID_SUBJECT
  ) {
    const { rows } = await db.query(
      "SELECT subscription FROM rentkeep.devices WHERE account=$1 LIMIT 2",
      [event.recipient],
    );
    for (const { subscription } of rows) {
      try {
        await webpush.sendNotification(
          validateSubscription(subscription),
          payload,
          {
            timeout: 7000,
            TTL: 86400,
            topic: event.event_key.slice(0, 32),
            vapidDetails: {
              subject: env.VAPID_SUBJECT,
              publicKey: env.VAPID_PUBLIC_KEY,
              privateKey: env.VAPID_PRIVATE_KEY,
            },
          },
        );
        return "push";
      } catch (e) {
        if ([404, 410].includes(e.statusCode))
          await db.query("DELETE FROM rentkeep.devices WHERE endpoint=$1", [
            subscription.endpoint,
          ]);
      }
    }
  }
  if (settings.email && env.RESEND_API_KEY && env.EMAIL_FROM) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.RESEND_API_KEY,
        "Content-Type": "application/json",
        "Idempotency-Key": event.event_key,
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [event.recipient],
        subject: "RentKeep renewal reminder",
        text: "A tenancy needs review. Sign in to your RentKeep workspace for the details.",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) return "email";
  }
  throw Error("No provider accepted the reminder.");
}
export async function dispatch(db, state, admins, sender = deliver) {
  const { rows } = await db.query(
    "SELECT * FROM rentkeep.deliveries WHERE status='pending' AND next_attempt<=now() ORDER BY next_attempt LIMIT 1",
  );
  for (const event of rows) {
    const latest =
      (await db.query("SELECT data FROM rentkeep.workspace WHERE singleton"))
        .rows[0]?.data || state;
    const tenancy = latest.tenancies.find((t) => t.id === event.tenancy_id);
    const date =
      typeof event.end_date === "string"
        ? event.end_date
        : event.end_date.toISOString().slice(0, 10);
    const currentWindow =
      tenancy &&
      latest.settings.months
        .filter((m) => shiftMonths(tenancy.end, -m) <= today())
        .sort((a, b) => a - b)[0];
    if (
      !admins.some((a) => a.notify && a.email === event.recipient) ||
      !tenancy ||
      tenancy.archived ||
      tenancy.end !== date ||
      tenancy.end < today() ||
      currentWindow !== event.window_months
    ) {
      await db.query(
        "UPDATE rentkeep.deliveries SET status='superseded' WHERE event_key=$1",
        [event.event_key],
      );
      continue;
    }
    try {
      const channel = await sender(db, event, latest.settings);
      await db.query(
        "UPDATE rentkeep.deliveries SET status='accepted',channel=$2,accepted_at=now(),attempts=attempts+1 WHERE event_key=$1",
        [event.event_key, channel],
      );
    } catch {
      await db.query(
        "UPDATE rentkeep.deliveries SET attempts=attempts+1,next_attempt=now()+interval '1 hour',status=CASE WHEN attempts>=23 THEN 'failed' ELSE 'pending' END WHERE event_key=$1",
        [event.event_key],
      );
    }
  }
}
