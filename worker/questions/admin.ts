/**
 * The approval desk's API: where a week's drafted questions are sent, looked at, put right,
 * approved or rejected. Only for whoever holds the admin token (the product owner sets it
 * in Cloudflare as the secret `ADMIN_TOKEN`, and gives it to the drafting routine).
 *
 *   PUT  /api/admin/questions                      send drafts: { drafts: [{ day, mode, slot,
 *                                                  question, note? }], source?, replace? }
 *   GET  /api/admin/questions?from=<day>&to=<day>  every place filled in those days, whole
 *        ...&brief=1                               the same without the answers (the prompt,
 *                                                  the state, the reviewer's note), over
 *                                                  up to 120 days: what is taken
 *   POST /api/admin/questions/<day>/<mode>/<slot>  { status?, review?, question? }: approve,
 *                                                  reject, send back to draft, or put a
 *                                                  corrected question in its place
 *
 * A request without the token is answered 401 with a `reason`: `no_token` (no
 * `Authorization: Bearer ...` header came) or `wrong_token` (one came that is not the
 * desk's).
 *
 * Every question is checked on its way in and again as it is approved (`checkQuestion`):
 * nothing unfit is stored, and nothing is approved that would not play.
 */

import { checkQuestion } from "~/game/check";
import type { Mode } from "~/game/types";

import { database } from "../db/migrate";
import type { Env } from "../env";
import { failure, json, wrongMethod } from "../http";
import {
  SLOT_STATUSES,
  type SlotKey,
  type SlotStatus,
  briefBetween,
  isSlotKey,
  sameQuestionElsewhere,
  saveDraft,
  setStatus,
  slotAt,
  slotsBetween,
} from "./store";

/** A token shorter than this is not a secret: the desk stays shut. */
export const MIN_TOKEN = 24;
/** The most a request may carry, and the most drafts in one. */
export const MAX_BODY = 4_000_000;
export const MAX_DRAFTS = 250;
/** The most days one look may span, whole and in brief. */
export const MAX_DAYS = 31;
export const MAX_BRIEF_DAYS = 120;

/** SHA-256 of a text, as bytes: tokens are compared by their hashes, in equal time. */
async function digest(text: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
  );
}

/** Whether the request carries the admin token (`Authorization: Bearer ...`). */
export async function isAdmin(request: Request, env: Env): Promise<boolean> {
  const token = env.ADMIN_TOKEN ?? "";
  if (token.length < MIN_TOKEN) return false;
  const header = request.headers.get("authorization") ?? "";
  const given = /^Bearer\s+(\S+)$/i.exec(header)?.[1] ?? "";
  if (given === "") return false;
  const [a, b] = await Promise.all([digest(token), digest(given)]);
  let differ = 0;
  for (let i = 0; i < a.length; i++) differ |= a[i] ^ b[i];
  return differ === 0;
}

/** What became of one draft that was sent. */
export interface DraftResult extends SlotKey {
  /** `saved`; `kept` (an approved question is in the place); `refused` (see `problems`). */
  outcome: "saved" | "kept" | "refused";
  problems: string[];
}

