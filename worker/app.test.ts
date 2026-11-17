// @vitest-environment node
/**
 * The Worker's requests (worker/app.ts) and its database's upkeep (worker/db/migrate.ts),
 * against a real SQLite in memory (worker/testing/d1.ts).
 */
import { describe, expect, test } from "vitest";

import { EPOCH_UTC, MS_PER_DAY } from "~/game/day";

import { type HealthAnswer, type TodayAnswer, handle } from "./app";
import {
  MIGRATIONS,
  type Migration,
  SCHEMA_VERSION,
  database,
  migrate,
} from "./db/migrate";
import type { Env } from "./env";
import { SERVER_TIME_HEADER } from "./http";
import { memoryD1 } from "./testing/d1";

/** Noon on the game's eighth day: 2026-11-17. */
const NOON = EPOCH_UTC + 7 * MS_PER_DAY + MS_PER_DAY / 2;

function env(over: Partial<Env> = {}): Env & { served: string[] } {
  const served: string[] = [];
  return {
    served,
    ASSETS: {
      fetch: async (request) => {
        served.push(new URL(request.url).pathname);
        return new Response("the built site");
      },
    },
    ...over,
  };
}

const ask = (path: string, init?: RequestInit) =>
  new Request(`https://soccersense.example${path}`, init);

describe("the Worker", () => {
  test("anything that is not the API is the built site", async () => {
    const e = env();
    for (const path of ["/", "/play/home", "/apiary", "/favicon.svg"]) {
      const response = await handle(ask(path), e, NOON);
      expect(await response.text()).toBe("the built site");
    }
    expect(e.served).toEqual(["/", "/play/home", "/apiary", "/favicon.svg"]);
  });

  test("GET /api/today is the day by the server", async () => {
    const response = await handle(ask("/api/today"), env(), NOON);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^application\/json/);
    // never kept by a cache: it is the time
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get(SERVER_TIME_HEADER)).toBe(String(NOON));
    const today = (await response.json()) as TodayAnswer;
    expect(today).toEqual({
      now: NOON,
      day: 8,
      dayKey: "2026-11-17",
      nextDayIn: MS_PER_DAY / 2,
      questions: "sample",
    });
  });

  test("the day turns at midnight UTC", async () => {
    const at = async (now: number) =>
      (await (
        await handle(ask("/api/today"), env(), now)
      ).json()) as TodayAnswer;
    const midnight = EPOCH_UTC + 8 * MS_PER_DAY;
    expect((await at(midnight - 1)).day).toBe(8);
    expect((await at(midnight - 1)).nextDayIn).toBe(1);
    expect((await at(midnight)).day).toBe(9);
    expect((await at(midnight)).dayKey).toBe("2026-11-18");
  });

  test("a HEAD request gets the time in its headers and no body: the clock's request", async () => {
    const response = await handle(
      ask("/api/today?clock=abc", { method: "HEAD" }),
      env(),
      NOON,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get(SERVER_TIME_HEADER)).toBe(String(NOON));
    expect(await response.text()).toBe("");
  });

  test("the questions are the sample until the flag says scheduled, and nothing else switches them", async () => {
    const source = async (QUESTIONS: string | undefined) =>
      (
        (await (
          await handle(ask("/api/today"), env({ QUESTIONS }), NOON)
        ).json()) as TodayAnswer
      ).questions;
    expect(await source(undefined)).toBe("sample");
    expect(await source("sample")).toBe("sample");
    expect(await source("scheduled")).toBe("scheduled");
    for (const odd of ["", "true", "SCHEDULED", "live", "1"]) {
      expect(await source(odd), odd).toBe("sample");
    }
  });

  test("an address the API does not have, and a method it does not take", async () => {
    const missing = await handle(ask("/api/nothing"), env(), NOON);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "not_found" });
    expect((await handle(ask("/api"), env(), NOON)).status).toBe(404);

    const posted = await handle(
      ask("/api/today", { method: "POST" }),
      env(),
      NOON,
    );
    expect(posted.status).toBe(405);
    expect(posted.headers.get("allow")).toBe("GET, HEAD");
    // an API address is never the site's page, whatever is asked of it
    const e = env();
    await handle(ask("/api/today/"), e, NOON);
    expect(e.served).toEqual([]);
  });

  test("GET /api/health says the database is up to date", async () => {
    const DB = memoryD1();
    const response = await handle(ask("/api/health"), env({ DB }), NOON);
    expect(response.status).toBe(200);
    expect((await response.json()) as HealthAnswer).toEqual({
      ok: true,
      db: SCHEMA_VERSION,
      schema: SCHEMA_VERSION,
      questions: "sample",
    });
    DB.close();
  });

  test("with no database, or one that is failing, health says so and the day still answers", async () => {
    const none = await handle(ask("/api/health"), env(), NOON);
    expect(none.status).toBe(503);
    expect(((await none.json()) as HealthAnswer).db).toBeNull();

    const broken = memoryD1();
    broken.close();
    const failing = await handle(ask("/api/health"), env({ DB: broken }), NOON);
    expect(failing.status).toBe(503);
    expect(((await failing.json()) as HealthAnswer).ok).toBe(false);
    expect(
      (await handle(ask("/api/today"), env({ DB: broken }), NOON)).status,
    ).toBe(200);
  });
});

