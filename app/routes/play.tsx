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

import {
  type LinksFunction,
  type MetaFunction,
  useLocation,
} from "react-router";

import jersey20Latin from "@fontsource/jersey-20/files/jersey-20-latin-400-normal.woff2?url";
import jersey25Latin from "@fontsource/jersey-25/files/jersey-25-latin-400-normal.woff2?url";

import { type Mode, modeOfPath, playPath } from "~/game";
import { strings } from "~/i18n";
import { Game } from "./play/Game";
import { pageMeta } from "./seo";

/** The mode is the last part of the address (`playPath` the other way round). */
function modeFor(pathname: string): Mode {
  return modeOfPath(pathname);
}

export const meta: MetaFunction = ({ location }) => {
  const mode = modeFor(location.pathname);
  // The address the mode is known by: /play/nextgen is filed under /play/next-gen.
  return pageMeta({
    path: playPath(mode),
    title: strings.play.title[mode],
    description: strings.play.description[mode],
  });
};

/**
 * The mode card's own face, fetched with the page: the card is the first thing a mode page
 * shows, and its name is set in Jersey 20 on a phone and Jersey 25 on a monitor (ui.css,
 * section 30), neither of which the site preloads. Without this the name shows in the
 * fallback face until the face has come, then changes size. The larger face is only asked
 * for where the card can be a monitor's (about `isWide`: a landscape window at least 600
 * px wide); a guess that is wrong costs one face fetched early, or late as before.
 */
export const links: LinksFunction = () => [
  {
    rel: "preload",
    href: jersey20Latin,
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
    // ("not all and ...": the old way to write "not (...)", which Safari before 16.4 and
    // Chrome before 104 cannot read and take for "never")
    media: "not all and (orientation: landscape) and (min-width: 600px)",
  },
  {
    rel: "preload",
    href: jersey25Latin,
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
    media: "(orientation: landscape) and (min-width: 600px)",
  },
];

export default function Play() {
  const mode = modeFor(useLocation().pathname);
  // One game per mode: going from one mode's full time to the other starts afresh.
  return <Game key={mode} mode={mode} />;
}