async function body(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

const isBag = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const keyOf = (bag: Record<string, unknown>): SlotKey => ({
  day: bag.day as number,
  mode: bag.mode as Mode,
  slot: bag.slot as number,
});

/** Answers a request under `/api/admin`. `route` is the path after `/api`. */
export async function admin(
  request: Request,
  env: Env,
  now: number,
  route: string,
): Promise<Response> {
  if ((env.ADMIN_TOKEN ?? "").length < MIN_TOKEN) {
    return failure("admin_not_set_up", 503, now);
  }
  if (!(await isAdmin(request, env))) {
    // Which it was, for whoever is setting a caller up: nothing is given away, since the
    // caller knows whether it sent one.
    const sent = /^Bearer\s+\S+$/i.test(
      request.headers.get("authorization") ?? "",
    );
    return json(
      { error: "unauthorized", reason: sent ? "wrong_token" : "no_token" },
      now,
      { status: 401 },
    );
  }
  if (!env.DB) return failure("no_database", 503, now);
  const db = env.DB;
  await database(db, now);

  if (route === "/admin/questions") {
    const wrong = wrongMethod(request, ["GET", "PUT"], now);
    if (wrong) return wrong;

    if (request.method === "GET") {
      const params = new URL(request.url).searchParams;
      const from = Number(params.get("from"));
      const to = Number(params.get("to") ?? from);
      const brief = params.get("brief") === "1";
      const ok =
        Number.isInteger(from) &&
        Number.isInteger(to) &&
        from >= 1 &&
        to >= from &&
        to - from < (brief ? MAX_BRIEF_DAYS : MAX_DAYS);
      if (!ok) return failure("bad_days", 400, now);
      const slots = brief
        ? await briefBetween(db, from, to)
        : await slotsBetween(db, from, to);
      return json({ from, to, slots }, now);
    }

    const sent = await body(request);
    if (!isBag(sent) || !Array.isArray(sent.drafts)) {
      return failure("bad_request", 400, now);
    }
    if (sent.drafts.length > MAX_DRAFTS) {
      return failure("too_many_drafts", 400, now);
    }
    const source = sent.source === "hand" ? "hand" : "ai";
    const results: DraftResult[] = [];
    for (const draft of sent.drafts) {
      const bag = isBag(draft) ? draft : {};
      const key = keyOf(bag);
      const result: DraftResult = { ...key, outcome: "refused", problems: [] };
      results.push(result);
      if (!isSlotKey(key)) {
        result.problems.push(
          "day, mode and slot must be a day number, a mode and a place from 0 to 6",
        );
        continue;
      }
      const checked = checkQuestion(bag.question, key.mode);
      if (!checked.question) {
        result.problems = checked.problems;
        continue;
      }
      const twins = await sameQuestionElsewhere(db, key, checked.question.id);
      if (twins.length > 0) {
        result.problems.push(
          `the same question (${checked.question.id}) is already in place ${twins.join(", ")} of that day and mode`,
        );
        continue;
      }
      result.outcome = await saveDraft(
        db,
        key,
        {
          question: checked.question,
          note: typeof bag.note === "string" ? bag.note.slice(0, 4000) : "",
          source,
        },
        now,
        sent.replace === true,
      );
    }
    return json({ results }, now);
  }

  const one = /^\/admin\/questions\/(\d+)\/([a-z]+)\/(\d)$/.exec(route);
  if (one) {
    const wrong = wrongMethod(request, ["POST"], now);
    if (wrong) return wrong;
    const key: SlotKey = {
      day: Number(one[1]),
      mode: one[2] as Mode,
      slot: Number(one[3]),
    };
    if (!isSlotKey(key)) return failure("not_found", 404, now);
    const sent = await body(request);
    if (!isBag(sent)) return failure("bad_request", 400, now);
    const status = sent.status as SlotStatus | undefined;
    if (status !== undefined && !SLOT_STATUSES.includes(status)) {
      return failure("bad_status", 400, now);
    }
    let slot = await slotAt(db, key);

    // a corrected question, put in the place of the one that is there
    if (sent.question !== undefined) {
      const checked = checkQuestion(sent.question, key.mode);
      if (!checked.question) {
        return json({ error: "unfit", problems: checked.problems }, now, {
          status: 422,
        });
      }
      const twins = await sameQuestionElsewhere(db, key, checked.question.id);
      if (twins.length > 0) {
        return json(
          {
            error: "unfit",
            problems: [
              `the same question (${checked.question.id}) is already in place ${twins.join(", ")} of that day and mode`,
            ],
          },
          now,
          { status: 422 },
        );
      }
      await saveDraft(
        db,
        key,
        {
          question: checked.question,
          note: slot?.note ?? "",
          source: slot?.source ?? "hand",
        },
        now,
        true,
      );
      slot = await slotAt(db, key);
    }
    if (!slot) return failure("not_found", 404, now);

    if (status !== undefined) {
      if (status === "approved") {
        // checked again as it is passed: the rules may have moved on since it was drafted
        const checked = checkQuestion(slot.question, key.mode);
        if (!checked.question) {
          return json({ error: "unfit", problems: checked.problems }, now, {
            status: 422,
          });
        }
      }
      const review =
        typeof sent.review === "string" ? sent.review.slice(0, 2000) : "";
      await setStatus(db, key, status, review, now);
      slot = await slotAt(db, key);
    }
    return json({ slot }, now);
  }

  return failure("not_found", 404, now);
}
