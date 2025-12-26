import { Context, Hono } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { googleAuth } from "@hono/oauth-providers/google";

// 型定義
type Bindings = {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  FRONTEND_URL: string;
  BACKEND_URL: string;
  COOKIE_SECURE?: string | boolean;
};

// --- Cookieオプション生成の共通化 ---
const COOKIE_NAME = "__Secure-session_user_id";

const getSessionCookieOptions = (c: Context<{ Bindings: Bindings }>) => {
  const url = new URL(c.req.url);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";

  if (isLocal) {
    return {
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
      path: "/",
    };
  } else {
    return {
      httpOnly: true,
      secure: true,
      sameSite: "None" as const,
      path: "/",
      partitioned: true,
    };
  }
};

// --- Auth App Definition ---
// Honoのサブアプリとして定義し、index.tsでマウントする形にします
const authApp = new Hono<{ Bindings: Bindings }>();

// 1. Google Auth Middlewareの設定
// /auth/google へのアクセスで自動的にGoogleへリダイレクト
// /auth/callback へのアクセスでトークン交換とユーザー情報取得を実行
authApp.use(
  "/google",
  googleAuth({
    scope: ["openid", "email", "profile"],
  })
);

authApp.use(
  "/callback",
  googleAuth({
    scope: ["openid", "email", "profile"],
  }),
  async (c) => {
    const userGoogle = c.get("user-google");
    if (!userGoogle) {
      return c.text("Failed to get user info", 400);
    }

    const db = c.env.DB;
    let userId = "";

    // 既存ユーザー確認
    const existingUser: any = await db
      .prepare("SELECT id FROM users WHERE google_id = ?")
      .bind(userGoogle.id)
      .first();

    if (existingUser) {
      userId = existingUser.id;
    } else {
      userId = crypto.randomUUID();
      await db
        .prepare("INSERT INTO users (id, google_id, name) VALUES (?, ?, ?)")
        .bind(userId, userGoogle.id, userGoogle.name)
        .run();
    }

    // Cookie保存
    const cookieOpts = getSessionCookieOptions(c);
    setCookie(c, COOKIE_NAME, userId, {
      ...cookieOpts,
      maxAge: 60 * 60 * 24 * 7, // 7日間
    });

    // HTMLレスポンスで確実にCookieを保存させてから遷移
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Redirecting...</title>
      </head>
      <body>
        <p>Login successful. Redirecting...</p>
        <script>
          setTimeout(() => {
            window.location.href = "${c.env.FRONTEND_URL}";
          }, 100);
        </script>
      </body>
      </html>
    `);
  }
);

// 2. その他のAuthルート
authApp.get("/me", async (c) => {
  const userId = getCookie(c, COOKIE_NAME);
  if (!userId) return c.json({ error: "Not logged in" }, 401);

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first();

  if (!user) {
    deleteCookie(c, COOKIE_NAME, getSessionCookieOptions(c));
    return c.json({ error: "User not found" }, 404);
  }
  return c.json(user);
});

authApp.post("/logout", async (c) => {
  const cookieOpts = getSessionCookieOptions(c);
  deleteCookie(c, COOKIE_NAME, cookieOpts);
  return c.json({ success: true });
});

export { authApp, getSessionCookieOptions, COOKIE_NAME };

// 互換性のために古い関数もエクスポートしておく（index.tsの修正が終わるまで）
export const updateName = async (c: Context) => {
  const userId = getCookie(c, COOKIE_NAME);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  const { name } = await c.req.json<{ name: string }>();
  const db = c.env.DB as D1Database;
  await db
    .prepare("UPDATE users SET name = ? WHERE id = ?")
    .bind(name, userId)
    .run();
  return c.json({ success: true });
};

export const getRanking = async (c: Context) => {
  const db = c.env.DB as D1Database;
  const { results } = await db
    .prepare("SELECT name, rate, wins FROM users ORDER BY rate DESC LIMIT 100")
    .all();
  return c.json(results);
};

