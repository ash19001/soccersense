// The home screen: the menu scene on the canvas (a football in front of today's stadium,
// under the player's own sky) with the DOM captions under the ball.
//
// The page is rendered to HTML at build time, when there is no clock, no address and no
// storage to read. So the first render shows only what never changes (the captions and
// the name), and everything that depends on the day arrives after mounting.
//
// Debug: ?day=<n>, ?stadium=<id> (see app/data/stadiums.ts), ?time=HH:MM, and ?speed=<n>,
// which multiplies the scene's time (0.1 is slow motion, for looking at the kick-off).

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PrefetchPageLinks, useNavigate } from "react-router";

import { STADIUMS } from "~/data";
import {
  type Mode,
  type Today,
  loadDay,
  msUntilNextDay,
  resolveToday,
} from "~/game";
import { strings } from "~/i18n";
import { MenuScene } from "~/scenes";
import {
  GameLayout,
  MenuCaptions,
  Panel,
  PixelStage,
  fetchHeadingFaces,
  useArrivalFocus,
  useDeviceSky,
} from "~/ui";
import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => [
  { title: strings.home.title },
  { name: "description", content: strings.home.description },
];

/** How long the "more modes are coming" plate stays up. */
const NOTICE_MS = 2000;
/**
 * The scene says when its kick-off is over. If it never does (no canvas to run it on),
 * the page moves on by itself after this long.
 */
const KICKOFF_PATIENCE_MS = 6000;
/**
 * The page has asked to move on. If it is still here this much later, that went nowhere
 * (the mode's page could not be fetched, say): the menu comes back instead of leaving the
 * player on the ink the kick-off ends on.
 */
const STRANDED_MS = 8000;
/**
 * Every other page's heading is set in a face this page never uses. It is fetched this
 * long after the menu is up (not to compete with the picture for the network), or at
 * once when a mode is pointed at or chosen, so the next page has it when it arrives.
 */
const FACES_AFTER_MS = 1500;
const MODES: readonly Mode[] = ["home", "away"];

/**
 * The entrance plays once per page load: the first time the home screen is shown. This
 * module lives as long as the page, so coming back from another page starts at rest.
 */
let entranceShown = false;

/** What the page knows once it is in a browser. */
interface Matchday {
  today: Today;
  /** The address's query, debug overrides and all: carried on to the mode's page. */
  search: string;
  /** Today's saved result per mode, or null if it has not been played. */
  scores: Record<Mode, number | null>;
  scene: MenuScene;
  /** `?speed=`: how fast the scene's time runs. 1 unless asked. */
  speed: number;
}

/** `?speed=0.1`: anything that is not a number from 0 to 16 is 1. */
function speedFrom(search: string): number {
  const text = new URLSearchParams(search).get("speed");
  const speed = text === null || text.trim() === "" ? 1 : Number(text);
  return Number.isFinite(speed) && speed >= 0 && speed <= 16 ? speed : 1;
}

/** What the scene tells the page. */
interface MenuEvents {
  /** The pointer's hover on the ball changed. */
  onHover(mode: Mode | null): void;
  /** A mode was chosen, on the ball or from the captions: the kick-off starts now. */
  onKickoff(mode: Mode): void;
  /** The kick-off is over. */
  onChoose(mode: Mode): void;
  /** A locked patch was pressed. */
  onLocked(): void;
}

interface MatchdayStore {
  subscribe(onChange: () => void): () => void;
  read(): Matchday | null;
  /** Hear from whichever scene is up. Returns the way to stop listening. */
  listen(events: MenuEvents): () => void;
  /** The page is still here after a kick-off: the scene back at rest, ready to choose. */
  reset(): void;
}

/**
 * One per page. Nothing is read and no scene is made until React subscribes, which is
 * after mounting. From then on it looks again at midnight UTC (a new day, a new stadium)
 * and whenever the tab comes back into view (a game may have been played in another).
 */
