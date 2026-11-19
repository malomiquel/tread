import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { expo } from "@better-auth/expo";
import { prisma } from "@tread/db";
import { requestLanguage, sendPasswordReset, sendVerification } from "./email";

const development = process.env.NODE_ENV !== "production";

/**
 * Accounts, for the web app and the phone alike.
 *
 * Better Auth on the Postgres Prisma talks to (Supabase), e-mail and password
 * only. The phone signs in through the same endpoints with the Expo plugin,
 * which keeps its session cookie in the keychain rather than a browser.
 *
 * BETTER_AUTH_SECRET and BETTER_AUTH_URL come from the environment, never
 * from this file.
 */
export const auth = betterAuth({
  appName: "Tread",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    // An address nobody confirmed cannot sign in: it may not be theirs.
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }, request) => {
      await sendPasswordReset(user.email, url, requestLanguage(request));
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }, request) => {
      await sendVerification(user.email, url, requestLanguage(request));
    },
  },
  user: {
    // Somebody's own runs are theirs to take away: the account goes with them.
    deleteUser: { enabled: true },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 60,
  },
  rateLimit: {
    enabled: true,
    // Shared by every server instance, unlike memory.
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 60, max: 3 },
    },
  },
  trustedOrigins: [
    // The phone app's scheme (app.json).
    "tread://",
    ...(development ? ["exp://", "exp://**"] : []),
  ],
  advanced: {
    cookiePrefix: "tread",
  },
  plugins: [expo()],
});

export type Session = typeof auth.$Infer.Session;
