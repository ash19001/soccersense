// The home screen: the menu scene on the canvas (a football in front of a stadium, under the
// player's own sky, an airship whose sign tells the player about their day, and now and
// then a plane towing the fact of the day) with the DOM captions under the ball, the day
// and the daily streak among them.
//
// The page is rendered to HTML at build time, when there is no clock, no address and no
// storage to read. So the first render shows only what never changes (the captions and
// the name), and everything that depends on the day arrives after mounting.
//
// Debug: ?day=<n> (the day's fact and the day's stadium), ?stadium=<id> (see
// app/data/stadiums.ts: it is the game's, not this page's), ?time=HH:MM, and ?speed=<n>,
// which multiplies the scene's time (0.1 is slow motion, for looking at the kick-off).

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { PrefetchPageLinks, useNavigate } from "react-router";

import { STADIUMS } from "~/data";
import { factForDay, type Fact } from "~/data/facts";
import { leaderboardFor } from "~/data/leaderboard";
import { COFFEE_URL, IDEAS_URL, usableLink } from "~/data/links";
import {
  MODES,
  type Mode,
  type PlayedGame,
  type Today,
  EPOCH_UTC,
  MS_PER_DAY,
  loadDay,
  loadHistory,
  msUntilNextDay,
  playPath,
  resolveToday,
  streakFor,
} from "~/game";
import { strings } from "~/i18n";
import { MenuScene } from "~/scenes";
import type { LockedMode } from "~/scenes/menu";
import {
  GameLayout,
  HowToPlay,
  Leaderboard,
  type LeaderboardBoard,
  MenuCaptions,
  Panel,
  PixelStage,
  RemindMe,
  Stats,
  Support,
  arrivingThroughFade,
  fetchHeadingFaces,
  useArrivalFocus,
  useDeviceSky,
  useFadeArrival,
} from "~/ui";
import type { Route } from "./+types/home";
import { signMessages } from "./home-sign";
import { howToPlayContent } from "./how-to-play-card";
import { type StatsContent, statsContent } from "./stats-content";

export const meta: Route.MetaFunction = () => [
  { title: strings.home.title },
  { name: "description", content: strings.home.description },
];

/** How long the "coming soon" plate for a locked mode stays up. */
const NOTICE_MS = 2500;
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
/** What the rules' pop-up says (the "?" button opens it). */
const RULES = howToPlayContent();
/** Where the Support pop-up's buttons go: null while a link is still a placeholder. */
const IDEAS = usableLink(IDEAS_URL);
const COFFEE = usableLink(COFFEE_URL);

/**
 * The entrance plays once per page load: the first time the home screen is shown. This
 * module lives as long as the page, so coming back from another page starts at rest.
 */
let entranceShown = false;

/** What the page knows once it is in a browser. */
interface Matchday {
  today: Today;
  /** The fact of the day, on the plane's banner. */
  fact: Fact;
  /** The address's query, debug overrides and all: carried on to the mode's page. */
  search: string;
  /** Today's saved result per mode, or null if it has not been played. */
  scores: Record<Mode, number | null>;
  /**
   * Each mode's totals on the last seven days, oldest first and today last (null: not
   * played that day), for the leaderboard's strip.
   */
  week: Record<Mode, (number | null)[]>;
  /** The daily streak: days in a row with a finished game, up to today (or yesterday). */
  streak: number;
  /** The streak went up since this device last showed it: it hops, once. */
  bump: boolean;
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
  /** A locked patch was pressed: which mode it is. */
  onLocked(mode: LockedMode): void;
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
 * after mounting. From then on it looks again at midnight UTC (a new day, a new fact)
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
    const fact = factForDay(today.dayNumber);
    const saved = loadDay(today.dayKey);
    const scores = {
      home: saved.home?.total ?? null,
      away: saved.away?.total ?? null,
      retro: saved.retro?.total ?? null,
      nextgen: saved.nextgen?.total ?? null,
    };
    const history = loadHistory(today.dayNumber);
    const days = history.map((game) => game.day);
    const streak = streakFor(days, today.dayNumber).current;
    const week = weekOf(history, today.dayNumber);
    if (
      current &&
      current.today.dayNumber === today.dayNumber &&
      current.fact.id === fact.id &&
      current.search === search &&
      MODES.every((mode) => current?.scores[mode] === scores[mode]) &&
      JSON.stringify(current.week) === JSON.stringify(week) &&
      current.streak === streak
    ) {
      return false;
    }