function createMatchdayStore(): MatchdayStore {
  let current: Matchday | null = null;
  let listener: MenuEvents | null = null;
  /**
   * A mode has been chosen (`onKickoff`). The scene's phase does not always say so: a mode
   * chosen during the entrance is struck only when the ball has settled, and until then the
   * phase is still "intro".
   */
  let chosen = false;

  /** True if anything changed. */
  const refresh = (): boolean => {
    // A kick-off is on its way to another page: leave its scene alone.
    const phase = current?.scene.phase;
    if (chosen || phase === "kickoff" || phase === "done") return false;

    const search = window.location.search;
    const today = resolveToday(new Date(), search, STADIUMS);
    const saved = loadDay(today.dayKey);
    const scores = {
      home: saved.home?.total ?? null,
      away: saved.away?.total ?? null,
    };
    if (
      current &&
      current.today.dayNumber === today.dayNumber &&
      current.today.stadium.id === today.stadium.id &&
      current.search === search &&
      current.scores.home === scores.home &&
      current.scores.away === scores.away
    ) {
      return false;
    }

    // The day seeds the picture, so a new day is a new scene. It arrives at rest.
    let scene = current?.scene;
    if (!scene || current?.today.dayNumber !== today.dayNumber) {
      scene = new MenuScene({
        seed: today.dayNumber,
        stadium: today.stadium,
        labels: strings.home.canvas,
        intro: !entranceShown,
      });
      entranceShown = true;
      scene.onHover = (mode) => listener?.onHover(mode);
      scene.onKickoff = (mode) => {
        chosen = true;
        listener?.onKickoff(mode);
      };
      scene.onChoose = (mode) => listener?.onChoose(mode);
      scene.onLocked = () => listener?.onLocked();
    } else if (current?.today.stadium.id !== today.stadium.id) {
      scene.setStadium(today.stadium);
    }
    scene.setScores(scores);
    current = { today, search, scores, scene, speed: speedFrom(search) };
    return true;
  };

  return {
    subscribe(onChange) {
      const look = () => {
        if (refresh()) onChange();
      };
      let timer = 0;
      const waitForMidnight = () => {
        timer = window.setTimeout(
          () => {
            look();
            waitForMidnight();
          },
          msUntilNextDay(new Date()) + 1000,
        );
      };
      const onVisibility = () => {
        if (document.visibilityState !== "hidden") look();
      };
      document.addEventListener("visibilitychange", onVisibility);
      waitForMidnight();
      // The first value: React is told like any other change, and renders again with it.
      look();
      return () => {
        window.clearTimeout(timer);
        document.removeEventListener("visibilitychange", onVisibility);
      };
    },
    read: () => current,
    listen(events) {
      listener = events;
      return () => {
        if (listener === events) listener = null;
      };
    },
    reset() {
      chosen = false;
      current?.scene.reset();
    },
  };
}

function serverMatchday(): null {
  return null;
}