describe("the database's migrations", () => {
  const tables = async (db: ReturnType<typeof memoryD1>) =>
    (
      await db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
        )
        .all<{ name: string }>()
    ).results.map((row) => row.name);

  test("are numbered 1, 2, 3 ... with no gaps, each with a name and some SQL", () => {
    expect(MIGRATIONS.map((m) => m.id)).toEqual(
      MIGRATIONS.map((_, i) => i + 1),
    );
    for (const m of MIGRATIONS) {
      expect(m.name.trim()).not.toBe("");
      expect(m.sql.length).toBeGreaterThan(0);
      // safe to meet twice
      for (const sql of m.sql) {
        if (/^\s*CREATE\s/i.test(sql)) expect(sql).toMatch(/IF NOT EXISTS/i);
      }
    }
    expect(SCHEMA_VERSION).toBe(MIGRATIONS.length);
  });

  test("a new database is brought up to date, and a second run changes nothing", async () => {
    const db = memoryD1();
    expect(await migrate(db, NOON)).toBe(SCHEMA_VERSION);
    expect(await tables(db)).toContain("counters");
    const record = await db
      .prepare("SELECT id, applied_at FROM _migrations ORDER BY id")
      .all<{ id: number; applied_at: number }>();
    expect(record.results.map((r) => r.id)).toEqual(
      MIGRATIONS.map((m) => m.id),
    );
    expect(record.results[0].applied_at).toBe(NOON);

    const before = db.log.length;
    expect(await migrate(db, NOON + 5)).toBe(SCHEMA_VERSION);
    // only the look at what is applied: no migration runs again
    expect(
      db.log.slice(before).some((sql) => /INSERT INTO _migrations/.test(sql)),
    ).toBe(false);
    db.close();
  });

  test("only the migrations after the last one applied are run, in order", async () => {
    const db = memoryD1();
    const one: Migration = {
      id: 1,
      name: "one",
      sql: ["CREATE TABLE IF NOT EXISTS a (x INTEGER)"],
    };
    const two: Migration = {
      id: 2,
      name: "two",
      sql: [
        "CREATE TABLE IF NOT EXISTS b (x INTEGER)",
        "INSERT INTO a VALUES (7)",
      ],
    };
    expect(await migrate(db, NOON, [one])).toBe(1);
    // handed over out of order: still 2 after 1, and 1 not again
    expect(await migrate(db, NOON, [two, one])).toBe(2);
    expect(await tables(db)).toEqual(["_migrations", "a", "b"]);
    expect(
      (await db.prepare("SELECT COUNT(*) AS n FROM a").first<{ n: number }>())
        ?.n,
    ).toBe(1);
    db.close();
  });

  test("a migration that fails is applied not at all, and is not recorded", async () => {
    const db = memoryD1();
    const bad: Migration = {
      id: 1,
      name: "bad",
      sql: ["CREATE TABLE IF NOT EXISTS kept (x INTEGER)", "THIS IS NOT SQL"],
    };
    await expect(migrate(db, NOON, [bad])).rejects.toThrow();
    expect(await tables(db)).toEqual(["_migrations"]);
    expect(
      (
        await db
          .prepare("SELECT COUNT(*) AS n FROM _migrations")
          .first<{ n: number }>()
      )?.n,
    ).toBe(0);
    db.close();
  });

  test("an instance migrates once, then remembers; a failure is tried again", async () => {
    const db = memoryD1();
    expect(await database(db, NOON)).toBe(SCHEMA_VERSION);
    const after = db.log.length;
    expect(await database(db, NOON)).toBe(SCHEMA_VERSION);
    expect(db.log.length).toBe(after);

    const broken = memoryD1();
    broken.close();
    await expect(database(broken, NOON)).rejects.toThrow();
    await expect(database(broken, NOON)).rejects.toThrow();
    db.close();
  });
});
