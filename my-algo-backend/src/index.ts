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

// CORS設定の修正
app.use("/*", async (c, next) => {
  const corsMiddleware = cors({
    origin: (origin) => {
      // 許可するオリジンのリスト
      const allowedOrigins = [
        c.env.FRONTEND_URL, // 環境変数 (https://my-algo-web.pages.dev)
        "http://localhost:3000",
        "http://localhost:5173",
        "https://my-algo-web.pages.dev",
      ];

      // 末尾のスラッシュ有無の揺れを吸収するため、部分一致や正規化を検討しても良いが
      // ここでは完全一致またはリストに含まれるかで判定
      if (allowedOrigins.includes(origin)) {
        return origin;
      }
      // 環境変数が読み込めていない場合などのフォールバック
      if (origin && origin.endsWith(".pages.dev")) {
        return origin;
      }
      return origin; // 開発中は便宜上すべて許可する場合 (本番では厳密にすべき)
    },
    allowHeaders: ["Content-Type", "Upgrade", "Authorization", "Cookie"], // Cookieを追加
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  });
  return corsMiddleware(c, next);
});

// Auth Routes
app.route("/auth", authApp);
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
  const userId = getCookie(c, COOKIE_NAME);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare("SELECT rate FROM users WHERE id = ?")
    .bind(userId)
    .first<any>();
  const rate = user?.rate || 1500;

  const stubId = c.env.MATCH_MAKER.idFromName("global");
  const stub = c.env.MATCH_MAKER.get(stubId);

  const url = new URL(c.req.url);
  url.searchParams.set("userId", userId);
  url.searchParams.set("rate", rate.toString());

  const newReq = new Request(url.toString(), c.req.raw);
  return stub.fetch(newReq);
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
