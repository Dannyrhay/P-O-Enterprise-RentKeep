import { database, administrators } from "../../backend/runtime.js";
import { snapshot } from "../../backend/store.js";
import { enqueue, dispatch } from "../../backend/notifications.js";
export default async function run() {
  const db = await database().connect();
  try {
    const {
      rows: [lock],
    } = await db.query("SELECT pg_try_advisory_lock(78294501) AS held");
    if (!lock.held) return;
    try {
      const admins = administrators(),
        { data } = await snapshot(db, admins);
      await enqueue(db, data, admins);
      await dispatch(db, data, admins);
    } finally {
      await db.query("SELECT pg_advisory_unlock(78294501)");
    }
  } finally {
    db.release();
  }
}
export const config = { schedule: "*/15 * * * *" };
