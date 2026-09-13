/**
 * Refuses to run a development-only Prisma command against a database that
 * isn't on this machine.
 *
 * `prisma migrate dev` and `migrate reset` are destructive by design: they
 * author new migrations, and they offer to drop and recreate the database
 * when it has drifted. Pointed at the hosted Postgres — easy to do, because
 * the same DATABASE_URL is what Vercel uses — a single run can leave a
 * half-applied migration recorded in `_prisma_migrations`, and from then on
 * every deploy fails with P3009 ("failed migrations in the target
 * database"). That is exactly what happened on 2026-09-12.
 *
 * Set ALLOW_REMOTE_MIGRATE=1 to override, deliberately, for one command.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal"]);

function hostOf(url) {
  if (!url) return null;
  try {
    // Postgres URLs parse as URLs; the hostname is what we care about.
    return new URL(url).hostname.replace(/^\[|\]$/g, "") || null;
  } catch {
    return null;
  }
}

const command = process.argv.slice(2);
if (command.length === 0) {
  console.error("guard-local-db: nothing to run.");
  process.exit(1);
}

if (process.env.ALLOW_REMOTE_MIGRATE === "1") {
  run();
} else {
  // Whichever URL the command would actually use (prisma7.config.ts prefers
  // the direct one), both have to be local.
  const urls = [
    ["DIRECT_URL", process.env.DIRECT_URL],
    ["DATABASE_POSTGRES_URL_NON_POOLING", process.env.DATABASE_POSTGRES_URL_NON_POOLING],
    ["DATABASE_URL", process.env.DATABASE_URL],
  ].filter(([, value]) => Boolean(value));

  if (urls.length === 0) {
    console.error("guard-local-db: no DATABASE_URL set. Copy .env.example to .env first.");
    process.exit(1);
  }

  const remote = urls.filter(([, value]) => {
    const host = hostOf(value);
    return host !== null && !LOCAL_HOSTS.has(host);
  });

  if (remote.length > 0) {
    const names = remote.map(([name, value]) => `  ${name} → ${hostOf(value)}`).join("\n");
    console.error(
      [
        "",
        `Refusing to run \`${command.join(" ")}\` against a database that isn't local:`,
        names,
        "",
        "`migrate dev` writes new migrations and can offer to drop the database.",
        "Against the hosted Postgres that corrupts `_prisma_migrations` and every",
        "later deploy fails with P3009.",
        "",
        "Point DATABASE_URL at your local Postgres, or use `npm run db:deploy`,",
        "which only applies migrations that already exist.",
        "",
        "If you really mean it: ALLOW_REMOTE_MIGRATE=1 npm run <script>",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }
  run();
}

async function run() {
  const { spawn } = await import("node:child_process");
  const child = spawn(command[0], command.slice(1), { stdio: "inherit", shell: process.platform === "win32" });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 0);
  });
}
