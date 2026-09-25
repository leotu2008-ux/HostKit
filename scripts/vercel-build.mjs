/**
 * Vercel build entry.
 *
 * Preview and production share one database, so `prisma migrate deploy` and
 * the seed run only when VERCEL_ENV is exactly "production". Preview,
 * development, and a local run (VERCEL_ENV unset) still generate the Prisma
 * client and run `next build`. A failing migrate or seed on production exits
 * with that command's status and does not continue.
 */

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/**
 * @param {string | undefined} vercelEnv
 * @returns {boolean}
 */
export function shouldRunMigrateAndSeed(vercelEnv) {
  return vercelEnv === "production";
}

/**
 * One build-log line: whether migrate and seed will run, and why.
 *
 * @param {string | undefined} vercelEnv
 * @returns {string}
 */
export function migrateAndSeedLogLine(vercelEnv) {
  if (shouldRunMigrateAndSeed(vercelEnv)) {
    return "Running prisma migrate deploy and db:seed because VERCEL_ENV=production.";
  }
  const shown = vercelEnv == null || vercelEnv === "" ? "unset" : vercelEnv;
  return `Skipping prisma migrate deploy and db:seed because VERCEL_ENV is ${shown}, not production.`;
}

/**
 * @param {string} command
 * @param {string[]} args
 */
function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) {
    console.error(`vercel-build: failed to start ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status === null ? 1 : result.status);
  }
}

function main() {
  const vercelEnv = process.env.VERCEL_ENV;
  console.log(migrateAndSeedLogLine(vercelEnv));
  run("prisma", ["generate"]);
  if (shouldRunMigrateAndSeed(vercelEnv)) {
    run("prisma", ["migrate", "deploy"]);
    run("npm", ["run", "db:seed"]);
  }
  run("next", ["build"]);
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  main();
}
