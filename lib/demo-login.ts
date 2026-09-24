/**
 * The seeded demo accounts' password (prisma/seed.ts).
 *
 * The repo is public, so the password the seed has always used is public too.
 * That's fine on a laptop or in CI, where the e2e specs sign in with it — but
 * every Vercel build (preview and production alike) seeds the production
 * database, and there a known password means anyone can sign in as Maya
 * Chen. Hosted builds therefore never get it: DEMO_PASSWORD when set,
 * otherwise null, which the seed turns into a random, unknowable one.
 */
export const PUBLIC_DEMO_PASSWORD = "hosty-demo";
/** Every password the seed has ever published, the current one first. A
 *  hosted build never keeps or hands out any of them. */
export const PUBLIC_DEMO_PASSWORDS = [PUBLIC_DEMO_PASSWORD, "hostkit-demo"] as const;

const MIN_LENGTH = 8;

export function demoPassword(env: Record<string, string | undefined>): string | null {
  const hosted = Boolean(env.VERCEL);
  const chosen = env.DEMO_PASSWORD?.trim();
  const isPublic = (PUBLIC_DEMO_PASSWORDS as readonly string[]).includes(chosen ?? "");
  if (chosen && chosen.length >= MIN_LENGTH && !(hosted && isPublic)) {
    return chosen;
  }
  return hosted ? null : PUBLIC_DEMO_PASSWORD;
}
