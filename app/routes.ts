import { type RouteConfig, index, route } from "@react-router/dev/routes";

/**
 * The development pages: aids for building the game, not pages for players. They exist on
 * the dev server (`pnpm dev`) and in the tests, and are left out of the built site
 * altogether, so the live site answers their addresses as it does any that is not a page
 * (the product owner, 2026-11-17: "why can i access links like /dev/sound on prod. i
 * thought that was for dev only"; until then they were built and deployed, asking only not
 * to be indexed).
 */
const DEVELOPMENT_PAGES = [
  // The interface gallery: every component in every state.
  route("dev/ui", "routes/dev-ui.tsx"),
  // The sound board (docs/AUDIO.md): every sound and its level.
  route("dev/sound", "routes/dev-sound.tsx"),
  // The canvas host's test card: PixelStage running a test scene.
  route("dev/stage", "routes/dev-stage.tsx"),
];

/**
 * The site is being built to be deployed: this file is being read by `react-router build`.
 * By the command, not by NODE_ENV: `react-router typegen` (part of `pnpm check`) also runs
 * as "production", and it has to see the development pages to make their types.
 */
const built = process.argv.includes("build");

export default [
  index("routes/home.tsx"),
  // The four modes. Static paths, not a `:mode` parameter: the site is prerendered, so each
  // page has to exist as a file. One module serves them all and reads the mode from the
  // address (`modeOfPath` in ~/game; `playPath(mode)` gives a mode's address).
  route("play/home", "routes/play.tsx", { id: "play-home" }),
  route("play/away", "routes/play.tsx", { id: "play-away" }),
  route("play/retro", "routes/play.tsx", { id: "play-retro" }),
  route("play/next-gen", "routes/play.tsx", { id: "play-nextgen" }),
  // NEXT-GEN's id as an address too, so `/play/${mode}` reaches it as it does the others.
  route("play/nextgen", "routes/play.tsx", { id: "play-nextgen-id" }),
  route("how-to-play", "routes/how-to-play.tsx"),
  // The privacy notice and the terms.
  route("privacy", "routes/privacy.tsx"),
  route("terms", "routes/terms.tsx"),
  // The approval desk for the day's questions: the product owner's page, on the live site
  // (it is where they work), useless without the admin token, and not listed anywhere.
  route("admin", "routes/admin.tsx"),
  // Where signing in lands: the page a sign-in link opens, and where a trip to Google ends.
  route("enter", "routes/enter.tsx"),
  ...(built ? [] : DEVELOPMENT_PAGES),
] satisfies RouteConfig;
