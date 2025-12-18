import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie } from "hono/cookie";
import { AlgoRoom } from "./algoRoom";
import { MatchMaker } from "./matchMaker";
import { googleAuth, googleCallback, getMe, updateName, getRanking, logout } from "./auth";

type Bindings = {
  ALGO_ROOM: DurableObjectNamespace;
  MATCH_MAKER: DurableObjectNamespace;
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  FRONTEND_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  "/*",
  cors({
    origin: (origin) => origin,
    allowHeaders: ["Content-Type", "Upgrade"],
    allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
    credentials: true,
  })
);

// Auth Routes
app.get("/auth/google", googleAuth);
app.get("/auth/callback", googleCallback);
app.get("/auth/me", getMe);
app.post("/auth/logout", logout);
app.put("/user/name", updateName);
app.get("/ranking", getRanking);

// Game Routes
app.get("/game/new", (c) => {
  const roomId = Math.floor(1000 + Math.random() * 9000).toString();
  return c.text(roomId);
});

app.get("/game/:id", async (c) => {
  const id = c.req.param("id");
  const stubId = c.env.ALGO_ROOM.idFromName(id);
  const stub = c.env.ALGO_ROOM.get(stubId);
  return stub.fetch(c.req.raw);
});

// Matchmaking Route
app.get("/match/random", async (c) => {
  const userId = getCookie(c, "session_user_id");
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare("SELECT rate FROM users WHERE id = ?").bind(userId).first<any>();
  const rate = user?.rate || 1500;

  const stubId = c.env.MATCH_MAKER.idFromName("global");
  const stub = c.env.MATCH_MAKER.get(stubId);
  
  const url = new URL(c.req.url);
  url.searchParams.set("userId", userId);
  url.searchParams.set("rate", rate.toString());
  
  const newReq = new Request(url.toString(), c.req.raw);
  return stub.fetch(newReq);
});

export default app;
export { AlgoRoom, MatchMaker };
