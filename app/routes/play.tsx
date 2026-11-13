// The mode pages, /play/home, /play/away, /play/retro and /play/next-gen: one module,
// registered once per mode in app/routes.ts. The game itself is in ./play/: the screen
// (Game.tsx), the referee that runs the rules, the clock and the scene (controller.ts),
// and the game kept in storage as it goes (progress.ts).
//
// The page is rendered to HTML at build time, when there is no clock, no address and no
// storage: that HTML is the ink the home screen's kick-off ends on, with the page's
// heading for screen readers. The game arrives after mounting.
//
// Debug: ?day=<n>, ?stadium=<id>, ?time=HH:MM and ?notimer=1, as on the home page.

import { type MetaFunction, useLocation } from "react-router";

import { type Mode, modeOfPath } from "~/game";
import { strings } from "~/i18n";
import { Game } from "./play/Game";

/** The mode is the last part of the address (`playPath` the other way round). */
function modeFor(pathname: string): Mode {
  return modeOfPath(pathname);
}

export const meta: MetaFunction = ({ location }) => {
  const mode = modeFor(location.pathname);
  return [
    { title: strings.play.title[mode] },
    { name: "description", content: strings.play.description[mode] },
  ];
};

export default function Play() {
  const mode = modeFor(useLocation().pathname);
  // One game per mode: going from one mode's full time to the other starts afresh.
  return <Game key={mode} mode={mode} />;
}
