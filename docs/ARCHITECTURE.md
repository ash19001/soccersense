# soccersense: architecture (iteration 1)

Read `docs/GAME_DESIGN.md` and `docs/ART_BIBLE.md` first. This document says where code lives,
what the shared contracts are, and how to check your work.

## 1. Shape of the app

- React Router v8 static site (`ssr: false`, pages prerendered at build time). The pictures,
  the sound and the interface all run in the browser, and no other site is ever called. Beyond
  its own files, the page asks its own API (section 8) for two things: the server's time
  (`app/ui/game-clock.ts`), so the day is not the device's clock, and the game itself
  (`app/routes/play/server.ts`): the server runs every game, and the page has no answers.
- **Scenes are drawn in software.** A scene paints into a `Surface` (a `Uint32Array`
  framebuffer at logical resolution). The browser copies it to a `<canvas>` with
  `putImageData` and scales it up with `image-rendering: pixelated`. Node can render the same
  scene to a PNG with no browser, which is how art is checked.
- **Interface is DOM** (React components) laid over the canvas: the board, the answer bar, the
  reveal sheet, buttons. Real inputs and buttons keep the keyboard and screen readers working.
- **Game rules are pure TypeScript** with no DOM, tested with Vitest.

```
app/
  pixel/      engine core: Surface, colour, text, sprites, rng, easing. Pure TS, no DOM.
  art/        palette, lighting, sky, and every painter (ball, stadium, characters, grounds).
  scenes/     Scene classes: compose art, animation and pointer input. Pure TS, no DOM.
  game/       rules: types, geo, scoring, judge, career, day, session reducer, storage, share.
  data/       demo content: stadiums and questions.
  lib/        sun position, time-zone to location guess.
  ui/         React components and CSS for the DOM interface, plus PixelStage (the canvas host).
  audio/      the sound engine (Web Audio, docs/AUDIO.md); mix.ts holds every level, pure data.
  routes/     pages. `/` hosts the game; its "?" opens the rules as a pop-up, and
              `/how-to-play` is the same rules as a page. `/dev/sound` is the sound board.
  i18n/       all user-facing interface text.
tools/        Node-only scripts: snap.ts (render shots to PNG), png.ts, browser screenshots,
              and the two that write files into public/: favicon.ts and seo.ts.
docs/         these briefs.
.snaps/       rendered PNGs (git-ignored scratch output).
```

`app/pixel`, `app/art`, `app/scenes`, `app/game`, `app/lib` and `app/data` must never touch
`window`, `document`, `navigator`, `localStorage` or `Date.now()` at module load or inside
painters. Browser access belongs in `app/ui` (inside effects and handlers) and in the few
functions that are documented as browser-only.

`app/audio` is browser code (the Web Audio engine), with one exception: `app/audio/mix.ts`,
every level of every sound, is pure data (type-only imports, no browser), so scenes and art
may import it (`import { HOME_PAGE } from "~/audio/mix"`) for the powers and sizes of the
sound cues they send. They import nothing else from `~/audio`; `app/audio/knobs.test.ts`
keeps `mix.ts` pure.

### What a page tells search engines and link previews

`app/routes/seo.ts` is the one place. Every page players are sent to builds its `meta` with
`pageMeta({ path, title, description })`: the title and description (from `app/i18n/en.ts`),
leave to index the page, and the same words as Open Graph tags, which chats, feeds and X read
for a link's preview. A new page does the same and is added to `PAGES`; a test compares
`PAGES` with `app/routes.ts`. The development pages (`/dev/ui`, `/dev/sound`, `/dev/stage`)
are on the dev server only: `app/routes.ts` leaves them out of a production build, so the
live site has no such addresses (since 2026-11-17; before that they were deployed, saying
`noindex`). They still say `noindex` themselves, and the root's
own `meta` (`fallbackMeta`) says it for an address that is not a page: the host serves the
app's shell for those (`__spa-fallback.html`; on Cloudflare as `404.html` with a "404 Not
Found", see "Hosting" below; many static hosts answer "200 OK", and the page would
otherwise be listed).

### Hosting

The site is on **Cloudflare** (since 2026-11-17), at https://soccersense.io: one Worker
that serves `build/client` as static files and answers `/api/*` itself (`wrangler.jsonc`;
the API is section 8). In the Cloudflare dashboard the Worker builds from the repository:
build command `pnpm build`, deploy command `npx wrangler deploy` (the default). Node comes
from `.nvmrc` and pnpm from `packageManager` in `package.json`. Only `/api/*` runs code
(`run_worker_first`): every page and file is served straight from the build.

- **`wrangler.jsonc` has to be in the repository.** Without one, Cloudflare's deploy sets
  the project up by itself (it detects the framework, adds wrangler with the project's
  package manager and opens a pull request). That is what failed the first deploy: pnpm
  refused workerd's install script (`ERR_PNPM_IGNORED_BUILDS`). `pnpm-workspace.yaml`
  now allows that script too, for the day wrangler is a dependency.
- **`name` must be the Worker's name in the dashboard**, or the deploy fails saying so.
- **Addresses have no closing slash** (`html_handling: "drop-trailing-slash"`):
  `/play/home` is served the file `play/home/index.html`, and `/play/home/` is sent to
  `/play/home`. The game's links, the sitemap and the canonical links say the same.
- **An address that is not a page** gets `404.html` with a "404 Not Found"
  (`not_found_handling: "404-page"`). `pnpm build` writes that file after React Router's
  build: `tools/not-found.ts` copies the app's shell, `__spa-fallback.html`, to it, so
  the app loads and shows the Offside! page. (Cloudflare's other setting,
  `single-page-application`, serves `/index.html`, which here is the home page already
  rendered, not a shell.)
- The game clock's HEAD request to `/favicon.svg` (the server's time) works as on any
  static host.
- Wrangler is a development dependency (since the API, 2026-11-17): the deploy uses the
  project's version, and `pnpm api` runs the Worker locally. `send_metrics` is off.
- Checked on the live site (2026-11-17): `/play/home` is served, `/play/home/` is sent to
  it, and an address that is not a page gets the Offside! page with a 404.
- `app/routes/hosting.test.ts` holds the configuration to the build.

- **`SITE_URL` is the one setting, and it is empty until the site has an address.** A
  canonical link, `og:url`, the preview's picture (`og:image`), the home page's structured
  data (JSON-LD: the site and the game, by name) and the sitemap must all be written out in
  full, and a preview is fetched by a server that never runs the page, so none of it can be
  worked out in the browser. Until the address is set they are left out, and a link's preview
  is words with no picture. To set it: `"https://"` and the host, nothing after; then
  `pnpm seo`.
