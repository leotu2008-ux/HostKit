import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    /** `sessionVersion` is the account's version when this session was made;
     *  a password reset bumps the account's and older sessions stop. */
    user: { id: string; sessionVersion: number } & DefaultSession["user"];
  }
  interface User {
    sessionVersion?: number;
  }
}
