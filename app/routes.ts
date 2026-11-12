import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  // The two modes. Static paths, not a `:mode` parameter: the site is prerendered, so each
  // page has to exist as a file. One module serves both and reads the mode from the address.
  route("play/home", "routes/play.tsx", { id: "play-home" }),
  route("play/away", "routes/play.tsx", { id: "play-away" }),
  route("how-to-play", "routes/how-to-play.tsx"),
  // The interface gallery: every component in every state. A development aid, not a page
  // players are sent to (it asks search engines not to index it).
  route("dev/ui", "routes/dev-ui.tsx"),
  route("dev/sound", "routes/dev-sound.tsx"), // the sound board (docs/AUDIO.md): every sound and its level
  // The canvas host's test card: PixelStage running a test scene. Also a development aid.
  route("dev/stage", "routes/dev-stage.tsx"),
] satisfies RouteConfig;
