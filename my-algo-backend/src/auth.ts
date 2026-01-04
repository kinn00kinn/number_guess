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

// Google Auth User Type
type GoogleUser = {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
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
      // `Partitioned` は一部環境で未対応か挙動が厳しいため除去する
    };
  }
};

// --- Auth App Definition ---
const authApp = new Hono<{ Bindings: Bindings }>();

// 1. Google Auth Middlewareの設定
// redirect_uri を明示的に指定して、/google ではなく /callback に戻るようにする

authApp.get("/google", async (c, next) => {
  // 末尾のスラッシュ有無を考慮してURLを結合
  const backendUrl = c.env.BACKEND_URL.replace(/\/$/, "");
  const redirectUri = `${backendUrl}/auth/callback`;

  const auth = googleAuth({
    client_id: c.env.GOOGLE_CLIENT_ID,
    client_secret: c.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri, // ★ここを追加
    scope: ["openid", "email", "profile"],
  });
  return auth(c, next);
});

authApp.get(
  "/callback",
  async (c, next) => {
    const backendUrl = c.env.BACKEND_URL.replace(/\/$/, "");
    const redirectUri = `${backendUrl}/auth/callback`;

    const auth = googleAuth({
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri, // ★ここも同様に追加（必須）
      scope: ["openid", "email", "profile"],
    });
    return auth(c, next);
  },
  async (c) => {
    // 一部の oauth プロバイダ実装ではキー名が異なる場合があるため、
    // 代表的な候補を順に参照してフォールバックする
    const userGoogle =
      ((c as any).get("user-google") as GoogleUser | undefined) ||
      ((c as any).get("user") as GoogleUser | undefined) ||
      ((c as any).get("google-user") as GoogleUser | undefined);

    if (!userGoogle) {
      console.error("auth callback: no user info found on context", {
        url: c.req.url,
      });
      return c.text("Failed to get user info", 400);
    }

    const db = c.env.DB;
    let userId = "";

    // 既存ユーザー確認
    const existingUser = await db
      .prepare("SELECT id FROM users WHERE google_id = ?")
      .bind(userGoogle.id)
      .first<{ id: string }>();

    if (existingUser) {
      userId = existingUser.id;
    } else {
      userId = crypto.randomUUID();
      try {
        await db
          .prepare("INSERT INTO users (id, google_id, name) VALUES (?, ?, ?)")
          .bind(userId, userGoogle.id, userGoogle.name)
          .run();
      } catch (e) {
        console.error("Failed to insert user", e);
        return c.text("Database Error", 500);
      }
    }

    // Cookie保存
    const cookieOpts = getSessionCookieOptions(c);
    setCookie(c, COOKIE_NAME, userId, {
      ...cookieOpts,
      maxAge: 60 * 60 * 24 * 7, // 7日間
    });
    c.header(
      "Set-Cookie",
      buildSetCookie("session_user_id", userId, cookieOpts)
    );

    // フロントエンドへリダイレクト
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

// 互換性のために古い関数もエクスポート
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
