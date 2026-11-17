/**
 * questions: the drafter's tool for the day's questions (docs/ARCHITECTURE.md section 8;
 * the skill that uses it is .claude/skills/draft-questions).
 *
 *   pnpm questions todo [--json]        which places need a question, and what is taken
 *   pnpm questions check <file> ...     check a file of drafts without sending it
 *   pnpm questions submit <file> ...    check it, then send it to the approval desk
 *
 * A file of drafts is JSON: `{ "drafts": [{ "day", "mode", "slot", "question", "note" }] }`,
 * `question` being a question as app/game/types.ts has it, without `shot` (the game files
 * the shots itself).
 *
 * The desk is the site's own API (`SOCCERSENSE_SITE`, the live site unless set). It wants
 * the admin token. Set `SOCCERSENSE_ADMIN_TOKEN` to send it from here; where a proxy adds
 * it instead (a cloud environment's network secret for the site), leave it unset and the
 * requests go out bare.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkQuestion } from "~/game/check";
import { dayKeyFor } from "~/game/day";
import { normalise } from "~/game/judge";
import type { Mode } from "~/game/types";

const MODES: readonly Mode[] = ["home", "away", "retro", "nextgen"];
const SLOTS = 7;

/** A run drafts from tomorrow to eight days on: the week ahead, and anything left over. */
export const TODO_FROM = 1;
export const TODO_TO = 8;
/** How far back the prompts already used are listed, so no week repeats another. */
export const USED_DAYS = 90;
/** Drafts sent in one request. */
const BATCH = 28;

/** A place as the desk lists it in brief (worker/questions/store.ts, `BriefSlot`). */
export interface BriefSlot {
  day: number;
  mode: Mode;
  slot: number;
  status: "draft" | "approved" | "rejected";
  review: string;
  questionId: string;
  prompt: string;
}

/** A place that needs a question. */
export interface TodoPlace {
  day: number;
  /** The day's date, "2026-11-19". */
  date: string;
  mode: Mode;
  slot: number;
  /** `empty`: nothing drafted. `rejected`: turned down, for `review`'s reason. */
  why: "empty" | "rejected";
  review?: string;
  /** The question that was rejected. */
  rejected?: { questionId: string; prompt: string };
}

/**
 * The places to draft, given today's day number and what is in the places from tomorrow to
 * eight days on: every one that is empty or rejected, in order.
 */
export function placesToDraft(
  today: number,
  slots: readonly BriefSlot[],
): TodoPlace[] {
  const todo: TodoPlace[] = [];
  for (let day = today + TODO_FROM; day <= today + TODO_TO; day++) {
    for (const mode of MODES) {
      for (let slot = 0; slot < SLOTS; slot++) {
        const there = slots.find(
          (s) => s.day === day && s.mode === mode && s.slot === slot,
        );
        const place = { day, date: dayKeyFor(day), mode, slot };
        if (!there) {
          todo.push({ ...place, why: "empty" });
        } else if (there.status === "rejected") {
          todo.push({
            ...place,
            why: "rejected",
            review: there.review,
            rejected: { questionId: there.questionId, prompt: there.prompt },
          });
        }
      }
    }
  }
  return todo;
}

const isBag = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * What is wrong with a file of drafts, one line each (empty: it is fit to send). Every
 * question is checked as the desk will check it, and the file as a whole: no place filled
 * twice, no question twice in a game, and no prompt asked twice anywhere in the file.
 */
export function checkDrafts(file: unknown): string[] {
  if (!isBag(file) || !Array.isArray(file.drafts)) {
    return ['the file is not { "drafts": [...] }'];
  }
  const problems: string[] = [];
  const places = new Set<string>();
  const inGame = new Set<string>();
  const prompts = new Map<string, string>();
  file.drafts.forEach((draft, i) => {
    if (!isBag(draft)) {
      problems.push(`draft ${i + 1}: not an object`);
      return;
    }
    const { day, mode, slot } = draft;
    const at = `day ${String(day)} ${String(mode)} ${String(slot)}`;
    const placed =
      Number.isInteger(day) &&
      (day as number) >= 1 &&
      MODES.includes(mode as Mode) &&
      Number.isInteger(slot) &&
      (slot as number) >= 0 &&
      (slot as number) < SLOTS;
    if (!placed) {
      problems.push(
        `draft ${i + 1} (${at}): day, mode and slot must be a day number, one of ${MODES.join(", ")}, and 0 to ${SLOTS - 1}`,
      );
      return;
    }
    if (places.has(at)) problems.push(`${at}: the place is filled twice`);
    places.add(at);
    if (draft.note !== undefined && typeof draft.note !== "string") {
      problems.push(`${at}: note is not text`);
    }
    const checked = checkQuestion(draft.question, mode as Mode);
    for (const problem of checked.problems) problems.push(`${at}: ${problem}`);
    const question = checked.question;
    if (!question) return;
    const game = `${String(day)} ${String(mode)} ${question.id}`;
    if (inGame.has(game)) {
      problems.push(`${at}: ${question.id} is in that day and mode twice`);
    }
    inGame.add(game);
    const asked = normalise(question.prompt);
    const first = prompts.get(asked);
    if (first !== undefined) {
      problems.push(`${at}: "${question.prompt}" is also asked at ${first}`);
    } else {
      prompts.set(asked, at);
    }
  });
  return problems;
}

