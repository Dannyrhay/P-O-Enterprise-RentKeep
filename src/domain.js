export const unitTypes = ["Room", "Apartment", "Shop"];
export function unitLabel(unit) {
  return [unit?.location, unit?.name].filter(Boolean).join(" · ") || "Unit";
}
export function saveUnit(rooms, data, id) {
  const current = id && rooms.find((r) => r.id === id);
  if (id && !current) throw Error("This unit no longer exists.");
  const same = (a, b) => (a || "").toLowerCase() === (b || "").toLowerCase();
  const input = (data.location || "").trim();
  const location =
    rooms.find((r) => same(r.location, input))?.location || input;
  const name = data.name.trim();
  if (
    !name ||
    rooms.some(
      (r) => r.id !== id && same(r.location, location) && same(r.name, name),
    )
  )
    throw Error("Choose a unique unit name within this location.");
  const unit = { name, location, kind: data.kind || "Room", note: data.note };
  if (current) Object.assign(current, unit);
  else rooms.push({ ...unit, id: crypto.randomUUID() });
}
export const today = () => new Date().toISOString().slice(0, 10);
export function shiftMonths(date, n) {
  const d = new Date(date + "T12:00:00Z");
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}
export const daysLeft = (date, now = today()) =>
  Math.round((Date.parse(date) - Date.parse(now)) / 86400000);
export const balance = (invoice, payments) =>
  invoice.amount -
  payments
    .filter((p) => p.invoiceId === invoice.id)
    .reduce((n, p) => n + p.amount, 0);
export function recordPayment(state, p) {
  const i = state.invoices.find((i) => i.id === p.invoiceId);
  if (
    !i ||
    !p.verified ||
    !Number.isSafeInteger(p.amount) ||
    p.amount <= 0 ||
    p.amount > balance(i, state.payments) ||
    !p.reference?.trim() ||
    !state.settings.admins.some((a) => a.name === p.admin) ||
    !p.date ||
    p.date > today()
  )
    throw Error("Check the amount, date, reference and external verification.");
  state.payments.push({
    ...p,
    id: crypto.randomUUID(),
    receipt: "RK-" + String(state.payments.length + 1).padStart(4, "0"),
  });
}
export function reminder(t, months, now = today()) {
  if (t.archived) return null;
  if (t.end < now) return "Tenancy ended";
  const hit = months
    .filter((m) => shiftMonths(t.end, -m) <= now)
    .sort((a, b) => a - b)[0];
  return hit ? `${hit}-month renewal reminder` : null;
}
export function seed() {
  const names = [
    "Alex Morgan",
    "Jamie Ellis",
    "Taylor Reed",
    "Robin Lane",
    "Casey Brooks",
    "Drew Parker",
    "Sam Avery",
    "Jordan Quinn",
  ];
  const ends = [2, 5, 10, 14, 20, 8, 26, 11];
  const rooms = Array.from({ length: 10 }, (_, i) => ({
    id: "r" + (i + 1),
    location: i < 6 ? "Garden Court (demo)" : "Market Row (demo)",
    kind: i < 4 ? "Room" : i < 6 ? "Apartment" : "Shop",
    name:
      (i < 4 ? "Room " : i < 6 ? "Flat " : "Shop ") +
      String(i + 1).padStart(2, "0"),
    note: i < 5 ? "Ground floor" : "First floor",
  }));
  const tenancies = names.map((name, i) => ({
    id: "t" + i,
    roomId: rooms[i].id,
    name,
    email: name.toLowerCase().replace(" ", ".") + "@example.com",
    phone: "Demo contact â€” not callable",
    start: shiftMonths(today(), ends[i] - [12, 24, 36][i % 3]),
    end: shiftMonths(today(), ends[i]),
    rent: (1200 + i * 100) * 100,
    term: [1, 2, 3][i % 3],
    frequency: "year",
    archived: false,
  }));
  const invoices = tenancies.slice(0, 4).map((t, i) => ({
    id: "i" + i,
    number: "INV-" + String(i + 1).padStart(4, "0"),
    tenancyId: t.id,
    name: t.name,
    room: unitLabel(rooms[i]),
    amount: t.rent,
    currency: "GHS",
    date: today(),
    due: shiftMonths(today(), i === 0 ? -1 : 0),
    description: "Annual rent Â· fictional demonstration",
  }));
  return {
    version: 1,
    rooms,
    tenancies,
    invoices,
    payments: [],
    settings: {
      months: [6, 3],
      currency: "GHS",
      admins: [
        { name: "You", email: "" },
        { name: "Mum", email: "" },
        { name: "Sibling 1", email: "" },
        { name: "Sibling 2", email: "" },
      ],
      push: true,
      email: true,
    },
  };
}
