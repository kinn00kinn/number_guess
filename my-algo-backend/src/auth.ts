import { Context } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";

// --- 共通ヘルパー: 環境判定とCookieオプションの統一 ---

// プロトコルと環境判定
const getEnvInfo = (c: Context) => {
  const host = c.req.header("host") || "";

  // Cloudflare等のプロキシヘッダーを確認 (カンマ区切りの場合もあるのでincludesで判定)
  const forwardedProto = c.req.header("x-forwarded-proto") || "";
  const isHttps = forwardedProto.includes("https");

  // ローカル環境判定 (localhost または IPアドレス)
  const isLocal =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]") ||
    host.match(/^192\.168\./);

  // 本番(HTTPS)ならSecure必須、ローカルならfalse
  // ※重要: Cloudflare Workers上では req.url は http になることがあるため、ヘッダー判定が必須
  const secure = isHttps;

  return { host, secure, isLocal };
};

// Cookieオプションを生成する共通関数 (ログイン・ログアウトで必ず同じ設定を使うため)
const getSessionCookieOptions = (c: Context) => {
  const { secure, isLocal } = getEnvInfo(c);

  // クロスオリジン(フロントとバックが別ドメイン)通信を考慮した設定
  // HTTPS環境(本番)なら SameSite=None; Secure
  // HTTP環境(ローカル)なら SameSite=Lax
  if (secure) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: "None" as const, // クロスサイトでCookieを送るために必須
      path: "/",
      partitioned: true, // ChromeのサードパーティCookie廃止(CHIPS)対応
    };
  } else {
    return {
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const, // ローカル環境(http)ではNoneは使えないためLax
      path: "/",
      partitioned: false,
    };
  }
};

// --- Route Handlers ---

export const googleAuth = async (c: Context) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const { host, secure } = getEnvInfo(c);

  // リダイレクトURIの構築
  const protocol = secure ? "https" : "http";
  const redirectUri =
    c.env.GOOGLE_REDIRECT_URI || `${protocol}://${host}/auth/callback`;

  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid%20email%20profile`;

  return c.redirect(url);
};

export const googleCallback = async (c: Context) => {
  try {
    const code = c.req.query("code");
    if (!code) return c.text("No code provided", 400);

    const clientId = c.env.GOOGLE_CLIENT_ID;
    const clientSecret = c.env.GOOGLE_CLIENT_SECRET;

    // Auth時と同じロジックでRedirect URIを構築
    const { host, secure } = getEnvInfo(c);
    const protocol = secure ? "https" : "http";
    const redirectUri =
      c.env.GOOGLE_REDIRECT_URI || `${protocol}://${host}/auth/callback`;

    // 1. Googleからトークン取得
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

    // 2. ユーザー情報取得
    const userResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );
    const userData = (await userResponse.json()) as any;

    // 3. DB保存 (Upsert)
    const db = c.env.DB as D1Database;
    let userId = "";

    try {
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
    } catch (e: any) {
      return c.text(`Database Error: ${e.message}`, 500);
    }

    // 4. Cookie保存 (重要: 共通オプションを使用)
    const cookieOpts = getSessionCookieOptions(c);

    // setCookieするときは maxAge を追加
    setCookie(c, "session_user_id", userId, {
      ...cookieOpts,
      maxAge: 60 * 60 * 24 * 7, // 7日間
    });

    const frontendUrl = c.env.FRONTEND_URL || "http://localhost:3000";
    return c.redirect(frontendUrl);
  } catch (e: any) {
    console.error("Callback Error:", e);
    return c.text(`Internal Server Error: ${e.message}`, 500);
  }
};

export const getMe = async (c: Context) => {
  const userId = getCookie(c, "session_user_id");
  if (!userId) return c.json({ error: "Not logged in" }, 401);

  const db = c.env.DB as D1Database;
  const user = await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first();

  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json(user);
};

export const logout = async (c: Context) => {
  // 5. ログアウト (重要: 保存時と同じオプションで削除)
  const cookieOpts = getSessionCookieOptions(c);

  // メインの削除処理
  deleteCookie(c, "session_user_id", cookieOpts);

  // 念のための保険:
  // もし開発中などに古い形式(属性違い)のCookieが残ってしまっていると
  // 上記だけでは消えないことがあるため、属性を変えたパターンも空打ちしておく
  // (これが前回の修正で「ログアウトできた」要因です)

  if (cookieOpts.secure) {
    // Secure環境なら、Partitionedなし版も消しておく
    deleteCookie(c, "session_user_id", { ...cookieOpts, partitioned: false });
  } else {
    // Local環境なら、Secureあり版も念のため消しておく
    deleteCookie(c, "session_user_id", {
      ...cookieOpts,
      secure: true,
      sameSite: "None",
    });
  }

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