    // The day seeds the picture, so a new day is a new scene. It arrives at rest.
    let scene = current?.scene;
    if (!scene || current?.today.dayNumber !== today.dayNumber) {
      scene = new MenuScene({
        seed: today.dayNumber,
        fact: fact.text,
        labels: strings.home.canvas,
        // Back from a game through the fade (its MENU), the ball arrives as it fades in.
        intro: !entranceShown || arrivingThroughFade(),
      });
      entranceShown = true;
      scene.onHover = (mode) => listener?.onHover(mode);
      scene.onKickoff = (mode) => {
        chosen = true;
        listener?.onKickoff(mode);
      };
      scene.onChoose = (mode) => listener?.onChoose(mode);
      scene.onLocked = (mode) => listener?.onLocked(mode);
    } else {
      scene.setFact(fact.text);
    }
    scene.setScores(scores);
    // The airship's sign: the player's day, one message after another.
    scene.setSignMessages(signMessages(today.dayNumber, scores, streak));
    // The streak hops the first time it is seen after it went up (remembered per device).
    const seen = readStreakSeen();
    if (streak !== seen) writeStreakSeen(streak);
    current = {
      today,
      fact,
      search,
      scores,
      week,
      streak,
      bump: streak > seen,
      scene,
      speed: speedFrom(search),
    };
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

/** Where this device remembers the last streak it showed, for the hop when it goes up. */
const STREAK_SEEN = "soccersense:streak-seen";

function readStreakSeen(): number {
  try {
    const n = Number(window.localStorage.getItem(STREAK_SEEN));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function writeStreakSeen(days: number): void {
  try {
    window.localStorage.setItem(STREAK_SEEN, String(days));
  } catch {
    // no storage: it hops again next time, which is no harm
  }
}

/** Rows of the day's table on the home screen. */
const TOP = 10;
/** Days in the leaderboard's strip of the player's own totals, today included. */
const WEEK = 7;

/** Each mode's totals on the last WEEK days up to `today`, oldest first (null: not played). */
function weekOf(
  history: readonly PlayedGame[],
  today: number,
): Record<Mode, (number | null)[]> {
  const week = Object.fromEntries(
    MODES.map((mode) => [mode, Array<number | null>(WEEK).fill(null)]),
  ) as Record<Mode, (number | null)[]>;
  for (const game of history) {
    const i = game.day - (today - WEEK + 1);
    if (i >= 0 && i < WEEK && week[game.mode]) week[game.mode][i] = game.total;
  }
  return week;
}

/** The weekday (0 Sunday) of a game day, day 1 and before too: days change at midnight UTC. */
function weekdayOf(day: number): number {
  return new Date(EPOCH_UTC + (day - 1) * MS_PER_DAY).getUTCDay();
}

/**
 * Today's top ten for each mode, the player placed in it if they have played (mock data for
 * now: `leaderboardFor` in app/data/leaderboard.ts, which a backend will replace).
 */
function leaderboards(
  day: number,
  scores: Record<Mode, number | null>,
  week: Record<Mode, readonly (number | null)[]> | null,
): LeaderboardBoard[] {
  const text = strings.home.leaderboard;
  return MODES.map((mode) => {
    const board = leaderboardFor(day, mode, scores[mode]);
    const top = board.rows.slice(0, TOP);
    const mine =
      board.yourRank === null ? null : board.rows.find((row) => row.you);
    const label = strings.home.modes[mode].label;
    return {
      mode,
      label,
      caption: text.caption(label),
      played: text.played(board.total),
      rows: top.map((row) => ({
        rank: row.rank,
        name: row.name,
        points: row.total,
        you: row.you,
      })),
      you:
        mine && !top.includes(mine)
          ? { rank: mine.rank, name: "", points: mine.total, you: true }
          : null,
      youSpoken:
        board.yourRank === null
          ? undefined
          : text.youSpoken(board.yourRank, board.total),
      mine:
        board.yourRank === null
          ? text.nudge(board.total)
          : text.mine(board.yourRank, board.total),
      week: week ? weekBoard(day, label, week[mode]) : undefined,
    };
  });
}

/** The strip of the player's last seven days in one mode, from its totals. */
function weekBoard(
  today: number,
  label: string,
  totals: readonly (number | null)[],
): LeaderboardBoard["week"] {
  const text = strings.home.leaderboard;
  const days = totals.map((total, i) => {
    const weekday = weekdayOf(today - totals.length + 1 + i);
    return {
      label: text.weekdays[weekday],
      total,
      today: i === totals.length - 1,
      spoken: text.daySpoken(text.weekdaysSpoken[weekday], total),
    };
  });
  return {
    heading: text.week,
    days: days.map((d) => ({ label: d.label, total: d.total, today: d.today })),
    spoken: text.weekSpoken(label, days.map((d) => d.spoken).join(", ")),
  };
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
  const [notice, setNotice] = useState<{
    count: number;
    shown: boolean;
    mode: LockedMode;
  }>({ count: 0, shown: false, mode: "closest" });
  /**
   * The mode whose page is worth fetching already: the last one pointed at or chosen. Its
   * code is then there when the kick-off ends, and the ink it ends on is one frame long.
   */
  const [warm, setWarm] = useState<Mode | null>(null);
  /** The page has moved on. Nothing is chosen twice. */
  const left = useRef(false);
  // Coming back from another page, the name takes the focus: a screen reader reads it.
  const heading = useArrivalFocus<HTMLHeadingElement>();
  /** The rules are up, over the menu: the "?" button opens them. */
  const [help, setHelp] = useState(false);
  const helpButton = useRef<HTMLButtonElement | null>(null);
  /** The stats are up, over the menu, with what they say (read from storage on opening). */
  const [stats, setStats] = useState<StatsContent | null>(null);
  const statsButton = useRef<HTMLButtonElement | null>(null);
  /** The daily reminder's pop-up is up (the bell opens it), and Support's (the heart). */
  const [remind, setRemind] = useState(false);
  const remindButton = useRef<HTMLButtonElement | null>(null);
  const [support, setSupport] = useState(false);
  const supportButton = useRef<HTMLButtonElement | null>(null);

  const streak = matchday?.streak ?? null;
  const bump = matchday?.bump ?? false;

  // Back from a game through the fade: the ink goes once the picture is up.
  useFadeArrival(scene !== null && sky !== null);

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
          pathname: playPath(mode),
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
      onLocked(mode) {
        setNotice((n) => ({ count: n.count + 1, shown: true, mode }));
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
  const fact = matchday?.fact ?? null;
  const day = matchday?.today.dayNumber ?? null;
  const scores = matchday?.scores ?? null;
  const week = matchday?.week ?? null;
  const boards = useMemo(
    () =>
      day === null || scores === null ? null : leaderboards(day, scores, week),
    [day, scores, week],
  );
  // The tab shown first: the mode played today, if only one was (the player wants to see
  // where they came), else HOME.
  const played = scores ? MODES.filter((mode) => scores[mode] !== null) : [];
  const firstTab: Mode = played.length === 1 ? played[0] : "home";
  /** The player's stats, read from storage on the press, never while rendering. */
  const openStats = () => {
    const today = store.read()?.today.dayNumber;
    if (today !== undefined) setStats(statsContent(today));
  };

  return (
    <main>
      <GameLayout
        canvas={
          <PixelStage
            className="touch-none"
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
                short: text.short[mode],
                tiny: text.tiny[mode],
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
            notice={notice.shown ? text.soon[notice.mode] : null}
            noticeKey={notice.count}
            stowed={stowed}
            howToPlay={{
              label: strings.howToPlay.title,
              // The rules open over the menu (HowToPlay below).
              onClick: () => setHelp(true),
              open: help,
            }}
            howToPlayRef={helpButton}
            stats={{
              label: strings.stats.open,
              onClick: openStats,
              open: stats !== null,
            }}
            statsRef={statsButton}
            remind={{
              label: strings.remind.open,
              onClick: () => setRemind(true),
              open: remind,
            }}
            remindRef={remindButton}
            support={{
              label: strings.support.open,
              onClick: () => setSupport(true),
              open: support,
            }}
            supportRef={supportButton}
            dayLabel={
              matchday ? text.day(matchday.today.dayNumber) : text.dayPending
            }
            // no streak yet: nothing (a cold grey flame read as a drop of water)
            streak={
              streak === null || streak <= 0
                ? undefined
                : {
                    days: streak,
                    spoken: text.streak.spoken(streak),
                    title: text.streak.title,
                    bump,
                  }
            }
          />
        }
      >
        {/* The logo, the banner and the sign are only pixels: these are for screen readers. */}
        <h1 ref={heading} tabIndex={-1} className="ss-sr">
          {strings.siteName}
        </h1>
        {fact && <p className="ss-sr">{text.fact(fact.text)}</p>}
        {/* Known once the day is: nothing of it is in the build-time page. */}
        {boards && (
          <Leaderboard
            boards={boards}
            labels={text.leaderboard}
            initialMode={firstTab}
            stowed={stowed}
            onStats={openStats}
          />
        )}
        {/* With no script there is no picture and no game: the page says what it is. */}
        <noscript>
          <Panel>
            <p className="ss-t20">{strings.siteName}</p>
            <p>{text.description}</p>
          </Panel>
        </noscript>
        {warm && <PrefetchPageLinks page={playPath(warm)} />}
        {/* A modal dialog: while it is up nothing behind it, the ball included, can be reached. */}
        <HowToPlay
          {...RULES}
          open={help}
          onClose={() => setHelp(false)}
          returnFocus={helpButton}
        />
        {stats && (
          <Stats
            {...stats}
            open
            onClose={() => setStats(null)}
            returnFocus={statsButton}
          />
        )}
        <RemindMe
          labels={strings.remind}
          open={remind}
          onClose={() => setRemind(false)}
          returnFocus={remindButton}
        />
        <Support
          labels={strings.support}
          ideas={IDEAS}
          coffee={COFFEE}
          open={support}
          onClose={() => setSupport(false)}
          returnFocus={supportButton}
        />
      </GameLayout>
    </main>
  );
}
