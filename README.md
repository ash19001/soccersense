# soccersense

A free daily survey game: guess the most common answer.

Frontend only for now. There's no backend, API or hosting set up yet.

## Requirements

- Node 26 (see `.nvmrc`)
- pnpm 11

## Getting started

```sh
pnpm install
pnpm dev
```

The dev server runs at http://localhost:5173.

## Scripts

| Command          | What it does                                             |
| ---------------- | -------------------------------------------------------- |
| `pnpm dev`       | Dev server with hot reload                               |
| `pnpm build`     | Production build into `build/client` (static files only) |
| `pnpm preview`   | Serve the production build at http://localhost:4173      |
| `pnpm typecheck` | Generate route types and run TypeScript                  |
| `pnpm lint`      | ESLint                                                   |
| `pnpm format`    | Format everything with Prettier                          |
| `pnpm test`      | Run tests once (`pnpm test:watch` to watch)              |
| `pnpm check`     | Typecheck, lint, format check and tests in one go        |

## Stack

- [React Router](https://reactrouter.com) v8 (framework mode) on [Vite](https://vite.dev)
- React 19 + TypeScript (strict)
- [Tailwind CSS](https://tailwindcss.com) v4
- Vitest + Testing Library, ESLint, Prettier

The app is fully static (`ssr: false`). Every route in `app/routes.ts` is rendered to
HTML at build time, so pages are indexable without a server. Any other URL is served
`build/client/__spa-fallback.html`, which boots the app in the browser.

## Project layout

```
app/
  root.tsx        HTML shell, global error boundary
  routes.ts       Route table
  routes/         One file per page (+ *.test.tsx alongside)
  i18n/           All user-facing text (English only for now)
  app.css         Tailwind entry and design tokens
public/           Static files copied as-is
```

## Deploying (later)

Upload `build/client` to any static host and configure it to serve
`__spa-fallback.html` for paths that don't match a file.
