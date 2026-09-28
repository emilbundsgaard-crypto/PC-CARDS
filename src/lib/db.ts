import Database from "better-sqlite3";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "data", "pcards.db");

let db: Database.Database | null = null;

/** Lazily open a single read-only connection, reused across requests. */
export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    db.pragma("query_only = true");
  }
  return db;
}

export const MAX_ROWS = 500;

/**
 * Statements we refuse outright. The connection is already read-only, so these
 * would fail anyway — rejecting them early gives a clearer error and keeps
 * anything destructive from ever reaching SQLite.
 */
const FORBIDDEN = /\b(ATTACH|DETACH|PRAGMA|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|VACUUM|REINDEX)\b/i;

export class UnsafeQueryError extends Error {}

/**
 * Validate that `sql` is a single read-only SELECT/WITH statement and cap the
 * number of rows it can return.
 */
export function assertReadOnlySelect(sql: string): string {
  const trimmed = sql.trim().replace(/;\s*$/, "");

  if (!trimmed) {
    throw new UnsafeQueryError("Empty query.");
  }
  // A remaining ';' means more than one statement was submitted.
  if (trimmed.includes(";")) {
    throw new UnsafeQueryError("Only a single statement is allowed.");
  }
  if (!/^(SELECT|WITH)\b/i.test(trimmed)) {
    throw new UnsafeQueryError("Only SELECT queries are allowed.");
  }
  if (FORBIDDEN.test(trimmed)) {
    throw new UnsafeQueryError("Only read-only SELECT queries are allowed.");
  }
  return trimmed;
}

export type QueryResult = {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
};

/** Run a validated read-only query, returning at most MAX_ROWS rows. */
export function runSelect(sql: string): QueryResult {
  const safe = assertReadOnlySelect(sql);
  const stmt = getDb().prepare(safe).raw(true);

  // Ask for one extra row so we can tell whether the result was cut off.
  const all = stmt.all() as unknown[][];
  const truncated = all.length > MAX_ROWS;
  const rows = truncated ? all.slice(0, MAX_ROWS) : all;

  return {
    columns: stmt.columns().map((c) => c.name),
    rows,
    rowCount: all.length,
    truncated,
  };
}

/** Distinct years present in the data, newest first — drives the year selector. */
export function availableYears(): number[] {
  const rows = getDb()
    .prepare("SELECT DISTINCT Year FROM pcards ORDER BY Year DESC")
    .all() as { Year: number }[];
  return rows.map((r) => r.Year);
}
