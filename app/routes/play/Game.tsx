// The game screen: the career scene on the canvas, the scoreboard at the top, and at the
// bottom the answer bar, the reveal sheet or the full-time card. Before a new game, the
// mode card alone, on the ink the page arrives on. The rules and the timing
// live in the controller (./controller.ts); this only draws what it says and passes the
// player's moves back. Every word comes from `strings.play`.
//
// The site's server runs the game (`serverRuns`): the page is sent each question as it is
// asked and each reveal once it is decided, and has no answers of its own.

import {
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { useLocation, useNavigate } from "react-router";

import type { Place } from "~/data/places";
import { STADIUMS } from "~/data/stadiums";
import {
  ACCOUNT_KEY,
  type Grade,
  MAX_TOTAL,
  type Mode,
  PLAYER_KEY,
  type RankedAnswer,
  type RevealRow,
  type RevealView,
  QUESTION_MS,
  STORAGE_PREFIX,
  clockView,
  formatDistanceShort,
  formatShare,
  isDistanceMode,
  isEraMode,
  isPerfect,
  isShot,
  parseOverrides,
  pips,
  playPath,
  progressFor,
  questionView,
  resolveToday,
  results,
  revealFor,
} from "~/game";
import { strings } from "~/i18n";
import {
  AnswerBar,
  Board,
  FullTimeCard,
  type ClockStatus,
  GameLayout,
  type LeagueEntry,
  ModeIntro,
  Panel,
  PixelStage,
  RevealSheet,
  type RevealYours,
  fadeThrough,
  gameClock,
  gameSearch,
  useArrivalFocus,
  useDeviceSky,
} from "~/ui";
import {
  GameController,
  type GameView,
  tierName,
  titleName,
} from "./controller";
import { FirstGameCheck } from "../first-check";
import { watchCeiling } from "../scene-edges";
import { dayPlace } from "~/ui/day-place";
import { gameServer } from "./server";

const text = strings.play;

/** Under this share of players, an answer is a lonely one: the reveal says so. */
export const LONELY_SHARE = 2;

/**
 * The mode card, before the page's code has loaded.
 *
 * A mode page's build-time HTML is ink: the card only came once all the page's code had
 * run and the server had said what day it is, seconds later on a phone (Lighthouse's phone,
 * 2026-11-19: the card, the page's largest paint, at 5.2 s). But a device that has never
 * played is always shown the card first, whatever the day, so the build-time HTML carries
 * the card out of sight (`ModeIntro`'s `early`) and this script, first inside it, shows it
 * at once on such a device: one with no player and no account noted and no game kept, of
 * any day or mode (the keys of ~/game's storage). That is never more than the referee's own
 * test for a new game (controller.ts, `fresh`), so the card it shows is the card the game
 * then opens with: the same element, which stays up until the game takes it away. On any
 * other device the card stays out of sight until the page knows what the player's game is.
 * A device whose storage cannot be read has nothing kept either, and is shown the card.
 */
export const EARLY_CARD = [
  "(function(){",
  "var e=document.currentScript,s,i,k;",
  "if(!e||!(e=e.parentElement))return;",
  "try{",
  "s=localStorage;",
  `if(s.getItem(${JSON.stringify(PLAYER_KEY)})!==null||s.getItem(${JSON.stringify(ACCOUNT_KEY)})!==null)return;`,
  // a game kept: `soccersense:v1:<YYYY-MM-DD>:<mode>`, finished or in progress
  `for(i=0;i<s.length;i++){k=s.key(i)||"";if(k.indexOf(${JSON.stringify(`${STORAGE_PREFIX}:`)})===0&&k.charCodeAt(${STORAGE_PREFIX.length + 1})<58)return}`,
  "}catch(x){}",
  'e.removeAttribute("data-pending")',
  "})()",
].join("");

/** The player's language, for miles or kilometres. Browser only. */
function locale(): string {
  try {
    return globalThis.navigator?.language || "en-GB";
  } catch {
    return "en-GB";
  }
}

/**
 * Whether the site's server runs this game. In a production build, always: the page has no
 * questions of its own there. In development it does when there is an API behind the page
 * (`pnpm api` beside `pnpm dev`: `api`, from the game's clock) and no debug switch asks for
 * a game only the page can make (`?day=`, `?stadium=`, `?notimer=`). Otherwise the page runs
 * the game itself, with the sample questions.
 */
export function serverRuns(
  api: boolean,
  search: string,
  dev: boolean = import.meta.env.DEV,
): boolean {
  if (!dev) return true;
  const switches = parseOverrides(search);
  return (
    api &&
    switches.day === undefined &&
    switches.stadiumId === undefined &&
    !switches.noTimer
  );
}

/**
 * Makes the game once React subscribes, which is after mounting, and ends it on the way out.
 * It waits for the game's clock (the server's time, `gameClock`): the day is the server's,
 * whatever the device's clock says, and so is every question's time. CLOSEST and FURTHEST
 * wait for the day's place too, where the server runs them: it is drafted for the day
 * (`dayPlace`), and the fixed list's only if the server gives none.
 */
interface GameStore {
  subscribe(onChange: () => void): () => void;
  read(): GameController | null;
}

function createGameStore(mode: Mode): GameStore {
  let current: GameController | null = null;
  return {
    subscribe(onChange) {
      const clock = gameClock();
      let made: GameController | null = null;
      let waiting = false;
      let gone = false;
      const begin = () => {
        const now = clock.now();
        if (made || waiting || now === null) return;
        const search = gameSearch(window.location.search);
        const today = resolveToday(new Date(now), search, STADIUMS);
        const server = serverRuns(clock.api(), search);
        const go = (place: Place | null) => {
          if (made || gone) return;
          made = new GameController({
            mode,
            today: place ? { ...today, stadium: place } : today,
            locale: locale(),
            clock: () => clock.now() ?? now,
            server: server ? gameServer() : null,
          });
          current = made;
          made.start();
          onChange();
        };
        if (server && isDistanceMode(mode)) {
          waiting = true;
          void dayPlace(today.dayNumber).then(go);
          return;
        }
        go(null);
      };
      const stop = clock.subscribe(begin);
      begin();
      return () => {
        gone = true;
        stop();
        made?.dispose();
        if (current === made) current = null;
      };
    },
    read: () => current,
  };
}

/** The game's clock's status, for the line that says the date cannot be checked. */
function useClockStatus(): ClockStatus {
  const [clock] = useState<{
    subscribe(onChange: () => void): () => void;
    read(): ClockStatus;
  }>(() => ({
    subscribe: (onChange) => gameClock().subscribe(onChange),
    read: () => gameClock().status(),
  }));
  return useSyncExternalStore(clock.subscribe, clock.read, () => "checking");
}

function noSubscription(): () => void {
  return () => {};
}
function nothing(): null {
  return null;
}

/**
 * What the reveal's third column says about an answer: its share of players ("34%") in
 * HOME and AWAY, its year in RETRO (the first it counted, "1888") and NEXT-GEN (the last,
 * "2026"), its distance from the day's place in CLOSEST and FURTHEST ("212 miles", in the
 * player's own units).
 */
export function rowFigure(
  row: RankedAnswer,
  mode: Mode,
  lang: string = locale(),
): string {
  if (isEraMode(mode)) return row.year === null ? "" : String(row.year);
  if (isDistanceMode(mode)) return formatDistanceShort(row.km, lang);
  return formatShare(row.share);
}

/**
 * The reveal's one plain sentence: how many players gave the answer (in RETRO and NEXT-GEN,
 * the year it first or last counted; in CLOSEST and FURTHEST, how far it is from `place`,
 * the day's), and what kind of shot that made it, in the mode's tone.
 */
export function revealSentence(
  reveal: RevealView,
  mode: Mode,
  place = "",
): string {
  const { answer, row, best, turn } = reveal;
  if (isDistanceMode(mode)) {
    const where = place || text.board.place.label;
    if (answer && row) {
      return text.sentence[mode][row.shot](
        answer.name,
        rowFigure(row, mode),
        where,
      );
    }
    const missed = turn.grade === "timeup" ? "timeup" : "skipped";
    if (!best) return text.grades[missed];
    const said =
      missed === "timeup"
        ? text.sentence.timeupDistance
        : text.sentence.skippedDistance;
    return said[mode](best.answer.name, rowFigure(best, mode), where);
  }
  if (answer && row) {
    if (isEraMode(mode)) {
      return text.sentence[mode][row.shot](answer.name, rowFigure(row, mode));
    }
    const { picked } = text.sentence;
    const share = formatShare(row.share);
    const said = row.share < LONELY_SHARE ? picked.lonely : picked.crowd;
    return text.sentence[mode][row.shot](answer.name, said(share));
  }
  const missed = turn.grade === "timeup" ? "timeup" : "skipped";
  if (!best) return text.grades[missed];
  return text.sentence[missed][mode](best.answer.name, rowFigure(best, mode));
}

/**
 * The line under an answer's name in the table: its country, for a person, a club or a
 * stadium. Nothing when it would say nothing: for a country (it would repeat its own name),
 * or when every answer to the question shares one country (the Premier League's clubs).
 */
function tablePlace(reveal: RevealView, row: RevealRow): string {
  if (reveal.question.measure === "capital") return "";
  return reveal.oneCountry ? "" : row.answer.country;
}

/**
 * The reveal's table, as the kit's league table takes it: one row for each shot that scores
 * (`revealFor(...).rows`), the third column the share (the year in RETRO and NEXT-GEN:
 * `rowFigure`), then each answer's shot and its points.
 */
export function tableRows(
  reveal: RevealView,
  mode: Mode = reveal.question.mode,
): LeagueEntry[] {
  return reveal.rows.map((row) => ({
    rank: row.rank,
    name: row.answer.name,
    place: tablePlace(reveal, row),
    distance: rowFigure(row, mode),
    grade: row.shot,
    shot: text.shots[row.shot],
    points: row.points,
    you: row.isPlayer,
    id: row.answer.id,
  }));
}

/** The reveal table's headings: the third column says what it holds in the mode. */
export function tableLabels(mode: Mode): typeof text.table {
  if (isEraMode(mode))
    return { ...text.table, distance: text.table.year[mode] };
  if (isDistanceMode(mode)) return { ...text.table, distance: text.table.far };
  return text.table;
}

/**
 * The player's answer above the table, when it did not score and so is not a row: a listed
 * miss with its share (its year in RETRO and NEXT-GEN), or no answer after a pass or a
 * time-up. Undefined when it is a row.
 */
export function yoursLine(
  reveal: RevealView,
  mode: Mode = reveal.question.mode,
  place = "",
): RevealYours | undefined {
  if (reveal.playerInRows) return undefined;
  const { answer, row, turn } = reveal;
  const you = text.table.you;
  if (answer && row) {
    const picked = rowFigure(row, mode);
    const shot = text.shots[row.shot];
    return {
      you,
      name: answer.name,
      ...(picked ? { picked } : {}),
      shot,
      points: row.points,
      spoken: isEraMode(mode)
        ? text.yours.spokenYear[mode](answer.name, picked, shot, row.points)
        : isDistanceMode(mode)
          ? text.yours.spokenDistance(
              answer.name,
              picked,
              place || text.board.place.label,
              shot,
              row.points,
            )
          : text.yours.spoken(answer.name, picked, shot, row.points),
    };
  }
  const shot = turn.grade === "timeup" ? text.yours.timeup : text.yours.skipped;
  return {
    you,
    name: text.yours.none,
    shot,
    points: turn.points,
    spoken: text.yours.spokenNone(shot, turn.points),
  };
}

export function Game({ mode }: { mode: Mode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const sky = useDeviceSky();
  // The kick-off on the home screen ends here: the heading takes the focus.
  const heading = useArrivalFocus<HTMLHeadingElement>();
  /** What is typed, and for which question: every question starts with an empty field. */
  const [field, setField] = useState({ index: -1, value: "" });
  const [store] = useState(() => createGameStore(mode));
  const game = useSyncExternalStore(store.subscribe, store.read, nothing);
  const clockStatus = useClockStatus();

  const view: GameView | null = useSyncExternalStore(
    game?.subscribe ?? noSubscription,
    game?.read ?? nothing,
    nothing,
  );
  const session = view?.session ?? null;
  const phase = session?.phase ?? null;

  // CLOSEST's and FURTHEST's map keeps the day's place clear of the board (scene-edges.ts).
  const scene = game?.scene ?? null;
  useEffect(() => (scene ? watchCeiling(scene) : undefined), [scene]);
  const index = session?.index ?? 0;

  const value = field.index === index ? field.value : "";
  const setValue = (typed: string) => {
    setField({ index, value: typed });
    // If the clock runs out before Enter, what is typed counts as sent.
    game?.type(typed);
  };

  // Full time (a mode is played once a day: any way back to a finished game shows its card
  // again), and the keyboard goes to SHARE.
  const dayNumber = session?.dayNumber ?? 0;
  useEffect(() => {
    if (phase !== "done") return;
    document.querySelector<HTMLElement>(".ss-play-full button")?.focus();
    // Once per arrival at full time.
  }, [phase, dayNumber]);

  const search = location.search;
  // the next mode not played today (none once all four have been)
  const other: Mode | null = view?.next ?? null;

  let top: ReactNode = null;
  let bottom: ReactNode = null;
  let card: ReactNode = null;

  // The server runs the game: while it cannot be reached the page says so, and keeps
  // asking (the controller's `trouble`).
  const lost = view?.trouble ? (
    <Panel variant="plain" className="ss-t10" role="status">
      {text.server.trouble}
    </Panel>
  ) : null;

  // The game is not known yet (the build-time HTML, until the server's clock has answered,
  // and while the server is asked what the player's game is): the mode card, out of sight
  // but for a device that has never played, which its own script shows it to at once
  // (`EARLY_CARD`). The same element is the card a new game then opens with, so it is never
  // drawn twice. (CLOSEST's and FURTHEST's card names the day's place, which is not known
  // here: theirs comes with the game.)
  const early = isDistanceMode(mode) ? null : (
    <ModeIntro
      mode={mode}
      name={strings.home.modes[mode].label}
      line={text.intro.line[mode]}
      emphasis={text.intro.key[mode]}
      early={EARLY_CARD}
    />
  );

  if (game && view && session && view.loading) {
    // The server is being asked what the player's game is: ink, and nothing of a game yet.
    // (The card stays as it was, shown or out of sight: a device with nothing kept but a
    // player the server still knows has been shown it, and a new game opens with it.)
    bottom = lost;
    card = early;
  } else if (game && view && session && view.intro) {
    bottom = lost;
    // A new game: the mode card first, on the ink, and nothing else. The scene waits behind
    // it and no clock runs until it has gone (by itself, or on a press anywhere).
    card = (
      <ModeIntro
        mode={mode}
        name={strings.home.modes[mode].label}
        line={text.intro.line[mode]}
        emphasis={text.intro.key[mode]}
        {...(game.placeLabel && { place: game.placeLabel.toUpperCase() })}
        leaving={view.intro === "leaving"}
        onSkip={game.skipIntro}
      />
    );
  } else if (game && view && session) {
    const question = questionView(session);
    const clock = clockView(session, view.now);
    const progress = progressFor(session);
    // The board holds the old total until the shot has landed.
    const resolving = session.phase === "resolving";
    const shownTotal = resolving ? progress.totalBefore : session.total;
    const career = resolving ? progress.before : progress.after;
    const lamps: (Grade | null)[] = pips(session);
    if (resolving) lamps[session.index] = null;

    if (session.phase !== "done") {
      top = (
        <Board
          mode={mode}
          questionNumber={question.number}
          questionCount={question.count}
          results={lamps}
          total={shownTotal}
          tierName={text.tiers[career.id]}
          tierProgress={career.progress}
          question={question.prompt}
          instruction={text.board.instruction[mode]}
          measureLine={
            isDistanceMode(mode) && question.measureLabel
              ? text.board.measuredBy(question.measureLabel)
              : text.board.measure[mode]
          }
          {...(game.placeLabel && {
            place: {
              label: text.board.place.label,
              name: game.placeLabel,
            },
          })}
          secondsLeft={clock.secondsLeft}
          secondsTotal={QUESTION_MS / 1000}
          compact={session.phase !== "asking"}
          labels={{
            mode: strings.home.modes[mode].label,
            questionOf: text.board.questionOf(question.number, question.count),
            points: text.board.points,
            totalSpoken: text.board.totalSpoken(shownTotal),
            timeLeft: text.board.timeLeft(clock.secondsLeft),
            board: text.board.label,
          }}
        />
      );
    }

    if (session.phase === "asking") {
      const rejected = session.rejected;
      // The words stay up until the player changes what was turned down.
      const showRejection =
        rejected !== null && value.trim() === rejected.input;
      bottom = (
        <AnswerBar
          key={session.index}
          mode={mode}
          value={value}
          onChange={setValue}
          onSubmit={game.submit}
          onPass={game.pass}
          canPass={clock.canPass}
          // while the server judges an answer: the field holds, the buttons are off
          busy={view.waiting}
          rejection={
            view.trouble
              ? text.server.trouble
              : showRejection
                ? rejected.reason === "ambiguous"
                  ? text.answer.ambiguous
                  : text.answer.unknown
                : null
          }
          shakeKey={view.rejections}
          placeholder={text.answer.placeholder[question.measure]}
          labels={{
            input: text.answer.input,
            shoot: text.answer.shoot,
            pass: text.answer.pass,
          }}
          autoFocus
        />
      );
    } else if (session.phase === "reveal" && !view.promoting) {
      const reveal = revealFor(session);
      if (reveal) {
        const { turn } = reveal;
        const answered = turn.answerId !== null;
        bottom = (
          <RevealSheet
            key={session.index}
            grade={turn.grade}
            mode={mode}
            gradeLabel={text.grades[turn.grade]}
            pointsLabel={
              answered && turn.grade !== "miss"
                ? text.gained(turn.points)
                : undefined
            }
            sentence={revealSentence(reveal, mode, game.placeName)}
            rows={tableRows(reveal, mode)}
            tableLabels={tableLabels(mode)}
            yours={yoursLine(reveal, mode, game.placeName)}
            nextLabel={
              view.trouble
                ? text.server.retrying
                : reveal.isLast
                  ? text.toFullTime
                  : text.next
            }
            onNext={game.next}
          />
        );
      }
    } else if (session.phase === "reveal") {
      // A promotion has played and the next question has not come: if the server cannot
      // be reached, the sheet is gone and this is where the page says so.
      bottom = lost;
    } else if (session.phase === "done") {
      const full = text.fullTime;
      const shareLabel = {
        idle: full.share,
        making: full.making,
        shared: full.shared,
        // Downloaded and copied: SAVED! first, then the controller moves on to COPIED!
        saved: full.downloaded,
        downloaded: full.downloaded,
        copied: full.copied,
        failed: full.notCopied,
      }[view.share];
      bottom = (
        <FullTimeCard
          className="ss-play-full"
          mode={mode}
          heading={full.heading}
          total={session.total}
          maxTotal={MAX_TOTAL}
          totalSpoken={full.totalSpoken(session.total, MAX_TOTAL)}
          careerTitle={tierName(session.total)}
          earnedTitle={titleName(mode, session.total)}
          earnedTitleSpoken={full.titleSpoken}
          perfectLine={isPerfect(session.total) ? full.perfect : undefined}
          streak={
            view.streak > 0
              ? {
                  days: view.streak,
                  text: full.streak(view.streak),
                  spoken: full.streakSpoken(view.streak),
                }
              : undefined
          }
          results={results(session).map((line) => ({
            grade: line.turn.grade,
            points: line.turn.points,
            label: isShot(line.turn.grade)
              ? text.shots[line.turn.grade]
              : undefined,
            answer:
              line.name ??
              (line.turn.grade === "timeup" ? full.timeup : full.skipped),
          }))}
          resultsLabel={full.results}
          shareLabel={shareLabel}
          shareBusy={view.share === "making"}
          onShare={game.share}
          {...(other && {
            otherLabel: full.other[other],
            otherSpoken: full.otherSpoken(full.other[other]),
            otherMode: other,
            onPlayOther: () =>
              void navigate({ pathname: playPath(other), search }),
          })}
          menuLabel={full.menu}
          // Home through black (`fadeThrough`): the ink comes, the menu, the ink goes.
          onMenu={() => fadeThrough(() => navigate({ pathname: "/", search }))}
        />
      );
    }
  } else if (clockStatus === "failing") {
    // No game until the server has said what day it is: it keeps asking meanwhile.
    bottom = (
      <Panel variant="plain" className="ss-t10" role="status">
        {text.clock.failing}
      </Panel>
    );
  } else if (!game) {
    card = early;
  }

  return (
    <main>
      <GameLayout
        canvas={
          <PixelStage scene={game?.scene ?? null} light={sky?.light ?? null} />
        }
        top={top}
        bottom={bottom}
        // The board (and its sound switch) is gone at full time, but the crowd plays on.
        sound={phase === "done"}
      >
        {/* The scoreboard says the rest; these are for screen readers. */}
        <h1 ref={heading} tabIndex={-1} className="ss-sr">
          {text.heading[mode]}
        </h1>
        <p className="ss-sr" role="status" aria-live="polite">
          {view?.announcement ?? ""}
        </p>
        {card}
        {/* The bot check before a first game, out of sight (../first-check.tsx). */}
        <FirstGameCheck />
      </GameLayout>
    </main>
  );
}
