// The approval desk: the product owner's page for the day's questions (docs/ARCHITECTURE.md
// section 8). A week's drafts arrive in the database; here each is looked at, approved,
// rejected with a reason, or put right, through the admin API (worker/questions/admin.ts).
// Its other tab is moderation: the players with accounts (./admin-players.tsx).
//
// Not a page for players, and not in the game's skin: it is a working tool with long tables
// of answers to read, so it is plain and legible (system type, no pixel fonts). It asks not
// to be indexed and is not in PAGES. Anyone can load it; nothing in it works without the
// admin token, which is kept in this browser's storage and sent only to this site's API.
//
// Browser only past the first render: the token is read in an effect, never while
// rendering (the page is prerendered).

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { type Place, placeLabel } from "~/data/places";
import { STADIUMS } from "~/data/stadiums";
import {
  type LatLng,
  MODES,
  type Mode,
  type Question,
  SHOT_ORDER,
  type Shot,
  dayKeyFor,
  distanceKm,
  ruleFor,
  shotsOf,
  stadiumForDay,
} from "~/game";
import { strings } from "~/i18n";
import type { Route } from "./+types/admin";
import { Players } from "./admin-players";

const text = strings.admin;
const TOKEN_KEY = "soccersense:admin-token";
const DAYS = 7;
const PLACES = 7;

// The token, kept in this browser. It is read as an external store, so the prerendered
// page (which has no browser) and the first render in the browser agree: no token.
const tokenListeners = new Set<() => void>();
/** A token typed where there is no storage: kept for the visit. */
let unsaved: string | null = null;

function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? unsaved;
  } catch {
    return unsaved;
  }
}

function writeToken(value: string | null): void {
  unsaved = value;
  try {
    if (value === null) window.localStorage.removeItem(TOKEN_KEY);
    else window.localStorage.setItem(TOKEN_KEY, value);
  } catch {
    // no storage: it lasts until the page is closed
  }
  for (const listener of [...tokenListeners]) listener();
}

function subscribeToToken(listener: () => void): () => void {
  tokenListeners.add(listener);
  return () => {
    tokenListeners.delete(listener);
  };
}

const noToken = () => null;

export const meta: Route.MetaFunction = () => [
  { title: `${text.title} · ${strings.siteName}` },
  { name: "robots", content: "noindex" },
];

type Status = "draft" | "approved" | "rejected";

/** A place as the API sends it (worker/questions/store.ts, `Slot`). */
interface Slot {
  day: number;
  mode: Mode;
  slot: number;
  status: Status;
  question: Question;
  note: string;
  review: string;
  source: string;
  updatedAt: number;
}

/** A day's place as the API sends it (worker/questions/places.ts, `PlaceSlot`). */
interface DaySlot {
  day: number;
  status: Status;
  place: Place;
  note: string;
  review: string;
  source: string;
  updatedAt: number;
}

/** What is picked: a day and mode's questions, or a day's place. */
type Picked = { day: number; mode: Mode | "place" };

const STATUS_STYLE: Record<Status, string> = {
  draft: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-rose-100 text-rose-900",
};

const button =
  "rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50";
const primary =
  "rounded border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50";

function dayLabel(day: number, today: number | null): string {
  const key = dayKeyFor(day);
  const weekday = text.weekdays[new Date(`${key}T00:00:00Z`).getUTCDay()];
  const label = text.day(weekday, key, day);
  return day === today ? `${label}, ${text.today}` : label;
}

/** The answers in the order the mode scores them: the best shot first. */
/** A question's answers as the desk lists them: each with its shot, and its distance in km. */
interface Row {
  answer: Question["answers"][number];
  shot: Shot;
  km: number | null;
}

function ranked(question: Question): Row[] {
  return [...question.answers]
    .sort(
      (a, b) =>
        SHOT_ORDER.indexOf(a.shot) - SHOT_ORDER.indexOf(b.shot) ||
        b.popularity - a.popularity,
    )
    .map((answer) => ({ answer, shot: answer.shot, km: null }));
}

