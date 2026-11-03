import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shiftMonths,
  daysLeft,
  balance,
  recordPayment,
  reminder,
  seed,
  today,
} from "../src/domain.js";
test("calendar arithmetic clamps month ends and leap years", () => {
  assert.equal(shiftMonths("2024-02-29", 12), "2025-02-28");
  assert.equal(shiftMonths("2027-08-31", -6), "2027-02-28");
  assert.equal(daysLeft("2027-01-01", "2026-12-31"), 1);
});
test("reminders activate on exact calendar threshold and exclude archives", () => {
  const t = { end: "2027-08-31" };
  assert.equal(reminder(t, [6, 3], "2027-02-27"), null);
  assert.equal(reminder(t, [6, 3], "2027-02-28"), "6-month renewal reminder");
  assert.equal(reminder(t, [6, 3], "2027-05-31"), "3-month renewal reminder");
  assert.equal(reminder({ ...t, archived: true }, [6, 3], "2027-06-01"), null);
  assert.equal(reminder(t, [6, 3], "2027-09-01"), "Tenancy ended");
});
test("unverified payments and overpayments cannot create receipts", () => {
  const s = seed(),
    i = s.invoices[0];
  const p = {
    invoiceId: i.id,
    amount: 100,
    date: today(),
    reference: "DEMO-123",
    admin: "You",
    verified: false,
  };
  assert.throws(() => recordPayment(s, p));
  assert.throws(() =>
    recordPayment(s, { ...p, verified: true, amount: i.amount + 1 }),
  );
  assert.throws(() => recordPayment(s, { ...p, verified: true, amount: 0 }));
  assert.throws(() =>
    recordPayment(s, { ...p, verified: true, reference: " " }),
  );
  assert.throws(() =>
    recordPayment(s, { ...p, verified: true, date: "2099-01-01" }),
  );
  assert.equal(s.payments.length, 0);
});
test("partial payments preserve balance and generate separate receipts", () => {
  const s = seed(),
    i = s.invoices[0],
    amount = i.amount;
  recordPayment(s, {
    invoiceId: i.id,
    amount: 100,
    verified: true,
    reference: "DEMO-1",
    date: today(),
    admin: "You",
  });
  assert.equal(balance(i, s.payments), amount - 100);
  recordPayment(s, {
    invoiceId: i.id,
    amount: amount - 100,
    verified: true,
    reference: "DEMO-2",
    date: today(),
    admin: "Mum",
  });
  assert.equal(balance(i, s.payments), 0);
  assert.notEqual(s.payments[0].receipt, s.payments[1].receipt);
  assert.equal(i.amount, amount);
});
test("demo has ten rooms, eight fictional tenants and no claimed payments", () => {
  const s = seed();
  assert.equal(s.rooms.length, 10);
  assert.equal(s.tenancies.length, 8);
  assert.equal(s.payments.length, 0);
  assert.ok(s.tenancies.every((t) => t.email.endsWith("@example.com")));
  assert.deepEqual(s.settings.months, [6, 3]);
});
