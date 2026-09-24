import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { hasDashboardAccess } from "@/lib/access";

/** Right password, unconfirmed address: sign-in says so, with a resend. */
export class EmailUnverified extends CredentialsSignin {
  code = "unverified";
}

/** Right password, but this person is not Maya Chen. */
export class DashboardClosed extends CredentialsSignin {
  code = "closed";
}

export const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128, "Use at most 128 characters."),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Credentials sign-in requires the JWT strategy; Auth.js does not support
  // database sessions for it.
  session: { strategy: "jwt" },
  // Vercel sets the Host header safely; say so explicitly rather than
  // depending on AUTH_TRUST_HOST being present in every environment.
  trustHost: true,
  pages: { signIn: "/signin" },
  // Credentials only. package.json overrides next-auth's nodemailer peer
  // (^7 || ^8) with our nodemailer 9, which is safe only while Auth.js never
  // sends mail. Adding the Email/Nodemailer provider needs that re-checked.
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        // Compare even when the user is missing, against a dummy hash, so a
        // wrong email and a wrong password take the same time to answer and
        // the response cannot be used to enumerate registered addresses.
        const hash = user?.passwordHash ?? DUMMY_HASH;
        const ok = await bcrypt.compare(parsed.data.password, hash);
        if (!ok || !user) return null;
        // Only after the password matched, so this never confirms an address
        // to someone who doesn't know the password.
        if (!user.emailVerifiedAt) throw new EmailUnverified();
        if (!hasDashboardAccess(user)) throw new DashboardClosed();

        return { id: user.id, email: user.email, name: user.name, sessionVersion: user.sessionVersion };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.sv = user.sessionVersion ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.id === "string") session.user.id = token.id;
      session.user.sessionVersion = typeof token.sv === "number" ? token.sv : 0;
      return session;
    },
  },
});

// A real bcrypt hash of a value nobody can sign in with, used only to keep
// failed lookups on the same code path as failed passwords.
const DUMMY_HASH =
  "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.aG9RbG9KLMLLPk6f9CnXDGRwqW/G";