- **`pnpm seo`** (`tools/seo.ts`) writes three files into `public/`: `social-card.png` (the
  preview's picture, 1200 x 630: `app/scenes/social-card.ts`), `robots.txt` and, with the
  address set, `sitemap.xml`. Tests hold each file to its source, so `pnpm check` fails when
  the home screen's art, the list of pages or the address has changed and the tool has not
  been run.
- **Titles and descriptions** stay under 60 and 160 characters (a search result cuts them
  there), no two pages share one, and each page names football in one or the other
  (`seo.test.ts`).
- `/play/nextgen` is a second address of NEXT-GEN's page: it gives `/play/next-gen` as its
  address of record.
- Nothing is claimed that the page does not show: no ratings, reviews or prices in the
  structured data.
- **To check when a host is chosen:** addresses are written without a closing slash
  (`/play/home`), as the game's own links are. A page is built as `play/home/index.html`,
  and some hosts send `/play/home` on to `/play/home/`. Have the host serve the address as it
  is written, or every canonical link points at an address that redirects.

## 2. Engine (`app/pixel`)

The engine is built. **`docs/API_ENGINE.md` is the reference**: the `Surface` framebuffer and
its primitives, colour helpers, the two bitmap fonts, text-art sprites, seeded randomness,
easing, and the snap tool. Read it before drawing anything.

Anything missing from the engine that two or more painters would need belongs in the engine.
Tell the lead rather than writing a private copy.

## 3. Lighting and shots

The art foundations are built. **`docs/API_ART.md` is the reference** for the palette, lighting,
sky, the shared layout numbers and every finished painter (menu ball, stadium, logo). The
outline of the lighting contract:

```ts
// app/art/lighting.ts
export interface Sun {
  elevation: number;
  morning: boolean;
} // degrees above horizon; before or after solar noon
export interface Lighting {
  sun: Sun;
  phase: "night" | "dawn" | "day" | "dusk";
  lightsOn: boolean; // floodlights and street lights
  env(c: Color): Color; // graded for things lit by the sky
  lit(c: Color): Color; // graded for things under floodlights when they are on
}
export function lightingFor(sun: Sun): Lighting;
```

A **shot** is a named, deterministic render used to look at art. Any file named `*.shots.ts`
under `app/` can export shots:

```ts
// app/pixel/shot.ts
export interface ShotContext { w: number; h: number; t: number; seed: number; sun: Sun }
export type Shot = (ctx: ShotContext) => Surface; // may return any size (sprite sheets, swatches)
export type ShotMap = Record<string, Shot>;

// app/art/ball.shots.ts
export const shots: ShotMap = { "ball/idle": (ctx) => { ... } };
```

Render with the snap tool (no browser, safe to run in parallel with other people):

```sh
./node_modules/.bin/tsx tools/snap.ts --list
./node_modules/.bin/tsx tools/snap.ts ball/idle --out .snaps/ball-idle.png
./node_modules/.bin/tsx tools/snap.ts stadium/full --time night --w 960 --h 540 --scale 1 --out .snaps/x.png
./node_modules/.bin/tsx tools/snap.ts career/home-t3 --strip 6 --dt 0.15 --out .snaps/y.png
```

Options: `--w --h` (default 260 x 562, a phone), `--size all` (the four reference sizes),
`--scale` (default 2), `--t` seconds (default 0), `--strip N --dt S` (N frames side by side),
`--time day|golden|dusk|night|dawn` or `--sun <deg> [--morning]`, `--seed`, `--out`. Then open the PNG with the
Read tool and look.

### The canvas's scale

The canvas has about twice the pixels each way of the interface's logical canvas
(`app/ui/scale.ts`, `canvasDpFor`; art bible section 2): 960 x 540 at 1920 x 1080. Everything
drawn at a fixed size is drawn natively at that scale, and every fixed length is written
plainly in canvas pixels. (History: until 2026-11-12 the art also existed at half the detail,
behind a switch; it was removed with the switch.)

- **Cost.** Measured in Chrome (2026-11-12), every frame of the home page and of the game
  (tiers 0, 4 and 6, a shot, a promotion) is under 16 ms at 1920 x 1080, 2560 x 1440 and on a
  phone at ratio 3: home 3.9 ms on average (worst 15 ms, in the ball's entrance), the game 1.3
  to 2.1 ms. Building the home picture is the one long frame: 355 ms at 960 x 540, most of it
  painting the town and the stadium bowl pixel by pixel. Keep per-pixel work out of frames,
  cache what does not change, and never search a box per pixel (a summed-area table, as
  `findCrashSite` does, is four lookups).

### Eras

Since 2026-11-13 the career scene is drawn in one of three eras (`app/art/era.ts`:
`"today"` for HOME and AWAY, `"retro"`, `"nextgen"`; art bible section 10). The career scene
decides it once from its mode (`eraOf`) and passes it down as a parameter, never a global:
to the ground (`Paint.era`), on the kits (`Kit.era`), to the props and to the effects. A
painter that draws differently per era takes it as an **optional last argument that defaults
to `"today"`**, and with `"today"` draws exactly what it drew before, so existing callers and
shots keep their pixels. Era art lives in the era's own files; shared painters hold only a
one-line dispatch. `docs/API_ART.md`, "Eras", has the details. Era code in `app/art` imports
the type from `~/art/era`, never from `~/scenes`.

## 4. Scenes (`app/scenes`)

The contract lives in `app/scenes/scene.ts`:

```ts
export interface PointerInfo {
  type: "move" | "down" | "up" | "leave";
  x: number;
  y: number; // logical px
  touch?: boolean; // a finger or a pen: no hover
}
export interface Scene {
  resize(w: number, h: number): void;
  setLighting(light: Lighting): void;
  update(dt: number): void; // seconds; may be called with any dt
  draw(s: Surface): void; // must fully cover the surface
  pointer?(p: PointerInfo): void;
  setReducedMotion?(on: boolean): void;
  cursor?(): "default" | "pointer" | "grab" | "grabbing";
  // and sound (onSound, ambience) and a floating sprite (setFloating, floating): API_SCENES.md
}
```

The host's frame is always `resize` (if the size changed), `setLighting` (if the light changed),
`update(dt)`, `draw(surface)`. Time only moves in `update`, so a scene renders the same in the
browser and in the snap tool.

Scenes own animation state and expose plain methods and callbacks for the interface to drive
(for example `menu.onSelect`, `career.playShot(grade)`), never React.

Cache what does not change: static layers are rendered once per resize or lighting change into
their own `Surface` and copied each frame. The per-frame budget is 4 ms at 960 x 540 (see "The
canvas's scale").

A game page drives a `GameScene` (`app/scenes/game-scene.ts`): what the page asks of the
scenery behind a game (`setTotal`, the opening, `playShot`, `promote`, `showFullTime`).
HOME, AWAY, RETRO and NEXT-GEN play the career (`CareerScene`); CLOSEST and FURTHEST play the
world map (`MapScene`, `app/scenes/map.ts`, 2026-11-18), which is given the day's place and,
with each shot, where the answer came down and how far that is (`ShotLanding`). The map's land
is Natural Earth's (public domain) rasterised at half a degree by `tools/world-map.ts` into
`app/art/world-map-data.ts`; `app/art/world-map.ts` reads it and works out great circles. The
map draws the ground at any scale with `app/art/earth-zoom.ts` and the home town from above
with `app/art/stadium-top.ts`; its career is a camera closing in (CLOSEST) or pulling back
into space, drawn by `app/art/cosmos.ts` (FURTHEST).

## 5. Game rules (`app/game`)

The rules are built. **`docs/API_GAME.md` is the reference** (every export, and how an interface
uses them). The summary below is the original outline.

`app/game/types.ts` holds the shared types (`Mode`, `Stadium`, `Question`, `Answer`, `Grade`,
...). Data files and rules both import from it. Rules are pure functions:

- `geo.ts`: `distanceKm(a, b)`, `formatDistance(km, locale)`.
- `scoring.ts`: `rankAnswers(question, stadium, mode)`, `gradeFor(points)`.
- `judge.ts`: `normalise(text)`, `judge(question, input)` returning the matched answer or a reason.
- `career.ts`: tiers, thresholds, `careerFor(total)`.
- `day.ts`: `dayNumber(date)`, `stadiumForDay(n)`, debug overrides.
- `session.ts`: a reducer for one game (phases, answers, totals). Time is passed in, never read.
- `storage.ts` (browser-only functions, safe to import anywhere), `share.ts`.

## 6. Interface (`app/ui`)

- The interface kit is built. **`docs/API_UI.md` is the reference**: units, type classes, every
  component, the gallery at `/dev/ui`, and the browser screenshot tool.
- `GameLayout` is the game shell. It picks `px` from the viewport (art bible section 2) and sets
  the CSS variables `--px` (one logical pixel) and `--fp` (one font pixel) for everything inside.
- `PixelStage` owns the `<canvas>` in `GameLayout`'s canvas slot: it reads that scale, runs the
  frame loop, forwards pointer events in logical pixels, pauses when the tab is hidden, and
  tells the scene about reduced motion.
- `Game` is the state machine that swaps scenes and overlays: menu, playing, reveal, full time.
- Interface text lives in `app/i18n/en.ts`. Question content lives in `app/data`.
- The page must render on the server at build time: no browser APIs during render.

## 7. Working rules for everyone

1. **Stay in your lane.** Each task names the files it owns. Create and edit only those. If you
   need a change elsewhere, say so in your report instead of making it.
2. **Do not install packages, and do not edit** `package.json`, the lockfile, configs,
   `CLAUDE.md` or the `docs/` briefs unless your task says you own them.
3. **Do not use git** (no commits, no stash, no checkout). Do not start a dev server unless
   your task says so. Other people are working in this folder at the same time.
4. **Run tools directly**, not through pnpm:
   `./node_modules/.bin/tsx`, `./node_modules/.bin/vitest run <file>`,
   `./node_modules/.bin/eslint <files>`, `./node_modules/.bin/prettier --write <files>`,
   `./node_modules/.bin/tsc --noEmit`.
   `tsc` checks the whole project: fix errors in your own files and ignore errors in files you
   do not own (someone else is mid-edit).
5. **Before you report**: your files are formatted with prettier, pass eslint, have no type
   errors, and your tests pass.
6. **Look at what you draw.** Art is not done until you have rendered it and viewed the PNG,
   several times, against section 9 of the art bible. Write snapshots to `.snaps/<your-area>-*.png`.
7. TypeScript is strict. No `any`, no `enum`, no default exports outside route files.
   Import app code with the `~/` alias (`import { Surface } from "~/pixel"`).
8. Tests sit next to the code as `*.test.ts`.
9. Report honestly: what you built, what you changed outside the brief and why, what is weak
   or unfinished, and anything the next person needs to know.
10. **Write only inside the repository** (and a scratchpad you were given). Never create files
    anywhere else, and never on another drive. Keep renders small and delete intermediates. If a
    write fails for lack of disk space, stop, check your files are whole, and report it.

## 8. The backend

It is being built a step at a time (the product owner, 2026-11-17: "how can we go about
starting to build the cloudflare backend for user auth, leaderboard, etc."), in this order:
the API and its database; the day's questions, drafted, approved and scheduled; games run by
the server (built, below); accounts (built, below: they came before the leaderboard, which
now ranks only accounts); the leaderboards (built, below); HOME's and AWAY's shares moving
with the day's answers, and moderation (built 2026-11-18, below); then membership and the
rest of the plan below.

### What is built (2026-11-17)

- **The Worker** (`worker/`, `main` in `wrangler.jsonc`). `index.ts` is Cloudflare's entry;
  `app.ts` answers a request and is handed the time, so it is a pure function of the
  request, the settings, the database and the time. It is written on web standards and
  checked by the project's one TypeScript configuration: `env.ts` writes out the few
  Cloudflare types it uses (the database, the files) rather than generating them. It
  imports the game's pure rules (`~/game/day` for the day's number), the same code the
  page runs.
- **`GET /api/today`**: `{ now, day, dayKey, nextDayIn, questions, place }`, the day by the
  server, never cached. `place` is the day's place as the games play it (below); a HEAD
  (the clock) does without it, and with the sample questions on it is the fixed list's and
  the database is not asked. Every answer of the API carries `x-server-time`, the server's
  clock in milliseconds.
- **The game's clock reads it.** `app/ui/game-clock.ts` asks `/api/today` (a HEAD
  request) and takes `x-server-time`, to the millisecond. Where no API answers (the dev
  server alone, a static host), the answer's `Date` header is read as before, so nothing
  depends on the Worker being there.
- **`GET /api/health`**: `{ ok, db, schema, questions }`, for a look after a deploy: `db`
  is the database's migration number and `schema` the one the code expects; 503 if they
  differ or there is no database.
- **The database** is D1 (SQLite), bound as `DB`. It has no id in `wrangler.jsonc`:
  Cloudflare makes it on the first deploy that has the binding. **The Worker keeps its own
  tables** (`worker/db/migrate.ts`): migrations are numbered in the code, and the first
  request of each instance applies the ones the database has not had, each as one
  transaction with its record. Nothing is run by hand or added to the deploy. Never edit a
  migration that has been deployed: add the next number.
- **The flag** `QUESTIONS` (`vars` in `wrangler.jsonc`): `sample` (the questions built into
  the game) or `scheduled`. The product owner, 2026-11-17: "for now sample should exist,
  only start real ones on a feature flag because currently its still in testing". Nothing
  reads `scheduled` yet.
- **Locally**: `pnpm api` runs the Worker and the built site on port 8787 (`wrangler dev`,
  with a database of its own under `.wrangler/`); `pnpm dev` passes `/api` to it
  (`vite.config.ts`), and works without it.
- **Tests** (`worker/**/*.test.ts`, run by `pnpm test` on Node): the requests and the
  migrations against a real SQLite in memory, `worker/testing/d1.ts`, the part of D1 the
  Worker uses over Node's own `node:sqlite`.

### The day's questions: drafted, approved, scheduled (2026-11-17, in progress)

The product owner: "Make a way to draft and schedule them. they will be coming from ai
after approval and scheduling. preferably generate them all once a week with approval for
the subsequent days to be scheduled." A week was 196 questions (seven days, four modes,
seven each), and they will approve them all; since 2026-11-19 it is 294, CLOSEST and
FURTHEST drafted too ("add these new gamemodes to the schedule so once i remove sample
feature flag then these will also get generated and have new ones daily"). The drafting is to be done by a scheduled
Claude routine on the product owner's own Claude account, **not** through the Claude API
("the weekly draft will use my claude account so just creating a scheduled skill").

Built:

- **The rules a question must pass**: `checkQuestion(raw, mode)` in `app/game/check.ts`.
  The sample questions are held to their rules by tests; a question that arrives as data
  has none, so the same rules are a function. It takes anything and gives back the
  question, typed, or every problem in plain words. It files each answer's shot itself
  (`shotsFor` on the shares or the years), so a draft cannot disagree with the scoring.
  Every sample question passes it.
- **Where they are kept**: the table `question_slots` (migration 2,
  `worker/questions/store.ts`). Each day and mode has seven places; a place holds one
  question, whole, and its state: `draft`, `approved` or `rejected`, with the drafter's
  note (sources, doubts) and the reviewer's (why it was rejected).
  `scheduledFor(db, day, mode)` gives a day's seven questions only when all seven places
  are approved: a day is played whole or not at all, and nothing unapproved is ever played.
- **The approval desk's API** (`worker/questions/admin.ts`), for whoever holds the admin
  token: `PUT /api/admin/questions` (send drafts; each is checked, and the unfit are
  refused with what is wrong while the rest go in; an approved question is never
  overwritten unless `replace` is set), `GET /api/admin/questions?from=&to=` (look),
  `POST /api/admin/questions/<day>/<mode>/<slot>` (approve, reject with a reason, send back
  to draft, or put a corrected question in its place; a question is checked again as it is
  approved).
- **The token** is the secret `ADMIN_TOKEN`, set in Cloudflare by the product owner (24
  characters or more; until it is set the desk answers 503). It is compared by hash.

- **The approval page** is `/admin` (`app/routes/admin.tsx`), on the live site: the
  product owner asked for its link (2026-11-17). It asks for the token (kept in that
  browser's storage, sent only to this site's API), then shows seven days from today, a
  row a day and a column a mode, each cell counting its seven places (or "Scheduled").
  Picking a cell lists that game's questions: approve, reject with a reason, send back to
  draft, show the answers in scoring order, or edit the question as JSON (checked by the
  server; its problems are listed). "Approve all drafts" passes a whole game. It is a
  working tool, not part of the game's interface: plain type, no pixel skin, `noindex`,
  not in `PAGES`. Anyone can load it; nothing in it works without the token.

- **The drafter** is a project skill, `.claude/skills/draft-questions`, run once a week by
  a scheduled Claude routine on the product owner's Claude account (their choice, not the
  Claude API). It says what a question is and how to check one, and works through
  `pnpm questions` (`tools/questions.ts`):
  - `todo` asks the desk which places from tomorrow to eight days on are empty or rejected
    (with the reviewer's reason), and what has been asked in the last 90 days, so no week
    repeats another. A weekly run therefore drafts the week ahead and redoes what was
    turned down, and a run that stopped early is picked up by the next.
  - `check <file>` holds a file of drafts to `checkQuestion` and to the file as a whole
    (no place twice, no prompt twice); `submit <file>` checks, then sends them as drafts.
  - Every mode is drafted, CLOSEST and FURTHEST too, and **every day's place** (2026-11-19,
    "i dont want fixed places because eventually questions will get repetitive so it should
    also be generated"). The places are kept in `day_places` (migration 8,
    `worker/questions/places.ts`), one a day, drafted, approved or rejected like a question,
    checked by `checkPlace` (`app/data/places.ts`: an id, a name and area the pixel font
    draws, a kind, coordinates not by the poles). The desk's API sends them with the week's
    questions (`places`), takes them (`PUT /api/admin/places`, no place twice within 90
    days) and changes one (`POST /api/admin/places/<day>`). A CLOSEST or FURTHEST question
    is approved only once its day's place is; a place changed once approved sends that day's
    approved CLOSEST and FURTHEST back to draft.
  - `todo` lists the days to place (with the days either side's) and gives CLOSEST's and
    FURTHEST's places the day's drafted place (or `waitsForPlace`); `check` holds a file of
    places to `checkPlace` and to their neighbours (2,000 km apart, another kind, nothing
    used), and works a distance question's shots out from its day's place on the desk
    (`shotsOf`), wanting each of the five that score. The skill drafts the places first.
  - **Played**: with `QUESTIONS` at `scheduled`, a day's games and `/api/today` take its
    approved place (`questionsOn`, `placeOn` in `worker/games/questions.ts`, remembered a
    minute), else the fixed list's; CLOSEST's and FURTHEST's scheduled questions play only
    with their approved place. The page asks `/api/today` for it (`app/ui/day-place.ts`):
    the play page waits for it before a CLOSEST or FURTHEST game (3 s at most, then the
    fixed list's), the home picture's dives take it when it comes. Nothing on the map is
    made for a place: the globe, the pin, the flights and the space career work from its
    coordinates alone.
  - The approval page has a Place column (the day's place and its state); a place's card
    shows where it is, a link to a map, approve, reject, back to draft, or a correction as
    JSON. A CLOSEST or FURTHEST question is shown from its day's place (drafted, approved,
    or the fixed list's while there is none): each answer's distance and its shot that day,
    nearest (or furthest) first.
  - The admin API's `brief=1` look (the prompt and state, no answers, up to 120 days) is
    what `todo` reads.
  - **The token never reaches the routine.** In the cloud environment the product owner
    stores it as a network secret (Bearer, for soccersense.io): the environment's proxy
    adds it to requests to the site, and the tool sends them bare. Locally the tool reads
    `SOCCERSENSE_ADMIN_TOKEN` (and `SOCCERSENSE_SITE` to point it at a local Worker).
  - Drafts are written to `.drafts/`, which git ignores: they are never committed, so the
    answers to coming days are not in the repository.

- **The routine** is "soccersense: draft the week's questions" on the product owner's
  Claude account: every Sunday at 03:17 UTC, in the Default cloud environment, with no
  connectors, its prompt telling the session to follow the skill. Its model is Sonnet 5.5,
  the product owner's pick (2026-11-18: "i pick sonnet") after a trial of Sonnet 5.5 and
  Opus 5.5 on different days.

The game plays what is scheduled once the `QUESTIONS` flag says so (below).

### Games run by the server (2026-11-17)

The page used to run its own games: every question, every answer and every answer's share
shipped in its code. Now the server runs the game, and the page shows it.

- **What the page is sent.** A question as its clock starts, never one ahead, and never its
  answers. What is typed goes to the server, which judges it and, once the question is
  decided, sends the reveal: the five rows of the table, the player's own, the best answer.
  After every move the server answers with the whole game as its player may see it, a
  `GameSnapshot` (`app/game/served.ts`, used by both ends), and the page makes its
  `Session` from that, so the board, the sheet and the full-time card read it as before.
- **The rules are the same code.** The server runs `reduce` (`app/game/session.ts`) with the
  whole questions and its own clock (`worker/games/play.ts`). Nothing about scoring, the
  judge, PASS or the whistle is written twice.
- **The API**: `POST /api/games/<mode>/<move>`, the moves being `start`, `look` (the game as
  it stands now, on coming back to the page), `answer`, `pass` and `next`. Every answer is
  `{ game, ticket }`. A move says which day's game and which question it is about, and one
  that does not fit where the game is changes nothing and gets the game back as it stands.
- **The clock is the server's.** The page counts down on the server's time. At its zero it
  sends what is in the answer field (the whistle); the server counts that as sent at the
  deadline if it arrives within 2 seconds of it (`GRACE_MS`), and as a time-up after. A
  game left alone is timed out by the next request that sees it.
- **Who keeps the game** (the product owner, 2026-11-17: "for no account users everything
  is stored on localstorage. the database is only used to check the question and answer but
  not actually store anything". **Changed 2026-11-18**: every player is kept by the server,
  a player with no account as a guest; see "Every player kept by the server". A ticket is
  now only the fallback where no guest can be made):
  - **A player with no account keeps their own.** The server stores nothing about them: no
    row, no cookie. After every move it hands the game back as a **ticket**
    (`worker/games/ticket.ts`): the game as it stands, with the server's seal on it. The
    page keeps the ticket on the device and sends it with its next move; the server checks
    the seal, plays the move and seals the result. The seal means a ticket cannot be made up
    or changed: every answer in it was judged by the server, and its clock is the server's.
    The key it is sealed with is made by the Worker the first time it is needed and kept in
    the database (`secrets`, migration 3), so there is nothing to set up.
  - **An account's game is a row in the database** (`worker/games/store.ts`, the `games`
    table of migration 3): where the game is, the turns decided, the total, the current
    question's clock. It is written at the start and at each move that changes the game,
    and only if the game still stands where the move found it. It is the game of whoever
    is signed in ("Accounts", below).
  - **What only a kept game can promise.** One game a day, and a move happening once
    however often it is sent. A ticket can be sent again, because the server does not
    remember it: someone who goes out of their way can answer a question twice or start
    the day over. What comes of that never leaves their own device, which is where "once a
    day" has always been for a player with no account.
  - **So only accounts are on the leaderboards** (the product owner, 2026-11-17: "for no
    accounts it just says where they land on leaderboard without actually putting them on
    the leaderboard. only accounts are on leaderboards"). Changed 2026-11-18: guests are
    on them too.
- **Which questions.** `worker/games/questions.ts`: the sample while `QUESTIONS` is `sample`.
  At `scheduled`, the seven approved for the day, and the sample for a day that does not
  have all seven approved: there is always a game, and never an unapproved question. A
  day's scheduled questions are remembered for a minute by each instance, so a change at
  the desk reaches the games within a minute. If they change under a game in progress it
  starts again; a finished game stands.
- **The page** (`app/routes/play/controller.ts`). A new game is the mode card at once and
  question 1 asked for as the card goes. The ticket is kept on the device as the game goes
  (under the key a game in progress has always had), so a reload carries on: the server
  looks at the ticket and says where the game stands now (a reload in the middle of a shot
  comes back at the reveal; a question left too long is a time-up). While a request is out
  the bar and NEXT wait; if the server cannot be reached the page says so and keeps asking.
  A ticket the server will not take (meddled with, days old, the day's questions changed)
  is dropped for a new game. A finished game is kept on the device with what it asked and
  each answer's name, and shown again from there with no request: the home screen's
  scores, review and SHARE read the same copy.
- **No answers in the page.** A production build has no questions in it (checked: none of
  the sample's prompts is in `build/client`). In development, with no API beside the dev
  server or with a debug switch (`?day=`, `?stadium=`, `?notimer=`), the page runs the game
  itself with the sample, by the same rules: `serverRuns` in `app/routes/play/Game.tsx`.
- **Tests.** `worker/games/play.test.ts` (the API against SQLite, for a player with no
  account and for an account) and `app/routes/play/served.test.tsx`, which puts the real
  page in front of the real Worker code with only `fetch` stood in for.

Known, and not in this step:

- **What it costs to run.** A game with no account is about 16 requests and no database
  writes at all; an account's is the same requests and about 16 rows written. By
  Cloudflare's price list read on 2026-11-17 (Workers Paid: $5 a month, 10 million requests
  in it, then $0.30 a million; D1: 50 million rows written a month in it, then $1 a million;
  the site's files are free to serve), with no accounts:
  - Free plan: about 6,000 games a day (its limit is 100,000 requests a day).
  - 10,000 daily players, all four modes each: about $10 a month.
  - 100,000 daily players: about $20 a month at one mode each, $35 at two, $70 at all four.

  Accounts' games add their writes: the first 50 million rows a month (about 100,000
  account games a day) are in the plan. The plan's "$25–35 a month" (below) counted a
  player as 20 requests a day, which is about one game.

- **Made-up games.** Nothing stops a script from playing as a player with no account, but
  nothing comes of it: nothing is stored and nothing is counted. Since 2026-11-18 a game
  with no account makes a guest, which is counted; the new-player limit holds a script to a
  trickle ("Every player kept by the server").
- **Where a player with no account would have placed** is for the leaderboard step: their
  total against the accounts' totals of the day, said to them and not stored.

### Accounts (2026-11-17)

The product owner: "start the user accounts and let me know where you want me to input the
keys". An account is optional. It keeps a player's games on the server, the same on every
device and fit to stand on a leaderboard, and it holds their nickname. A player with no
account is still never stored, given a cookie or asked about.

- **Signing in has no passwords.** Two ways, each on only once its key is in Cloudflare:
  - **A link sent by email.** The page asks for one (`POST /api/account/link`); the Worker
    makes a random token, keeps its hash, and emails `/enter#<token>` through Resend
    (`worker/accounts/mail.ts`). The link works once, for 15 minutes. What follows the "#"
    is never sent to a server by a browser, so the token is in nobody's logs and a mail
    scanner that fetches the address uses nothing up: only the page at `/enter`, running in
    the player's browser, hands the token to the API (`POST /api/account/enter`). It does
    so at once where the link was asked for from that same browser, and asks for a press
    anywhere else.
  - **Google** (`worker/accounts/google.ts`): `/api/account/google` sends the browser to
    Google with a state and a PKCE challenge kept in a ten-minute cookie; Google sends it
    back to `/api/account/google/callback`, where the state is checked and the code is
    swapped, with the client's secret, for the person's id and verified email address.
    Only `openid email` is asked for: no name, no picture.
  - **Signing up is signing in**: there is no separate step. The card is "SIGN IN", and says
    so ("New or back, it's the same").
- **A bot check before a link is emailed** (the product owner, 2026-11-17: "should i use
  cloudflare turnstile?": yes). The card shows Cloudflare Turnstile's widget
  (`app/ui/BotCheck.tsx`), which mostly decides out of sight and asks for a click only
  where it cannot tell (`appearance: "interaction-only"`); its script loads only when the
  card is opened with the check on. Its token goes with the request, and the Worker asks
  Turnstile's `siteverify` whether it is good before sending anything
  (`worker/accounts/check.ts`). A token works once; the card asks for a fresh one after
  every send, and a press made before the check has decided waits for it (15 seconds at
  most). Turnstile not answering is a no. The site key is not a secret and is in
  `wrangler.jsonc` (`TURNSTILE_SITE_KEY`); the check is off until the secret key is in
  Cloudflare too (`TURNSTILE_SECRET_KEY`). `GET /api/account` gives the page the site key
  (`signIn.check`), never the secret.
- **An address is one account**, whichever way it is reached: both prove the address is the
  person's. Signing in with an address that has no account makes one.
- **A device is signed in by a cookie** (`worker/accounts/session.ts`): a random token, of
  which the database holds only the hash (`sessions`), `HttpOnly`, `Secure`,
  `SameSite=Lax`, named `__Host-ss` so a browser takes it from this exact site only. It
  lasts 90 days and is renewed past halfway. Since 2026-11-18 a guest (a player with no
  account) has one too, for a year ("Every player kept by the server").
- **The page keeps a note** of who the server last said is signed in (`loadAccount` in
  `app/game/account.ts`; the cookie itself cannot be read by scripts). The note is how the
  page knows to ask the server at all: with none, `/api/account` is never requested, and
  when it is requested with no cookie the Worker answers without touching the database.
- **The nickname.** A new account is `soccerfan` and the next number from the database's
  counter (soccerfan1, soccerfan2, ...: the product owner's "always unique", 2026-11-15).
  Changing it (`POST /api/account/name`) is the server's to allow: no two accounts share a
  name whatever the capitals, `soccerfan` and a number cannot be chosen, nor a name that
  passes for the game's staff, nor one with a slur or a swear word in it
  (`worker/accounts/names.ts`: a short first net, not a moderation system). On the device
  the account's name becomes the player's nickname.
- **Games.** A request from a signed-in device plays the account's game, kept in the
  database (`rowKeeper`, built with "Games run by the server"); any other request is a
  player keeping their own ticket. The game page, where the device has the note, asks the
  server for the day's game on arriving (`look`), so a game started on one device carries
  on, or is full time, on another. A ticket left on the device from before signing in is
  dropped. As each game is decided the server keeps what its questions asked with it
  (`prompts`), so any device can show it again.
- **The streak, the stats and the scores are the account's** (the product owner,
  2026-11-17: "streaks, stats, etc. should be saved to database if the user is logged
  in"). They are worked out from the finished games, as ever; for an account those are
  kept by the server, and each time a signed-in page asks who is signed in it swaps games
  with the server (`POST /api/account/history`, `sync` in `app/routes/account.ts`): it
  says which games of the last year it has (day, mode, total), the server answers with the
  account's games it lacks or holds with another total (the account's win), and which of
  the device's the account lacks; the device sends those, 100 at a time. So the streak,
  stats, scores, reviews and SHARE are the same on every device, and a device's games
  from before it signed in join the account. The home screen looks again once games have
  arrived.
- **Two kinds of game in the account** (`games.origin`, migration 4): `server`, played
  through the server, and `device`, a finished game a device sent up. A `device` game is
  taken on the device's word (checked for shape: seven turns, a total that is their sum,
  the last year, nothing longer than a game holds), counts for the streak and stats, and
  is the account's game of that day and mode (once a day), but **never stands on a
  leaderboard**: the leaderboard step ranks `origin = 'server'` only.
- **Another site's page cannot act for a signed-in player.** Every request that changes
  something must say it comes from this site (`fromThisSite`, the `Origin` header a
  browser adds and a page cannot change), and the cookie is `SameSite=Lax`.
- **An inbox cannot be filled from here.** Three links to an address in 15 minutes; five
  requests a minute from one connection (Cloudflare's rate limit, `SIGN_IN_LIMIT` in
  `wrangler.jsonc`: counted in memory, never kept); 2,000 links a day in all.
- **Deleting an account**: DELETE ACCOUNT on the account's card, which asks first
  ("Delete your account for good? ..."; DELETE FOR GOOD or KEEP MY ACCOUNT), then
  `POST /api/account/delete` takes its games of both kinds, its sessions (every device is
  signed out) and its links. The device keeps its own copy of the games and its name, as
  any device with no account does.
- **The API**: `GET /api/account` (`{ account, signIn: { email, google, check } }`: who is
  signed in, and which ways of signing in are set up), and `link`, `enter`, `name`,
  `leave`, `delete`, `history` under it (`worker/accounts/api.ts`). The tables are
  migration 4: `accounts`, `sessions`, `sign_in_links`, and `origin` and `prompts` on
  `games`.
- **On the page** (the product owner, 2026-11-17: "in bottom left add the account name
  (which is clickable if they want to change it) and next to it it says sign in which
  opens the sign in/ sign up pop up", then "actually move it top right of the screen"):
  - **A monitor**: in the top right corner (`AccountCorner` in `~/ui`): the player's
    name, underlined on the picture with a pencil (yellow under the pointer; a press opens
    YOUR NAME), beside **SIGN IN**, or **ACCOUNT** once signed in, on a small plate. The leaderboard's panel starts under it; on a monitor under
    820 px tall (1366 x 768) the panel then leaves out its seven days' strip so that it
    still ends above the captions (measured: 1366 x 768 ends 113 px above them, 960 x 457
    49 px; 1440 x 900 and taller are unchanged). It slides up out of view at the kick-off.
  - **A phone**: the logo leaves no room in the corner for words, so a button with a head
    and shoulders there opens the account's card, which has the name and CHANGE.
  - **The account's card** (`Account` in `~/ui`): SIGN IN while nobody is (the name and
    CHANGE, an email field and EMAIL ME A LINK with the bot check, CONTINUE WITH GOOGLE,
    each only where that way is set up), YOUR ACCOUNT once someone is (who, the name and
    CHANGE, SIGN OUT, DELETE ACCOUNT); the terms and the privacy notice are linked at its
    foot.
  - **The leaderboard no longer changes the name** ("remove the ability to change it within
    the leaderboard"): its line with the name and CHANGE is gone.
  - `/enter` (`app/routes/enter.tsx`) is where a link and a trip to Google land.
    `app/routes/account.ts` is the page's store.
- **The privacy notice and the terms** (`/privacy`, `/terms`: `app/routes/privacy.tsx`,
  `terms.tsx`, words in `strings.privacy` and `strings.terms`), linked from the account's
  card and the rules' small print, and listed for search engines. Ordinary pages that scroll
  (the product owner: "full scrollable pages, not a black page and a popup appearance"):
  a bar along the top with the game's name and PLAY, held there as the page scrolls, the
  words in a column about seventy characters wide, and a foot with the two pages' links
  and the small print (`app/routes/legal-page.tsx`). They are drafts written
  to match what the game does (no ads, cookie-free Cloudflare Web Analytics only, what an
  account keeps and for how long, Cloudflare, Resend and Google as processors, the ICO), for
  the product owner to have checked. They name `info@soccersense.io`
  (`strings.pages.contact`, the product owner's address, 2026-11-18) for questions, and
  who runs the game: its founders, as sole traders in the UK under the name soccersense
  (the product owner, 2026-11-18: not registered yet; a broader name may come later).
- **Written directly, not with Better Auth.** The plan named that library. Signing in here
  is two small flows with no passwords, and the Worker is plain TypeScript on web
  standards with its time handed in and its tests on a real SQLite: written directly it is
  about 1,200 lines, comments and all, that those tests cover end to end, with nothing new to install. Say so
  if the library is wanted after all.
- **The secrets** are the product owner's to put in Cloudflare (the Worker's Settings,
  "Variables and Secrets", type **Secret**: a plain variable set there is wiped by the next
  deploy): `RESEND_API_KEY` (and the domain verified in Resend, for the sender in
  `MAIL_FROM`), `GOOGLE_CLIENT_SECRET` (its client's id, not a secret, is in `wrangler.jsonc`;
  the client's redirect address:
  `https://soccersense.io/api/account/google/callback`), `TURNSTILE_SECRET_KEY` (the
  Turnstile widget for `soccersense.io`; its site key is not a secret and is in
  `wrangler.jsonc`). Until a key is there its way of signing in, or the check, is off and
  the card does not offer it.
- **Locally**: with no email key, `pnpm api` writes the sign-in link to its own log in the
  email's place, so signing in can be tried with nothing set up. A developer's own keys go
  in `.dev.vars` (git ignores it). Google needs the Worker's own address
  (`http://localhost:8787`) and that redirect address listed on the client.
- **Tests.** `worker/accounts/api.test.ts` (every request, the email service, Google and
  Turnstile stood in for), and the pages against the Worker's own code with a browser's
  cookie jar (`worker/testing/site.ts`): `app/routes/account.test.ts`, `enter.test.tsx`,
  `home-account.test.tsx`, `play/served-account.test.tsx`, `legal.test.tsx`; the kit's
  `Account.test.tsx` (Turnstile stood in for) and `MenuAccount.test.tsx`.

Known, and not in this step:

- **No offer of an account after a first game** (the plan's "after a first game the page
  offers an account"; the product owner, 2026-11-17: "no offer to sign up after first
  game").
- **The privacy notice and terms need a name**: who runs the game.
- **Signing out leaves the device as it is**: its games (the account's among them, once
  swapped) and its name stay, so the streak a shared computer shows is the last
  account's until another signs in there.

### The leaderboards (2026-11-18)

The product owner: "proceed with leaderboard". Today's boards on the home screen are real:
the mock (`app/data/leaderboard.ts`) is left to development with no API, and the tests.

- **Who is on them**: accounts only, with a game played through the server (the product
  owner, 2026-11-17: "only accounts are on leaderboards"); since 2026-11-18 guests too,
  every player the server keeps ("Every player kept by the server"). A game a device sent up after
  signing in (`games.origin = 'device'`) counts for the account's streak and stats, never on
  a board. One game a day and mode each, so the first counts.
- **A player whose game is not kept** (a ticket, where no guest could be made) is told
  where they would have placed ("You'd be 37th of 1,285", they counted in) and is not put
  on the board. Their page works it out from the
  board's counts (`rankFor`, `app/game/board.ts`): nothing about them is sent or kept.
- **The API**: `GET /api/leaderboard?day=<n>` (today when left out; any day that has been,
  never one to come), `worker/games/board.ts`. For each mode: `count` (accounts on the
  board), `top` (the ten best, best first: equal totals share a place, the one who finished
  first listed first; the signed-in player's row marked `you`), `tally` (how many accounts
  finished on each total) and `you` (the signed-in player's place, where they are on the
  board). Anyone may read it; it is the same for everyone but `you`.
- **Cheap at any size**: a place is worked out from the counts, never by reading every game.
  `board_tally` (migration 5) holds, for each day, mode and total, how many accounts' games
  were decided on it: one more as each game is decided, in the same transaction as the move
  that decides it and only if that move was written (a game is counted once however many
  requests carry its last move; checked on SQLite and on Cloudflare's own engine through
  `wrangler dev`). Deleting an account takes its games off the counts. The top ten come
  from an index (`games_board`). A whole day's boards are one round trip of six reads at
  most: at most 71 counts a mode, and ten rows each.
- **On the page** (`app/routes/board.ts`, `boardStore`): the home screen watches the day's
  boards, asking at once, every minute while the tab is in view, when it comes back into
  view, and when who is signed in changes. The panel's table is the ten (or "Nobody on today's
  board yet."); under it the player's own line: their place ("You're 37th of 1,284"), where
  they would have placed, or the count and a nudge ("1,284 on the board. You?"). The airship
  says the count ("ON THE BOARD / 1,284") and, for a player on a board, their place.
- **In development** with no API behind the dev server (`gameClock().api()` false) the
  boards are made up (`mockBoards`); a production build leaves that module out (checked: none
  of its names is in `build/client`).

Known, and not in this step:

- **Past days' boards** can be asked for, but nothing on the page shows them yet (the
  archive, with membership).
- **The modes still to come** (GUESS WHO, SHOOTOUT) will have boards of their own when
  they are built; the API answers per mode, and CLOSEST and FURTHEST (2026-11-18) have theirs.

### Every player kept by the server (2026-11-18)

The product owner: "i do want non account players answers to count towards it too...
maybe change architecture then so non account players can still come on leaderboard and
their answers also influence the ranking for home and away. only thing on localstorage
should be their stats and streak". They accepted that people can cheat ("all trivia games
are cheatable but that isn't the point") and twelve months' keeping. This replaces the
2026-11-17 rule that nothing was stored about a player with no account; the sections above
and below say where it changed.

- **A guest** is a player with no account: a row in `accounts` with no email address
  (migration 7 made the table again so that the address can be empty, keeping its rows and
  indexes; checked on Cloudflare's own engine). It has a name like any player, unique, and
  the same session cookie (`__Host-ss`), which lasts a year for a guest (renewed past
  halfway) and 90 days for an account.
- **Made at the first game** (`worker/app.ts`, `newGuest` in `worker/accounts/api.ts`): a
  start with no player makes one. Its name is the one the device has been showing, where
  the server would take it from a player and it is free (a name the player chose); a
  `soccerfan` name made up on the device is not taken, and the guest gets the next number
  from the counter. Changing the name before any game makes the guest too, with that name
  (`POST /api/account/name`; a taken or unfit name makes nothing).
- **Their games are the server's**, as an account's: one a day and mode, kept as rows, on
  the leaderboards, their answers counted for HOME's and AWAY's shares. Their streak, stats
  and settings stay on the device (the history swap is for accounts: a guest gets nothing
  to swap). The page knows to ask the server for a game in progress by a device note
  (`hasPlayer`, `app/game/account.ts`), as it does for an account.
- **Signing in** with an address that has no account turns the guest into it, name and
  games and all (same row). With an address that has an account, the guest's games come
  into the account except for a day and mode the account has played (the account's game
  stands), the boards' counts are put right in the same transaction, and the guest goes.
- **Deleting**: a guest can delete itself (DELETE MY GAMES on the sign-in card,
  `POST /api/account/delete`). The nightly tidy (`worker/tidy.ts`, the Worker's
  `scheduled`, cron `41 3 * * *`) deletes a guest a year after its last game, or a year
  after it was made if it never played, and clears sessions that have run out and sign-in
  links over a day old.
- **The new-player limit** (`NEW_PLAYER_LIMIT`, 10 a minute per connection, in Cloudflare's
  memory): a script making player after player is held to a trickle; a person never meets
  it. Where it says no, the game is a ticket on the device as before (not kept, not on a
  board, not counted), and a name change says "too many".
- **A visitor who has not played** has no row and no cookie; the home screen asks who plays
  here as it opens, which without a cookie does not touch the database.
- **The bot check** (Turnstile, the product owner, 2026-11-18: "yes add both
  protections"): a first game, or a first name, makes a player only with a token that
  Turnstile says is good (`mayMakePlayer`, `worker/accounts/api.ts`). It stops scripts
  however many connections they use, which the new-player limit alone does not. The page
  runs the widget out of sight on the home screen and the mode pages for a device the
  server does not know yet (`FirstGameCheck`, `app/routes/first-check.tsx`), so a token is
  waiting when the game starts; a first game waits for one up to 10 seconds, then starts
  without it, and is then a ticket (played, not kept). Where Turnstile has to ask, its
  widget shows at the foot of the screen. A device the server knows runs nothing.
- **Cost**: every game is now rows written (about 16 a game, plus its counted answers), where
  a game with no account wrote none. "What it costs to run", above, counted no-account games
  as free.

### Moderation (2026-11-18)

The product owner: "build the admin action to remove players for moderation". It is a
second tab on `/admin`, Players (`app/routes/admin-players.tsx`), behind the same admin
token, and an API beside the desk's (`worker/accounts/moderation.ts`):

- `GET /api/admin/players?q=` finds accounts by any part of their name or email address
  (or their id), at most 25; with nothing given, the newest. Each with when it joined, its
  games, the last day it played and whether it is on the leaderboards.
- `POST /api/admin/players/<id>` with an `action`:
  - `rename`: a new soccerfan name in place of theirs, for a name that breaks the terms.
  - `ban`: **off the leaderboards**, with a note of why (`accounts.banned_at`,
    `banned_note`, migration 6). The account still plays and keeps its games, streak and
    stats; its games are on no board and out of the boards' counts (taken off in the same
    transaction), its answers are not counted for the day's shares, and it is told where
    it would have placed, as a player with no account is. Nothing on the page tells it why.
  - `unban`: back on, with every game it has played through the server, those finished
    while off too.
  - `delete`: the account and everything kept for it, as the player can do themselves. An
    account already off the boards is not taken off their counts twice.
- The terms already allow each: "We may change a name that breaks this, or close the
  account", and "We may remove scores or accounts that do". The privacy notice says a note
  of when and why is kept with an account taken off.
- The answers an account gave before it was taken off stay in the day's counts: they are
  counts with nothing saying whose they were.
- Checked by `worker/accounts/moderation.test.ts`, `app/routes/admin.test.tsx`, and on
  Cloudflare's own engine through `wrangler dev`.

### Security (2026-11-17)

The product owner: "ensure everything is secure so no jwt in headers or session cookies. no
senstive secrets anywhere public". What is so, and how it was checked:

- **No JWTs anywhere.** Nothing the game makes is a JWT. A signed-in device's cookie holds
  a random 32-byte value (43 characters) that means nothing by itself; the database keeps
  only its SHA-256, so even a copy of the database signs nobody in. The cookie is
  `HttpOnly` (scripts on the page cannot read it: checked, `document.cookie` is empty in
  Chrome), `Secure`, `SameSite=Lax`, `__Host-` (this exact site only), and only accounts
  get one. Google's sign-in hands the Worker a JWT (its ID token) over a direct HTTPS
  request; the Worker reads the address and id from it there and keeps nothing of it, and
  it never reaches a browser. No token is put in a request header by the page: the only
  `Authorization` header is the approval desk's, sent from the product owner's own
  browser.
- **No secret anywhere public.** The keys (`ADMIN_TOKEN`, `RESEND_API_KEY`,
  `GOOGLE_CLIENT_SECRET`, `TURNSTILE_SECRET_KEY`) live only in Cloudflare as secrets;
  `wrangler.jsonc` names them and holds none. It does hold the Turnstile site key and the
  Google client's id, which are public by design (every page that shows the check, and
  every link to Google's sign-in page, has them). Checked by searching the working tree, every commit in the history and the
  built site for key shapes (Resend, Google, Turnstile, JWTs, private keys) and for the
  product owner's address: nothing. The built site ships no source maps and no server
  code; the page reads no setting but where it is served from. A developer's own keys go in
  `.dev.vars`, which git ignores. The game ticket's key is made by the Worker and kept in
  the database. Tests hold the settings to this (`app/routes/hosting.test.ts`).
- **Headers.** Every file the site serves carries `public/_headers`: a content security
  policy (scripts, styles, pictures, sounds and requests from this site only, plus
  Turnstile's script and frame from `challenges.cloudflare.com` and Cloudflare Web
  Analytics' script and its count, which the product owner keeps on (2026-11-18); no plugins, no other base
  address, no form posted elsewhere, no framing by another site), HSTS for a year,
  `nosniff`, `X-Frame-Options: DENY`, a referrer cut to the site, no camera, microphone,
  location or payments, and `Cross-Origin-Opener-Policy: same-origin`. Every API answer
  carries `no-store`, `nosniff`, `default-src 'none'; frame-ancestors 'none'` and
  `no-referrer` (`API_HEADERS`, `worker/http.ts`). Checked in Chrome against the built site
  served by the Worker: the home screen, SHARE's picture, the sign-in card with the bot
  check, signing in, a game and both pages, with nothing blocked; framed by another page,
  the site refuses. The policy allows inline scripts, because the pages are built ahead of
  time with their start-up script written into them.
- **Requests.** Another site's page cannot act for a signed-in player (`fromThisSite`, the
  `Origin` a browser adds), and no API answer can be read by another site's script (no
  CORS headers). "A developer's own machine" (the link written to the log; any origin
  taken) is plain HTTP to this machine's own address only, never the live site.
- **Limits** (`ratelimits` in `wrangler.jsonc`, Cloudflare's own counters, kept in memory
  for a minute and never stored): 5 sign-in links a minute per connection
  (`SIGN_IN_LIMIT`), 10 new players a minute per connection (`NEW_PLAYER_LIMIT`, "Every
  player kept by the server"), and 120 moves of the games a minute per player (`GAME_LIMIT`, added
  2026-11-18 at the product owner's word: "yes build the rate limit"), an account counted
  by itself and anyone else by their connection. A game is about 16 requests, so only a
  script comes near it. A refused move is answered 429 with `retry-after: 60`; the page
  takes it as the server out of reach and asks again (after 0.5, 1, 2, 4, then every 8
  seconds), so a player behind a busy shared connection carries on within the minute. The
  rest of the API is not counted.
- **Still to know:** commits carry the author's own email address, which a public GitHub
  repository shows (GitHub can give a private `noreply` address instead).

### What still stands in for the backend

These parts change as it arrives:

- **The day and the time: done** (above). `gameSearch` keeps `?day=`, `?stadium=` and
  `?notimer=` to development builds.
- **Once a day.** For a player with no account it is the device's storage, as it always
  was (`soccersense:v1:<day>:<mode>`, `app/game/storage.ts`, and the game in progress under
  `...:live`, `app/routes/play/progress.ts`, now the server's ticket): clearing site data,
  a private window or another browser gives a fresh game. That is the product owner's
  choice (2026-11-17): nothing is stored about a player with no account. Since 2026-11-18
  the server keeps a guest's game as it keeps an account's, and gives the day's game back to
  a second start; clearing site data or a private window is a new guest.
- **Nicknames.** Each player's first nickname is `soccerfan` and a number, given and kept on the
  device (`app/game/nickname.ts`, `app/routes/nickname.ts`); the leaderboard shows it only on the
  player's own row. The product owner wants the numbers to go up one by one so that no two
  players share one (2026-11-15). A device cannot know which numbers others have, so for now it
  picks a random one from 1000 to 9999 (`fanNumber`). **For an account this is done**
  ("Accounts", above): the server hands out the next number from a counter (`fanNickname(n)`
  makes the name: soccerfan1, soccerfan2, ...), checks a changed name is free and turns down
  offensive or impersonating ones (the device only checks length and characters). The
  leaderboards show accounts' names ("The leaderboards", above). A UUID is the
  right thing to identify a player behind the scenes (it is what anonymous sign-in gives), not
  to show: it is 36 characters.
- **The questions and the answers: done** (above). They are in the Worker, not the page.
- **The rest already noted elsewhere:** popularity shares are estimates, the foundation that
  the day's counted answers move (below; docs/data-notes/popularity.md); streaks, stats and the history are
  kept on the device for a player with no account, and are the account's for one who has one
  ("Accounts", above).
- **The rendering rules** in CLAUDE.md (`ssr: false`, prerender, no `action`, `clientLoader`
  for anything fetched at runtime) still hold: the pages are files, and what the game needs
  from the server it asks for itself after mounting.

### The plan agreed with the product owner (2026-11-15)

Nothing of this is built yet ("Don't build it yet, just tell me").

- **Platform: Cloudflare.** One Worker serves the static site and an `/api`; D1 (SQL) holds the
  data; R2 keeps archived days; cron triggers run the nightly jobs. Chosen over Supabase,
  Firebase and AWS Lambda for cost at 100,000+ daily players (about $25–35 a month against
  $60–120 on AWS; "What it costs to run" above has the figures as built) and for having one place to maintain. D1 caps a database at 10 GB: archive
  raw games to R2 nightly after counting.
- **Lean design:** one row per finished game (its seven answers inside it); ranks from a
  per-day, per-mode tally of the 71 possible totals (0 to 700 in tens); the top ten and today's
  questions cached and refreshed every minute or so; answer popularity counted as the day goes
  (below). About 20 requests and 2 writes per daily player (as built: about 16 requests a
  game, with no writes for a player with no account and 16 rows for an account's game).
- **Accounts:** optional. Everyone plays at once as `soccerfanNNNN`; after a first game the page
  offers an account to keep the streak, stats and name on every device, and the games already
  on the device go with it. Sign-in by emailed link and Google (no passwords), with Better Auth
  on the Worker (not a hosted service: those charge per user). Email through Resend. (Built
  2026-11-17, "Accounts" above: on the Worker and not a hosted service, as agreed, but written
  directly, not with that library; the offer after a first game, and the device's games
  going with the account, are not built.)
- **Leaderboards:** only accounts are on them (changed 2026-11-17, with games kept on the
  device for players with no account: it was "everyone on them, accounts or not"; and back
  on 2026-11-18: everyone the server keeps, guests included). A player
  with no account is told where their total would have placed, and is not put on the
  board. Only an account's first game of a day and mode counts.
- **Membership** (Paddle, which sells as merchant of record and handles VAT; about £2.99 a month
  or £19.99 a year):
  - Free, no account needed: HOME, AWAY, RETRO and NEXT-GEN, once a day each; and CLOSEST and
    FURTHEST for now (the product owner, 2026-11-18: "for now it will always be free but when
    game is popular i might but it behind the membership").
  - Members: the locked modes (GUESS WHO, SHOOTOUT and any later ones, and perhaps CLOSEST and
    FURTHEST later), once a day each with their own daily leaderboards; and unlimited play: any
    past day from the archive, in any mode they have. Replays never count on a leaderboard.
  - The server decides what a player may open; the page only shows it.
- **For the product owner to set up first:** a Cloudflare account, the domain, a Paddle
  application (its checks take days and it reviews the site), Resend, a Google OAuth client;
  privacy, terms and refund pages; the ICO data protection fee if it applies. Each day needs its
  own questions before the leaderboard means anything.

### How HOME's and AWAY's shares are worked out (decided 2026-11-16, built 2026-11-18)

Built on 2026-11-18 (the product owner: "you can proceed with the home and away scoring from
what players type"), as below, with these choices made in the building:

- **Whose answers are counted: accounts' only** (as first built; since the same day, every
  player the server keeps, guests included: "Every player kept by the server"). A player with no account is scored by the
  same blend, but their answers are not counted. Their game is a ticket the server does not
  remember, which can be sent again, so a script could count one answer as often as it
  liked; counting them safely would need the server to remember their games, and nothing is
  kept about a player with no account. Accounts play a day and mode once, and each move is
  kept once. The day's weight grows with the accounts that play (`t` is small while there
  are few), which is the rule working as meant.
- **The counts are in D1**, not a Durable Object: `answer_tally` (migration 6), one row
  per day, mode, question and answer, one more in the same transaction as the move that
  decided it and only if that move was written (as the boards' counts are; checked on
  Cloudflare's own engine). At 100,000 daily players in both modes that is about 1.4 million
  rows written a day, within Workers Paid's 50 million a month. A Durable Object can take
  it over if that ever stops being true.
- **Each instance remembers a question's counts for ten seconds** (`COUNTS_KEPT_MS`), so
  an answer is scored on counts at most that old and the database is not read for each one.
- **The shots are filed again** from the blended shares by the mode's rule (`shotsFor`),
  as every drafted question is. A sample answer whose shot was moved by eye goes back to
  the rule once its question has counts.
- **The reveal at the moment of answering** is the table the answer was scored on. Coming
  back to a reveal later (a reload) shows the table as it is then, which can differ a
  little; the score in the turn does not change.
- **Not built with it:** logging what players type that the judge does not know, and the
  final counts feeding the next outing's foundation.

The code: the rule is `~/game/day-shares` (`scoredToday`, `blendShares`, `dayWeight`,
`DAY_WEIGHT_MOST` 0.35, `DAY_WEIGHT_HALF` 300); the counts are `worker/games/shares.ts`;
`worker/games/play.ts` scores the question in hand on them (`withTheDay`) and counts the
answer a move decided (`answerDecided`).

The decision, as it was written on 2026-11-16. The question put to the product owner: should an answer's share (how common it is,
which is the whole score in HOME and AWAY) be counted from what players type that day, or be a
fixed table of what fans say when they are not trying to be clever? Their answer: "a combo of
both. perhaps what fans would naturally say have a strong foundation and the premise, then the
answers given that day also add weight to the scores".

- **The foundation: what fans would naturally say.** Every question has a table of natural
  shares, written with it: at first our estimates, as the sample questions have now
  (`docs/data-notes/popularity.md`). It is the premise of the game, and it never counts for
  less than most of an answer's share.
- **The day adds weight.** What players type that day, in that mode, is counted, and moves
  the foundation's shares towards the day's. An answer's share is

      share = (1 - t) x natural + t x the day's,    t = T x n / (n + K)

  where `n` is how many players have answered the question so far. So the first players of a
  day are scored on the foundation alone, the day's weight comes in as people play, and it
  never passes `T`. Starting numbers, to be tuned with real players: `T` 0.35 (the day is at
  most about a third of a share) and `K` 300 (half of that after 300 players).

- **Why both** (the two failures the blend is there to stop):
  - Counted from the day alone, AWAY turns inside out: everyone avoids the obvious answer, so
    hardly anyone types Messi, and Messi would score as a rare answer. With the foundation at
    two thirds, Messi (natural 32%, typed by 1%) is still 21%: common.
  - On a fixed table alone, a list of the day's best AWAY answers posted anywhere gives every
    reader the top score. With the day's weight, an answer of natural 0.1% that 30% of players
    copy is 10.6%: no longer rare. A leak undoes itself.
- **What is counted:** a player's first game of the day in that mode, and only answers the
  judge accepted (its aliases and spellings counted as the one answer). Not replays, archive
  games, wrong answers, passes or time-ups.
- **A score is the player's as they answer:** the reveal shows the table as it stood then, and
  nothing is re-scored afterwards (a result already shared, and a career already watched, stay
  true). At midnight UTC the day's table is frozen: archive replays are scored against it.
- **The foundation gets better.** A question that has been played gives real numbers for its
  next outing. HOME's players are asked for the common answer, so HOME's final counts are the
  nearest thing to "what fans naturally say" that the game collects by itself: they feed that
  question's foundation (how much, and whether an unscored "first one that comes to mind"
  question is worth adding for the same end, to be decided when there are players).
- **Both modes use the one rule.** The product owner's answer was about AWAY, where it
  matters most. HOME is given the same blend (an assumption, not yet put to them): there the
  day's answers and the foundation mostly agree, and the day's weight corrects an estimate
  that was wrong.
- **Not in this:** RETRO, NEXT-GEN, CLOSEST and FURTHEST are scored on years and distances,
  which are facts. Their tables never move.
- **With it** (as planned on 2026-11-16; as built, see above): what players type that the
  judge does not know is logged (missing answers and spellings show up in the first week),
  and starting a game needs a bot check (Cloudflare Turnstile) and a limit per address, or
  made-up players could push an answer's share about. The counts for a day and mode are
  kept in memory by one Durable Object and saved now and then, not written to the database
  answer by answer.
- **In the code:** the game reads one number per answer (`Answer.popularity`, through
  `rankAnswers`), so the blend is the server's: it sends the shares with each reveal.
