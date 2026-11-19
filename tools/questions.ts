/**
 * questions: the drafter's tool for the day's questions and the day's places
 * (docs/ARCHITECTURE.md section 8; the skill that uses it is .claude/skills/draft-questions).
 *
 *   pnpm questions todo [--json]        what needs drafting: the days' places, the questions,
 *                                       and what has been used
 *   pnpm questions check <file> ...     check a file of drafts without sending it
 *   pnpm questions submit <file> ...    check it, then send it to the approval desk
 *
 * A file of questions is JSON: `{ "drafts": [{ "day", "mode", "slot", "question", "note" }] }`,
 * `question` being a question as app/game/types.ts has it, without `shot` (the game files
 * the shots itself). A file of the days' places is `{ "places": [{ "day", "place", "note" }] }`,
 * `place` as app/data/places.ts has one: `{ id, name, area, kind, lat, lng }`.
 *
 * Every mode is drafted, CLOSEST and FURTHEST too (the product owner, 2026-11-19: "add these
 * new gamemodes to the schedule so once i remove sample feature flag then these will also
 * get generated and have new ones daily"), and so is every day's place, where those two
 * measure from ("i dont want fixed places because eventually questions will get repetitive
 * so it should also be generated"). A day's place is drafted before its CLOSEST and FURTHEST:
 * their places to draft say which it is, and a draft for them is checked against it.
 *
 * The desk is the site's own API (`SOCCERSENSE_SITE`, the live site unless set). It wants
 * the admin token. Set `SOCCERSENSE_ADMIN_TOKEN` to send it from here; where a proxy adds
 * it instead (a cloud environment's network secret for the site), leave it unset and the
 * requests go out bare.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { type Place, checkPlace, placeLabel } from "~/data/places";
import { checkQuestion } from "~/game/check";
import { dayKeyFor } from "~/game/day";
import { distanceKm } from "~/game/geo";
import { normalise } from "~/game/judge";
import { isDistanceRule, ruleFor, shotsOf } from "~/game/scoring";
import { SHOT_ORDER, isGoal } from "~/game/shots";
import type { Mode } from "~/game/types";

/** Every mode with questions of its own each day (as worker/questions/store.ts has them). */
const MODES: readonly Mode[] = [
  "home",
  "away",
  "retro",
  "nextgen",
  "closest",
  "furthest",
];
const SLOTS = 7;

/** A run drafts from tomorrow to eight days on: the week ahead, and anything left over. */
export const TODO_FROM = 1;
export const TODO_TO = 8;
/** How far back the prompts and places already used are listed, so no week repeats another. */
export const USED_DAYS = 90;
/** One day's place is at least this far from the day before's and the day after's. */
export const APART_KM = 2000;
/** Drafts sent in one request. */
const BATCH = 28;

type Status = "draft" | "approved" | "rejected";

/** A question's place as the desk lists it in brief (worker/questions/store.ts, `BriefSlot`). */
export interface BriefSlot {
  day: number;
  mode: Mode;
  slot: number;
  status: Status;
  review: string;
  questionId: string;
  prompt: string;
}

/** A day's place as the desk lists it (worker/questions/places.ts, `PlaceSlot`). */
export interface DaySlot {
  day: number;
  status: Status;
  place: Place;
  review: string;
}

/** The day's place as the drafter is told it: where CLOSEST and FURTHEST measure from. */
export interface DayPlace {
  id: string;
  /** How the game names it: "Wembley, London", "Lagos, Nigeria". */
  label: string;
  /** A stadium, a city or a landmark. */
  kind: string;
  lat: number;
  lng: number;
  /** `draft` until the reviewer approves it. */
  status: "draft" | "approved";
}

const told = (slot: DaySlot): DayPlace => ({
  id: slot.place.id,
  label: placeLabel(slot.place),
  kind: slot.place.kind,
  lat: slot.place.lat,
  lng: slot.place.lng,
  status: slot.status === "approved" ? "approved" : "draft",
});

/** The day's place that stands: drafted or approved, not rejected. */
function standing(
  places: readonly DaySlot[],
  day: number,
): DaySlot | undefined {
  return places.find((p) => p.day === day && p.status !== "rejected");
}

const measuredFromPlace = (mode: Mode) => isDistanceRule(ruleFor(mode));

