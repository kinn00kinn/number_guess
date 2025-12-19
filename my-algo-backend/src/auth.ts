import { Context } from "hono";
import { getCookie } from "hono/cookie";

export const googleAuth = async (c: Context) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const redirectUri = c.env.GOOGLE_REDIRECT_URI || getRedirectUri(c);

  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid%20email%20profile`;

  return c.redirect(url);
};

export const googleCallback = async (c: Context) => {
  try {
    const code = c.req.query("code");
    if (!code) return c.text("No code provided", 400);

    const clientId = c.env.GOOGLE_CLIENT_ID;
    const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return c.text(
        "Configuration Error: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing.",
        500
      );
    }

    const redirectUri = c.env.GOOGLE_REDIRECT_URI || getRedirectUri(c);

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

    const userResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );
    const userData = (await userResponse.json()) as any;

    const db = c.env.DB as D1Database;

    // Check if table exists (or just try query)
    let existingUser;
    try {
      existingUser = await db
        .prepare("SELECT * FROM users WHERE google_id = ?")
        .bind(userData.id)
        .first();
    } catch (e: any) {
      return c.text(`Database Error (Select): ${e.message}`, 500);
    }

    let userId = existingUser?.id as string;
    if (!existingUser) {
      userId = crypto.randomUUID();
      try {
        await db
          .prepare("INSERT INTO users (id, google_id, name) VALUES (?, ?, ?)")
          .bind(userId, userData.id, userData.name)
          .run();
      } catch (e: any) {
        return c.text(`Database Error (Insert): ${e.message}`, 500);
      }
    }

    const url = new URL(c.req.url);

    const cookieOpts = buildCookieOptions(c, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    c.header(
      "Set-Cookie",
      buildSetCookie("session_user_id", userId, cookieOpts)
    );

    const frontendUrl = c.env.FRONTEND_URL || "http://localhost:3000";
    return c.redirect(frontendUrl);
  } catch (e: any) {
    console.error("Callback Error:", e);
    return c.text(
      `Internal Server Error: ${e.message}
${e.stack}`,
      500
    );
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
  const url = new URL(c.req.url);
  const cookieOpts = buildCookieOptions(c, {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  c.header("Set-Cookie", buildSetCookie("session_user_id", "", cookieOpts));
  return c.json({ success: true });
};

export const updateName = async (c: Context) => {
  const userId = getCookie(c, "session_user_id");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { name } = await c.req.json<{ name: string }>();
  if (!name || name.length > 10) return c.json({ error: "Invalid name" }, 400);

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

// Helpers
function isLocalhost(host?: string) {
  if (!host) return false;
  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]")
  );
}

function getDefaultOrigin(c: Context) {
  const host = c.req.header("host") || "localhost:3000";
  return `https://${host}`;
}

function getRedirectUri(c: Context) {
  const host = c.req.header("host");
  if (!host) return undefined;
  // Prefer x-forwarded-proto if present (Cloudflare Workers / proxies)
  const xfProto = c.req.header("x-forwarded-proto");
  if (xfProto) return `${xfProto}://${host}/auth/callback`;
  const cfVisitor = c.req.header("cf-visitor");
  if (cfVisitor) {
    try {
      const parsed = JSON.parse(cfVisitor as string) as any;
      if (parsed?.scheme) return `${parsed.scheme}://${host}/auth/callback`;
    } catch {
      // ignore
    }
  }
  return `https://${host}/auth/callback`;
}

type CookieOpts = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None" | undefined;
  maxAge?: number;
  path?: string;
  partitioned?: boolean;
};

function buildCookieOptions(c: Context, base: CookieOpts): CookieOpts {
  const host = c.req.header("host") || "";
  const local = isLocalhost(host);
  if (local) {
    return {
      ...base,
      secure: false,
      sameSite: base.sameSite ?? "Lax",
      partitioned: false,
    };
  }
  return {
    ...base,
    secure: true,
    sameSite: "None",
    partitioned: true,
  };
}

function buildSetCookie(name: string, value: string, opts: CookieOpts) {
  const parts: string[] = [];
  parts.push(`${name}=${encodeURIComponent(value)}`);
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (typeof opts.maxAge === "number") parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly) parts.push(`HttpOnly`);
  if (opts.secure) parts.push(`Secure`);
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.partitioned) parts.push(`Partitioned`);
  return parts.join("; ");
}