// ---------------------------------------------------------------------------
// The command line
// ---------------------------------------------------------------------------

const site = () =>
  (process.env.SOCCERSENSE_SITE ?? "https://soccersense.io").replace(
    /\/+$/,
    "",
  );

async function desk(route: string, init: RequestInit = {}): Promise<Response> {
  const token = process.env.SOCCERSENSE_ADMIN_TOKEN;
  const response = await fetch(`${site()}/api${route}`, {
    ...init,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
  });
  if (response.status === 401) {
    let reason = "";
    try {
      reason = ((await response.json()) as { reason?: string }).reason ?? "";
    } catch {
      // an answer with no reason in it
    }
    throw new Error(
      reason === "wrong_token"
        ? "the desk turned the request away (401, wrong token): a token arrived, but it is not the one set as ADMIN_TOKEN on the Worker in Cloudflare. The value saved in the cloud environment's network secret (or in SOCCERSENSE_ADMIN_TOKEN) does not match it"
        : "the desk turned the request away (401, no token): no token arrived. Set SOCCERSENSE_ADMIN_TOKEN, or give the cloud environment a Bearer network secret for the site",
    );
  }
  if (response.status === 503) {
    throw new Error(
      "the desk is shut (503): no ADMIN_TOKEN is set on the Worker in Cloudflare",
    );
  }
  return response;
}

async function todo(json: boolean): Promise<number> {
  const today = ((await (await desk("/today")).json()) as { day: number }).day;
  const from = Math.max(1, today + TODO_TO - USED_DAYS);
  const to = today + TODO_TO;
  const response = await desk(`/admin/questions?from=${from}&to=${to}&brief=1`);
  if (!response.ok) throw new Error(`the desk answered ${response.status}`);
  const slots = ((await response.json()) as { slots: BriefSlot[] }).slots;
  const places = placesToDraft(today, slots);
  const used = slots
    .filter((s) => s.status !== "rejected")
    .map((s) => ({
      day: s.day,
      mode: s.mode,
      prompt: s.prompt,
      id: s.questionId,
    }));
  if (json) {
    console.log(
      JSON.stringify(
        { site: site(), today, todayDate: dayKeyFor(today), places, used },
        null,
        2,
      ),
    );
    return 0;
  }
  console.log(
    `${site()}: today is day ${today} (${dayKeyFor(today)}). ` +
      `${places.length} place${places.length === 1 ? "" : "s"} to draft from day ${today + TODO_FROM} to day ${to}.`,
  );
  for (const place of places) {
    console.log(
      `  day ${place.day} (${place.date}) ${place.mode} ${place.slot}: ${place.why}` +
        (place.why === "rejected"
          ? ` ("${place.rejected?.prompt}": ${place.review || "no reason given"})`
          : ""),
    );
  }
  console.log(
    `${used.length} questions are taken in the last ${USED_DAYS} days.`,
  );
  return 0;
}

function read(file: string): unknown {
  return JSON.parse(readFileSync(path.resolve(file), "utf8")) as unknown;
}

function check(files: string[]): number {
  let wrong = 0;
  for (const file of files) {
    let problems: string[];
    try {
      problems = checkDrafts(read(file));
    } catch (error) {
      problems = [`cannot be read as JSON: ${(error as Error).message}`];
    }
    if (problems.length === 0) {
      console.log(`${file}: fit to send`);
    } else {
      wrong += problems.length;
      console.log(
        `${file}: ${problems.length} problem${problems.length === 1 ? "" : "s"}`,
      );
      for (const problem of problems) console.log(`  ${problem}`);
    }
  }
  return wrong === 0 ? 0 : 1;
}

async function submit(files: string[]): Promise<number> {
  if (check(files) !== 0) {
    console.log("Nothing was sent: put the problems right first.");
    return 1;
  }
  let refused = 0;
  for (const file of files) {
    const drafts = (read(file) as { drafts: unknown[] }).drafts;
    for (let i = 0; i < drafts.length; i += BATCH) {
      const response = await desk("/admin/questions", {
        method: "PUT",
        body: JSON.stringify({
          drafts: drafts.slice(i, i + BATCH),
          source: "ai",
        }),
      });
      if (!response.ok) throw new Error(`the desk answered ${response.status}`);
      const { results } = (await response.json()) as {
        results: {
          day: number;
          mode: string;
          slot: number;
          outcome: string;
          problems: string[];
        }[];
      };
      for (const result of results) {
        const at = `day ${result.day} ${result.mode} ${result.slot}`;
        if (result.outcome === "refused") {
          refused++;
          console.log(`${at}: refused`);
          for (const problem of result.problems) console.log(`  ${problem}`);
        } else if (result.outcome === "kept") {
          console.log(
            `${at}: left alone (an approved question is in the place)`,
          );
        } else {
          console.log(`${at}: saved as a draft`);
        }
      }
    }
  }
  return refused === 0 ? 0 : 1;
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);
  const files = rest.filter((arg) => !arg.startsWith("--"));
  if (command === "todo") return todo(rest.includes("--json"));
  if (command === "check" && files.length > 0) return check(files);
  if (command === "submit" && files.length > 0) return submit(files);
  console.log(
    "usage: pnpm questions todo [--json] | check <file> ... | submit <file> ...",
  );
  return 2;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(`questions: ${(error as Error).message}`);
      process.exitCode = 1;
    },
  );
}