/** A question's place that needs a question. */
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
  /** CLOSEST and FURTHEST: the day's place, that the answers are measured from. */
  place?: DayPlace;
  /** CLOSEST and FURTHEST with no place for the day yet: draft and send that first. */
  waitsForPlace?: true;
}

/**
 * The questions to draft, given today's day number and what is in the places from tomorrow
 * to eight days on: every one that is empty or rejected, in order; CLOSEST's and FURTHEST's
 * with the day's place (or waiting for one).
 */
export function placesToDraft(
  today: number,
  slots: readonly BriefSlot[],
  places: readonly DaySlot[] = [],
): TodoPlace[] {
  const todo: TodoPlace[] = [];
  for (let day = today + TODO_FROM; day <= today + TODO_TO; day++) {
    const from = standing(places, day);
    for (const mode of MODES) {
      for (let slot = 0; slot < SLOTS; slot++) {
        const there = slots.find(
          (s) => s.day === day && s.mode === mode && s.slot === slot,
        );
        const place: Omit<TodoPlace, "why"> = {
          day,
          date: dayKeyFor(day),
          mode,
          slot,
          ...(measuredFromPlace(mode) &&
            (from ? { place: told(from) } : { waitsForPlace: true as const })),
        };
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

/** A day that needs its place drafted. */
export interface TodoDay {
  day: number;
  date: string;
  why: "empty" | "rejected";
  review?: string;
  /** The place that was rejected. */
  rejected?: { id: string; label: string };
  /** The days either side's places, where there are any: it must be far from both, and of another kind. */
  before?: DayPlace;
  after?: DayPlace;
}

/** The days from tomorrow to eight days on whose place is empty or rejected, in order. */
export function daysToPlace(
  today: number,
  places: readonly DaySlot[],
): TodoDay[] {
  const todo: TodoDay[] = [];
  for (let day = today + TODO_FROM; day <= today + TODO_TO; day++) {
    const there = places.find((p) => p.day === day);
    if (there && there.status !== "rejected") continue;
    const before = standing(places, day - 1);
    const after = standing(places, day + 1);
    todo.push({
      day,
      date: dayKeyFor(day),
      why: there ? "rejected" : "empty",
      ...(there && {
        review: there.review,
        rejected: { id: there.place.id, label: placeLabel(there.place) },
      }),
      ...(before && { before: told(before) }),
      ...(after && { after: told(after) }),
    });
  }
  return todo;
}

const isBag = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * What is wrong with a file of question drafts, one line each (empty: it is fit to send).
 * Every question is checked as the desk will check it, and the file as a whole: no place
 * filled twice, no question twice in a game, and no prompt asked twice anywhere in the file.
 * A CLOSEST or FURTHEST question is played from its day's place (`placeFor`, the desk's):
 * there must be one, and from it, as for every other mode, some answer must be each of the
 * five shots that score.
 */
export function checkDrafts(
  file: unknown,
  placeFor: (day: number) => DayPlace | null = () => null,
): string[] {
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
    if (measuredFromPlace(mode as Mode)) {
      const from = placeFor(day as number);
      if (!from) {
        problems.push(
          `${at}: day ${String(day)} has no place yet: draft and send the day's place first (it is measured from it)`,
        );
      } else {
        const shots = new Set(shotsOf(question, from, ruleFor(mode as Mode)));
        const empty = SHOT_ORDER.filter(
          (shot) => isGoal(shot) && !shots.has(shot),
        );
        if (empty.length > 0) {
          problems.push(
            `${at}: measured from day ${String(day)}'s place, ${from.label}, no answer would be a ${empty.join(" or a ")} (the reveal shows one for each of the five shots that score: the distances from it are too uneven: most bunched together, or one far from the rest. Pick answers spread nearer to it and further from it, or another list)`,
          );
        }
      }
    }
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

/**
 * What is wrong with a file of the days' places, one line each (empty: fit to send). Each
 * place is checked as the desk will (`checkPlace`), and against its neighbours: the days
 * either side, in the file or on the desk (`around`), must be another kind of place and at
 * least APART_KM away; and no place twice in the file, nor one of `used` (the desk's last
 * USED_DAYS days and the days ahead).
 */
export function checkPlaces(
  file: unknown,
  around: (day: number) => DayPlace | null = () => null,
  used: readonly { day: number; id: string }[] = [],
): string[] {
  if (!isBag(file) || !Array.isArray(file.places)) {
    return ['the file is not { "places": [...] }'];
  }
  const problems: string[] = [];
  const mine = new Map<number, Place>();
  const ids = new Map<string, number>();
  file.places.forEach((sent, i) => {
    if (!isBag(sent)) {
      problems.push(`place ${i + 1}: not an object`);
      return;
    }
    const day = sent.day;
    const at = `day ${String(day)}`;
    if (!Number.isInteger(day) || (day as number) < 1) {
      problems.push(`place ${i + 1}: day must be a day number`);
      return;
    }
    if (mine.has(day as number))
      problems.push(`${at}: the day is placed twice`);
    if (sent.note !== undefined && typeof sent.note !== "string") {
      problems.push(`${at}: note is not text`);
    }
    const checked = checkPlace(sent.place);
    for (const problem of checked.problems) problems.push(`${at}: ${problem}`);
    const place = checked.place;
    if (!place) return;
    mine.set(day as number, place);
    const twice = ids.get(place.id);
    if (twice !== undefined) {
      problems.push(`${at}: ${place.id} is also day ${twice}'s in this file`);
    }
    ids.set(place.id, day as number);
    const before = used.find(
      (u) => u.id === place.id && u.day !== (day as number),
    );
    if (before) {
      problems.push(
        `${at}: ${place.id} is already day ${before.day}'s place: no place twice within ${USED_DAYS} days`,
      );
    }
  });
  // its neighbours: in the file, or on the desk
  const near = (
    day: number,
  ): { label: string; kind: string; lat: number; lng: number } | null => {
    const own = mine.get(day);
    return own ? { ...own, label: placeLabel(own) } : around(day);
  };
  for (const [day, place] of mine) {
    for (const other of [day - 1, day + 1]) {
      // each pair in the file once: the earlier day says it
      if (other < day && mine.has(other)) continue;
      const next = near(other);
      if (!next) continue;
      const km = Math.round(distanceKm(place, next));
      if (km < APART_KM) {
        problems.push(
          `day ${day}: ${placeLabel(place)} is ${km} km from day ${other}'s, ${next.label}: a day's place is ${APART_KM} km or more from the next`,
        );
      }
      if (next.kind === place.kind) {
        problems.push(
          `day ${day}: a ${place.kind}, as day ${other}'s is: no two days running of one kind`,
        );
      }
    }
  }
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

/** What the desk has from day `from` to day `to`: the questions in brief, and the places. */
async function look(
  from: number,
  to: number,
): Promise<{ slots: BriefSlot[]; places: DaySlot[] }> {
  const response = await desk(
    `/admin/questions?from=${Math.max(1, from)}&to=${to}&brief=1`,
  );
  if (!response.ok) throw new Error(`the desk answered ${response.status}`);
  const data = (await response.json()) as {
    slots: BriefSlot[];
    places?: DaySlot[];
  };
  return { slots: data.slots, places: data.places ?? [] };
}

async function today(): Promise<number> {
  return ((await (await desk("/today")).json()) as { day: number }).day;
}

async function todo(json: boolean): Promise<number> {
  const day = await today();
  const to = day + TODO_TO;
  const { slots, places } = await look(to - USED_DAYS, to);
  const days = daysToPlace(day, places);
  const questions = placesToDraft(day, slots, places);
  const used = slots
    .filter((s) => s.status !== "rejected")
    .map((s) => ({
      day: s.day,
      mode: s.mode,
      prompt: s.prompt,
      id: s.questionId,
    }));
  const usedPlaces = places
    .filter((p) => p.status !== "rejected")
    .map((p) => ({ day: p.day, id: p.place.id, label: placeLabel(p.place) }));
  if (json) {
    console.log(
      JSON.stringify(
        {
          site: site(),
          today: day,
          todayDate: dayKeyFor(day),
          days,
          places: questions,
          used,
          usedPlaces,
        },
        null,
        2,
      ),
    );
    return 0;
  }
  console.log(
    `${site()}: today is day ${day} (${dayKeyFor(day)}). From day ${day + TODO_FROM} to day ${to}: ` +
      `${days.length} day${days.length === 1 ? "" : "s"} to place, ` +
      `${questions.length} question${questions.length === 1 ? "" : "s"} to draft.`,
  );
  for (const d of days) {
    console.log(
      `  day ${d.day} (${d.date}) place: ${d.why}` +
        (d.why === "rejected"
          ? ` (${d.rejected?.label}: ${d.review || "no reason given"})`
          : ""),
    );
  }
  for (const place of questions) {
    console.log(
      `  day ${place.day} (${place.date}) ${place.mode} ${place.slot}: ${place.why}` +
        (place.place ? ` (from ${place.place.label})` : "") +
        (place.waitsForPlace ? " (waits for the day's place)" : "") +
        (place.why === "rejected"
          ? ` ("${place.rejected?.prompt}": ${place.review || "no reason given"})`
          : ""),
    );
  }
  console.log(
    `${used.length} questions and ${usedPlaces.length} places are taken in the last ${USED_DAYS} days and the days ahead.`,
  );
  return 0;
}

function read(file: string): unknown {
  return JSON.parse(readFileSync(path.resolve(file), "utf8")) as unknown;
}

const daysIn = (file: unknown, key: "drafts" | "places"): number[] =>
  isBag(file) && Array.isArray(file[key])
    ? (file[key] as unknown[])
        .map((item) => (isBag(item) ? item.day : undefined))
        .filter((day): day is number => Number.isInteger(day))
    : [];

/** What is wrong with a file, of questions or of places, with what the desk has around it. */
async function problemsIn(file: unknown): Promise<string[]> {
  if (isBag(file) && Array.isArray(file.places)) {
    const days = daysIn(file, "places");
    if (days.length === 0) return checkPlaces(file);
    const { places } = await look(
      Math.min(...days) - USED_DAYS,
      Math.max(...days) + USED_DAYS,
    );
    const around = (day: number) => {
      const there = standing(places, day);
      return there ? told(there) : null;
    };
    const used = places
      .filter((p) => p.status !== "rejected")
      .map((p) => ({ day: p.day, id: p.place.id }));
    return checkPlaces(file, around, used);
  }
  const days = daysIn(file, "drafts");
  const distance =
    isBag(file) &&
    Array.isArray(file.drafts) &&
    (file.drafts as unknown[]).some(
      (d) =>
        isBag(d) &&
        MODES.includes(d.mode as Mode) &&
        measuredFromPlace(d.mode as Mode),
    );
  if (!distance || days.length === 0) return checkDrafts(file);
  // CLOSEST and FURTHEST: the days' places, as the desk has them
  const { places } = await look(Math.min(...days), Math.max(...days));
  return checkDrafts(file, (day) => {
    const there = standing(places, day);
    return there ? told(there) : null;
  });
}

async function check(files: string[]): Promise<number> {
  let wrong = 0;
  for (const file of files) {
    let problems: string[];
    try {
      problems = await problemsIn(read(file));
    } catch (error) {
      problems = [
        error instanceof SyntaxError
          ? `cannot be read as JSON: ${error.message}`
          : (error as Error).message,
      ];
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
  if ((await check(files)) !== 0) {
    console.log("Nothing was sent: put the problems right first.");
    return 1;
  }
  let refused = 0;
  for (const file of files) {
    const sent = read(file) as { drafts?: unknown[]; places?: unknown[] };
    const kind = sent.places ? "places" : "drafts";
    const items = (sent.places ?? sent.drafts ?? []) as unknown[];
    for (let i = 0; i < items.length; i += BATCH) {
      const response = await desk(
        kind === "places" ? "/admin/places" : "/admin/questions",
        {
          method: "PUT",
          body: JSON.stringify({
            [kind]: items.slice(i, i + BATCH),
            source: "ai",
          }),
        },
      );
      if (!response.ok) throw new Error(`the desk answered ${response.status}`);
      const { results } = (await response.json()) as {
        results: {
          day: number;
          mode?: string;
          slot?: number;
          outcome: string;
          problems: string[];
        }[];
      };
      for (const result of results) {
        const at =
          kind === "places"
            ? `day ${result.day} place`
            : `day ${result.day} ${result.mode} ${result.slot}`;
        if (result.outcome === "refused") {
          refused++;
          console.log(`${at}: refused`);
          for (const problem of result.problems) console.log(`  ${problem}`);
        } else if (result.outcome === "kept") {
          console.log(`${at}: left alone (an approved one is there)`);
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
