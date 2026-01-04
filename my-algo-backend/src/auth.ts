import { Hono } from 'hono'
import { authHandler, initAuthConfig, verifyAuth } from '@hono/auth-js'
import Google from '@auth/core/providers/google'
import type { User as AuthUser } from '@auth/core/types'

// Type definition for the Bindings
type Bindings = {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  AUTH_SECRET: string; // New secret for Auth.js
  FRONTEND_URL: string;
  BACKEND_URL: string;
};

// Define a custom user type that includes the ID
export type AppUser = AuthUser & { id: string };

const authApp = new Hono<{ Bindings: Bindings }>();

// 1. Initialize Auth.js configuration
authApp.use('*', initAuthConfig(c => ({
  secret: c.env.AUTH_SECRET,
  providers: [
    Google({
      clientId: c.env.GOOGLE_CLIENT_ID,
      clientSecret: c.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    // This callback is used to persist the user ID from the provider into the JWT session
    async session({ session, token }) {
      if (session?.user && token?.sub) {
        session.user.id = token.sub; // token.sub is the user's ID from the provider (Google ID)
      }
      return session;
    },
    // After a user signs in, we either find them in our DB or create a new entry
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google' && profile?.sub) {
        const db = c.env.DB;
        const googleId = profile.sub;

        // Check if user already exists
        const existingUser = await db
          .prepare('SELECT id FROM users WHERE google_id = ?')
          .bind(googleId)
          .first<{ id: string }>();

        if (!existingUser) {
          // Create new user if they don't exist
          try {
            const newUserId = crypto.randomUUID();
            await db
              .prepare('INSERT INTO users (id, google_id, name) VALUES (?, ?, ?)')
              .bind(newUserId, googleId, profile.name || 'New User')
              .run();
          } catch (e) {
            console.error('Failed to insert user', e);
            return false; // Prevent sign-in if DB operation fails
          }
        }
        return true; // Sign-in successful
      }
      return false; // Deny sign-in for other cases
    },
  },
})));

// 2. Define the auth routes (e.g., /api/auth/signin, /api/auth/callback, etc.)
authApp.use('*', authHandler());

// 3. Export a middleware to verify authentication on protected routes
const requireAuth = () => verifyAuth();

export { authApp, requireAuth };