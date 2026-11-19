# soccersense

A daily football trivia game. Seven typed questions, 100 points each, and the total drives a
footballer's career from the park to the World Cup. HOME: give the most common answer (the one
most players give). AWAY: give the most niche answer. The stadium on the home screen changes
its colours every day and has no name: nothing on it says which stadium it is. RETRO (the
oldest answer) and NEXT-GEN (the most recent) are open too, and so are CLOSEST and FURTHEST
(2026-11-18): the answer whose place is nearest to, or furthest from, the day's place (a
stadium, a city or a landmark, `app/data/places.ts`), which those two modes name and show on a
pixel world map. Retro pixel art, drawn in code.

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

The game is a static site with a small backend being built behind it, step by step
(`docs/ARCHITECTURE.md` section 8: the plan, and what is built so far). It is one Cloudflare
Worker at https://soccersense.io (`wrangler.jsonc`): the built site as files, and `/api/*`
answered by `worker/` with a D1 database. A push to `main` deploys it.

- Build the backend in the agreed order, a step at a time; don't add analytics or
  payments ahead of it. (Cloudflare Web Analytics, switched on in the dashboard, stays: the
  product owner, 2026-11-18. The security headers in `public/_headers` allow it.)
- Every player who plays is kept by the server (the product owner, 2026-11-18): a player
  with no account is a guest, a row in `accounts` with no email address, made at their
  first game (or first name change) and known by the same session cookie as an account.
  Their games and name are the server's, they are on the leaderboards and their answers are
  counted; only their streak and stats are on the device. A guest is deleted a year after
  their last game (`worker/tidy.ts`, nightly) or when they ask. Making one needs the bot
  check (Turnstile, run out of sight by `app/routes/first-check.tsx`) and passes the
  new-player limit; where either says no, the game falls back to a sealed ticket on the
  device, not kept.
- Accounts are optional (`worker/accounts`): sign-in by an emailed link or Google, no
  passwords. Signing in turns the guest into the account, or brings its games into the
  account the address has. An account's games, streak, stats and nickname are the server's,
  the same on every device. A game a device sent up (`games.origin = 'device'`) never
  counts on a leaderboard. The leaderboards are the server's (`GET /api/leaderboard`).
  The admin can rename, take off the leaderboards, or delete a player (`/admin`, Players).
- HOME's and AWAY's shares move with the day: each question's natural shares blended with
  the answers players gave it that day (`~/game/day-shares`, `worker/games/shares.ts`).
- Question data is a built-in sample in `app/data`, and stays what the game plays until the
  `QUESTIONS` flag (`wrangler.jsonc`) is switched: the game is still in testing.
- The server runs every game (`worker/games`): it sends a question as its clock starts,
  judges the answer and sends the reveal. The page has no answers: nothing under
  `app/routes` or `app/ui` may import the questions in `app/data` in a way a production
  build keeps. In development with no API (`pnpm dev` alone) the page runs the game itself
  with the sample.
- Secrets (API keys, tokens) are put into Cloudflare by the product owner, never into the
  repository or a chat.

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
- `worker/` is the API: plain TypeScript on web standards (`Request`, `Response`), with
  the time handed in. It may import the pure parts of `app/` (`~/game`, `~/data`), never
  the other way round. Its tests run on Node against a real SQLite
  (`worker/testing/d1.ts`). `pnpm api` runs it locally (port 8787); the dev server passes
  `/api` to it.
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
- A page players are sent to builds its `meta` with `pageMeta` and is listed in `PAGES`
  (`app/routes/seo.ts`, where `SITE_URL` is the site's address). `pnpm seo` rewrites the
  link preview's picture, `robots.txt` and the sitemap; `pnpm favicon` the tab icon.
- Import from `app/` with the `~/` alias.
- Tests sit next to the code as `*.test.ts(x)`.
- Run `pnpm check` before calling work done.
