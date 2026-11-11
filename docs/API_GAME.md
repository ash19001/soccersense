# Game rules reference (`~/game`)

The rules are pure TypeScript: no DOM, no clock reads. The current time is always passed in.
Import everything from `~/game`. Never import `test-fixtures.ts`.

**Changed on 2026-11-11.** HOME is scored by the most common answer and AWAY by the most niche
(`ruleFor(mode)` gives `"common"` or `"niche"`), from each answer's `popularity`: an
estimated share of players in percent (`docs/data-notes/popularity.md`). Today's stadium is
still the day's venue but no longer scores them. Distance scoring is kept as the rules
`"closest"` and `"furthest"` for the locked modes CLOSEST and FURTHEST: to switch one on, add
the mode and map it in `ruleFor`; nothing else in the rules changes. `rankAnswers` takes a
`Rule` instead of a `Mode`; `Answer.popularity`, `RankedAnswer.share`, `Turn.share` and
`QuestionView.rule` are new.

## How an interface uses it

```
Menu
  const today = resolveToday(new Date(), location.search, STADIUMS)
  today.stadium, today.dayNumber, today.time (forced sky time, optional)
  loadDay(today.dayKey) gives { home, away }, each null or { total, turns } for the patch scores
  msUntilNextDay(new Date()) to refresh at midnight UTC

Game
  let s = createSession({ mode, dayNumber: today.dayNumber, stadium: today.stadium, questions, now, noTimer: today.noTimer })
  s = reduce(s, action). If the result === s, nothing happened.
  Every frame while asking: reduce(s, { type: "tick", now }) and clockView(s, now).
  Board: questionView(s), pips(s), progressFor(s), clockView(s, now)
  Answer bar: s.rejected (new object per rejection, key the shake on it), clockView(s, now).canPass
  Shot (phase "resolving"): currentTurn(s).grade, progressFor(s).promotions; then dispatch { type: "resolved" }
  Reveal (phase "reveal"): revealFor(s, maxRows); formatShare(row.share) for "34%"; then { type: "next", now }
  Full time (phase "done"): summary(s), results(s), careerFor(s.total), saveSession(s), buildShareText(shareInputFor(s, tierName))

Use one clock for every `now` (Date.now() or performance.now(), never mixed). A game keeps the day and stadium it started with, so playing across midnight saves under the day it began.
```

Notes:

- `Rejection.reason` is `"unknown"` or `"ambiguous"`. The second needs its own line of text
  (for example "Which one? Be more specific.").
- Two answers tied for best both score 100 and both are a WORLDIE. The sample data has no tie at
  either end of any question (a data test keeps it so).
- Tier names are interface text, keyed by `TierId`.
- `Question.decoys` (optional) lists strings the judge must never accept, for real things that
  are one typo away from a listed answer ("Bayer" next to "Bayern").

## Public API

