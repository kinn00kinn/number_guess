import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie } from "hono/cookie";
import { AlgoRoom } from "./algoRoom";
import { MatchMaker } from "./matchMaker";
import { authApp, updateName, getRanking, COOKIE_NAME } from "./auth";

type Bindings = {
  ALGO_ROOM: DurableObjectNamespace;
  MATCH_MAKER: DurableObjectNamespace;
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  FRONTEND_URL: string;
  BACKEND_URL: string;
  COOKIE_SECURE?: string | boolean;
};

const app = new Hono<{ Bindings: Bindings }>();

const normalizeOrigin = (value: string | undefined) => value?.replace(/\/$/, "");

const isAllowedBrowserOrigin = (
  configuredFrontend: string | undefined,
  origin: string | undefined,
) => {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  const allowedOrigins = new Set(
    [
      normalizeOrigin(configuredFrontend),
      "http://localhost:3000",
      "http://localhost:5173",
      "https://binarily.kinn-kinn.com",
      "https://my-algo-web.pages.dev",
    ].filter(Boolean),
  );
  return (
    (!!normalized && allowedOrigins.has(normalized)) ||
    !!normalized?.endsWith(".my-algo-web.pages.dev")
  );
};

app.use("/*", async (c, next) => {
  const corsMiddleware = cors({
    origin: (origin) =>
      isAllowedBrowserOrigin(c.env.FRONTEND_URL, origin) ? origin : "",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  });
  return corsMiddleware(c, next);
});

app.route("/auth", authApp);
app.put("/user/name", updateName);
app.get("/ranking", getRanking);

app.get("/game/new", async (c) => {
  for (let attempt = 0; attempt < 32; attempt++) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const roomId = (1000 + (random[0] % 9000)).toString();
    const stub = c.env.ALGO_ROOM.get(c.env.ALGO_ROOM.idFromName(roomId));
    const reserved = await stub.fetch("https://room.internal/reserve", {
      method: "POST",
    });
    if (reserved.ok) return c.text(roomId);
  }
  return c.json({ error: "No room ID available. Please retry." }, 503);
});

app.get("/game/:id", async (c) => {
  if (!isAllowedBrowserOrigin(c.env.FRONTEND_URL, c.req.header("Origin"))) {
    return c.json({ error: "Origin not allowed" }, 403);
  }
  const id = c.req.param("id");
  const stub = c.env.ALGO_ROOM.get(c.env.ALGO_ROOM.idFromName(id));
  const headers = new Headers(c.req.raw.headers);
  const userId = getCookie(c, COOKIE_NAME);
  if (userId) headers.set("x-binarily-user-id", userId);
  else headers.delete("x-binarily-user-id");

  const forwarded = new Request(c.req.url, {
    method: c.req.method,
    headers,
  });
  return stub.fetch(forwarded);
});

app.get("/match/random", async (c) => {
  if (!isAllowedBrowserOrigin(c.env.FRONTEND_URL, c.req.header("Origin"))) {
    return c.json({ error: "Origin not allowed" }, 403);
  }
  const userId = getCookie(c, COOKIE_NAME);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const user = await c.env.DB.prepare("SELECT rate FROM users WHERE id = ?")
    .bind(userId)
    .first<{ rate: number }>();
  const rate = user?.rate ?? 1500;

  const stub = c.env.MATCH_MAKER.get(c.env.MATCH_MAKER.idFromName("global"));
  const url = new URL(c.req.url);
  url.searchParams.set("userId", userId);
  url.searchParams.set("rate", rate.toString());
  return stub.fetch(new Request(url.toString(), c.req.raw));
});

app.get("/debug", (c) => {
  return c.json({
    backend_url: c.env.BACKEND_URL || "undefined",
    frontend_url: c.env.FRONTEND_URL || "undefined",
    has_client_id: !!c.env.GOOGLE_CLIENT_ID,
    cookie_secure:
      c.env.COOKIE_SECURE === true || c.env.COOKIE_SECURE === "true",
  });
});

export default app;
export { AlgoRoom, MatchMaker };
