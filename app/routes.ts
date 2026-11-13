import { type RouteConfig, index, route } from "@react-router/dev/routes";

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
  // The interface gallery: every component in every state. A development aid, not a page
  // players are sent to (it asks search engines not to index it).
  route("dev/ui", "routes/dev-ui.tsx"),
  route("dev/sound", "routes/dev-sound.tsx"), // the sound board (docs/AUDIO.md): every sound and its level
  // The canvas host's test card: PixelStage running a test scene. Also a development aid.
  route("dev/stage", "routes/dev-stage.tsx"),
] satisfies RouteConfig;
