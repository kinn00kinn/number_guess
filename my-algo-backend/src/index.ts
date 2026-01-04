import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from 'hono/http-exception';
import { AlgoRoom } from "./algoRoom";
import { MatchMaker } from "./matchMaker";
import { authApp, requireAuth, AppUser } from "./auth"; // New auth imports

// Extend the Hono context to include the authUser
type HonoContext = {
  Bindings: {
    ALGO_ROOM: DurableObjectNamespace;
    MATCH_MAKER: DurableObjectNamespace;
    DB: D1Database;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    AUTH_SECRET: string;
    FRONTEND_URL: string;
    BACKEND_URL: string;
  };
  Variables: {
    authUser: { session: { user: AppUser } };
  };
};

const app = new Hono<HonoContext>();

// CORS middleware
app.use("/*", cors({
  origin: "https://my-algo-web.pages.dev",
  allowHeaders: ["Content-Type", "Upgrade", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
}));

// Error handler for auth errors
app.onError((err, c) => {
  if (err instanceof HTTPException && err.status === 401) {
    // For API requests, returning a JSON error is more appropriate
    return c.json({ error: 'Unauthorized' }, 401);
  }
  console.error('An error occurred:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

// Auth.js routes are now at /api/auth/*
app.route("/api/auth", authApp);

const authMiddleware = requireAuth();

// New /me endpoint for frontend compatibility.
// Frontend should ideally call /api/auth/session, but this helps migration.
app.get("/me", authMiddleware, (c) => {
  const auth = c.get('authUser');
  // We need to fetch the full user from our database to match the old format
  const googleId = auth.session.user.id;

  // This is an async operation inside a non-async handler.
  // We need to return a promise.
  return c.env.DB.prepare("SELECT * FROM users WHERE google_id = ?")
    .bind(googleId)
    .first()
    .then(user => {
      if (!user) {
        return c.json({ error: "User not found in DB" }, 404);
      }
      return c.json(user);
    });
});

// Ranking route (public, no auth needed)
app.get("/ranking", async (c) => {
    const db = c.env.DB;
    const { results } = await db
        .prepare("SELECT name, rate, wins FROM users ORDER BY rate DESC LIMIT 100")
        .all();
    return c.json(results);
});

// Update user name route (protected)
app.put("/user/name", authMiddleware, async (c) => {
    const auth = c.get('authUser');
    const googleId = auth.session.user.id;
    const { name } = await c.req.json<{ name: string }>();

    if (!googleId) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    
    const db = c.env.DB;
    await db
        .prepare("UPDATE users SET name = ? WHERE google_id = ?")
        .bind(name, googleId)
        .run();

    return c.json({ success: true });
});

// Game Routes
app.get("/game/new", (c) => {
  const roomId = Math.floor(1000 + Math.random() * 9000).toString();
  return c.text(roomId);
});

app.get("/game/:id", authMiddleware, async (c) => {
  const auth = c.get('authUser');
  const googleId = auth.session.user.id;

  const user = await c.env.DB.prepare("SELECT id FROM users WHERE google_id = ?")
    .bind(googleId)
    .first<{ id: string }>();
  
  if (!user) {
    return c.json({ error: "User not found in DB" }, 404);
  }

  const id = c.req.param("id");
  const stubId = c.env.ALGO_ROOM.idFromName(id);
  const stub = c.env.ALGO_ROOM.get(stubId);

  // Create a new request with the internal user ID in a header
  const newReq = new Request(c.req.raw);
  newReq.headers.set('X-User-ID', user.id);

  return stub.fetch(newReq);
});

// Matchmaking Route (protected)
app.get("/match/random", authMiddleware, async (c) => {
  const auth = c.get('authUser');
  const googleId = auth.session.user.id;

  const user = await c.env.DB.prepare("SELECT id, rate FROM users WHERE google_id = ?")
    .bind(googleId)
    .first<{ id: string, rate: number }>();

  if (!user) {
    return c.json({ error: "User not found in our DB" }, 404);
  }

  const { id: internalUserId, rate } = user;
  
  const stubId = c.env.MATCH_MAKER.idFromName("global");
  const stub = c.env.MATCH_MAKER.get(stubId);

  const url = new URL(c.req.url);
  url.searchParams.set("userId", internalUserId);
  url.searchParams.set("rate", (rate || 1500).toString());

  const newReq = new Request(url.toString(), c.req.raw);
  return stub.fetch(newReq);
});

app.get("/debug", (c) => {
  return c.json({
    backend_url: c.env.BACKEND_URL || "undefined",
    frontend_url: c.env.FRONTEND_URL || "undefined",
    has_client_id: !!c.env.GOOGLE_CLIENT_ID,
  });
});

export default app;
export { AlgoRoom, MatchMaker };
