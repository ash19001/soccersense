/**
 * A database for the tests: the part of D1 the Worker uses (worker/env.ts), over an
 * in-memory SQLite (Node's own, `node:sqlite`). D1 is SQLite, so the SQL the tests run is
 * the SQL Cloudflare runs. Tests only: nothing in the Worker imports this.
 */

import { DatabaseSync } from "node:sqlite";

import type { D1, D1Result, D1Statement } from "../env";

type Value = null | number | bigint | string | Uint8Array;

/** A statement that reads rows, not one that changes them. */
const READS = /^\s*(select|with|pragma|explain)\b/i;

export interface MemoryD1 extends D1 {
  /** Every statement run, in order: for a test to count the database's work. */
  readonly log: string[];
  close(): void;
}

/** A new, empty database in memory. */
export function memoryD1(): MemoryD1 {
  const db = new DatabaseSync(":memory:");
  const log: string[] = [];

  const execute = (sql: string, values: readonly unknown[]): D1Result => {
    log.push(sql);
    const statement = db.prepare(sql);
    if (READS.test(sql)) {
      const results = statement.all(...(values as Value[])) as Record<
        string,
        unknown
      >[];
      return {
        results: results.map((row) => ({ ...row })),
        success: true,
        meta: {},
      };
    }
    const done = statement.run(...(values as Value[]));
    return {
      results: [],
      success: true,
      meta: {
        changes: Number(done.changes),
        last_row_id: Number(done.lastInsertRowid),
      },
    };
  };

  const statements = new WeakMap<D1Statement, [string, readonly unknown[]]>();
  const prepare = (
    sql: string,
    values: readonly unknown[] = [],
  ): D1Statement => {
    const statement: D1Statement = {
      bind: (...next) => prepare(sql, next),
      first: async <T>() =>
        (execute(sql, values).results[0] as T | undefined) ?? null,
      all: async <T>() => execute(sql, values) as D1Result<T>,
      run: async () => execute(sql, values),
    };
    statements.set(statement, [sql, values]);
    return statement;
  };

  return {
    log,
    prepare: (sql) => prepare(sql),
    async batch(list) {
      db.exec("BEGIN");
      try {
        const results = list.map((statement) => {
          const known = statements.get(statement);
          if (!known) throw new Error("a statement from another database");
          return execute(known[0], known[1]);
        });
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    close: () => db.close(),
  };
}
