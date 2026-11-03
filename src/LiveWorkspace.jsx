import { subscribeDevice } from "./subscribeDevice";
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import App from "./App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
let client;
function auth() {
  if (
    !import.meta.env.VITE_SUPABASE_URL ||
    !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  )
    throw Error("Live sign-in has not been configured for this site.");
  return (client ??= createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  ));
}
async function api(path, body) {
  const {
    data: { session },
  } = await auth().auth.getSession();
  if (!session) throw Error("Sign in again to continue.");
  const response = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + session.access_token,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw Error("Shared records service is unavailable.");
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(Error(result.error || "Request failed."), {
      status: response.status,
    });
  return result;
}
export const registerDevice = (key) => subscribeDevice(key, api);
export default function LiveWorkspace() {
  const [preview, setPreview] = useState(false),
    [sending, setSending] = useState(false);
  const [session, setSession] = useState(null),
    [workspace, setWorkspace] = useState(null),
    [message, setMessage] = useState(""),
    [boot, setBoot] = useState(true);
  useEffect(() => {
    let subscription;
    try {
      subscription = auth().auth.onAuthStateChange((_, s) => {
        setSession(s);
        if (!s) setWorkspace(null);
        setBoot(false);
      }).data.subscription;
    } catch (e) {
      setMessage(e.message);
      setBoot(false);
    }
    return () => subscription?.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) return;
    let disposed = false;
    api("workspace")
      .then((v) => {
        if (!disposed) {
          setWorkspace(v);
          setMessage("");
        }
      })
      .catch((e) => {
        if (!disposed) setMessage(e.message);
      });
    return () => {
      disposed = true;
    };
  }, [session?.user?.id]);
  if (preview && !configured) return <App />;
  if (!configured)
    return (
      <main className="max-w-sm mx-auto px-5 py-20">
        <p className="eyebrow">P&O ENTERPRISE</p>
        <h1 className="page-title">Welcome to RentKeep</h1>
        <p className="page-description mb-6">
          Shared sign-in is awaiting setup. Explore the layout with fictional
          records on this device.
        </p>
        <Button onClick={() => setPreview(true)}>Explore fictional demo</Button>
      </main>
    );
  if (
    workspace &&
    session &&
    workspace.actor.email === session.user.email?.toLowerCase()
  )
    return (
      <App
        key={session.user.id}
        live={{
          initial: workspace,
          api,
          signOut: () => auth().auth.signOut(),
          registerDevice,
        }}
      />
    );
  return (
    <main className="max-w-sm mx-auto px-5 py-20">
      <p className="eyebrow">P&O ENTERPRISE</p>
      <h1 className="page-title">RentKeep</h1>
      <p className="page-description mb-6">
        {boot
          ? "Opening your workspace…"
          : session
            ? "Opening shared records…"
            : "Sign in with your administrator email."}
      </p>
      {message && (
        <p role="status" className="notice mb-5">
          {message}
        </p>
      )}
      {!boot && !session && (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const email = new FormData(e.currentTarget).get("email");
            setSending(true);
            try {
              const { error } = await auth().auth.signInWithOtp({
                email,
                options: {
                  shouldCreateUser: false,
                  emailRedirectTo: location.origin,
                },
              });
              if (error) throw error;
              setMessage("Check your email for your sign-in link.");
            } catch {
              setMessage(
                "Sign-in could not be started. Check the address and workspace configuration.",
              );
            } finally {
              setSending(false);
            }
          }}
        >
          <label className="input-label">
            Administrator email
            <Input name="email" type="email" autoComplete="email" required />
          </label>
          <Button type="submit" disabled={sending}>
            {sending ? "Sending…" : "Send sign-in link"}
          </Button>
        </form>
      )}
      {session && (
        <Button onClick={() => auth().auth.signOut()}>Sign out</Button>
      )}
    </main>
  );
}
