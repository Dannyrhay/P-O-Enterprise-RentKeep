import { createHash } from "node:crypto";
import { newWorkspace, executeCommand } from "./commands.js";

export async function snapshot(db, admins) {
  await db.query(
    "INSERT INTO rentkeep.workspace VALUES(true,0,$1) ON CONFLICT DO NOTHING",
    [JSON.stringify(newWorkspace(admins))],
  );
  const {
    rows: [row],
  } = await db.query(
    "SELECT data,revision FROM rentkeep.workspace WHERE singleton",
  );
  row.data.settings.admins = admins;
  return row;
}
export async function writeCommand(db, admins, actor, request) {
  const hash = createHash("sha256")
    .update(JSON.stringify(request))
    .digest("hex");
  await db.query("BEGIN");
  try {
    const {
      rows: [row],
    } = await db.query(
      "SELECT data,revision FROM rentkeep.workspace WHERE singleton FOR UPDATE",
    );
    if (!row) throw Error("Open the workspace before writing.");
    const {
      rows: [prior],
    } = await db.query(
      "SELECT * FROM rentkeep.operations WHERE request_id=$1",
      [request.requestId],
    );
    row.data.settings.admins = admins;
    if (prior) {
      if (prior.actor !== actor.id || prior.payload_hash !== hash)
        throw Error("Request identifier was reused.");
      await db.query("COMMIT");
      return { ...row, selectedId: prior.result_id };
    }
    if (row.revision !== request.revision)
      throw Object.assign(
        Error(
          "Another administrator changed these records. Review the refreshed workspace before retrying.",
        ),
        { status: 409 },
      );
    const selectedId = executeCommand(row.data, request.action, actor);
    const revision = row.revision + 1;
    await db.query(
      "UPDATE rentkeep.workspace SET data=$1,revision=$2 WHERE singleton",
      [JSON.stringify(row.data), revision],
    );
    await db.query(
      "INSERT INTO rentkeep.operations(request_id,actor,payload_hash,revision,action,target,result_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        request.requestId,
        actor.id,
        hash,
        revision,
        request.action.type,
        request.action.id || null,
        selectedId,
      ],
    );
    await db.query("COMMIT");
    return { data: row.data, revision, selectedId };
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  }
}
