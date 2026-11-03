import React, { useState, useEffect, useRef } from "react";

import { createPortal } from "react-dom";
import {
  Building2,
  LayoutDashboard,
  DoorOpen,
  Wallet,
  CalendarClock,
  Settings2,
  Plus,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  ArrowLeft,
  Search,
  Bell,
  Download,
  Printer,
  Archive,
  RefreshCw,
  Mail,
  Smartphone,
  Info,
  Check,
  Clock,
  ArrowRight,
  Users,
  MoreHorizontal,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Toaster, toast } from "sonner";
import {
  today,
  shiftMonths,
  daysLeft,
  balance,
  recordPayment,
  reminder,
  seed,
} from "./domain.js";
import "./styles.css";
const KEY = "rentkeep-demo-v1";
const nav = [
  ["overview", LayoutDashboard, "Overview"],
  ["rooms", DoorOpen, "Rooms & tenants"],
  ["payments", Wallet, "Payments"],
  ["reminders", CalendarClock, "Reminders"],
  ["settings", Settings2, "Settings"],
];
const date = (d) =>
  new Date(d + "T12:00:00Z").toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Accra",
    year: "numeric",
  });
const money = (n, c = "units") =>
  `${(n / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`;
const initials = (name) =>
  name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function readState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { data: seed(), error: "" };
    const data = JSON.parse(raw);
    if (
      data.version !== 1 ||
      !Array.isArray(data.tenancies) ||
      !Array.isArray(data.invoices) ||
      !data.settings
    )
      throw Error();
    for (const name of ["Sibling 1", "Sibling 2"])
      if (!data.settings.admins.some((a) => a.name === name))
        data.settings.admins.push({ name, email: "" });
    return { data, error: "" };
  } catch {
    return {
      data: seed(),
      error:
        "Saved data could not be read. This session uses fictional demo data.",
    };
  }
}
function Pill({ children, tone = "" }) {
  return <span className={"status-pill " + tone}>{children}</span>;
}
function Person({ name, sub }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="attention-avatar size-9">
        <AvatarFallback className="avatar-fallback text-[11px]">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div>
        <div className="person-name">{name}</div>
        {sub && <div className="quiet">{sub}</div>}
      </div>
    </div>
  );
}
function Heading({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children}
    </div>
  );
}
function Surface({ title, action, children, className = "" }) {
  return (
    <section className={"surface " + className}>
      {title && (
        <div className="surface-head">
          <h2 className="section-title">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
function Notice({ children }) {
  return (
    <div className="notice">
      <Info />
      <div>{children}</div>
    </div>
  );
}
function Field({ label, children, ...props }) {
  return (
    <label className="input-label">
      {label}
      {children || <Input {...props} />}
    </label>
  );
}
function Select({ children, ...props }) {
  return (
    <select
      className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-xs outline-none focus:ring-2 focus:ring-ring/30"
      {...props}
    >
      {children}
    </select>
  );
}
function Empty({ children }) {
  return (
    <div className="p-10 text-center quiet">
      <CheckCircle2 className="size-6 mx-auto mb-3 text-[#8ea480]" />
      {children}
    </div>
  );
}
export default function App({ live = null }) {
  const [initial] = useState(() =>
    live ? { data: live.initial.data, error: "" } : readState(),
  );
  const revision = useRef(live?.initial.revision ?? 0),
    inFlight = useRef(false),
    retry = useRef(null);
  const [saving, setSaving] = useState(false);
  async function send(action) {
    if (inFlight.current) throw Error("A save is already in progress.");
    inFlight.current = true;
    setSaving(true);
    const payload = JSON.stringify([revision.current, action]);
    if (retry.current?.payload !== payload)
      retry.current = { payload, id: crypto.randomUUID() };
    try {
      const result = await live.api("commands", {
        requestId: retry.current.id,
        revision: revision.current,
        action,
      });
      revision.current = result.revision;
      setState(result.data);
      setWarning("");
      setModal(null);
      retry.current = null;
      toast.success("Saved to shared records");
      return result;
    } catch (e) {
      if (e.status === 409) {
        const result = await live.api("workspace");
        revision.current = result.revision;
        setState(result.data);
        setModal(null);
        retry.current = null;
      }
      const message = e.message || "Unable to save.";
      setWarning(message);
      toast.error(message);
      throw e;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }
  const [state, setState] = useState(initial.data);
  const [warning, setWarning] = useState(initial.error);
  const [page, setPage] = useState("overview");
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [error, setError] = useState("");
  const [invoiceTenant, setInvoiceTenant] = useState("");
  useEffect(() => {
    if (!live || modal || page === "settings") return;
    let active = true;
    async function sync() {
      if (document.hidden || inFlight.current) return;
      try {
        const next = await live.api("workspace");
        if (active && !inFlight.current && next.revision > revision.current) {
          revision.current = next.revision;
          setState(next.data);
        }
      } catch (e) {
        if (active) setWarning(e.message);
      }
    }
    const timer = setInterval(sync, 30000);
    window.addEventListener("focus", sync);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", sync);
    };
  }, [live, modal, page]);
  const active = state.tenancies.filter((t) => !t.archived);
  const occupied = new Set(active.map((t) => t.roomId)).size;
  const alerts = active.filter((t) => reminder(t, state.settings.months));
  const open = state.invoices.filter((i) => balance(i, state.payments) > 0);
  const room = (t) =>
    state.rooms.find((r) => r.id === t.roomId)?.name || "Room";
  const remaining = (t) =>
    daysLeft(t.end) < 0
      ? `${Math.abs(daysLeft(t.end))} days past end`
      : `${daysLeft(t.end)} days remaining`;
  function commit(mutator) {
    const copy = structuredClone(state);
    mutator(copy);
    setState(copy);
    try {
      localStorage.setItem(KEY, JSON.stringify(copy));
      setWarning("");
    } catch {
      setWarning(
        "Changes are in memory only. Browser storage is unavailable. Export a backup before closing.",
      );
    }
    setModal(null);
    toast.success("Saved in this browser");
  }
  function navigate(p) {
    setPage(p);
    setSelected(null);
    setSearch("");
    window.scrollTo(0, 0);
  }
  function view(t) {
    setPage("rooms");
    setSelected(t.id);
    window.scrollTo(0, 0);
  }
  function show(type, id) {
    setError("");
    if (type === "invoice") {
      if (!active.length) {
        toast.info("Add a tenancy first.");
        return;
      }
      setInvoiceTenant(id || active[0].id);
    }
    if (
      type === "tenancy" &&
      !state.rooms.some((r) => !active.some((t) => t.roomId === r.id))
    ) {
      toast.info("Add a room or archive a departed tenancy first.");
      return;
    }
    setModal({ type, id });
  }
  function invoiceAction(i) {
    return balance(i, state.payments) > 0 ? (
      <Button size="sm" variant="outline" onClick={() => show("payment", i.id)}>
        Record payment
      </Button>
    ) : (
      <Button size="sm" variant="ghost" onClick={() => show("document", i.id)}>
        View invoice
        <ArrowUpRight className="size-3.5" />
      </Button>
    );
  }
  function invoiceStatus(i) {
    const b = balance(i, state.payments);
    return (
      <Pill tone={b ? (i.due < today() ? "red" : "amber") : ""}>
        {b
          ? b < i.amount
            ? "Part paid"
            : i.due < today()
              ? "Overdue"
              : "Due"
          : "Paid"}
      </Pill>
    );
  }
  function Invoices({ items }) {
    if (!items.length) return <Empty>No invoices here yet.</Empty>;
    return (
      <>
        <div className="desktop-invoices">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#fcfdfa]">
                <TableHead className="table-heading pl-6 h-11">
                  Tenant / invoice
                </TableHead>
                <TableHead className="table-heading">Due date</TableHead>
                <TableHead className="table-heading">Outstanding</TableHead>
                <TableHead className="table-heading">Status</TableHead>
                <TableHead className="table-heading text-right pr-6">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="pl-6 py-4">
                    <button
                      className="text-left"
                      onClick={() => show("document", i.id)}
                    >
                      <div className="person-name">{i.name}</div>
                      <div className="quiet text-[10px]">
                        {i.number} · {i.room}
                      </div>
                    </button>
                  </TableCell>
                  <TableCell className="text-xs text-[#788371]">
                    {date(i.due)}
                  </TableCell>
                  <TableCell className="text-xs font-medium tabular-nums">
                    {money(balance(i, state.payments), i.currency)}
                  </TableCell>
                  <TableCell>{invoiceStatus(i)}</TableCell>
                  <TableCell className="pr-6 text-right">
                    {invoiceAction(i)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mobile-invoices">
          {items.map((i) => (
            <div key={i.id} className="p-[18px] border-b last:border-b-0">
              <div className="flex justify-between items-start gap-3">
                <button
                  className="text-left"
                  onClick={() => show("document", i.id)}
                >
                  <div className="person-name">{i.name}</div>
                  <div className="quiet text-[10px]">
                    {i.number} · {i.room}
                  </div>
                </button>
                {invoiceStatus(i)}
              </div>
              <div className="flex justify-between items-end mt-4 gap-3">
                <div>
                  <div className="text-sm font-semibold tabular-nums">
                    {money(balance(i, state.payments), i.currency)}
                  </div>
                  <div className="quiet text-[10px]">Due {date(i.due)}</div>
                </div>
                {invoiceAction(i)}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }
  function Overview() {
    return (
      <>
        <Heading
          eyebrow="YOUR RENTAL WORKSPACE"
          title="Overview"
          description="Your rooms, payments and upcoming renewals — all together."
        >
          <Button onClick={() => show("tenancy")}>
            <Plus />
            Add tenancy
          </Button>
        </Heading>
        <div className="stats-grid">
          {[
            [
              "Rooms occupied",
              `${occupied}`,
              `of ${state.rooms.length} rooms`,
              DoorOpen,
              `${state.rooms.length - occupied} available`,
            ],
            [
              "Payments to follow up",
              String(open.length).padStart(2, "0"),
              "outstanding invoices",
              Wallet,
              "External payments only",
            ],
            [
              "Upcoming renewals",
              String(alerts.length).padStart(2, "0"),
              "need your attention",
              CalendarClock,
              "Based on reminder settings",
            ],
            [
              "Payments recorded",
              String(state.payments.length).padStart(2, "0"),
              "externally verified",
              CheckCircle2,
              "Receipts available",
            ],
          ].map(([label, value, unit, Icon, note]) => (
            <div className="stat-card" key={label}>
              <div className="flex justify-between items-center gap-2">
                <span className="text-[11px] font-medium text-[#7c8877]">
                  {label}
                </span>
                <span className="stat-icon">
                  <Icon />
                </span>
              </div>
              <div className="stat-value">
                {value}
                <span className="text-[11px] text-[#899382] font-normal tracking-normal ml-2">
                  {unit}
                </span>
              </div>
              <div className="text-[10px] text-[#91a085]">{note}</div>
            </div>
          ))}
        </div>
        <div className="dashboard-grid">
          <Surface
            title={
              <span className="flex items-center gap-2">
                Needs your attention<Pill tone="amber">{alerts.length}</Pill>
              </span>
            }
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("reminders")}
              >
                View all
                <ArrowRight className="size-3.5" />
              </Button>
            }
          >
            {alerts.slice(0, 3).map((t) => (
              <div className="attention-row" key={t.id}>
                <Person
                  name={t.name}
                  sub={`${room(t)} · Ends ${date(t.end)}`}
                />
                <div className="text-right">
                  <Pill tone="amber">
                    {reminder(t, state.settings.months).replace(
                      " renewal reminder",
                      " notice",
                    )}
                  </Pill>
                  <button
                    className="flex items-center gap-1 text-[10px] text-[#7e8b75] mt-2 ml-auto"
                    onClick={() => view(t)}
                  >
                    Review tenancy
                    <ChevronRight className="size-3" />
                  </button>
                </div>
              </div>
            ))}
            {!alerts.length && <Empty>No renewals need attention today.</Empty>}
          </Surface>
          <Surface
            title="Your rooms"
            action={
              <Pill>
                {Math.round((occupied / (state.rooms.length || 1)) * 100)}%
                occupied
              </Pill>
            }
          >
            <div className="p-[23px]">
              <div className="room-map">
                {state.rooms.map((r, i) => (
                  <button
                    key={r.id}
                    className={
                      "room-tile " +
                      (active.some((t) => t.roomId === r.id) ? "" : "vacant")
                    }
                    aria-label={`${r.name}, ${active.some((t) => t.roomId === r.id) ? "occupied" : "available"}`}
                    onClick={() => {
                      const t = active.find((t) => t.roomId === r.id);
                      t ? view(t) : show("tenancy", r.id);
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between mt-5">
                <div className="flex gap-4 text-[10px] text-[#8a9680]">
                  <span>● Occupied</span>
                  <span>○ Available</span>
                </div>
                <button
                  className="text-[10px] flex gap-1 items-center text-[#5e7850]"
                  onClick={() => navigate("rooms")}
                >
                  Manage rooms
                  <ChevronRight className="size-3" />
                </button>
              </div>
            </div>
          </Surface>
        </div>
        <Surface
          title="Payments to follow up"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("payments")}
            >
              All payments
              <ArrowRight className="size-3.5" />
            </Button>
          }
        >
          <Invoices items={open.slice(0, 4)} />
        </Surface>
        <div className="mt-6">
          <Notice>
            <strong className="text-[#536d44]">
              Stay ahead of the next renewal.
            </strong>{" "}
            {live
              ? "Review approaching end dates in Reminders. Phone and email delivery preferences are in Settings."
              : "In-app reminders are ready. Phone notifications and email need setup before they can reach you and Mum."}
          </Notice>
        </div>
      </>
    );
  }
  function Rooms() {
    const list =
      filter === "archive" ? state.tenancies.filter((t) => t.archived) : active;
    const cards = (
      filter === "archive"
        ? list.map((t) => ({
            r: state.rooms.find((r) => r.id === t.roomId),
            t,
          }))
        : state.rooms.map((r) => ({
            r,
            t: list.find((t) => t.roomId === r.id),
          }))
    ).filter(({ r, t }) =>
      (r.name + " " + (t?.name || ""))
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
    return (
      <>
        <Heading
          eyebrow="A PLACE FOR EVERY TENANT"
          title="Rooms & tenants"
          description="The important details, from move-in to the next renewal."
        >
          <Button onClick={() => show("room")}>
            <Plus />
            Add room
          </Button>
        </Heading>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-3 size-4 text-[#8b9684]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tenants or rooms"
              aria-label="Search tenants or rooms"
              className="pl-9 bg-white h-10"
            />
          </div>
          <div className="segmented">
            {[
              ["active", "Current"],
              ["archive", "Archive"],
            ].map(([k, v]) => (
              <button
                key={k}
                className={filter === k ? "selected" : ""}
                onClick={() => setFilter(k)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="room-grid">
          {cards.map(({ r, t }) => (
            <Surface key={t?.id || r.id} className="room-card">
              <div className="flex items-center justify-between">
                <div className="bg-[#f0f4ec] text-[#7c926d] rounded-lg p-3">
                  <DoorOpen className="size-5" />
                </div>
                <Pill tone={t ? (t.archived ? "gray" : "") : "amber"}>
                  {t ? (t.archived ? "Archived" : "Occupied") : "Available"}
                </Pill>
              </div>
              <h2 className="text-base font-semibold mt-5 tracking-tight">
                {r.name}
              </h2>
              <p className="quiet text-[11px] mt-1">{r.note}</p>
              <div className="room-card-line" />
              {t ? (
                <>
                  <Person name={t.name} sub={`${t.term}-year tenancy`} />
                  <div className="room-detail-line mt-5">
                    <span className="text-[#8b9684]">
                      Rent per {t.frequency}
                    </span>
                    <span className="font-medium">
                      {money(t.rent, state.settings.currency)}
                    </span>
                  </div>
                  <div className="room-detail-line">
                    <span className="text-[#8b9684]">Tenancy ends</span>
                    <span>{date(t.end)}</span>
                  </div>
                  <Button
                    className="w-full mt-4 justify-between"
                    variant="outline"
                    onClick={() => view(t)}
                  >
                    View tenancy
                    <ArrowRight />
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-medium">
                    Ready for a new tenant
                  </h3>
                  <p className="quiet mt-2 mb-8">
                    Keep contacts, rent and dates
                    <br />
                    in one organised place.
                  </p>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => show("tenancy", r.id)}
                  >
                    <Plus />
                    Add tenancy
                  </Button>
                </>
              )}
            </Surface>
          ))}
        </div>
        {!cards.length && <Empty>No records match your search.</Empty>}
      </>
    );
  }
  function Detail() {
    const t = state.tenancies.find((t) => t.id === selected);
    const progress = Math.min(
      100,
      Math.max(
        0,
        (100 * (Date.parse(today()) - Date.parse(t.start))) /
          (Date.parse(t.end) - Date.parse(t.start)),
      ),
    );
    return (
      <>
        <Button
          variant="ghost"
          className="mb-5 -ml-3"
          onClick={() => navigate("rooms")}
        >
          <ArrowLeft />
          Rooms & tenants
        </Button>
        <Heading
          eyebrow={room(t).toUpperCase()}
          title={t.name}
          description={
            t.archived
              ? "Archived tenancy · history retained"
              : `${t.term}-year tenancy · ${remaining(t)}`
          }
        >
          <Pill tone={t.archived ? "gray" : ""}>
            {t.archived ? "Archived" : "Current tenancy"}
          </Pill>
        </Heading>
        <Surface
          title="Tenancy details"
          action={
            !t.archived && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => show("edit", t.id)}
              >
                Edit details
              </Button>
            )
          }
        >
          <div className="p-6">
            <dl className="detail-fields">
              {[
                ["Start date", date(t.start)],
                ["End date", date(t.end)],
                [
                  "Rent",
                  `${money(t.rent, state.settings.currency)} / ${t.frequency}`,
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="h-1.5 bg-[#edf2e8] rounded-full overflow-hidden mt-7 mb-3">
              <div
                style={{ width: progress + "%" }}
                className="h-full bg-[#8caa77]"
              />
            </div>
            <p className="quiet mb-7">
              {remaining(t)} · Calculated from the recorded end date.
            </p>
            <dl className="detail-fields">
              {[
                ["Email", t.email || "Not provided"],
                ["Phone", t.phone || "Not provided"],
                [
                  "Reminders",
                  state.settings.months.join(" & ") + " months before end",
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {!t.archived && (
              <div className="flex flex-wrap gap-3 mt-8">
                <Button onClick={() => show("invoice", t.id)}>
                  <FileText />
                  Create invoice
                </Button>
                <Button variant="outline" onClick={() => show("renew", t.id)}>
                  <RefreshCw />
                  Renew tenancy
                </Button>
                <Button
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => show("archive", t.id)}
                >
                  <Archive />
                  Archive
                </Button>
              </div>
            )}
          </div>
        </Surface>
        <Surface title="Invoices & payment history" className="mt-6">
          <Invoices
            items={state.invoices.filter((i) => i.tenancyId === t.id)}
          />
        </Surface>
      </>
    );
  }
  function Payments() {
    return (
      <>
        <Heading
          eyebrow="A CLEAR PAPER TRAIL"
          title="Invoices & payments"
          description="Create an invoice. Verify funds externally. Record the payment."
        >
          <Button onClick={() => show("invoice")}>
            <Plus />
            Create invoice
          </Button>
        </Heading>
        <Notice>
          Payments happen outside RentKeep by bank transfer or mobile money. An
          invoice is a request for payment, never proof of receipt.
        </Notice>
        <Surface
          className="mt-6"
          title="All invoices"
          action={<Pill tone="gray">{state.invoices.length} records</Pill>}
        >
          <Invoices items={state.invoices} />
        </Surface>
        <Surface className="mt-6" title="Verified payments & receipts">
          {state.payments.length ? (
            state.payments.map((p) => {
              const i = state.invoices.find((i) => i.id === p.invoiceId);
              return (
                <div className="attention-row" key={p.id}>
                  <Person
                    name={i.name}
                    sub={`${p.receipt} · ${date(p.date)} · Verified by ${p.admin}`}
                  />
                  <div className="text-right">
                    <p className="text-xs font-semibold mb-1">
                      {money(p.amount, i.currency)}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => show("receipt", p.id)}
                    >
                      View receipt
                      <ArrowUpRight className="size-3" />
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <Empty>
              Receipts appear after you record an externally verified payment.
            </Empty>
          )}
        </Surface>
      </>
    );
  }
  function Reminders() {
    return (
      <>
        <Heading
          eyebrow="STAY ONE STEP AHEAD"
          title="Renewal reminders"
          description="A timely nudge, with all the details close at hand."
        >
          <Button variant="outline" onClick={() => navigate("settings")}>
            <Settings2 />
            Preferences
          </Button>
        </Heading>
        <Notice>
          <strong>Administrators only: You and Mum.</strong> Reminders remain
          visible here.{" "}
          {live
            ? "See Settings for delivery configuration."
            : "Push and email are not connected."}{" "}
          No messages go to tenants.
        </Notice>
        <Surface
          className="mt-6"
          title="Ready for review"
          action={<Pill tone="amber">{alerts.length} tenancies</Pill>}
        >
          {alerts.map((t) => (
            <div className="attention-row" key={t.id}>
              <Person name={t.name} sub={`${room(t)} · Ends ${date(t.end)}`} />
              <div className="text-right">
                <Pill tone="amber">
                  {reminder(t, state.settings.months).replace(
                    " renewal reminder",
                    " notice",
                  )}
                </Pill>
                <div className="mt-2">
                  <Button variant="ghost" size="sm" onClick={() => view(t)}>
                    Review
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {!alerts.length && (
            <Empty>All caught up. No renewals need attention.</Empty>
          )}
        </Surface>
        <Surface className="mt-6" title="Coming later">
          {active
            .filter((t) => !reminder(t, state.settings.months))
            .sort((a, b) => a.end.localeCompare(b.end))
            .map((t) => (
              <div className="attention-row" key={t.id}>
                <Person
                  name={t.name}
                  sub={`${room(t)} · Ends ${date(t.end)}`}
                />
                <span className="quiet text-right">{remaining(t)}</span>
              </div>
            ))}
        </Surface>
      </>
    );
  }
  function Settings() {
    return (
      <>
        <Heading
          eyebrow="YOUR WORKSPACE, YOUR WAY"
          title="Settings"
          description="Manage access details and renewal reminders for your family team."
        />
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const months = f
              .get("months")
              .split(",")
              .map((v) => Number(v.trim()));
            if (
              months.some((n) => !Number.isInteger(n) || n < 1 || n > 24) ||
              !f.get("currency").trim()
            ) {
              toast.error(
                "Use whole months between 1 and 24 and a currency label.",
              );
              return;
            }
            if (live) {
              try {
                await send({
                  type: "settings",
                  data: { months, push: f.has("push"), email: f.has("email") },
                });
              } catch {}
              return;
            }
            commit((s) => {
              s.settings = {
                ...s.settings,
                months: [...new Set(months)].sort((a, b) => b - a),
                currency: f.get("currency").trim(),
                push: f.has("push"),
                email: f.has("email"),
                admins: s.settings.admins.map((a, i) => ({
                  ...a,
                  email: f.get("admin" + i),
                })),
              };
            });
          }}
        >
          <div className="settings-grid">
            <Surface title="Reminder preferences">
              <div className="p-6 space-y-6">
                <Field
                  label="Months before tenancy end"
                  name="months"
                  required
                  defaultValue={state.settings.months.join(", ")}
                />
                <p className="form-note">
                  Separate whole months with commas. Default: 6 and 3.
                </p>
                <div className="flex justify-between gap-4 items-center">
                  <div className="flex items-center gap-3">
                    <Smartphone className="size-4 text-[#819577]" />
                    <div>
                      <label htmlFor="push" className="text-xs font-medium">
                        Phone notifications
                      </label>
                      <p className="quiet text-[10px]">
                        {live?.initial.delivery.push
                          ? "Provider configured"
                          : "Preferred · setup required"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="push"
                    name="push"
                    defaultChecked={state.settings.push}
                  />
                </div>
                <div className="flex justify-between gap-4 items-center">
                  <div className="flex items-center gap-3">
                    <Mail className="size-4 text-[#819577]" />
                    <div>
                      <label htmlFor="email" className="text-xs font-medium">
                        Email fallback
                      </label>
                      <p className="quiet text-[10px]">
                        {live?.initial.delivery.email
                          ? "Provider configured"
                          : "Setup required"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="email"
                    name="email"
                    defaultChecked={state.settings.email}
                  />
                </div>
                <Notice>
                  {live
                    ? "Provider acceptance is recorded by the server. Verify delivery on each recipient’s device."
                    : "Demo preferences only. In-app reminders remain available."}
                </Notice>
                {live?.initial.actor.notify && live.initial.delivery.push && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await live.registerDevice(
                          live.initial.delivery.publicKey,
                        );
                        toast.success("Device registered for reminders");
                      } catch (e) {
                        toast.error(e.message);
                      }
                    }}
                  >
                    Enable reminders on this device
                  </Button>
                )}
                <div>
                  <p className="text-xs font-medium mb-2">Tenant messaging</p>
                  <p className="form-note">
                    SMS and WhatsApp are reserved for a later phase. Tenant
                    delivery stays disabled.
                  </p>
                </div>
              </div>
            </Surface>
            <Surface title="Administrators & currency">
              <div className="p-6 space-y-5">
                {state.settings.admins.map((a, i) => (
                  <Field
                    key={a.name}
                    label={`${a.name} · ${i < 2 ? "Admin and reminder recipient" : "Admin"}`}
                    readOnly={!!live}
                    type="email"
                    name={"admin" + i}
                    defaultValue={a.email}
                    placeholder="Email for future fallback"
                  />
                ))}
                <p className="form-note">
                  {live
                    ? "Four approved accounts have full administrative access. Reminders go to the first two accounts."
                    : "Demo profiles. Live access requires a separate sign-in for each of the four administrators."}
                </p>
                <Field
                  label="Currency"
                  readOnly={!!live}
                  name="currency"
                  maxLength={12}
                  required
                  defaultValue={state.settings.currency}
                />
                <p className="form-note">
                  Ghana cedis use the currency code GHS. Existing invoices
                  retain their original currency.
                </p>
              </div>
            </Surface>
          </div>
          <Button disabled={saving} className="mt-6" type="submit">
            <Check />
            Save preferences
          </Button>
        </form>
        <Surface
          className="mt-7"
          title={live ? "Shared records & exports" : "Local records & backups"}
        >
          <div className="p-6">
            <p className="form-note mb-5">
              {live
                ? "Export a copy of the shared records. The export contains tenant contact and payment details."
                : "Demo records are saved in this browser only. Export a backup to keep your review work."}
            </p>
            <Button
              variant="outline"
              onClick={() =>
                download(
                  "rentkeep-backup-" + today() + ".json",
                  JSON.stringify(state, null, 2),
                  "application/json",
                )
              }
            >
              <Download />
              Export JSON backup
            </Button>
          </div>
        </Surface>
      </>
    );
  }
  const current = state.tenancies.find((t) => t.id === modal?.id);
  const invoice = state.invoices.find((i) => i.id === modal?.id);
  const payment = state.payments.find((p) => p.id === modal?.id);
  const docInvoice =
    modal?.type === "receipt"
      ? state.invoices.find((i) => i.id === payment?.invoiceId)
      : invoice;
  const docContent = docInvoice ? (
    <Receipt
      invoice={docInvoice}
      payment={modal?.type === "receipt" ? payment : null}
      state={state}
      live={!!live}
    />
  ) : null;
  async function submit(e) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const type = modal.type;
      if (live) {
        const data = Object.fromEntries(f);
        if (type === "payment") data.verified = f.has("verified");
        if (type === "archive") data.confirmed = f.has("confirmed");
        const result = await send({ type, id: modal.id || null, data });
        if (type === "renew") setSelected(result.selectedId);
        return;
      }
      if (type === "room") {
        const name = f.get("name").trim();
        if (
          !name ||
          state.rooms.some((r) => r.name.toLowerCase() === name.toLowerCase())
        )
          throw Error("Choose a unique room name.");
        commit((s) =>
          s.rooms.push({ id: crypto.randomUUID(), name, note: f.get("note") }),
        );
      }
      if (type === "tenancy" || type === "edit") {
        const d = Object.fromEntries(f);
        d.name = d.name.trim();
        d.term = Number(d.term);
        d.rent = Math.round(Number(d.rent) * 100);
        d.end = d.end || shiftMonths(d.start, d.term * 12);
        if (
          !d.name ||
          d.end <= d.start ||
          !Number.isSafeInteger(d.rent) ||
          d.rent <= 0
        )
          throw Error(
            "Enter a name, positive rent and an end date after the start.",
          );
        commit((s) => {
          if (type === "edit")
            Object.assign(
              s.tenancies.find((t) => t.id === current.id),
              d,
            );
          else
            s.tenancies.push({
              ...d,
              id: crypto.randomUUID(),
              archived: false,
            });
        });
      }
      if (type === "invoice") {
        const t = state.tenancies.find((t) => t.id === f.get("tenancyId"));
        const amount = Math.round(Number(f.get("amount")) * 100);
        if (!Number.isSafeInteger(amount) || amount <= 0)
          throw Error("Enter a valid positive amount.");
        commit((s) =>
          s.invoices.push({
            id: crypto.randomUUID(),
            number: "INV-" + String(s.invoices.length + 1).padStart(4, "0"),
            tenancyId: t.id,
            name: t.name,
            room: room(t),
            amount,
            currency: s.settings.currency,
            date: today(),
            due: f.get("due"),
            description: f.get("description"),
          }),
        );
      }
      if (type === "payment")
        commit((s) =>
          recordPayment(s, {
            invoiceId: invoice.id,
            amount: Math.round(Number(f.get("amount")) * 100),
            date: f.get("date"),
            method: f.get("method"),
            admin: f.get("admin"),
            reference: f.get("reference"),
            verified: f.has("verified"),
          }),
        );
      if (type === "archive")
        commit((s) =>
          Object.assign(
            s.tenancies.find((t) => t.id === current.id),
            { archived: true, archivedAt: today() },
          ),
        );
      if (type === "renew") {
        if (f.get("start") <= current.end)
          throw Error(
            "The new tenancy must begin after the previous end date.",
          );
        const id = crypto.randomUUID();
        commit((s) => {
          const t = s.tenancies.find((t) => t.id === current.id);
          t.archived = true;
          t.archivedAt = today();
          const next = {
            ...t,
            id,
            start: f.get("start"),
            end: shiftMonths(f.get("start"), Number(f.get("term")) * 12),
            term: Number(f.get("term")),
            archived: false,
            previousId: t.id,
          };
          delete next.archivedAt;
          s.tenancies.push(next);
        });
        setSelected(id);
      }
    } catch (err) {
      setError(err.message);
    }
  }
  function Fields() {
    if (!modal) return null;
    const t = current;
    switch (modal.type) {
      case "room":
        return (
          <div className="space-y-5">
            <Field label="Room name" name="name" required maxLength={50} />
            <Field label="Location / note" name="note" maxLength={100} />
          </div>
        );
      case "tenancy":
      case "edit":
        return (
          <>
            <p className="form-note mb-5">
              {live
                ? "Enter the agreed rental terms and tenant contact details."
                : "Demo workspace · Use fictional contact details."}
            </p>
            <div className="form-grid">
              <Field label="Room">
                <Select name="roomId" defaultValue={t?.roomId || modal.id}>
                  {state.rooms
                    .filter(
                      (r) =>
                        r.id === t?.roomId ||
                        !active.some((a) => a.roomId === r.id),
                    )
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field
                label="Tenant name"
                name="name"
                required
                maxLength={80}
                defaultValue={t?.name}
              />
              <Field
                label="Email"
                name="email"
                type="email"
                defaultValue={t?.email}
              />
              <Field label="Phone" name="phone" defaultValue={t?.phone} />
              <Field
                label="Start date"
                type="date"
                name="start"
                required
                defaultValue={t?.start || today()}
              />
              <Field label="Tenancy term">
                <Select name="term" defaultValue={t?.term || 1}>
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n} year{n > 1 ? "s" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              {t && (
                <Field
                  label="End date"
                  name="end"
                  type="date"
                  required
                  defaultValue={t.end}
                />
              )}
              <Field
                label={`Rent amount (${state.settings.currency})`}
                name="rent"
                type="number"
                required
                min="0.01"
                step="0.01"
                defaultValue={t ? t.rent / 100 : ""}
              />
              <Field label="Rent applies per">
                <Select name="frequency" defaultValue={t?.frequency || "year"}>
                  {["year", "month", "tenancy"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <p className="form-note mt-5">
              New end dates use the selected term. Recorded end dates can be
              edited later.
            </p>
          </>
        );
      case "invoice":
        return (
          <div className="space-y-5">
            <Notice>
              An invoice requests payment. It does not confirm funds were
              received.
            </Notice>
            <Field label="Tenancy">
              <Select
                name="tenancyId"
                value={invoiceTenant}
                onChange={(e) => setInvoiceTenant(e.target.value)}
              >
                {active.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {room(t)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="form-grid">
              <Field
                key={invoiceTenant}
                label={`Amount (${state.settings.currency})`}
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue={
                  active.find((t) => t.id === invoiceTenant)?.rent / 100
                }
              />
              <Field
                label="Due date"
                name="due"
                type="date"
                required
                defaultValue={today()}
              />
            </div>
            <Field
              label="Description / rental period"
              name="description"
              required
              defaultValue="Rent"
              maxLength={200}
            />
          </div>
        );
      case "payment":
        return (
          <div className="space-y-5">
            <Notice>
              <strong>
                {invoice.name} · {invoice.number}
              </strong>
              <br />
              Outstanding:{" "}
              {money(balance(invoice, state.payments), invoice.currency)}.
              Verify receipt in the external account first.
            </Notice>
            <div className="form-grid">
              <Field
                label={`Amount received (${invoice.currency})`}
                name="amount"
                type="number"
                min="0.01"
                max={balance(invoice, state.payments) / 100}
                step="0.01"
                required
                defaultValue={balance(invoice, state.payments) / 100}
              />
              <Field
                label="Received date"
                name="date"
                type="date"
                required
                max={today()}
                defaultValue={today()}
              />
              <Field label="Payment method">
                <Select name="method">
                  <option>Bank transfer</option>
                  <option>Mobile money</option>
                </Select>
              </Field>
              <Field label="Verified by">
                <Select
                  name="admin"
                  disabled={!!live}
                  defaultValue={live?.initial.actor.name || "You"}
                >
                  {state.settings.admins.map((a) => (
                    <option key={a.name}>{a.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field
              label="External transaction reference"
              name="reference"
              required
              maxLength={120}
            />
            <label className="flex items-start gap-3 text-xs leading-6">
              <input
                className="mt-1.5 accent-[#285d46] size-4 shrink-0"
                type="checkbox"
                name="verified"
                required
              />
              I checked the external account and verified that these funds were
              received.
            </label>
          </div>
        );
      case "archive":
        return (
          <div className="space-y-5">
            <p className="form-note">
              Archive {t.name} and make {room(t)} available? Contacts, invoices
              and receipts stay in the archive.
            </p>
            <label className="flex gap-3 items-center text-xs">
              <input
                type="checkbox"
                name="confirmed"
                required
                className="size-4 accent-[#285d46]"
              />
              I confirm this tenant has departed.
            </label>
          </div>
        );
      case "renew": {
        const next = new Date(t.end + "T12:00:00Z");
        next.setUTCDate(next.getUTCDate() + 1);
        return (
          <div className="space-y-5">
            <p className="form-note">
              The current tenancy is archived with its invoices and receipts. A
              new tenancy keeps contact details and rent.
            </p>
            <Field
              label="New start date"
              name="start"
              type="date"
              required
              defaultValue={next.toISOString().slice(0, 10)}
            />
            <Field label="New term">
              <Select name="term">
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n} year{n > 1 ? "s" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        );
      }
      default:
        return null;
    }
  }
  const titles = {
    room: "Add a room",
    tenancy: "Add a tenancy",
    edit: "Edit tenancy",
    invoice: "Create invoice",
    payment: "Record verified payment",
    archive: "Archive tenancy",
    renew: "Renew tenancy",
    document: "Invoice",
    receipt: "Payment receipt",
  };
  const submits = {
    room: "Add room",
    tenancy: "Save tenancy",
    edit: "Save changes",
    invoice: "Create invoice",
    payment: "Record payment & create receipt",
    archive: "Archive tenancy",
    renew: "Renew tenancy",
  };
  return (
    <>
      <aside className="app-sidebar">
        <div className="flex items-center gap-2.5 px-2">
          <div className="brand-icon">
            <Building2 className="size-5" />
          </div>
          <span className="brand-name">
            RentKeep<span className="text-[#87a778]">.</span>
          </span>
        </div>
        <div className="org-switch">
          <div className="bg-[#f1f4ed] text-[#798969] rounded-md p-2">
            <Building2 className="size-4" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold">P&O Enterprise</p>
            <p className="text-[9px] text-[#95a08b] mt-1">Rental workspace</p>
          </div>
          <ChevronDown className="size-3 text-[#a2ac99]" />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(([k, Icon, label]) => (
            <button
              key={k}
              className={"nav-item " + (page === k ? "active" : "")}
              onClick={() => navigate(k)}
              aria-current={page === k ? "page" : undefined}
            >
              <Icon />
              {label}
              {k === "reminders" && alerts.length > 0 && (
                <span className="ml-auto text-[10px] bg-[#f2e9d6] text-[#99805b] rounded px-1.5 py-0.5">
                  {alerts.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="p-4 bg-[#f7f9f4] rounded-lg border border-[#e8eddf] mb-5">
            <div className="flex gap-2 text-[11px] font-medium text-[#748968]">
              <Info className="size-3.5" />
              {live ? "Family workspace" : "Demo workspace"}
            </div>
            <p className="text-[10px] leading-5 text-[#9aa58e] mt-2">
              {live
                ? "Shared records · Ghana"
                : "Fictional records · This browser only"}
            </p>
          </div>
          <div className="flex items-center gap-3 border-t pt-5 px-2">
            <Avatar className="size-8">
              <AvatarFallback className="text-[10px] bg-[#eaf0e4] text-[#718660]">
                PO
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-[11px] font-medium">
                {live?.initial.actor.name || "Family team"}
              </p>
              <p className="text-[9px] text-[#94a087] mt-1">Administrators</p>
            </div>
          </div>
        </div>
      </aside>
      <div className="app-shell">
        <header className="topbar">
          <div className="flex items-center gap-2 text-[12px] text-[#99a28f]">
            <Building2 className="size-4" />
            <span className="desktop-only">Workspace</span>
            <ChevronRight className="size-3 desktop-only" />
            <span className="font-medium text-[#52674a]">
              {nav.find((n) => n[0] === page)[2]}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="desktop-only text-[11px] text-[#98a18f]">
              {date(today())}
            </span>
            <Pill tone={live ? "" : "amber"}>
              {live ? "Shared workspace" : "Fictional demo"}
            </Pill>
            {live && (
              <Button variant="ghost" size="sm" onClick={live.signOut}>
                Sign out
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="View reminders"
              onClick={() => navigate("reminders")}
              className="size-8 relative"
            >
              <Bell className="size-4" />
              {alerts.length > 0 && (
                <span className="absolute top-1 right-1.5 size-1.5 rounded-full bg-[#c8ac6b]" />
              )}
            </Button>
          </div>
        </header>
        <main className="workspace">
          {warning && (
            <div className="mb-6">
              <Notice>{warning}</Notice>
            </div>
          )}
          {selected
            ? Detail()
            : page === "overview"
              ? Overview()
              : page === "rooms"
                ? Rooms()
                : page === "payments"
                  ? Payments()
                  : page === "reminders"
                    ? Reminders()
                    : Settings()}
          <footer className="footer-note">
            {live
              ? "RentKeep for P&O Enterprise · Shared workspace · Ghana"
              : "RentKeep for P&O Enterprise · Demo records stay in this browser."}
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.map(([k, Icon, label]) => (
          <button
            key={k}
            className={page === k ? "active" : ""}
            aria-current={page === k ? "page" : undefined}
            onClick={() => navigate(k)}
          >
            <Icon />
            {k === "rooms" ? "Rooms" : label}
          </button>
        ))}
      </nav>
      <Dialog
        open={!!modal}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent className="sm:max-w-[560px] max-h-[90dvh] overflow-y-auto p-6 gap-5">
          <DialogHeader>
            <DialogTitle className="text-xl tracking-tight">
              {titles[modal?.type]}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {["document", "receipt"].includes(modal?.type)
                ? live
                  ? "A printable record from your shared workspace."
                  : "A printable record from your demo workspace."
                : "Keep the details accurate and the next step simple."}
            </DialogDescription>
          </DialogHeader>
          {["document", "receipt"].includes(modal?.type) ? (
            <>
              {docContent}
              <div className="form-actions">
                <Button
                  variant="outline"
                  onClick={async () => {
                    const { renderToStaticMarkup } =
                      await import("react-dom/server");
                    download(
                      (payment?.receipt || docInvoice.number) + ".html",
                      `<!doctype html><html><head><meta charset="utf-8"><title>RentKeep document</title><style>body{font:15px system-ui;max-width:700px;margin:40px auto;padding:20px;color:#24372d}h1{font-size:28px}p{line-height:1.7}hr{border:0;border-top:1px solid #ddd;margin:25px 0}</style></head><body>${renderToStaticMarkup(docContent)}</body></html>`,
                      "text/html",
                    );
                  }}
                >
                  <Download />
                  HTML
                </Button>
                <Button onClick={() => window.print()}>
                  <Printer />
                  Print / Save PDF
                </Button>
              </div>
            </>
          ) : (
            <form onSubmit={submit}>
              {Fields()}
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </Button>
                <Button disabled={saving} type="submit">
                  {saving ? "Saving…" : submits[modal?.type]}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {docContent &&
        createPortal(
          <div className="print-only">{docContent}</div>,
          document.body,
        )}
      <Toaster richColors position="top-center" />
    </>
  );
}
function Receipt({ invoice: i, payment: p, state, live }) {
  return (
    <article className="receipt-paper">
      <p className="eyebrow">P&O ENTERPRISE · RENTKEEP</p>
      <h1>{p ? "Payment receipt" : "Invoice"}</h1>
      {!live && <Pill tone="amber">Fictional demo document</Pill>}
      <p className="quiet mt-4">
        {p?.receipt || i.number} · {date(p?.date || i.date)}
      </p>
      <hr className="receipt-rule" />
      <p className="quiet">{p ? "Received from" : "Bill to"}</p>
      <h2 className="text-lg font-semibold mt-1">{i.name}</h2>
      <p className="quiet mt-3">
        {i.room}
        <br />
        {i.description}
      </p>
      <p style={{ fontSize: 32, fontWeight: 600, margin: "25px 0" }}>
        {money(p?.amount || i.amount, i.currency)}
      </p>
      {p ? (
        <>
          <p className="quiet">
            Method: {p.method}
            <br />
            Reference: {p.reference}
            <br />
            Receipt recorded by: {p.admin}
            <br />
            Invoice: {i.number}
          </p>
          <p className="text-xs mt-4">
            Administrator confirmed receipt of funds externally.
          </p>
        </>
      ) : (
        <>
          <p className="quiet">
            Due: {date(i.due)}
            <br />
            Outstanding: {money(balance(i, state.payments), i.currency)}
          </p>
          <p className="text-xs font-semibold mt-4">
            This invoice is not proof of payment.
          </p>
        </>
      )}
      <hr className="receipt-rule" />
      <p className="quiet text-[10px]">
        {live ? "P&O Enterprise · Ghana" : "Fictional demonstration document."}
      </p>
    </article>
  );
}
