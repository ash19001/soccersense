# Game rules reference (`~/game`)

The rules are pure TypeScript: no DOM, no clock reads. The current time is always passed in.
Import everything from `~/game`. Never import `test-fixtures.ts`.

**Changed on 2026-11-11.** HOME is scored by the most common answer and AWAY by the most
uncommon (`ruleFor(mode)` gives `"common"` or `"niche"`: the rule keeps its id in code, while
every word a player sees says "uncommon"), from each answer's `popularity`: an
estimated share of players in percent (`docs/data-notes/popularity.md`). The day's pin (`Stadium`:
an id and a place, with no name since 2026-11-17) no longer scores them. Distance scoring is kept as the rules
`"closest"` and `"furthest"`, played since 2026-11-18 by the modes CLOSEST and FURTHEST
(`ruleFor("closest")` is `"closest"`; `isDistanceMode`; their shots are worked out from the
day's place by `shotsOf`, never filed; the day's place has a name in `~/data/places`, which
the rules never read). `rankAnswers` takes a
`Rule` instead of a `Mode`; `Answer.popularity`, `RankedAnswer.share`, `Turn.share` and
`QuestionView.rule` are new.

**Changed again on 2026-11-11: six shots.** Points no longer slide with an answer's place.
Every answer is one of six shots (`Shot`): `worldie` 100, `golazo` 80, `trivela` 60,
`toepoke` 30, `tapin` 10, `miss` 0, stored in the data as `Answer.shot` for the question's own
mode. `Grade` is the six plus `timeup` and `skipped` (both 0); the sliding grades before them
(topbins, goal, ontarget, wide) are gone. New: `shots.ts` (`SHOT_ORDER`, `SHOT_POINTS`, the
rule `shotsFor`), `Shot`, `Answer.shot`, `RankedAnswer.shot`, `shotsOf`. Gone: `gradeFor`. The
table is ranked by shot first. Games saved with the sliding grades (finished or in progress)
read as nothing.

**Changed a third time on 2026-11-11: the shots renamed, and titles.** The ids changed with
the names; the points did not: `bicycle` is now `worldie`, `finesse` `golazo`, `power`
`trivela`, `chip` `toepoke`. A finished game saved under the first names loads with the new
ones (`loadGame`); a game in progress under them is not carried on. New: `titles.ts`
(`titleFor`, `TITLES`, `TITLE_FROM`, `HomeTitleId`, `AwayTitleId`, `TitleId`), the title a
total earns at full time (it was also put in the share text, by `ShareInput.title` and the
third argument of `shareInputFor`, until the text summary was taken out on 2026-11-17).

**Changed on 2026-11-13: RETRO and NEXT-GEN.** Two more modes, played exactly like HOME and
AWAY but ranked by an answer's **year**: `Mode` is now `"home" | "away" | "retro" |
"nextgen"` (`EraMode` the last two), `MODES` lists all four in the menu's order, and
`ruleFor` maps them through `MODE_RULES` to two new rules, `"oldest"` (RETRO: the earliest
year that makes the answer valid, `years[0]`, so a club with many titles counts its first)
and `"newest"` (NEXT-GEN: the latest, its most recent). Answers from the same year tie: the
same standing, the same shot, the same rank. Their questions are `RETRO_QUESTIONS` and
`NEXT_GEN_QUESTIONS` in `~/data` (`questionsFor` serves them); every answer has `years`
(`EraAnswer`, `EraQuestion` in `types.ts`, moved from the data file). The data's shots were
filed with `closest` and `furthest` as stand-ins; they are the same under `oldest` and
`newest` (a test keeps them so). New: `modes.ts` (`ERA_MODES`, `isEraMode`, `MODE_SLUGS`,
`playPath`, `modeOfPath`, `nextMode`), `MODE_RULES`, `isYearRule`, `rankingYear`,
`RankedAnswer.year`, `ShareCardRow.year`, `RetroTitleId`, `NextgenTitleId`, `TITLES.retro`, `TITLES.nextgen`.
NEXT-GEN's address is `/play/next-gen` (`playPath`); `/play/nextgen` plays it too.

## How an interface uses it

```
Menu
  const today = resolveToday(new Date(gameClock().now() ?? Date.now()), gameSearch(location.search), STADIUMS)
    (the server's time and the production build's query: gameClock and gameSearch, docs/API_UI.md)
  today.stadium, today.dayNumber, today.time (forced sky time, optional)
  loadDay(today.dayKey) gives { home, away }, each null or { total, turns } for the patch scores
  msUntilNextDay(new Date(gameClock().now() ?? Date.now())) to refresh at midnight UTC