export default function Home() {
  const navigate = useNavigate();
  const sky = useDeviceSky();
  // `null` at build time and on the first render.
  const [store] = useState(createMatchdayStore);
  const matchday = useSyncExternalStore(
    store.subscribe,
    store.read,
    serverMatchday,
  );
  const scene = matchday?.scene ?? null;
  const moonPhase = sky?.moonPhase;

  /** The mode whose patch on the ball is under the pointer. */
  const [lit, setLit] = useState<Mode | null>(null);
  /** The kick-off is on: the captions are out of the way. */
  const [stowed, setStowed] = useState(false);
  const [notice, setNotice] = useState({ count: 0, shown: false });
  /**
   * The mode whose page is worth fetching already: the last one pointed at or chosen. Its
   * code is then there when the kick-off ends, and the ink it ends on is one frame long.
   */
  const [warm, setWarm] = useState<Mode | null>(null);
  /** The page has moved on. Nothing is chosen twice. */
  const left = useRef(false);
  // Coming back from another page, the name takes the focus: a screen reader reads it.
  const heading = useArrivalFocus<HTMLHeadingElement>();

  useEffect(() => {
    if (scene && moonPhase !== undefined) scene.setMoonPhase(moonPhase);
  }, [scene, moonPhase]);

  // The next page's heading face: see FACES_AFTER_MS.
  const ready = matchday !== null;
  const pointed = warm !== null;
  useEffect(() => {
    if (!ready) return;
    if (pointed) {
      fetchHeadingFaces();
      return;
    }
    const timer = window.setTimeout(fetchHeadingFaces, FACES_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [ready, pointed]);

  // What the scene tells the page.
  useEffect(() => {
    let patience = 0;
    let stranded = 0;
    // Still here: put the menu back as it was, ready to be chosen from again.
    const comeBack = () => {
      window.clearTimeout(stranded);
      if (!left.current) return;
      left.current = false;
      store.reset();
      setStowed(false);
    };
    const leave = (mode: Mode) => {
      window.clearTimeout(patience);
      if (left.current) return;
      left.current = true;
      stranded = window.setTimeout(comeBack, STRANDED_MS);
      // Leaving unmounts this page, and the cleanup below stops that clock.
      void Promise.resolve(
        navigate({
          pathname: `/play/${mode}`,
          search: window.location.search,
        }),
      ).catch(comeBack);
    };
    const stop = store.listen({
      onHover(mode) {
        setLit(mode);
        if (mode) setWarm(mode);
      },
      onKickoff(mode) {
        setStowed(true);
        setLit(null);
        setWarm(mode);
        setNotice((n) => (n.shown ? { ...n, shown: false } : n));
        window.clearTimeout(patience);
        // In slow motion (?speed=) the kick-off takes that much longer.
        const speed = store.read()?.speed ?? 1;
        const slow = speed > 0 && speed < 1 ? 1 / speed : 1;
        patience = window.setTimeout(
          () => leave(mode),
          KICKOFF_PATIENCE_MS * slow,
        );
      },
      onChoose: leave,
      onLocked() {
        setNotice((n) => ({ count: n.count + 1, shown: true }));
      },
    });
    return () => {
      window.clearTimeout(patience);
      window.clearTimeout(stranded);
      stop();
    };
  }, [store, navigate]);

  // The plate takes itself down again. A second press starts the wait afresh.
  useEffect(() => {
    if (!notice.shown) return;
    const timer = window.setTimeout(() => {
      setNotice((n) => ({ ...n, shown: false }));
    }, NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice.count, notice.shown]);

  const text = strings.home;
  const stadium = matchday?.today.stadium ?? null;

  return (
    <main>
      <GameLayout
        canvas={
          <PixelStage
            scene={scene}
            light={sky?.light ?? null}
            timeScale={matchday?.speed ?? 1}
          />
        }
        bottom={
          <MenuCaptions
            modes={MODES.map((mode) => {
              const score = matchday?.scores[mode] ?? null;
              return {
                mode,
                label: text.modes[mode].label,
                line: text.modes[mode].line,
                score,
                scoreSpoken: score === null ? undefined : text.played(score),
              };
            })}
            onSelect={(mode) => scene?.choose(mode)}
            onHover={(mode) => {
              scene?.setHovered(mode);
              if (mode) setWarm(mode);
            }}
            lit={lit}
            notice={notice.shown ? text.locked : null}
            noticeKey={notice.count}
            stowed={stowed}
            howToPlay={{
              label: strings.howToPlay.title,
              // The debug overrides go along, and the rules page brings them back.
              to: `/how-to-play${matchday?.search ?? ""}`,
            }}
            dayLabel={
              matchday ? text.day(matchday.today.dayNumber) : text.dayPending
            }
          />
        }
      >
        {/* The logo and the stadium sign are only pixels: these are for screen readers. */}
        <h1 ref={heading} tabIndex={-1} className="ss-sr">
          {strings.siteName}
        </h1>
        {stadium && (
          <p className="ss-sr">
            {text.stadium(stadium.name, stadium.city, stadium.country)}
          </p>
        )}
        {/* With no script there is no picture and no game: the page says what it is. */}
        <noscript>
          <Panel>
            <p className="ss-t20">{strings.siteName}</p>
            <p>{text.description}</p>
          </Panel>
        </noscript>
        {warm && <PrefetchPageLinks page={`/play/${warm}`} />}
      </GameLayout>
    </main>
  );
}
