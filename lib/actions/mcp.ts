"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { issueToken } from "@/lib/api/token";
import { getCurrentUser } from "@/lib/session";

export type McpTokenState = { token: string } | { error: string };

/**
 * A bearer token for the signed-in account, for the hosted MCP.
 *
 * Same token `POST /api/v1/auth/token` issues: thirty days, and a password
 * reset ends every one of them. Nothing is stored beyond the signature, so
 * the page can show it once and cannot look it up again.
 */
export async function issueMcpTokenAction(): Promise<McpTokenState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { sessionVersion: true },
  });
  if (!row) return { error: "Sign in first." };
  return { token: issueToken(user.id, row.sessionVersion) };
}

/** Ends one OAuth grant. Access and refresh tokens for it stop working. */
export async function revokeMcpGrantAction(form: FormData) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/signin?next=%2Fsettings%2Fconnections");
  const id = form.get("id");
  if (typeof id !== "string" || !id) return;
  await db.mcpGrant.updateMany({
    where: { id, userId: actor.id },
    data: { revokedAt: new Date(), codeHash: null, accessHash: null, refreshHash: null },
  });
  revalidatePath("/settings/connections");
}
