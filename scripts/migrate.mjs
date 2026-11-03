import { readFile } from "node:fs/promises";
import { database } from "../backend/runtime.js";
const pool = database();
try {
  await pool.query(
    await readFile(new URL("../backend/schema.sql", import.meta.url), "utf8"),
  );
  console.log("RentKeep schema ready.");
} finally {
  await pool.end();
}
