import { db } from "@/lib/db";

/** Adds someone to the list. Signing up again with the same address updates the name. */
export async function joinEmailList(input: { name: string; email: string }): Promise<{ email: string }> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  await db.emailListEntry.upsert({
    where: { email },
    create: { email, name },
    update: { name },
  });
  return { email };
}
