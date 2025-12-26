import { Context } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";

// 型定義
type Bindings = {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  FRONTEND_URL: string;
  BACKEND_URL: string;
  // 環境変数で "true" / "false" 文字列として渡ってくる場合を考慮
  COOKIE_SECURE?: string | boolean;
};

// --- Cookieオプション生成の共通化 ---
// LoginとLogoutで完全に同じ設定を使うことが、削除トラブルを防ぐ唯一の方法です。

const getSessionCookieOptions = (c: Context<{ Bindings: Bindings }>) => {
  // 環境変数またはリクエストURLから判定
  const isSecure =
    c.env.COOKIE_SECURE === true ||
    c.env.COOKIE_SECURE === "true" ||
    new URL(c.req.url).protocol === "https:";

  // クロスサイト(FrontendとBackendのドメインが違う)場合、SameSite=Noneが必須
  // ただし、NoneにするにはSecure=trueが必須
  if (isSecure) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: "None" as const, // クロスドメインでCookieを送る設定
      path: "/",
      partitioned: true, // ChromeのCHIPS対応 (将来的な必須対応)
    };
  } else {
    // ローカル開発 (HTTP) 用
    return {
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const, // HTTP環境ではNoneは使えないためLax
      path: "/",
      partitioned: false,
    };
  }
};

// --- Route Handlers ---

// Google Auth Redirect
export const googleAuth = async (c: Context<{ Bindings: Bindings }>) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  // 環境変数からコールバックURLを作成 (hostヘッダー依存を排除)
  const backendUrl = c.env.BACKEND_URL || new URL(c.req.url).origin;
  const redirectUri = `${backendUrl}/auth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline", // リフレッシュトークンが必要な場合は指定
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
    // Auth時と全く同じ文字列である必要があります
    const backendUrl = c.env.BACKEND_URL || new URL(c.req.url).origin;
    const redirectUri = `${backendUrl}/auth/callback`;

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
      return c.text(`Failed to get token`, 400);
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

    // 既存ユーザー確認
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

    return c.redirect(c.env.FRONTEND_URL);
  } catch (e: any) {
    console.error("Callback Error:", e);
    return c.text(`Internal Server Error: ${e.message}`, 500);
  }
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
    // クッキーはあるがDBにいない場合（開発中のDBリセットなど）はクッキーを消す
    deleteCookie(c, "session_user_id", getSessionCookieOptions(c));
    return c.json({ error: "User not found" }, 404);
  }

  return c.json(user);
};

// Logout
export const logout = async (c: Context<{ Bindings: Bindings }>) => {
  const cookieOpts = getSessionCookieOptions(c);

  // ログイン時と全く同じオプションを指定して削除します。
  // これによりブラウザは「上書きして無効化」と認識します。
  deleteCookie(c, "session_user_id", cookieOpts);

  return c.json({ success: true });
};

// ... updateName, getRanking はそのまま ...
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


