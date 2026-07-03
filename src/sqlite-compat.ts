import { createRequire } from "node:module";
import type { registerHooks as RegisterHooksFn } from "node:module";
import chalk from "chalk";

// camoufox-js loads the native better-sqlite3 module to read its bundled
// read-only WebGL fingerprint database. Prebuilt native binaries are tied to
// the Node ABI of the Node version that ran the install, so a gateway that
// spawns this server with a different Node version fails with
// ERR_DLOPEN_FAILED / NODE_MODULE_VERSION errors. When the runtime supports
// it (Node >= 22.15), redirect the better-sqlite3 import to a shim backed by
// the built-in node:sqlite module so no native binary is ever loaded.

const require = createRequire(import.meta.url);
const SHIM_URL = new URL("./sqlite-shim.js", import.meta.url).href;

export const SQLITE_SHIM_DISABLED = process.env.CAMOUFOX_MCP_NO_SQLITE_SHIM === "1";

function loadRegisterHooks(): typeof RegisterHooksFn | undefined {
  const moduleApi = require("node:module") as { registerHooks?: typeof RegisterHooksFn };
  return typeof moduleApi.registerHooks === "function" ? moduleApi.registerHooks : undefined;
}

function nodeSqliteAvailable(): boolean {
  try {
    require("node:sqlite");
    return true;
  } catch {
    return false;
  }
}

function installSqliteShim(): boolean {
  if (SQLITE_SHIM_DISABLED) {
    return false;
  }

  const registerHooks = loadRegisterHooks();
  if (!registerHooks || !nodeSqliteAvailable()) {
    return false;
  }

  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "better-sqlite3") {
        return { url: SHIM_URL, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  });
  return true;
}

export const SQLITE_SHIM_ACTIVE = installSqliteShim();

if (SQLITE_SHIM_ACTIVE) {
  console.error(chalk.blue("[Camoufox] Using built-in node:sqlite instead of the native better-sqlite3 module."));
} else if (!SQLITE_SHIM_DISABLED) {
  console.error(chalk.yellow("[Camoufox] node:sqlite or module.registerHooks unavailable on this Node runtime; camoufox-js will load the native better-sqlite3 module. Node >= 22.15 avoids native ABI mismatches."));
}
