import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SQLITE_SHIM_ACTIVE, SQLITE_SHIM_DISABLED } from "../dist/sqlite-compat.js";
import ShimDatabase from "../dist/sqlite-shim.js";
import { describeError } from "../dist/utils.js";

assert.equal(SQLITE_SHIM_DISABLED, false, "shim should not be disabled in the test environment");
assert.equal(SQLITE_SHIM_ACTIVE, true, "sqlite shim should activate on this Node version");

const workDir = mkdtempSync(path.join(tmpdir(), "camoufox-sqlite-shim-"));
const dbPath = path.join(workDir, "webgl.db");

const seed = new DatabaseSync(dbPath);
seed.exec("CREATE TABLE webgl_fingerprints (vendor TEXT, renderer TEXT, data TEXT, mac REAL, win REAL, lin REAL)");
seed
  .prepare("INSERT INTO webgl_fingerprints VALUES (?, ?, ?, ?, ?, ?)")
  .run("Apple", "Apple M1", JSON.stringify({ webGl2Enabled: true }), 1, 0, 0);
seed.close();

const { default: InterceptedDatabase } = await import("better-sqlite3");
assert.equal(
  InterceptedDatabase,
  ShimDatabase,
  "importing better-sqlite3 should resolve to the node:sqlite shim, not the native module",
);

const db = new InterceptedDatabase(dbPath, { readonly: true });
const rows = db.prepare("SELECT vendor, renderer, data, mac FROM webgl_fingerprints WHERE mac > 0").all();
assert.equal(rows.length, 1);
assert.equal(rows[0].vendor, "Apple");
assert.deepEqual(JSON.parse(rows[0].data), { webGl2Enabled: true });
const paramRows = db
  .prepare("SELECT vendor, renderer, data, mac FROM webgl_fingerprints WHERE vendor = ? AND renderer = ?")
  .all("Apple", "Apple M1");
assert.equal(paramRows.length, 1);
db.close();

rmSync(workDir, { recursive: true, force: true });

const abiError = new Error(
  "The module was compiled against a different Node.js version using NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 141.",
);
const described = describeError(abiError);
assert.match(described, /Native module ABI mismatch/, "ABI errors should gain an actionable hint");
assert.match(described, /_npx/, "hint should mention the npx cache");
assert.equal(describeError(new Error("plain failure")), "plain failure");

console.log("sqlite shim unit tests passed");
