import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

export const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Credentials sign-in requires the JWT strategy; Auth.js does not support
  // database sessions for it.
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
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

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
});

// A real bcrypt hash of a value nobody can sign in with, used only to keep
// failed lookups on the same code path as failed passwords.
const DUMMY_HASH =
  "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.aG9RbG9KLMLLPk6f9CnXDGRwqW/G";
