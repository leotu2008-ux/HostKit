import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/api/token";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function apiError(message: string, status: number) {
  return json({ error: message }, status);
}

/** Parses a JSON body, or null when there isn't a valid one. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** The user behind a `Authorization: Bearer` token, or null. */
export async function apiUser(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;
  const payload = verifyToken(match[1]);
  if (!payload) return null;
  return db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true },
  });
}

/**
 * An event the token's user owns. The API deliberately ignores the web's
 * draft cookie: a native client either signs in or it doesn't manage events.
 */
export async function ownedEvent(eventId: string, userId: string) {
  return db.event.findFirst({ where: { id: eventId, ownerId: userId } });
}
