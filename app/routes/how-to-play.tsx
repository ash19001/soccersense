// The rules at their old address. The "?" on the home screen now opens them as a pop-up
// (HowToPlay in ~/ui); this page keeps old links working with the same card, on ink in the
// game's skin: a PixelRoot (so its type is on whole device pixels at any display scaling),
// the card in the middle (two columns on a monitor, one on a phone), and the way back to
// the ball where the pop-up has its close button. It is a page of its own, not the home screen with the pop-up open, because the
// site is prerendered: this way its HTML carries the whole of the rules (no script needed,
// and nothing for a search engine to miss), and nothing about the router is bent to make
// one address show another's page.

import { useSyncExternalStore } from "react";

import { strings } from "~/i18n";
import { HowToPlayCard, IconButton, PixelRoot, useArrivalFocus } from "~/ui";
import type { Route } from "./+types/how-to-play";
import { howToPlayContent } from "./how-to-play-card";

export const meta: Route.MetaFunction = () => [
  { title: `${strings.howToPlay.title} · ${strings.siteName}` },
  { name: "description", content: strings.howToPlay.description },
];

// The address's query (the debug overrides `?day=`, `?stadium=`, `?time=`) is carried back
// to the menu. It is not known at build time, so it is read after mounting.
function subscribeToNothing(): () => void {
  return () => {};
}
const searchNow = () => window.location.search;
const noSearch = () => "";

/** The same card as the pop-up on the home screen. */
const RULES = howToPlayContent();

export default function HowToPlay() {
  const search = useSyncExternalStore(subscribeToNothing, searchNow, noSearch);
  const heading = useArrivalFocus<HTMLHeadingElement>();

  return (
    <PixelRoot className="ss-page flex flex-col justify-center">
      <main className="ss-help-page">
        <HowToPlayCard
          {...RULES}
          headingLevel={1}
          headingRef={heading}
          // Where the pop-up has its close button: the way back to the ball.
          action={
            <IconButton
              icon="close"
              label={strings.play.back}
              to={`/${search}`}
              className="ss-help__close"
            />
          }
        />
      </main>
    </PixelRoot>
  );
}
