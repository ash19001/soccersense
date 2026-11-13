# soccersense: architecture (iteration 1)

Read `docs/GAME_DESIGN.md` and `docs/ART_BIBLE.md` first. This document says where code lives,
what the shared contracts are, and how to check your work.

## 1. Shape of the app

- React Router v8 static site (`ssr: false`, pages prerendered at build time). Everything in
  this iteration runs in the browser. No backend, no network calls.
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
tools/        Node-only scripts: snap.ts (render shots to PNG), png.ts, browser screenshots.
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
