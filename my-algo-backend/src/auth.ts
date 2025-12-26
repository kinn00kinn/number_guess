import { Context } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";

// 型定義
type Bindings = {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  FRONTEND_URL: string;
  BACKEND_URL: string;
  COOKIE_SECURE?: string | boolean;
};

// --- Cookieオプションの共通化 (Login/Logoutで完全に一致させる) ---
const getSessionCookieOptions = (c: Context<{ Bindings: Bindings }>) => {
  // 環境変数でSecure判定 (文字の"true"も考慮)
  const isSecure =
    c.env.COOKIE_SECURE === true || c.env.COOKIE_SECURE === "true";

  if (isSecure) {
    // 本番環境 (HTTPS / Cross-Site)
    return {
      httpOnly: true,
      secure: true,
      sameSite: "None" as const, // クロスドメイン必須
      path: "/",
      partitioned: true, // ChromeのCHIPS対応
    };
  } else {
    // ローカル開発 (HTTP)
    return {
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
      path: "/",
    };
  }
};

// --- Route Handlers ---

// Google Auth Redirect
export const googleAuth = async (c: Context<{ Bindings: Bindings }>) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;

  // 【重要】動的判定せず、必ず環境変数の BACKEND_URL を使う
  // これにより undefined エラーや http/https の不一致を防ぐ
  const redirectUri = `${c.env.BACKEND_URL}/auth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });

  return c.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
};

// Google Auth Callback
export const googleCallback = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const code = c.req.query("code");
    if (!code) return c.text("No code provided", 400);

    const clientId = c.env.GOOGLE_CLIENT_ID;
    const clientSecret = c.env.GOOGLE_CLIENT_SECRET;

    // Auth時と完全に同じURIを指定する
    const redirectUri = `${c.env.BACKEND_URL}/auth/callback`;

    // 1. Token Exchange
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = (await tokenResponse.json()) as any;
    if (!tokenData.access_token) {
      console.error("Token Error:", tokenData);
      return c.text(`Failed to get token: ${JSON.stringify(tokenData)}`, 400);
    }

    // 2. User Info
    const userResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );
    const userData = (await userResponse.json()) as any;

    // 3. DB Upsert
    const db = c.env.DB;
    let userId = "";

    const existingUser: any = await db
      .prepare("SELECT id FROM users WHERE google_id = ?")
      .bind(userData.id)
      .first();

    if (existingUser) {
      userId = existingUser.id;
    } else {
      userId = crypto.randomUUID();
      await db
        .prepare("INSERT INTO users (id, google_id, name) VALUES (?, ?, ?)")
        .bind(userId, userData.id, userData.name)
        .run();
    }

    // 4. Set Cookie
    const cookieOpts = getSessionCookieOptions(c);
    setCookie(c, "session_user_id", userId, {
      ...cookieOpts,
      maxAge: 60 * 60 * 24 * 7, // 7日間
    });

    // フロントエンドへ戻る
    return c.redirect(c.env.FRONTEND_URL);
  } catch (e: any) {
    console.error("Callback Error:", e);
    return c.text(`Internal Server Error: ${e.message}`, 500);
  }
};

// Logout
export const logout = async (c: Context<{ Bindings: Bindings }>) => {
  const cookieOpts = getSessionCookieOptions(c);

  // ログイン時と全く同じオプションで削除
  deleteCookie(c, "session_user_id", cookieOpts);

  return c.json({ success: true });
};

// Get Me
export const getMe = async (c: Context<{ Bindings: Bindings }>) => {
  const userId = getCookie(c, "session_user_id");
  if (!userId) return c.json({ error: "Not logged in" }, 401);

  const db = c.env.DB;
  const user = await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first();

  if (!user) {
    deleteCookie(c, "session_user_id", getSessionCookieOptions(c));
    return c.json({ error: "User not found" }, 404);
  }

  return c.json(user);
};

// updateName, getRanking はそのままでOK
export const updateName = async (c: Context) => {
  const userId = getCookie(c, "session_user_id");
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