```
types.ts
- type Mode = "home" | "away". The two playable modes.
- type Rule = "common" | "niche" | "closest" | "furthest". New. How a question's answers are ranked.
- interface LatLng { lat: number; lng: number }
- interface Stadium extends LatLng { id; name; city; country }
- type Measure = "birthplace" | "ground" | "location" | "capital". The judge uses it: people, clubs, stadiums, countries.
- interface Answer extends LatLng { id; name; aliases: string[]; place; country; popularity: number }. popularity is new: the estimated share of players who give the answer, in percent, 0.1 to 100, one decimal at most; a question's shares add up to about 100.
- interface Question { id; mode; prompt; measure; measureLabel; asOf; answers: Answer[]; decoys?: string[] }. decoys is new and optional.
- type Grade = "worldie" | "topbins" | "goal" | "ontarget" | "wide" | "timeup" | "skipped"
- interface RankedAnswer { answer: Answer; km: number; share: number; points: number; rank: number }. share (new) is the answer's popularity; km is filled under every rule.

geo.ts
- EARTH_RADIUS_KM = 6371.0088; KM_PER_MILE = 1.609344
- distanceKm(a: LatLng, b: LatLng): number. Haversine, unrounded.
- usesMiles(locale: string): boolean. Region US, GB, LR, MM, or a bare "en"; false for anything else, including a missing locale.
- formatDistance(km: number, locale: string): string. "3 miles", "1 mile", "11,589 miles", "5 km", "under 1 mile", "under 1 km".

scoring.ts
- RULES: readonly Rule[]. New. ["common", "niche", "closest", "furthest"].
- ruleFor(mode: Mode): Rule. New. home → "common", away → "niche".
- isDistanceRule(rule: Rule): boolean. New. True for "closest" and "furthest".
- rankAnswers(question: Question, stadium: LatLng, rule: Rule): RankedAnswer[]. Changed: takes a Rule (was a Mode). Full table, best first, ties in name order. common: highest share first; niche: lowest share first (shares tie when equal to a tenth of a percent); closest / furthest: by whole kilometres from the stadium. points = round(100 * worse / (better + worse)); only the best scores 100. The stadium only matters to the distance rules.
- formatShare(share: number): string. New. "34%", "2.5%", "0.4%"; "under 0.1%" below 0.05 or for a non-number; capped at "100%".
- gradeFor(points: number): Grade. 100 worldie, 80-99 topbins, 55-79 goal, 30-54 ontarget, 0-29 wide.
- rankedFor(table: readonly RankedAnswer[], answerId: string | null): RankedAnswer | null
- interface TableRow extends RankedAnswer { grade: Grade; isPlayer: boolean; index: number; gapBefore: boolean }. grade is new; gapBefore means draw an ellipsis row above.
- tableExcerpt(table: readonly RankedAnswer[], answerId: string | null, maxRows: number): TableRow[]. Whole table if it fits (pass Infinity for all); otherwise first, player's, last and an even spread.

judge.ts
- type JudgeResult = { kind: "empty" } | { kind: "unknown" } | { kind: "ambiguous"; candidates: Answer[] } | { kind: "match"; answer: Answer; via: "exact" | "surname" | "fuzzy" }
- normalise(text: string): string. Lower case, no accents or punctuation, no leading "the", no "and" between words, st/utd/jr spelt out.
- judge(question: Question, input: string): JudgeResult. Order: exact name, exact alias, decoy, surname, the same without an optional word, typo on names and aliases, typo on surnames.
- editDistance(a: string, b: string): number. Damerau-Levenshtein, optimal string alignment.
- allowedTypos(length: number): number. 0 under 5, 1 for 5-8, 2 for 9+.
- typoDistance(text: string, candidate: string): number | null. New. The distance when text can be read as a typo of candidate under all the rules, else null. Both must already be normalised.

career.ts
- type TierId = "park" | "sunday" | "nonleague" | "lower" | "topflight" | "international" | "final" | "winner"
- interface Tier { tier: number; from: number; id: TierId }
- TIERS: readonly Tier[] (8 entries, from = tier * 90); TIER_STEP = 90; TOP_TIER = 7; MAX_TOTAL = 700
- interface Career { tier: number; id: TierId; from: number; next: number | null; progress: number }. id is new; progress is 0 to 1, 1 at the top tier.
- careerFor(total: number): Career
- tierFor(total: number): number
- tiersCrossed(before: number, after: number): number[]. (85, 185) gives [1, 2].
- isPerfect(total: number): boolean. total >= 700.

day.ts
- MS_PER_DAY = 86_400_000; EPOCH_UTC = Date.UTC(2026, 10, 10)
- dayNumber(date: Date): number. 1 on 2026-11-10 UTC; changes at midnight UTC; never below 1.
- utcDayKey(date: Date): string. "YYYY-MM-DD" in UTC.
- dayKeyFor(day: number): string. dayKeyFor(1) = "2026-11-10".
- msUntilNextDay(date: Date): number. A full day at exactly midnight and for an invalid date.
- stadiumForDay(n: number, stadiums: readonly Stadium[]): Stadium. (n - 1) mod length; throws on an empty list.
- interface Overrides { stadiumId?: string; day?: number; time?: { hours: number; minutes: number }; noTimer: boolean }
- parseOverrides(search: string): Overrides. ?stadium=<id>, ?day=<n>, ?time=HH:MM, ?notimer=1.
- interface Today { dayNumber: number; dayKey: string; stadium: Stadium; noTimer: boolean; time?: { hours: number; minutes: number } }. New.
- resolveToday(now: Date, search: string, stadiums: readonly Stadium[]): Today. Now also returns dayKey (= dayKeyFor(dayNumber), follows ?day), noTimer and time. ?stadium pins the stadium without changing the day; an unknown id is ignored.

session.ts
- QUESTION_MS = 30000; PASS_AFTER_MS = 8000
- type Phase = "asking" | "resolving" | "reveal" | "done"
- interface Turn { questionId: string; input: string | null; answerId: string | null; grade: Grade; points: number; km: number | null; share: number | null; rank: number | null; msLeft: number }. share is new (null without an answer).
- interface Rejection { input: string; reason: "unknown" | "ambiguous" }
- interface Session { mode; dayNumber; stadium; questions: readonly Question[]; index: number; phase: Phase; turns: readonly Turn[]; total: number; startedAt: number; deadline: number | null; rejected: Rejection | null; noTimer: boolean }
- type Action = { type: "submit"; input: string; now: number } | { type: "pass"; now: number } | { type: "tick"; now: number } | { type: "resolved" } | { type: "next"; now: number }
- interface SessionOptions { mode; dayNumber; stadium; questions; now: number; noTimer?: boolean }
- createSession(options: SessionOptions): Session. Throws on no questions or a non-finite now.
- reduce(session: Session, action: Action): Session. Never mutates. Ignored actions return the same object. A rejection returns a new object with `rejected` set. Time-up at now >= deadline for tick, submit and pass alike. Pass is allowed from exactly 8 s. Next on the last question gives "done"; everything after done is ignored.
- currentQuestion(session): Question. Stays on the last question once done.
- currentTurn(session): Turn | null. Null while asking.
- isLastQuestion(session): boolean
- canPass(session, now: number): boolean
- msLeft(session, now: number): number. Counts down while asking, frozen in resolving and reveal, 0 when done, full with noTimer.
- ruleOf(session): Rule. New. ruleFor(session.mode).
- tableFor(session, index: number): readonly RankedAnswer[]. Ranked under the game's rule. Memoised per question, stadium and rule, same array every call; [] for a bad index.
- interface Summary { total: number; tier: number; grades: Grade[]; perfect: boolean }
- summary(session): Summary

view.ts (new: selectors, pure, cheap to call on every render)
- interface QuestionView { number: number; count: number; question: Question; prompt: string; mode: Mode; rule: Rule; stadium: Stadium; measure: Measure; measureLabel: string; isLast: boolean }. rule is new. measureLabel is for the distance rules.
- questionView(session): QuestionView. The board's question and instruction line ("Question 3 of 7", "The most common answer wins.").
- interface ClockView { msLeft: number; secondsLeft: number; fraction: number; running: boolean; canPass: boolean; msUntilPass: number | null }
- clockView(session, now: number): ClockView. secondsLeft is 30 at the start, 1 until the last instant, 0 at time up; fraction is 1 to 0 for the timer strip; msUntilPass is null outside asking.
- interface RevealView { index: number; question: Question; turn: Turn; answer: Answer | null; row: RankedAnswer | null; best: RankedAnswer | null; rows: TableRow[]; tableSize: number; isLast: boolean }
- revealFor(session, maxRows = Infinity, index = session.index): RevealView | null. Null until that question is decided. rows has the player's row marked; answer and row are null for a pass or time-up; best is the top row.
- interface ProgressView { totalBefore: number; total: number; gained: number; before: Career; after: Career; promotions: number[] }
- progressFor(session): ProgressView. The career meter for the current question's turn: hold `before` until the shot lands, then fill to `after`; promotions lists the tiers reached.
- pips(session): (Grade | null)[]. One per question, null until decided.
- interface ResultLine { index: number; question: Question; turn: Turn; answer: Answer | null }
- results(session): ResultLine[]. Each decided question with the answer given, for full time.
- shareInputFor(session, tierName: string): ShareInput

storage.ts (key "soccersense:v1:<dayKey>:<mode>", value { total, turns }; none of these throw. A game saved before Turn.share existed still loads, with share null.)
- STORAGE_PREFIX = "soccersense:v1"
- interface StoredGame { total: number; turns: readonly Turn[] }
- type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">
- storageKey(dayKey: string, mode: Mode): string
- saveGame(dayKey: string, mode: Mode, game: StoredGame, storage?: StorageLike | null): boolean. Overwrites; returns whether it was written.
- saveSession(session: Session, storage?: StorageLike | null): boolean. New. Saves a finished game under dayKeyFor(session.dayNumber) and session.mode; false if the game is not done.
- loadGame(dayKey: string, mode: Mode, storage?): StoredGame | null. Null for junk, including a total that is not the sum of its turns.
- loadDay(dayKey: string, storage?): Record<Mode, StoredGame | null>
- clearGame(dayKey: string, mode: Mode, storage?): void
  Omit storage to use localStorage; pass null for "none".

share.ts
- GRADE_SYMBOLS: Record<Grade, string>
- interface ShareInput { dayNumber: number; mode: Mode; stadiumName: string; total: number; tierName: string; grades: readonly Grade[] }
- buildShareText(input: ShareInput): string. Three lines joined with "\n".
```
