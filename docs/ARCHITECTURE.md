# soccersense: architecture (iteration 1)

Read `docs/GAME_DESIGN.md` and `docs/ART_BIBLE.md` first. This document says where code lives,
what the shared contracts are, and how to check your work.

## 1. Shape of the app

- React Router v8 static site (`ssr: false`, pages prerendered at build time). Everything in
  this iteration runs in the browser. No backend, and no calls to any other site. Beyond its own
  files, the page makes one kind of request: a HEAD to its own address, for the server's time
  (`app/ui/game-clock.ts`), so the day is not the device's clock.
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
`PAGES` with `app/routes.ts`. The development pages say `noindex` themselves, and the root's
own `meta` (`fallbackMeta`) says it for an address that is not a page: a static host answers
those "200 OK" with `__spa-fallback.html`, and they would otherwise be listed.

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

## 8. When the backend comes

There is no backend yet (the product owner, 2026-11-15: "I will add backend later on"). These
parts stand in for one and change when it arrives:

- **The day and the time.** `app/ui/game-clock.ts` takes the time from the `Date` header of a
  HEAD request to the static host, so a changed phone clock cannot open another day's game.
  With a backend, the backend says what day it is (say, `/api/today` with the day number and
  the time) and the clock reads that instead. Only `serverClock`'s request and `serverTimeOf`
  change; the game page already waits for the clock, and the home screen already takes its
  correction. `gameSearch` keeps `?day=`, `?stadium=` and `?notimer=` to development builds.
- **Once a day.** Whether a mode was played today is the device's local storage
  (`soccersense:v1:<day>:<mode>`, `app/game/storage.ts`; the game in progress is
  `...:live`, `app/routes/play/progress.ts`). Clearing site data, a private window or another
  browser gives a fresh game. The backend records each player's game per day and mode and
  refuses a second; local storage becomes a cache of it.
- **Nicknames.** Each player's first nickname is `soccerfan` and a number, given and kept on the
  device (`app/game/nickname.ts`, `app/routes/nickname.ts`); the leaderboard shows it only on the
  player's own row. The product owner wants the numbers to go up one by one so that no two
  players share one (2026-11-15). A device cannot know which numbers others have, so for now it
  picks a random one from 1000 to 9999 (`fanNumber`). The backend hands out the next number from
  a counter (`fanNickname(n)` makes the name: soccerfan1, soccerfan2, ...), checks a changed name
  is free, turns down offensive or impersonating ones (the device only checks length and
  characters), and sends the real players' names in `leaderboardFor`'s place. A UUID is the
  right thing to identify a player behind the scenes (it is what anonymous sign-in gives), not
  to show: it is 36 characters.
- **The questions and the answers.** Every mode's questions and every answer's share ship in
  the page's code (`app/data`), so anyone can read them. The backend sends only today's
  questions, judges the answers itself and sends each reveal after it is answered. An answer still
  typed when the clock runs out counts as sent (2026-11-15, `reduce`'s whistle): the page sends
  it as the clock reaches zero, so it arrives a moment after the deadline. The server accepts
  it within a second or two of grace, and nothing later.
- **The rest already noted elsewhere:** popularity shares are estimates until real answers are
  counted (`shotsFor`, docs/data-notes/popularity.md); the leaderboard is mock data behind
  `leaderboardFor` (docs/API_UI.md); streaks, stats and the history are kept on the device only
  (GAME_DESIGN.md section 6.6).
- **The rendering rules** in CLAUDE.md (`ssr: false`, prerender, no `action`, `clientLoader`
  for anything fetched at runtime) assume no runtime server, and section 1 of this file allows
  only the clock's request. Both are revisited with the backend.

### The plan agreed with the product owner (2026-11-15)

Nothing of this is built yet ("Don't build it yet, just tell me").

- **Platform: Cloudflare.** One Worker serves the static site and an `/api`; D1 (SQL) holds the
  data; R2 keeps archived days; cron triggers run the nightly jobs. Chosen over Supabase,
  Firebase and AWS Lambda for cost at 100,000+ daily players (about $25–35 a month against
  $60–120 on AWS) and for having one place to maintain. D1 caps a database at 10 GB: archive
  raw games to R2 nightly after counting.
- **Lean design:** one row per finished game (its seven answers inside it); ranks from a
  per-day, per-mode tally of the 71 possible totals (0 to 700 in tens); the top ten and today's
  questions cached and refreshed every minute or so; answer popularity counted as the day goes
  (below). About 20 requests and 2 writes per daily player.
- **Accounts:** optional. Everyone plays at once as `soccerfanNNNN`; after a first game the page
  offers an account to keep the streak, stats and name on every device, and the games already
  on the device go with it. Sign-in by emailed link and Google (no passwords), with Better Auth
  on the Worker (not a hosted service: those charge per user). Email through Resend.
- **Leaderboards:** everyone on them, accounts or not; only the first game of a day and mode
  counts.
- **Membership** (Paddle, which sells as merchant of record and handles VAT; about £2.99 a month
  or £19.99 a year):
  - Free, no account needed: HOME, AWAY, RETRO and NEXT-GEN, once a day each.
  - Members: the locked modes (CLOSEST, FURTHEST, and GUESS WHO, SHOOTOUT and any later ones),
    once a day each with their own daily leaderboards; and unlimited play: any past day from
    the archive, in any mode they have. Replays never count on a leaderboard.
  - The server decides what a player may open; the page only shows it.
- **For the product owner to set up first:** a Cloudflare account, the domain, a Paddle
  application (its checks take days and it reviews the site), Resend, a Google OAuth client;
  privacy, terms and refund pages; the ICO data protection fee if it applies. Each day needs its
  own questions before the leaderboard means anything.

### How HOME's and AWAY's shares will be worked out (decided 2026-11-16)

Not built. The question put to the product owner: should an answer's share (how common it is,
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
- **With it:** what players type that the judge does not know is logged (missing answers and
  spellings show up in the first week), and starting a game needs a bot check (Cloudflare
  Turnstile) and a limit per address, or made-up players could push an answer's share about.
  The counts for a day and mode are kept in memory by one Durable Object and saved now and
  then, not written to the database answer by answer.
- **In the code today:** the game reads one number per answer (`Answer.popularity`, through
  `rankAnswers`), so the blend is the server's: it sends the shares with each reveal.
