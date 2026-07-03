import { DatabaseSync, type StatementSync } from "node:sqlite";

interface DatabaseShimOptions {
  readonly?: boolean;
}

// better-sqlite3-compatible wrapper over the Node.js built-in node:sqlite
// module. Covers the surface camoufox-js exercises for WebGL fingerprint
// sampling: new Database(path), prepare().all(), and close().
export default class Database {
  readonly #db: DatabaseSync;

  constructor(path: string, options?: DatabaseShimOptions) {
    this.#db = new DatabaseSync(path, { readOnly: options?.readonly ?? false });
  }

  prepare(sql: string): StatementSync {
    return this.#db.prepare(sql);
  }

  close(): void {
    this.#db.close();
  }
}
