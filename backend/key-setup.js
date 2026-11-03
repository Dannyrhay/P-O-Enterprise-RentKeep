const el = (id) => document.getElementById(id),
  msg = (text) => (el("status").textContent = text);
function reset() {
  el("hash").value = "";
  msg("");
}
el("key").oninput = reset;
el("generate").onclick = () => {
  if (el("key").value && !confirm("Replace the key in this field?")) return;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  el("key").value = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  reset();
  msg("Key generated on this device. Save it before leaving.");
};
el("show").onclick = () => {
  const k = el("key");
  k.type = k.type === "password" ? "text" : "password";
  el("show").textContent = k.type === "password" ? "Show key" : "Hide key";
};
function valid() {
  if (!/^[\w-]{43}$/.test(el("key").value)) {
    msg(
      "Use a generated 43-character key: letters, numbers, hyphen or underscore.",
    );
    return false;
  }
  return true;
}
el("verify").onclick = async () => {
  if (!valid()) return;
  const key = el("key").value;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  if (key !== el("key").value) return;
  el("hash").value = Array.from(new Uint8Array(digest), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
  msg("Verification hash ready. Share the hash, never the private key.");
};
el("save").onclick = async () => {
  if (!valid()) return;
  const e = el("email");
  if (!e.value || !e.reportValidity()) {
    msg("Enter your administrator email first.");
    return;
  }
  if (window.PasswordCredential && navigator.credentials?.store) {
    try {
      await navigator.credentials.store(
        new PasswordCredential({ id: e.value, password: el("key").value }),
      );
      msg("Check your password manager for the saved RentKeep login.");
      return;
    } catch {}
  }
  msg(
    "Open your password manager and add a login for this RentKeep address. Use your email and the private key. Use Show key to copy it if needed.",
  );
};
