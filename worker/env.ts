/**
 * What the Worker is given by Cloudflare (wrangler.jsonc): the database, the built site, and
 * its settings.
 *
 * The types here are the small part of Cloudflare's own that the Worker uses, written out
 * rather than generated (`wrangler types`), so the Worker is checked by the project's one
 * TypeScript configuration, beside the game's rules it shares, and so the tests can stand in
 * for the database with a few lines (worker/testing/d1.ts).
 */

/** The outcome of a statement: its rows (a write has none), and what it changed. */
export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: { changes?: number; last_row_id?: number };
}

/** A prepared statement. `?` marks a value; `bind` gives the values, in order. */
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  /** The first row, or null if there is none. */
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

/** D1, Cloudflare's SQL database (SQLite). */
export interface D1 {
  prepare(sql: string): D1Statement;
  /** Runs the statements in order as one transaction: all of them, or none. */
  batch(statements: D1Statement[]): Promise<D1Result[]>;
}

/** The built site (build/client), served by Cloudflare with the config's page handling. */
export interface Assets {
  fetch(request: Request): Promise<Response>;
}

/** Where each day's questions come from (the `QUESTIONS` setting). */
export type QuestionSource = "sample" | "scheduled";

export interface Env {
  /** The database. Absent only if the binding is missing from the configuration. */
  DB?: D1;
  ASSETS: Assets;
  /**
   * `sample` (the default): every day plays the sample questions built into the game.
   * `scheduled`: the questions approved and scheduled for the day. A feature flag: the game
   * is still in testing, so real questions start only when this is switched (the product
   * owner, 2026-11-17).
   */
  QUESTIONS?: string;
  /**
   * The approval desk's key (worker/questions/admin.ts): a long random secret the product
   * owner sets in Cloudflare, never in the repository. Unset, the desk is shut.
   */
  ADMIN_TOKEN?: string;
}

/** The setting as one of its two values: anything else is `sample`. */
export function questionSource(env: Pick<Env, "QUESTIONS">): QuestionSource {
  return env.QUESTIONS === "scheduled" ? "scheduled" : "sample";
}