Game
  let s = createSession({ mode, dayNumber: today.dayNumber, stadium: today.stadium, questions, now, noTimer: today.noTimer })
  s = reduce(s, action). If the result === s, nothing happened.
  Every frame while asking: reduce(s, { type: "tick", now, draft }) (draft: what is in the answer field) and clockView(s, now).
  Board: questionView(s), pips(s), progressFor(s), clockView(s, now)
  Answer bar: s.rejected (new object per rejection, key the shake on it), clockView(s, now).canPass
  Shot (phase "resolving"): currentTurn(s).grade, progressFor(s).promotions; then dispatch { type: "resolved" }
  Reveal (phase "reveal"): revealFor(s): five rows, one per scoring shot, and playerInRows; formatShare(row.share) for "34%" (in RETRO and NEXT-GEN, isEraMode: row.year, "1889"); then { type: "next", now }
  Full time (phase "done"): summary(s), results(s), careerFor(s.total), saveSession(s), shareCardFor(s) for the share picture

Use one clock for every `now` (Date.now() or performance.now(), never mixed). A game keeps the day and stadium it started with, so playing across midnight saves under the day it began.
```

Notes:

- `Rejection.reason` is `"unknown"` or `"ambiguous"`. The second needs its own line of text
  (for example "Which one? Be more specific.").
- Many answers can share a shot: a question usually has one to three worldies. The sample
  data has no tie in popularity at either end of any question (a data test keeps it so).
- The reveal's band: `turn.grade` names the shot; show `+points` for every shot but a miss.
- The reveal's table (changed 2026-11-12): `revealFor(s).rows` is one row for each shot that
  scores, best first (`SCORING_SHOTS`). The player's answer is the row for its shot when it
  scored; every other row is that shot's best answer, the one ranked highest in the full
  table (`rankAnswers`): in HOME the most picked answer in the shot, in AWAY the least
  picked. So the WORLDIE row is always #1, and the AWAY pass or time-up sentence (which
  names the deepest cut) names an answer on screen. A miss is never a
  row: when `playerInRows` is false (a miss, a pass, a time-up) show the player's answer and
  its 0 on their own (`answer`, `row`, `turn`). A question with no answer in some shot gets
  no row for it; the data tests keep every sample question complete.
- Tier names are interface text, keyed by `TierId`.
- `Question.decoys` (optional) lists strings the judge must never accept, for real things that
  are one typo away from a listed answer ("Bayer" next to "Bayern").

## Public API

```
types.ts
- type Mode = "home" | "away" | "retro" | "nextgen" | "closest" | "furthest". The six playable modes (RETRO and NEXT-GEN new 2026-11-13, CLOSEST and FURTHEST 2026-11-18).
- type EraMode = "retro" | "nextgen". New. The two ranked by an answer's year.
- type DistanceMode = "closest" | "furthest". New 2026-11-18. The two ranked by how far an answer's place is from the day's.
- type Rule = "common" | "niche" | "oldest" | "newest" | "closest" | "furthest". How a question's answers are ranked; oldest and newest new 2026-11-13.
- interface LatLng { lat: number; lng: number }
- interface Stadium extends LatLng { id }. The day's pin for the distance rules. No name, city or country (2026-11-17): the stadium is never named, anywhere. The id is for code and storage.
- type Measure = "birthplace" | "ground" | "location" | "capital". The judge uses it: people, clubs, stadiums, countries.
- interface Answer extends LatLng { id; name; aliases: string[]; place; country; popularity: number; shot: Shot; years?: number[] }. popularity: the estimated share of players who give the answer, in percent, 0.1 to 100, one decimal at most; a question's shares add up to about 100. shot (new): the answer's shot in its question's own mode (docs/data-notes/shots.md). years: every year that makes it valid, whole and ascending; required in RETRO and NEXT-GEN questions, left out in HOME and AWAY.
- interface EraAnswer extends Answer { years: number[] }. New 2026-11-13.
- interface Question { id; mode; prompt; measure; measureLabel; asOf; answers: Answer[]; decoys?: string[] }. decoys is new and optional.
- interface EraQuestion: a Question with mode: EraMode and answers: EraAnswer[]. New 2026-11-13; it is a Question, so it plays through the same rules.
- type Shot = "worldie" | "golazo" | "trivela" | "toepoke" | "tapin" | "miss". New (renamed 2026-11-11). The six shots, best first.
- type Grade = Shot | "timeup" | "skipped". Changed: the six shots, or no answer.
- interface RankedAnswer { answer: Answer; km: number; share: number; shot: Shot; points: number; rank: number; year: number | null }. share is the answer's popularity; km is filled under every rule; shot (new) is its shot under the table's rule and points = SHOT_POINTS[shot]; year (new 2026-11-13) is rankingYear under the table's rule: the first year under oldest, the last under newest, null under the others.

