// The rules page, behind the "?" button of the home screen. A plain page on ink in the
// game's skin: a PixelRoot (so its type is on whole device pixels at any display scaling)
// with one panel in the game's own column, and the way back to the ball.

import { useSyncExternalStore } from "react";

import { strings } from "~/i18n";
import { Button, Panel, PixelRoot, useArrivalFocus } from "~/ui";
import type { Route } from "./+types/how-to-play";

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

export default function HowToPlay() {
  const search = useSyncExternalStore(subscribeToNothing, searchNow, noSearch);
  const heading = useArrivalFocus<HTMLHeadingElement>();

  return (
    <PixelRoot className="ss-page flex flex-col items-center justify-center">
      {/* As wide as the game's own column: 135 logical pixels, or 405 font pixels if more. */}
      <main className="flex w-full max-w-[max(calc(var(--px)*135),calc(var(--fp)*405))] flex-col gap-[var(--u5)]">
        <Panel className="flex flex-col items-start gap-[var(--u3)]">
          <h1 ref={heading} tabIndex={-1} className="ss-t20">
            {strings.howToPlay.title}
          </h1>
          <p>{strings.howToPlay.description}</p>
        </Panel>
        <Button variant="primary" full to={`/${search}`}>
          {strings.play.back}
        </Button>
      </main>
    </PixelRoot>
  );
}
