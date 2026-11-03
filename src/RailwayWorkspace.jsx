import React, { useEffect, useState } from "react";
import App from "./App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeDevice } from "./subscribeDevice";
async function api(path, body) {
  const response = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const err = Error(
      response.status === 401
        ? "Sign-in expired or credentials incorrect."
        : result.error || "The shared service is unavailable. Try again.",
    );
    err.status = response.status;
    throw err;
  }
  return response.status === 204 ? null : response.json();
}
export default function RailwayWorkspace() {
  const [workspace, setWorkspace] = useState(null),
    [busy, setBusy] = useState(true),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    api("workspace")
      .then((v) => active && setWorkspace(v))
      .catch((e) => active && e.status !== 401 && setMessage(e.message))
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, []);
  async function request(path, body) {
    try {
      return await api(path, body);
    } catch (e) {
      if (e.status === 401) {
        setWorkspace(null);
        setMessage(e.message);
      }
      throw e;
    }
  }
  if (workspace)
    return (
      <App
        key={workspace.actor.email}
        live={{
          initial: workspace,
          keySetupUrl: "/key-setup.html",
          api: request,
          registerDevice: (key) => subscribeDevice(key, request),
          signOut: async () => {
            await request("logout", {});
            setWorkspace(null);
            setMessage("");
          },
        }}
      />
    );
  return (
    <main className="max-w-sm mx-auto px-5 py-20">
      <p className="eyebrow">P&O ENTERPRISE</p>
      <h1 className="page-title">RentKeep</h1>
      <p className="page-description mb-6">
        Sign in to your shared rental records.
      </p>
      {message && (
        <p className="notice mb-5" role="alert">
          {message}
        </p>
      )}
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setBusy(true);
          setMessage("");
          try {
            await api("login", {
              email: data.get("email"),
              key: data.get("key"),
            });
            setWorkspace(await api("workspace"));
          } catch (e) {
            setMessage(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="input-label">
          Administrator email
          <Input name="email" type="email" autoComplete="username" required />
        </label>
        <label className="input-label">
          Private sign-in key
          <Input
            name="key"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <Button disabled={busy}>
          {busy ? "Opening workspace…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
