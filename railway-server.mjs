import http from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { database, administrators } from "./backend/runtime.js";
import { makeAuth, credentials } from "./backend/railway-auth.js";
import { handleApi } from "./netlify/functions/api.mjs";
import reminders from "./netlify/functions/renewals.mjs";
const root = new URL("./dist/", import.meta.url);
const types = {
  html: "text/html; charset=utf-8",
  js: "text/javascript",
  css: "text/css",
  svg: "image/svg+xml",
  png: "image/png",
  webmanifest: "application/manifest+json",
};
export function createApp({
  setupOnly = false,
  origin,
  auth = makeAuth(),
  db = database,
  getAdmins = administrators,
  ready = () => db().query("SELECT digest FROM rentkeep.sessions LIMIT 0"),
}) {
  let attempts = 0,
    windowEnd = 0;
  return http.createServer(
    { requestTimeout: 15000, headersTimeout: 10000 },
    async (req, res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; form-action 'self'",
      );
      try {
        const path = req.url.split("?")[0];
        if (path === "/healthz") {
          if (!setupOnly) await ready();
          res.end("ready");
          return;
        }
        if (setupOnly && path === "/") {
          res.writeHead(302, { Location: "/key-setup.html" }).end();
          return;
        }
        if (setupOnly && !["/key-setup.html", "/key-setup.js"].includes(path)) {
          res.writeHead(503).end();
          return;
        }
        if (path.startsWith("/api/")) {
          if (
            ![
              "/api/login",
              "/api/logout",
              "/api/workspace",
              "/api/device",
              "/api/commands",
            ].includes(path)
          ) {
            res.writeHead(404).end();
            return;
          }
          if (!["GET", "POST"].includes(req.method)) {
            res.writeHead(405).end();
            return;
          }
          if (req.method === "POST" && req.headers.origin !== origin) {
            res.writeHead(403).end();
            return;
          }
          if (path === "/api/login" && req.method === "POST") {
            if (Date.now() > windowEnd) {
              attempts = 0;
              windowEnd = Date.now() + 60000;
            }
            if (++attempts > 60) {
              res.writeHead(429, { "Retry-After": "60" }).end();
              return;
            }
          }
          const chunks = [];
          let size = 0;
          if (req.method === "POST")
            for await (const chunk of req) {
              size += chunk.length;
              if (size > 24000) {
                res.writeHead(413).end();
                return;
              }
              chunks.push(chunk);
            }
          const request = new Request(new URL(path, origin), {
            method: req.method,
            headers: req.headers,
            body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
          });
          const out = ["/api/login", "/api/logout"].includes(path)
            ? await auth.route(request, path)
            : await handleApi(request, {
                getDatabase: db,
                getAdmins,
                verify: auth.verify,
              });
          res.writeHead(out.status, Object.fromEntries(out.headers));
          res.end(Buffer.from(await out.arrayBuffer()));
          return;
        }
        if (!["GET", "HEAD"].includes(req.method)) {
          res.writeHead(405).end();
          return;
        }
        if (
          !/^\/[a-zA-Z0-9._/-]*$/.test(path) ||
          path.includes("..") ||
          path.includes("//")
        ) {
          res.writeHead(404).end();
          return;
        }
        const file = new URL(path === "/" ? "index.html" : path.slice(1), root);
        let data;
        try {
          data = await readFile(file);
        } catch {
          res.writeHead(404).end();
          return;
        }
        res.setHeader(
          "Content-Type",
          types[file.pathname.split(".").pop()] || "application/octet-stream",
        );
        res.setHeader(
          "Cache-Control",
          path.startsWith("/assets/")
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        );
        res.end(req.method === "HEAD" ? undefined : data);
      } catch (e) {
        res
          .writeHead(e.status === 401 ? 401 : 503, {
            "Content-Type": "application/json",
          })
          .end(
            JSON.stringify({
              error:
                e.status === 401
                  ? "Sign in to continue."
                  : "Service unavailable.",
            }),
          );
      }
    },
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const setupOnly = process.env.RENTKEEP_SETUP_ONLY === "true";
  if (!setupOnly) credentials();
  const origin = new URL(
    process.env.PUBLIC_ORIGIN ||
      "https://" + (process.env.RAILWAY_PUBLIC_DOMAIN || ""),
  ).origin;
  if (!origin.startsWith("https://"))
    throw Error("A public HTTPS origin is required");
  const app = createApp({ origin, setupOnly });
  let running,
    closing = false;
  function tick() {
    if (setupOnly || closing || running) return;
    running = reminders()
      .catch(() =>
        console.error(
          "Reminder check failed; check database access and configuration.",
        ),
      )
      .finally(() => {
        running = null;
      });
  }
  const timer = setInterval(tick, 15 * 60 * 1000);
  app.listen(Number(process.env.PORT || 8080), "::", () => {
    console.log("RentKeep web service started.");
    tick();
  });
  function stop() {
    if (closing) return;
    closing = true;
    clearInterval(timer);
    app.close(async () => {
      await running;
      if (!setupOnly) await database().end();
    });
  }
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