geo.ts
- EARTH_RADIUS_KM = 6371.0088; KM_PER_MILE = 1.609344
- distanceKm(a: LatLng, b: LatLng): number. Haversine, unrounded.
- usesMiles(locale: string): boolean. Region US, GB, LR, MM, or a bare "en"; false for anything else, including a missing locale.
- formatDistance(km: number, locale: string): string. "3 miles", "1 mile", "11,589 miles", "5 km", "under 1 mile", "under 1 km".
- formatDistanceShort(km: number, locale: string): string. New 2026-11-18. The same for a column of figures (the reveal's table): "11,286 mi", "5 km", "<1 mi".

scoring.ts
- RULES: readonly Rule[]. ["common", "niche", "oldest", "newest", "closest", "furthest"].
- MODE_RULES: Readonly<Record<Mode, Rule>>. New 2026-11-13. home common, away niche, retro oldest, nextgen newest, closest closest, furthest furthest (2026-11-18).
- ruleFor(mode: Mode): Rule. MODE_RULES[mode] (common for anything unknown).
- isDistanceRule(rule: Rule): boolean. True for "closest" and "furthest".
- isYearRule(rule: Rule): boolean. New 2026-11-13. True for "oldest" and "newest".
- rankingYear(answer: Answer, rule: Rule): number | null. New 2026-11-13. years[0] under oldest, the last year under newest; null under the other rules or with no years.
- rankAnswers(question: Question, stadium: LatLng, rule: Rule): RankedAnswer[]. Changed: takes a Rule (was a Mode). Full table, best first, ties in name order. common: highest share first; niche: lowest share first (shares tie when equal to a tenth of a percent); oldest: earliest ranking year first; newest: latest first (equal years tie; an answer with no year last); closest / furthest: by whole kilometres from the stadium. Changed: ranked by shot first (worldies first), then by the rule, then by name; a row's points are its shot's; ties (same shot and same key) share a rank. The stadium only matters to the distance rules.
- shotsOf(question: Question, stadium: LatLng, rule: Rule): Shot[]. New. Each answer's shot, in answer order: the data's Answer.shot under ruleFor(question.mode) for a rule that is not a distance rule (a distance question's shots are never filed: they depend on the day's place), else shotsFor of the shares (common, niche), of the ranking years (oldest, newest; no year counts one past the worst) or of the whole kilometres (closest, furthest).
- formatShare(share: number): string. New. "34%", "2.5%", "0.4%"; "under 0.1%" below 0.05 or for a non-number; capped at "100%".
- rankedFor(table: readonly RankedAnswer[], answerId: string | null): RankedAnswer | null
- interface TableRow extends RankedAnswer { grade: Grade; isPlayer: boolean; index: number; gapBefore: boolean }. grade is the row's shot (the same as shot); gapBefore means draw an ellipsis row above.
- tableExcerpt(table: readonly RankedAnswer[], answerId: string | null, maxRows: number): TableRow[]. Whole table if it fits (pass Infinity for all); otherwise first, player's, last and an even spread. No longer used by the reveal (see reveal.ts).

reveal.ts (new 2026-11-12)
- SCORING_SHOTS: readonly Shot[]. ["worldie", "golazo", "trivela", "toepoke", "tapin"]: the shots that score, best first.
- interface RevealRow extends RankedAnswer { grade: Shot; isPlayer: boolean; index: number }. grade is the row's shot; index is its 0-based place in the full table.
- shotRows(table: readonly RankedAnswer[], answerId: string | null): RevealRow[]. From a full ranked table: one row per scoring shot the table has, best first. The player's answer takes its own shot's row when it scored; every other row is the shot's most popular answer (ties: the one higher in the table). A miss is never a row.
- revealRows(question: Question, mode: Mode, result: { answerId: string | null }, stadium: LatLng): RevealRow[]. The same from a question played in a mode (a Turn will do as the result); the stadium only fills km.
- interface Reveal { rows: RevealRow[]; row: RankedAnswer | null; best: RankedAnswer | null; tableSize: number; oneCountry: boolean } (2026-11-17). A question's reveal, whole: everything the sheet shows once the question is decided, so the server can send it in place of the answers. row is the player's answer in the table (null for a pass or a time-up), best the top row, oneCountry whether every answer is in one country (the table then does not repeat it).
- revealOf(table: readonly RankedAnswer[], answerId: string | null): Reveal. From a full ranked table.
- Types (types.ts, 2026-11-17): ShownAnswer = Pick<Answer, "id" | "name" | "country">, what a table row says of an answer. RankedAnswer<A extends ShownAnswer = ShownAnswer> and RevealRow<A> carry it: rankAnswers, tableFor and revealRows give RankedAnswer<Answer> (the whole answer); a row that was sent has only what is shown.

served.ts (new 2026-11-17): a game the server runs. Used by the Worker (to make what it sends) and by the page (to read it).
- type AskedQuestion = Pick<Question, "id" | "prompt" | "measure" | "measureLabel">. A question with none of its answers.
- type ServedPhase = "asking" | "reveal" | "done". The server has no "resolving": that is the page playing the shot.
- interface GameSnapshot { day; mode; count; questions: AskedQuestion[]; index; phase: ServedPhase; turns: Turn[]; total; startedAt; deadline: number | null; reveal: Reveal | null; rejected: Rejection | null }. The game as its player may see it: the questions asked so far (the current one last, never one ahead), the current question's reveal while the game is at it, and the answer just turned down (only in the reply to it).
- snapshotOf(session: Session, rejected?: Rejection | null): GameSnapshot. From a game held with its whole questions (the server's side). The reveal is trimmed to what is shown (shownReveal).
- sessionFrom(snapshot: GameSnapshot, stadium: Stadium): Session. The page's session: the questions asked with no answers (blankQuestion), blanks for the ones to come, and the reveal in session.reveals, where revealFor looks. The page sets phase "resolving" itself while the shot plays.
- isGameSnapshot(value: unknown): value is GameSnapshot. Every part of the right kind, and agreeing with each other. The page reads nothing that fails it.
- askedQuestion(question), blankQuestion(mode, asked?), shownReveal(reveal, mapped?), storedQuestions(mode, turns, prompts?): the questions of a finished game kept on the device, as far as it says. shownReveal keeps each row's place (lat, lng) when `mapped` (CLOSEST and FURTHEST, whose map puts the answers on it; 2026-11-18) and leaves it out otherwise.

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
- interface Turn { questionId: string; input: string | null; answerId: string | null; grade: Grade; points: number; km: number | null; share: number | null; rank: number | null; msLeft: number; name?: string | null; year?: number | null }. share is new (null without an answer). name (the matched answer's name) and year (the year it was ranked by, in RETRO and NEXT-GEN) are kept on the turn since 2026-11-17, so a result reads without the question's answers; games saved before have neither.
- QUESTION_COUNT = 7. Session.reveals?: readonly (Reveal | undefined)[]: only in a game the server runs, each decided question's reveal as it was sent.
- interface Rejection { input: string; reason: "unknown" | "ambiguous" }
- interface Session { mode; dayNumber; stadium; questions: readonly Question[]; index: number; phase: Phase; turns: readonly Turn[]; total: number; startedAt: number; deadline: number | null; rejected: Rejection | null; noTimer: boolean }
- type Action = { type: "submit"; input: string; now: number } | { type: "pass"; now: number } | { type: "tick"; now: number; draft?: string } | { type: "resolved" } | { type: "next"; now: number }
- interface SessionOptions { mode; dayNumber; stadium; questions; now: number; noTimer?: boolean }
- createSession(options: SessionOptions): Session. Throws on no questions or a non-finite now.
- reduce(session: Session, action: Action): Session. Never mutates. Ignored actions return the same object. A rejection returns a new object with `rejected` set. At now >= deadline the clock has run out for tick, submit and pass alike: the whistle. Changed 2026-11-15: what the field held then counts as sent: a tick's draft, or a late submit's input, is judged, and a match is recorded as the answer with msLeft 0; nothing, an unknown or ambiguous input, or a pass is a time-up. Pass is allowed from exactly 8 s. Next on the last question gives "done"; everything after done is ignored.
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
- interface RevealView { index: number; question: Question; turn: Turn; answer: Answer | null; row: RankedAnswer | null; best: RankedAnswer | null; rows: RevealRow[]; playerInRows: boolean; tableSize: number; isLast: boolean }. Changed 2026-11-12: rows are shotRows (was TableRow[], an excerpt of the whole table); playerInRows (new) is false for a miss, a pass or a time-up; tableSize is the full table's length.
- revealFor(session, index = session.index): RevealView | null. Changed 2026-11-12: the maxRows argument is gone. Null until that question is decided. rows has the player's row marked when it scored; answer and row (its place in the full table) are null for a pass or time-up; best is the top of the full table.
- interface ProgressView { totalBefore: number; total: number; gained: number; before: Career; after: Career; promotions: number[] }
- progressFor(session): ProgressView. The career meter for the current question's turn: hold `before` until the shot lands, then fill to `after`; promotions lists the tiers reached.
- pips(session): (Grade | null)[]. One per question, null until decided.
- interface ResultLine { index: number; question: Question; turn: Turn; answer: Answer | null }
- results(session): ResultLine[]. Each decided question with the answer given, for full time.

modes.ts (new 2026-11-13)
- ERA_MODES: readonly EraMode[]. ["retro", "nextgen"]. isEraMode(mode): mode is EraMode.
- DISTANCE_MODES: readonly DistanceMode[]. ["closest", "furthest"]. isDistanceMode(mode): mode is DistanceMode. New 2026-11-18.
- MODE_SLUGS: Record<Mode, string>. The last part of each mode's address: home, away, retro, next-gen, closest, furthest.
- playPath(mode): string. "/play/next-gen". modeOfPath(pathname): Mode. The other way round; also takes a mode's id ("/play/nextgen"); HOME for anything else.
- nextMode(mode, played: (mode) => boolean): Mode | null (2026-11-15, in place of `pairedMode`). The full-time card's next mode: the first after `mode` in `MODES` order (HOME, AWAY, RETRO, NEXT-GEN, CLOSEST, FURTHEST, round to HOME) that `played` says is not played today; never `mode` itself; null when all the others are. The play page's controller gives it as `GameView.next` at full time, from the games kept for that day.

shots.ts (new)
- SHOT_ORDER: readonly Shot[]. ["worldie", "golazo", "trivela", "toepoke", "tapin", "miss"], best first.
- SHOT_POINTS: Readonly<Record<Grade, number>>. worldie 100, golazo 80, trivela 60, toepoke 30, tapin 10, miss 0, timeup 0, skipped 0.
- isShot(grade): grade is Shot. False for timeup and skipped. isGoal(grade): every shot but a miss. shotIndex(grade): 0 (worldie) to 5 (miss), 6 for no answer.
- SHOT_BANDS: readonly { shot: Shot; upTo: number }[]. The bands of standing: worldie up to 0.10, golazo 0.25, trivela 0.42, toepoke 0.58, tapin 0.80, miss up to 1.
- shotForStanding(standing: number): Shot.
- standings(values: readonly number[], rule: Rule): number[]. Each answer from 0 (best) to 1 (worst): the mean of its place (better / (better + worse)) and its gap from the best (ratios of shares on a log scale for common and niche, shares tied to a tenth; years for oldest and newest, kilometres for closest and furthest; equal values tie).
- shotsFor(values: readonly number[], rule: Rule): Shot[]. The rule that filed the sample data and that a backend runs on real counts (as shares). The best is always a worldie, the worst a miss, and a better value never a worse shot.

titles.ts (new)
- type HomeTitleId = "wrongend" | "findingseat" | "turnstile" | "piequeue" | "seasonticket" | "knowschants" | "startschants" | "voice" | "whisperer" | "hivemind". Lowest first.
- type AwayTitleId = "herd" | "backpages" | "highlights" | "retroshirt" | "thirdkit" | "fanzine" | "lowerleague" | "beforecool" | "deepcuts" | "hipster". Lowest first.
- type RetroTitleId = "yesterday" | "almanac" | "blackwhite" | "leather" | "programmes" | "longshorts" | "historian" | "ledger" | "archive" | "kickoff". New 2026-11-13. Lowest first.
- type NextgenTitleId = "dialup" | "teletext" | "replays" | "groupchat" | "alerts" | "liveblog" | "rumours" | "firstnews" | "ahead" | "future". New 2026-11-13. Lowest first.
- type ClosestTitleId = "lost" | "wrongstop" | "directions" | "satnav" | "localmap" | "shortcuts" | "localknowledge" | "homingpigeon" | "pinpoint" | "bullseye". New 2026-11-18. Lowest first.
- type FurthestTitleId = "nevertown" | "daytripper" | "awaycoach" | "passport" | "awaydays" | "airmiles" | "jetlagged" | "globetrotter" | "endsofearth" | "orbit". New 2026-11-18. Lowest first.
- type TitleId = HomeTitleId | AwayTitleId | RetroTitleId | NextgenTitleId | ClosestTitleId | FurthestTitleId. interface TitleRung<Id> { id: Id; from: number }
- TITLE_FROM: readonly number[]. [0, 10, 120, 220, 300, 380, 460, 540, 620, 700]: where each rung starts, the same in both modes (0 exactly; 700, a perfect game, alone).
- TITLES: { home; away; retro; nextgen; closest; furthest }, each TitleRung<its ids>[]. Each ladder, lowest first, on the same TITLE_FROM.
- titleFor(mode, total): the title id for a total (typed by mode). Under 0 or NaN counts as 0, over 700 as 700. The words: strings.play.titles[mode][id].

storage.ts (key "soccersense:v1:<dayKey>:<mode>", value { total, turns }; none of these throw. A game saved before Turn.share existed still loads, with share null; one saved with the sliding grades, before the six shots, reads as nothing; one saved under the shots' first names (bicycle, finesse, power, chip) loads with today's names.)
- STORAGE_PREFIX = "soccersense:v1"
- interface StoredGame { total: number; turns: readonly Turn[]; prompts?: readonly string[] }. prompts (2026-11-17): what each turn's question asked, kept by saveSession, so a finished game is shown again and shared with nothing to look up. Prompts that do not fit the turns are dropped, not the game. isTurn(value) is exported: a turn as it is kept and sent.
- type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">
- storageKey(dayKey: string, mode: Mode): string
- saveGame(dayKey: string, mode: Mode, game: StoredGame, storage?: StorageLike | null): boolean. Overwrites; returns whether it was written.
- saveSession(session: Session, storage?: StorageLike | null, today?: number): boolean. Saves a finished game under dayKeyFor(session.dayNumber) and session.mode; false if the game is not done. Then prunes the history (pruneHistory) from min(session.dayNumber, today): pass the real game day (dayNumber(new Date()), no ?day= override) so a game played on a far-off ?day= never deletes real games; the controller does.
- day-shares.ts (2026-11-18): HOME's and AWAY's shares as a question is scored on its day. share = (1 - t) x natural + t x the day's, t = dayWeight(n) = DAY_WEIGHT_MOST (0.35) x n / (n + DAY_WEIGHT_HALF (300)), n the answers accepted so far. DayCounts (ReadonlyMap<answerId, count>). sharesMove(mode): HOME and AWAY. blendShares(question, counts): the blended shares in answer order. scoredToday(question, counts): the question with blended shares (to a thousandth) and its shots filed again by `shotsFor`; the same object while nothing is counted or in RETRO and NEXT-GEN. The counts are the server's (worker/games/shares.ts).
- board.ts (2026-11-18): the day's leaderboards as the page and the server agree on them. BoardAnswer ({ day, modes: Record<Mode, ModeBoard> }), ModeBoard ({ count, top: BoardEntry[], tally: TallyEntry[], you: { rank, points } | null }), BoardEntry ({ rank, name, points, you? }), TallyEntry ([total, players]). rankFor(tally, total): one more than the players with more (equal totals share a place): a player's place, or where one not on the board would have placed. emptyBoard(), isBoardAnswer(value), BOARD_TOP (10), BOARD_MAX (700).
- account.ts, every player the server keeps (2026-11-18): PlayerView ({ nickname }), isPlayerView; AccountAnswer.player (whoever plays on the device, a guest included; left out by an older server). hasPlayer(storage?) and notePlayer(on, storage?): the device note (PLAYER_KEY) that it plays as a player the server keeps, so the game page asks the server for a game in progress.
- account.ts, an account's games (2026-11-17): HistoryGame ({ day, mode, total, turns, prompts: string[] | null }), HistoryKey ([day, mode, total]), HistoryAnswer ({ games, want: [day, mode][], saved }): what a signed-in device and the server swap (POST /api/account/history). isHistoryGame(value): a whole finished game (QUESTION_COUNT turns that pass isTurn, a total that is their sum, no text longer than HISTORY_TEXT_MAX (200) or HISTORY_PROMPT_MAX (300)); isHistoryAnswer. HISTORY_BATCH (100): the most games sent in one request. SignInWays.check: the bot check's site key, or null. AccountProblem "bot_check".
- account.ts (2026-11-17): accounts as the page and the server agree on them. checkEmail(text): { ok: true, email } (tidied: trimmed, lower case) or { ok: false }: the shape of an address, EMAIL_MAX (254) at most. AccountView ({ nickname, email }), SignInWays ({ email, google }), AccountAnswer ({ account: AccountView | null, signIn }: what /api/account says), isAccountView, isAccountAnswer. AccountProblem and ACCOUNT_PROBLEMS: why the server would not do what was asked ("bad_email", "too_many", "not_set_up", "bad_link", "signed_out", "bad_name", "taken", "failed"). The device's note of who the server last said is signed in, under ACCOUNT_KEY ("soccersense:v1:account"): loadAccount(storage?), saveAccount(account | null, storage?); it is only a note (the cookie cannot be read by the page), and is how the pages know to ask the server at all. noteLinkAsked(now, storage?), linkAsked(now, storage?) (true for LINK_ASKED_MS, 20 minutes) and forgetLinkAsked(storage?), under LINK_ASKED_KEY: a sign-in link was asked for from this browser, so the page it opens signs in at once.
- nickname.ts, for accounts (2026-11-17): isFanNickname(name) (soccerfan and a number, in any capitals: only the server's counter hands those out) and nicknameKey(name) (lower case, tidied: two accounts cannot have names that are the same here).
- nickname.ts (2026-11-15): the player's nickname, kept on the device under NICKNAME_KEY ("soccersense:v1:nickname"). A first nickname is fanNickname(n): FAN_PREFIX ("soccerfan") and the number ("soccerfan4821"; anything but a whole number from 1 is 1); fanNumber(random) turns a random value from 0 to 1 into FAN_FIRST (1000) to FAN_LAST (9999), each as likely, until a backend hands out the numbers in order. checkNickname(text): { ok: true, name } (tidied: no spaces at the ends, one between words) or { ok: false, problem: "short" | "long" | "characters" | "letter" }: NICKNAME_MIN (3) to NICKNAME_MAX (13: soccerfan and four digits) letters, numbers, spaces, - and _, with a letter. loadNickname(storage?) (null for none or junk), saveNickname(text, storage?) (the name kept, or null), ensureNickname(fresh, storage?) (the kept name, or fresh() kept from now on; fresh() for the visit where nothing can be kept). Storage as storage.ts (resolveStorage, now exported, is the one lookup of localStorage).
- loadGame(dayKey: string, mode: Mode, storage?): StoredGame | null. Null for junk, including a total that is not the sum of its turns.
- loadDay(dayKey: string, storage?): Record<Mode, StoredGame | null>. One entry per mode in MODES.
- clearGame(dayKey: string, mode: Mode, storage?): void
  Omit storage to use localStorage; pass null for "none".
- MODES: readonly Mode[]. ["home", "away", "retro", "nextgen"], the menu's order. The history, the stats and loadDay are built over it, so a new mode joins them with no other change (RETRO and NEXT-GEN did, 2026-11-13).
- HISTORY_DAYS = 366. The history keeps a year of finished games, today included.
- type ListableStorage = StorageLike & Pick<Storage, "key" | "length">
- interface PlayedGame { day: number; mode: Mode; total: number; grades: readonly Grade[]; points: readonly number[] }. points are as saved (one per grade), so they add up to total even for a game saved under older points.
- dayOfKey(dayKey: string): number | null. The game day of a "YYYY-MM-DD" key; null for a non-day or a day before day 1.
- loadHistory(today: number, storage?: ListableStorage | null): PlayedGame[]. Every readable finished game in the year up to today, oldest first (MODES order on a day); games after today, live games and junk left out; [] where storage cannot list its keys.
- pruneHistory(today: number, storage?): number. Removes finished games from before the year up to today; returns how many.

stats.ts (pure; the stats pop-up's numbers)
- type Outcome = Shot | "none"; OUTCOMES: the six shots best first, then "none". outcomeOf(grade): the shot, or "none" for timeup and skipped.
- streakFor(days: Iterable<number>, today: number): { current; best }. Days in a row with a finished game (any mode). While today is unplayed the run up to yesterday is current. Days after today are left out.
- statsFor(games: readonly PlayedGame[], today: number, modes = MODES): Stats. Per mode: today's game (or null), played, average (rounded; null with none), best { total, day } (the first day on a tie), tally by outcome and answers; plus the streak and the total played.
- apportion(counts: readonly number[], cells: number): number[]. Whole cells in proportion (largest remainders), every non-zero count at least one cell while there are cells to spare; adds up to cells, or all zeros.

share.ts
- The text summary is gone (2026-11-17): `GRADE_SYMBOLS`, `ShareInput`, `buildShareText` and view.ts's `shareInputFor` were taken out when the share text became two lines of the interface text that say nothing of the result (`shareText(link)` in `app/routes/play/names.ts`). The picture carries the result.
- interface ShareCardRow { prompt; answer: string | null; year: number | null; grade; points }. year (new 2026-11-13): in RETRO and NEXT-GEN the answer's ranking year; null with no answer, and in HOME and AWAY.
- shareCardFor(session): ShareCard. The share image's content: day, mode, total, one row per question decided.
```
