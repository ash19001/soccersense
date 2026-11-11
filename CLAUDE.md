# soccersense

A daily football trivia game. Seven typed questions, 100 points each, and the total drives a
footballer's career from the park to the World Cup. HOME: give the most common answer (the one
most players give). AWAY: give the most niche answer. Every day has one stadium, shown on the
home screen; the locked modes CLOSEST and FURTHEST (an answer's place against today's stadium),
NEXT-GEN and RETRO come later. Retro pixel art, drawn in code.

(Changed on 2026-11-11: HOME and AWAY used to be closest to and furthest from today's stadium.
Some older notes in the docs still describe that; `docs/GAME_DESIGN.md` is being updated.)

Read these before changing anything substantial:

- `docs/GAME_DESIGN.md`: rules, scoring, career tiers, screens.
- `docs/ART_BIBLE.md`: how everything must look. Mandatory for any drawing work.
- `docs/ARCHITECTURE.md`: code layout, the engine and scene contracts, working rules.

References for what is already built (read the one for the area you are working in):
`docs/API_ENGINE.md` (drawing), `docs/API_ART.md` (palette, lighting, sky, layout, finished art),
`docs/API_GAME.md` (rules), `docs/API_UI.md` (interface kit). `docs/PROGRESS.md` says what is
done and what comes next.

## Current scope

Frontend only. Don't add a backend, database, auth, analytics, payments or hosting config until
asked. Question data is a built-in sample in `app/data`.

Borrow the daily-quiz _format_ only. Never copy the name, art, mascot, wording or question
content of wonderhop.io or any other game. No real club crests, kits or sponsor logos.

## Stack

- React Router v8 framework mode (static, `ssr: false` + prerender), Vite 8, React 19,
  TypeScript strict, Tailwind v4, Jersey pixel fonts (self-hosted via `@fontsource`).
- pnpm (not npm or yarn), Node 26.
- React Router docs for the installed version: `node_modules/react-router/docs/`
  (see the `react-router` skill in `.claude/skills/`).

## How it is built

- Scenes are drawn in software into a `Surface` framebuffer (`app/pixel`) and copied to a
  canvas. The interface (board, answer bar, reveal sheet) is DOM laid over it.
- `app/pixel`, `app/art`, `app/scenes`, `app/game`, `app/lib`, `app/data` are pure TypeScript:
  no DOM, no clock reads, no unseeded randomness.
- Art is checked by rendering named shots to PNG without a browser:
  `pnpm snap --list`, `pnpm snap <shot> --time night --out .snaps/x.png`, then look at the file.

## Rendering rules (`ssr: false` + prerender)

- Routes must not export `action` or `headers`: there is no runtime server.
- `loader` runs at build time only; use `clientLoader` for anything fetched at runtime.
- Every route is rendered at build time, so don't touch `window`, `localStorage` etc. during
  render. Use them in effects or event handlers.

## Conventions

- Interface text goes in `app/i18n/en.ts`, never hard-coded in components. Question content
  lives in `app/data`.
- Import from `app/` with the `~/` alias.
- Tests sit next to the code as `*.test.ts(x)`.
- Run `pnpm check` before calling work done.
