import { randomBytes, createHash } from "node:crypto";
const key = randomBytes(32).toString("base64url");
console.log(
  "Private sign-in key (store in this admin's password manager):",
  key,
);
console.log("Railway hash:", createHash("sha256").update(key).digest("hex"));
