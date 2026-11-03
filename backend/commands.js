import { z } from "zod";
import {
  shiftMonths,
  today,
  recordPayment,
  saveUnit,
  unitLabel,
  unitTypes,
} from "../src/domain.js";

const name = z.string().trim().min(1).max(100);
const id = z.string().min(1).max(64);
const day = z.iso.date();
const term = z.coerce.number().int().min(1).max(3);
const amount = z
  .union([z.string(), z.number()])
  .transform(String)
  .pipe(z.string().regex(/^\d{1,10}(\.\d{1,2})?$/))
  .transform((v) => Math.round(Number(v) * 100))
  .pipe(z.number().int().positive());
const details = z.object({
  roomId: id,
  name,
  email: z.union([z.email().max(254), z.literal("")]),
  phone: z.string().trim().max(80),
  start: day,
  end: day.optional(),
  term,
  rent: amount,
  frequency: z.enum(["year", "month", "tenancy"]),
});
const schemas = {
  room: z.object({
    name,
    location: name.optional(),
    kind: z.enum(unitTypes).optional(),
    note: z.string().trim().max(200),
  }),
  tenancy: details,
  edit: details,
  archive: z.object({ confirmed: z.literal(true) }),
  renew: z.object({ start: day, term }),
  invoice: z.object({
    tenancyId: id,
    amount,
    due: day,
    description: z.string().trim().min(1).max(200),
  }),
  payment: z.object({
    amount,
    date: day,
    method: z.enum(["Bank transfer", "Mobile money"]),
    reference: z.string().trim().min(1).max(120),
    verified: z.literal(true),
  }),
  settings: z.object({
    months: z.array(z.number().int().min(1).max(24)).min(1).max(24),
    push: z.boolean(),
    email: z.boolean(),
  }),
};
export function newWorkspace(admins) {
  return {
    version: 1,
    rooms: [],
    tenancies: [],
    invoices: [],
    payments: [],
    settings: {
      currency: "GHS",
      months: [6, 3],
      push: true,
      email: true,
      admins,
    },
  };
}
export function executeCommand(state, action, actor) {
  const schema = Object.hasOwn(schemas, action.type) && schemas[action.type];
  const parsed = schema?.safeParse?.(action.data);
  if (!parsed?.success)
    throw Error("Check the required fields, dates and amounts.");
  const d = parsed.data;
  const current = state.tenancies.find(
    (t) => t.id === action.id && !t.archived,
  );
  const findActive = () => {
    if (!current) throw Error("This tenancy is no longer active.");
    return current;
  };
  const newId = () => crypto.randomUUID();
  switch (action.type) {
    case "room":
      saveUnit(state.rooms, d, action.id);
      break;
    case "tenancy":
    case "edit": {
      if (action.type === "edit") findActive();
      if (
        !state.rooms.some((r) => r.id === d.roomId) ||
        state.tenancies.some(
          (t) =>
            !t.archived &&
            t.roomId === d.roomId &&
            (action.type === "tenancy" || t.id !== action.id),
        )
      )
        throw Error("Room is unavailable.");
      const end = d.end || shiftMonths(d.start, 12 * d.term);
      if (end <= d.start) throw Error("End date must follow the start date.");
      if (action.type === "edit") Object.assign(current, d, { end });
      else state.tenancies.push({ ...d, end, id: newId(), archived: false });
      break;
    }
    case "archive":
      Object.assign(findActive(), { archived: true, archivedAt: today() });
      break;
    case "renew": {
      const t = findActive();
      if (d.start <= t.end)
        throw Error("Renewal must begin after the current end.");
      const next = {
        ...t,
        id: newId(),
        previousId: t.id,
        start: d.start,
        term: d.term,
        end: shiftMonths(d.start, 12 * d.term),
      };
      Object.assign(t, { archived: true, archivedAt: today() });
      state.tenancies.push(next);
      return next.id;
    }
    case "invoice": {
      const t = state.tenancies.find(
        (t) => t.id === d.tenancyId && !t.archived,
      );
      if (!t) throw Error("Choose an active tenancy.");
      state.invoices.push({
        ...d,
        id: newId(),
        number: "INV-" + String(state.invoices.length + 1).padStart(4, "0"),
        name: t.name,
        room: unitLabel(state.rooms.find((r) => r.id === t.roomId)),
        currency: "GHS",
        date: today(),
      });
      break;
    }
    case "payment": {
      if (
        state.payments.some(
          (p) =>
            p.method === d.method &&
            p.reference.toLowerCase() === d.reference.toLowerCase(),
        )
      )
        throw Error("This external transaction is already recorded.");
      recordPayment(state, {
        ...d,
        invoiceId: action.id,
        admin: actor.name,
        verifiedBy: actor.id,
      });
      break;
    }
    case "settings":
      Object.assign(state.settings, d, {
        months: [...new Set(d.months)].sort((a, b) => b - a),
      });
      break;
  }
  return null;
}