/**
 * CLOSEST's and FURTHEST's answers as their day plays them: their shots are not filed but
 * worked out from the day's place, so each with its shot and its distance from there, best
 * first.
 */
function fromPlace(question: Question, place: LatLng, mode: Mode): Row[] {
  const shots = shotsOf(question, place, ruleFor(mode));
  const nearer = mode === "closest" ? 1 : -1;
  return question.answers
    .map((answer, i) => ({
      answer,
      shot: shots[i],
      km: Math.round(distanceKm(place, answer)),
    }))
    .sort(
      (a, b) =>
        SHOT_ORDER.indexOf(a.shot) - SHOT_ORDER.indexOf(b.shot) ||
        (a.km - b.km) * nearer,
    );
}

export default function Admin() {
  const token = useSyncExternalStore(subscribeToToken, readToken, noToken);
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [today, setToday] = useState<number | null>(null);
  const [from, setFrom] = useState<number | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [places, setPlaces] = useState<DaySlot[]>([]);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [view, setView] = useState<"questions" | "players">("questions");
  const failed = useCallback(() => setMessage(text.failed), []);

  const signOut = useCallback((why = "") => {
    writeToken(null);
    setSlots([]);
    setPlaces([]);
    setPicked(null);
    setMessage(why);
  }, []);

  /** Asks the admin API. Null when the desk turned the request away (and says why). */
  const ask = useCallback(
    async (path: string, init?: RequestInit): Promise<Response | null> => {
      if (!token) return null;
      let response: Response;
      try {
        response = await fetch(`/api/admin${path}`, {
          ...init,
          headers: {
            authorization: `Bearer ${token}`,
            ...(init?.body ? { "content-type": "application/json" } : {}),
          },
        });
      } catch {
        setMessage(text.failed);
        return null;
      }
      if (response.status === 401) {
        signOut(text.wrongToken);
        return null;
      }
      if (response.status === 503) {
        signOut(text.notSetUp);
        return null;
      }
      return response;
    },
    [token, signOut],
  );

  const load = useCallback(
    async (start: number) => {
      setBusy(true);
      const response = await ask(
        `/questions?from=${start}&to=${start + DAYS - 1}`,
      );
      if (response?.ok) {
        const data = (await response.json()) as {
          slots: Slot[];
          places?: DaySlot[];
        };
        setSlots(data.slots);
        setPlaces(data.places ?? []);
        setFrom(start);
        setMessage("");
      } else if (response) {
        setMessage(text.failed);
      }
      setBusy(false);
    },
    [ask],
  );

  // Signed in: what day is it by the server, then that week.
  useEffect(() => {
    if (!token) return;
    let stale = false;
    void (async () => {
      let day: number;
      try {
        const response = await fetch("/api/today");
        day = ((await response.json()) as { day: number }).day;
      } catch {
        setMessage(text.failed);
        return;
      }
      if (stale) return;
      setToday(day);
      await load(day);
    })();
    return () => {
      stale = true;
    };
  }, [token, load]);

  const signIn = (event: React.FormEvent) => {
    event.preventDefault();
    const value = typed.trim();
    if (value === "") return;
    setMessage("");
    setTyped("");
    writeToken(value);
  };

  /** Changes one place (approve, reject, send back, or a corrected question). */
  const change = useCallback(
    async (
      slot: Pick<Slot, "day" | "mode" | "slot">,
      body: Record<string, unknown>,
    ): Promise<string[] | null> => {
      setBusy(true);
      const response = await ask(
        `/questions/${slot.day}/${slot.mode}/${slot.slot}`,
        { method: "POST", body: JSON.stringify(body) },
      );
      setBusy(false);
      if (!response) return null;
      if (response.status === 422) {
        return ((await response.json()) as { problems: string[] }).problems;
      }
      if (!response.ok) {
        setMessage(text.failed);
        return null;
      }
      const next = ((await response.json()) as { slot: Slot }).slot;
      setSlots((all) =>
        all.map((s) =>
          s.day === next.day && s.mode === next.mode && s.slot === next.slot
            ? next
            : s,
        ),
      );
      return [];
    },
    [ask],
  );

  /** Changes a day's place (approve, reject, send back, or a corrected place). */
  const changePlace = useCallback(
    async (
      day: number,
      body: Record<string, unknown>,
    ): Promise<string[] | null> => {
      setBusy(true);
      const response = await ask(`/places/${day}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setBusy(false);
      if (!response) return null;
      if (response.status === 422) {
        return ((await response.json()) as { problems: string[] }).problems;
      }
      if (!response.ok) {
        setMessage(text.failed);
        return null;
      }
      // its CLOSEST and FURTHEST may have gone back to draft: the week as it is now
      if (from !== null) await load(from);
      return [];
    },
    [ask, from, load],
  );

  const game = useMemo(
    () =>
      picked
        ? slots.filter((s) => s.day === picked.day && s.mode === picked.mode)
        : [],
    [slots, picked],
  );

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
        <form onSubmit={signIn} className="mx-auto max-w-md space-y-3">
          <h1 className="text-2xl font-semibold">{text.title}</h1>
          <p className="text-sm text-slate-600">{text.intro}</p>
          <label className="block text-sm font-medium" htmlFor="admin-token">
            {text.tokenLabel}
          </label>
          <input
            id="admin-token"
            type="password"
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2"
          />
          <p className="text-xs text-slate-500">{text.tokenHelp}</p>
          <button type="submit" className={primary}>
            {text.signIn}
          </button>
          {message && (
            <p role="alert" className="text-sm text-rose-700">
              {message}
            </p>
          )}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 font-sans text-slate-900 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-2xl font-semibold">
            {view === "players" ? text.players.title : text.title}
          </h1>
          {view === "questions" && (
            <>
              <button
                type="button"
                className={button}
                disabled={busy || from === null || from <= 1}
                onClick={() =>
                  from !== null && void load(Math.max(1, from - DAYS))
                }
              >
                {text.earlier}
              </button>
              <button
                type="button"
                className={button}
                disabled={busy || today === null}
                onClick={() => today !== null && void load(today)}
              >
                {text.thisWeek}
              </button>
              <button
                type="button"
                className={button}
                disabled={busy || from === null}
                onClick={() => from !== null && void load(from + DAYS)}
              >
                {text.later}
              </button>
            </>
          )}
          <button type="button" className={button} onClick={() => signOut()}>
            {text.signOut}
          </button>
        </header>
        <nav className="flex gap-1 border-b border-slate-300">
          {(["questions", "players"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={view === tab}
              onClick={() => setView(tab)}
              className={`-mb-px rounded-t border px-3 py-1.5 text-sm font-medium ${view === tab ? "border-slate-300 border-b-slate-50 bg-slate-50 text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900"}`}
            >
              {text.tabs[tab]}
            </button>
          ))}
        </nav>
        {message && (
          <p role="alert" className="text-sm text-rose-700">
            {message}
          </p>
        )}
        {view === "players" ? (
          <Players ask={ask} failed={failed} />
        ) : (
          <>
            <p className="text-sm text-slate-600">{text.intro}</p>
            {from === null ? (
              <p>{text.loading}</p>
            ) : (
              <table className="w-full border-collapse bg-white text-sm shadow-sm">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="border border-slate-200 p-2">
                      {text.dayColumn}
                    </th>
                    <th className="border border-slate-200 p-2">
                      {text.places.column}
                    </th>
                    {MODES.map((mode) => (
                      <th key={mode} className="border border-slate-200 p-2">
                        {strings.home.modes[mode].label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: DAYS }, (_, i) => from + i).map(
                    (day) => (
                      <tr key={day}>
                        <th className="border border-slate-200 p-2 text-left font-medium">
                          {dayLabel(day, today)}
                        </th>
                        <td className="border border-slate-200 p-0">
                          {(() => {
                            const mine = places.find((p) => p.day === day);
                            const on =
                              picked?.day === day && picked.mode === "place";
                            return (
                              <button
                                type="button"
                                aria-pressed={on}
                                onClick={() =>
                                  setPicked({ day, mode: "place" })
                                }
                                className={`block w-full p-2 text-left hover:bg-slate-100 ${on ? "bg-sky-100" : ""}`}
                              >
                                {mine ? (
                                  <>
                                    <span className="font-medium">
                                      {placeLabel(mine.place)}
                                    </span>{" "}
                                    <span
                                      className={`rounded px-1 text-xs ${STATUS_STYLE[mine.status]}`}
                                    >
                                      {text.status[mine.status]}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-slate-400">
                                    {text.nothing}
                                  </span>
                                )}
                              </button>
                            );
                          })()}
                        </td>
                        {MODES.map((mode) => {
                          const mine = slots.filter(
                            (s) => s.day === day && s.mode === mode,
                          );
                          const count = (status: Status) =>
                            mine.filter((s) => s.status === status).length;
                          const approved = count("approved");
                          const on =
                            picked?.day === day && picked.mode === mode;
                          return (
                            <td
                              key={mode}
                              className="border border-slate-200 p-0"
                            >
                              <button
                                type="button"
                                aria-pressed={on}
                                onClick={() => setPicked({ day, mode })}
                                className={`block w-full p-2 text-left hover:bg-slate-100 ${on ? "bg-sky-100" : ""}`}
                              >
                                {approved === PLACES ? (
                                  <span className="font-medium text-emerald-800">
                                    {text.scheduled}
                                  </span>
                                ) : mine.length === 0 ? (
                                  <span className="text-slate-400">
                                    {text.nothing}
                                  </span>
                                ) : (
                                  <>
                                    {text.counts(
                                      approved,
                                      count("draft"),
                                      count("rejected"),
                                    )}
                                    {mine.length < PLACES && (
                                      <span className="text-slate-400">
                                        {`, ${text.missing(PLACES - mine.length)}`}
                                      </span>
                                    )}
                                  </>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            )}

            {!picked ? (
              from !== null && (
                <p className="text-sm text-slate-600">{text.pick}</p>
              )
            ) : picked.mode === "place" ? (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold">
                  {text.places.title(dayLabel(picked.day, today))}
                </h2>
                {(() => {
                  const mine = places.find((p) => p.day === picked.day);
                  return mine ? (
                    <DayPlace
                      key={`${mine.day}-${mine.updatedAt}`}
                      slot={mine}
                      busy={busy}
                      change={changePlace}
                    />
                  ) : (
                    <article className="rounded border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
                      {text.places.none(
                        placeLabel(
                          stadiumForDay(picked.day, STADIUMS) as Place,
                        ),
                      )}
                    </article>
                  );
                })()}
              </section>
            ) : (
              <section className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="mr-auto text-xl font-semibold">
                    {text.game(
                      strings.home.modes[picked.mode].label,
                      dayLabel(picked.day, today),
                    )}
                  </h2>
                  <button
                    type="button"
                    className={primary}
                    disabled={busy || !game.some((s) => s.status === "draft")}
                    onClick={async () => {
                      for (const slot of game) {
                        if (slot.status === "draft") {
                          const wrong = await change(slot, {
                            status: "approved",
                          });
                          if (wrong && wrong.length > 0) {
                            setMessage(wrong[0]);
                            return;
                          }
                        }
                      }
                    }}
                  >
                    {text.approveAll}
                  </button>
                </div>
                {Array.from({ length: PLACES }, (_, place) => {
                  const slot = game.find((s) => s.slot === place);
                  return slot ? (
                    <Place
                      key={`${slot.day}-${slot.mode}-${place}-${slot.updatedAt}`}
                      slot={slot}
                      busy={busy}
                      change={change}
                      dayPlace={
                        places.find(
                          (p) => p.day === slot.day && p.status !== "rejected",
                        ) ?? null
                      }
                    />
                  ) : (
                    <article
                      key={place}
                      className="rounded border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500"
                    >
                      <strong>{text.place(place + 1)}</strong>:{" "}
                      {text.emptyPlace}
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Place({
  slot,
  busy,
  change,
  dayPlace,
}: {
  slot: Slot;
  busy: boolean;
  change: (
    slot: Pick<Slot, "day" | "mode" | "slot">,
    body: Record<string, unknown>,
  ) => Promise<string[] | null>;
  /** The day's place drafted or approved (not rejected), if there is one. */
  dayPlace: DaySlot | null;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [reason, setReason] = useState(slot.review);
  const question = slot.question;
  const era = slot.mode === "retro" || slot.mode === "nextgen";
  // CLOSEST and FURTHEST: measured from the day's place (the one drafted for the day, or
  // the fixed list's while there is none)
  const distance = slot.mode === "closest" || slot.mode === "furthest";
  const from = !distance
    ? null
    : (dayPlace?.place ?? (stadiumForDay(slot.day, STADIUMS) as Place));
  const fromWords = !from
    ? ""
    : !dayPlace
      ? text.fromFixedPlace(placeLabel(from))
      : dayPlace.status === "approved"
        ? text.fromPlace(placeLabel(from))
        : text.fromDraftPlace(placeLabel(from));
  const rows = from ? fromPlace(question, from, slot.mode) : ranked(question);

  const save = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setProblems([text.badJson]);
      return;
    }
    const wrong = await change(slot, { question: parsed });
    if (wrong && wrong.length > 0) setProblems(wrong);
  };

  return (
    <article className="rounded border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[slot.status]}`}
        >
          {text.status[slot.status]}
        </span>
        <h3 className="mr-auto font-semibold">
          {text.place(slot.slot + 1)}: {question.prompt}
        </h3>
        <span className="text-xs text-slate-500">
          {text.answers(question.answers.length)}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {text.measured(question.measureLabel)} · {question.id} · {question.asOf}
      </p>
      {from && (
        <p className="mt-1 text-sm font-medium text-slate-700">{fromWords}</p>
      )}
      {slot.note && (
        <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">
          <strong>{text.note}:</strong> {slot.note}
        </p>
      )}
      {slot.review && (
        <p className="mt-2 text-sm whitespace-pre-wrap text-rose-800">
          <strong>{text.review}:</strong> {slot.review}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={primary}
          disabled={busy || slot.status === "approved"}
          onClick={async () => {
            const wrong = await change(slot, { status: "approved" });
            if (wrong && wrong.length > 0) setProblems(wrong);
          }}
        >
          {text.approve}
        </button>
        <input
          aria-label={text.reason}
          placeholder={text.reason}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="min-w-48 flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          className={button}
          disabled={busy}
          onClick={() =>
            void change(slot, { status: "rejected", review: reason.trim() })
          }
        >
          {text.reject}
        </button>
        {slot.status !== "draft" && (
          <button
            type="button"
            className={button}
            disabled={busy}
            onClick={() => void change(slot, { status: "draft" })}
          >
            {text.toDraft}
          </button>
        )}
        <button
          type="button"
          className={button}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? text.hide : text.show}
        </button>
        <button
          type="button"
          className={button}
          onClick={() => {
            setDraft(JSON.stringify(question, null, 2));
            setProblems([]);
            setEditing(!editing);
          }}
        >
          {editing ? text.cancel : text.edit}
        </button>
      </div>

      {!editing && problems.length > 0 && (
        <div role="alert" className="mt-2 text-sm text-rose-700">
          <p className="font-semibold">{text.notApproved}</p>
          <ul className="list-disc pl-5">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}

      {editing && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-500">{text.editHelp}</p>
          <textarea
            aria-label={text.edit}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            className="h-96 w-full rounded border border-slate-300 p-2 font-mono text-xs"
          />
          {problems.length > 0 && (
            <div role="alert" className="text-sm text-rose-700">
              <p className="font-semibold">{text.notSaved}</p>
              <ul className="list-disc pl-5">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            className={primary}
            disabled={busy}
            onClick={() => void save()}
          >
            {text.save}
          </button>
        </div>
      )}

      {open && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border border-slate-200 p-1.5">
                  {text.columns.name}
                </th>
                <th className="border border-slate-200 p-1.5">
                  {text.columns.shot}
                </th>
                <th className="border border-slate-200 p-1.5">
                  {era
                    ? text.columns.years
                    : from
                      ? text.columns.distance
                      : text.columns.share}
                </th>
                <th className="border border-slate-200 p-1.5">
                  {text.columns.aliases}
                </th>
                <th className="border border-slate-200 p-1.5">
                  {text.columns.place}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ answer, shot, km }) => (
                <tr key={answer.id}>
                  <td className="border border-slate-200 p-1.5 font-medium">
                    {answer.name}
                  </td>
                  <td className="border border-slate-200 p-1.5">
                    {strings.play.shots[shot]}
                  </td>
                  <td className="border border-slate-200 p-1.5">
                    {era
                      ? (answer.years ?? []).join(", ")
                      : km !== null
                        ? text.km(km)
                        : `${answer.popularity}%`}
                  </td>
                  <td className="border border-slate-200 p-1.5 text-slate-600">
                    {answer.aliases.join(", ")}
                  </td>
                  <td className="border border-slate-200 p-1.5 text-slate-600">
                    {answer.place}, {answer.country}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

/**
 * A day's place at the desk: where it is, the drafter's note, a link to see it on a map,
 * and approve, reject with a reason, send back to draft, or correct it as JSON. Approving it
 * lets the day's CLOSEST and FURTHEST be approved; changing it once approved sends them back.
 */
function DayPlace({
  slot,
  busy,
  change,
}: {
  slot: DaySlot;
  busy: boolean;
  change: (
    day: number,
    body: Record<string, unknown>,
  ) => Promise<string[] | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [reason, setReason] = useState(slot.review);
  const place = slot.place;
  const map = `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=15/${place.lat}/${place.lng}`;

  const act = async (body: Record<string, unknown>) => {
    const wrong = await change(slot.day, body);
    if (wrong && wrong.length > 0) setProblems(wrong);
  };
  const save = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setProblems([text.badJson]);
      return;
    }
    await act({ place: parsed });
  };

  return (
    <article className="rounded border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[slot.status]}`}
        >
          {text.status[slot.status]}
        </span>
        <h3 className="mr-auto font-semibold">{placeLabel(place)}</h3>
        <span className="text-xs text-slate-500">
          {text.places.kinds[place.kind]}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {text.places.where(place.lat, place.lng)} · {place.id} ·{" "}
        <a
          href={map}
          target="_blank"
          rel="noreferrer"
          className="text-sky-700 underline"
        >
          {text.places.onMap}
        </a>
      </p>
      {slot.note && (
        <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">
          <strong>{text.note}:</strong> {slot.note}
        </p>
      )}
      {slot.review && (
        <p className="mt-2 text-sm whitespace-pre-wrap text-rose-800">
          <strong>{text.review}:</strong> {slot.review}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={primary}
          disabled={busy || slot.status === "approved"}
          onClick={() => void act({ status: "approved" })}
        >
          {text.approve}
        </button>
        <input
          aria-label={text.reason}
          placeholder={text.reason}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="min-w-48 flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          className={button}
          disabled={busy}
          onClick={() =>
            void act({ status: "rejected", review: reason.trim() })
          }
        >
          {text.reject}
        </button>
        {slot.status !== "draft" && (
          <button
            type="button"
            className={button}
            disabled={busy}
            onClick={() => void act({ status: "draft" })}
          >
            {text.toDraft}
          </button>
        )}
        <button
          type="button"
          className={button}
          onClick={() => {
            setDraft(JSON.stringify(place, null, 2));
            setProblems([]);
            setEditing(!editing);
          }}
        >
          {editing ? text.cancel : text.edit}
        </button>
      </div>
      {problems.length > 0 && (
        <div role="alert" className="mt-2 text-sm text-rose-700">
          <p className="font-semibold">{text.notSaved}</p>
          <ul className="list-disc pl-5">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}
      {editing && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-500">{text.places.editHelp}</p>
          <textarea
            aria-label={text.edit}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            className="h-48 w-full rounded border border-slate-300 p-2 font-mono text-xs"
          />
          <button
            type="button"
            className={primary}
            disabled={busy}
            onClick={() => void save()}
          >
            {text.save}
          </button>
        </div>
      )}
    </article>
  );
}
