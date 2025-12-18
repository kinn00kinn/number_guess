import { Context } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";

export const googleAuth = async (c: Context) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const redirectUri = c.env.GOOGLE_REDIRECT_URI || "http://localhost:8787/auth/callback";
  
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid%20email%20profile`;
  
  return c.redirect(url);
};

export const googleCallback = async (c: Context) => {
  const code = c.req.query("code");
  if (!code) return c.text("No code provided", 400);

  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = c.env.GOOGLE_REDIRECT_URI || "http://localhost:8787/auth/callback";

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

  const tokenData = await tokenResponse.json() as any;
  if (!tokenData.access_token) return c.text("Failed to get token", 400);

  const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userData = await userResponse.json() as any;

  const db = c.env.DB as D1Database;
  const existingUser = await db.prepare("SELECT * FROM users WHERE google_id = ?").bind(userData.id).first();

  let userId = existingUser?.id as string;
  if (!existingUser) {
    userId = crypto.randomUUID();
    await db.prepare("INSERT INTO users (id, google_id, name) VALUES (?, ?, ?)").bind(userId, userData.id, userData.name).run();
  }

  const url = new URL(c.req.url);
  const isSecure = url.protocol === "https:";

  setCookie(c, "session_user_id", userId, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return c.redirect("http://localhost:3000/"); 
};

export const getMe = async (c: Context) => {
  const userId = getCookie(c, "session_user_id");
  if (!userId) return c.json({ error: "Not logged in" }, 401);

  const db = c.env.DB as D1Database;
  const user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
  
  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json(user);
};

export const logout = async (c: Context) => {
  deleteCookie(c, "session_user_id", { path: "/" });
  return c.json({ success: true });
};

export const updateName = async (c: Context) => {
  const userId = getCookie(c, "session_user_id");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { name } = await c.req.json<{ name: string }>();
  if (!name || name.length > 10) return c.json({ error: "Invalid name" }, 400);

  const db = c.env.DB as D1Database;
  await db.prepare("UPDATE users SET name = ? WHERE id = ?").bind(name, userId).run();
  
  return c.json({ success: true });
};

export const getRanking = async (c: Context) => {
  const db = c.env.DB as D1Database;
  const { results } = await db.prepare("SELECT name, rate, wins FROM users ORDER BY rate DESC LIMIT 100").all();
  return c.json(results);
};