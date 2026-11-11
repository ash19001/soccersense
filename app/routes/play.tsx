// The two mode pages, /play/home and /play/away: one module, registered twice in
// app/routes.ts. The game itself is the next milestone, so for now this is a placeholder in
// the game's skin on an ink background (the home screen's kick-off ends on ink, so the cut
// from one to the other is seamless). It will be replaced.

import { useState, useSyncExternalStore } from "react";
import { type MetaFunction, useLocation } from "react-router";

import { STADIUMS } from "~/data";
import { type Mode, type Today, resolveToday } from "~/game";
import { strings } from "~/i18n";
import { Button, ModeBadge, Panel, PixelRoot, useArrivalFocus } from "~/ui";

/** The mode is the last part of the address. */
function modeFor(pathname: string): Mode {
  return /\/away\/?$/.test(pathname) ? "away" : "home";
}

export const meta: MetaFunction = ({ location }) => {
  const mode = modeFor(location.pathname);
  return [
    { title: strings.play.title[mode] },
    { name: "description", content: strings.play.description[mode] },
  ];
};

/** What the page knows once it is in a browser: the day, and the address's query. */
interface Matchday {
  today: Today;
  /** Debug overrides and all (`?day=`, `?stadium=`, `?time=`): carried back to the menu. */
  search: string;
}

interface MatchdayStore {
  subscribe(onChange: () => void): () => void;
  read(): Matchday | null;
}

/** One per page: nothing is read until React subscribes, which is after mounting. */
function createMatchdayStore(): MatchdayStore {
  let current: Matchday | null = null;
  return {
    subscribe(onChange) {
      if (current === null) {
        const search = window.location.search;
        current = { today: resolveToday(new Date(), search, STADIUMS), search };
        onChange();
      }
      return () => {};
    },
    read: () => current,
  };
}

function serverMatchday(): null {
  return null;
}

export default function Play() {
  const mode = modeFor(useLocation().pathname);
  // `null` at build time and on the first render: the day is only known in the browser.
  const [store] = useState(createMatchdayStore);
  const matchday = useSyncExternalStore(
    store.subscribe,
    store.read,
    serverMatchday,
  );
  const stadium = matchday?.today.stadium ?? null;
  const text = strings.play;
  // The kick-off ends here: the heading takes the focus, and a screen reader reads it.
  const heading = useArrivalFocus<HTMLHeadingElement>();

  return (
    <PixelRoot
      className="ss-page flex flex-col items-center justify-center"
      data-mode={mode}
    >
      {/* As wide as the game's own column: 135 logical pixels, or 405 font pixels if more. */}
      <main className="flex w-full max-w-[max(calc(var(--px)*135),calc(var(--fp)*405))] flex-col gap-[var(--u5)]">
        <Panel className="flex flex-col items-start gap-[var(--u3)]">
          <ModeBadge mode={mode} label={strings.home.modes[mode].label} />
          <h1 ref={heading} tabIndex={-1} className="ss-t20">
            {text.heading[mode]}
          </h1>
          <p>{text.rule[mode]}</p>
          {/* The lines keep their height while the stadium is not known yet. */}
          <div>
            <p className="text-[var(--c-mist)]">{text.stadiumHeader}</p>
            <p className="ss-t15 text-[var(--c-amber)]">
              {stadium ? stadium.name : "\u00a0"}
            </p>
            <p>
              {stadium ? text.place(stadium.city, stadium.country) : "\u00a0"}
            </p>
          </div>
          <p>{text.building}</p>
        </Panel>
        <Button
          variant="primary"
          full
          to={matchday ? `/${matchday.search}` : "/"}
        >
          {text.back}
        </Button>
      </main>
    </PixelRoot>
  );
}
