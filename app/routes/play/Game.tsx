// The game screen: the career scene on the canvas, the scoreboard at the top, and at the
// bottom the answer bar, the reveal sheet or the full-time card. The rules and the timing
// live in the controller (./controller.ts); this only draws what it says and passes the
// player's moves back. Every word comes from `strings.play`.

import {
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { useLocation, useNavigate } from "react-router";

import { STADIUMS } from "~/data";
import {
  type Grade,
  MAX_TOTAL,
  type Mode,
  type RevealView,
  type TableRow,
  QUESTION_MS,
  clockView,
  dayKeyFor,
  formatShare,
  isPerfect,
  pips,
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
  GameLayout,
  type LeagueEntry,
  PixelStage,
  RevealSheet,
  useArrivalFocus,
  useDeviceSky,
} from "~/ui";
import { GameController, type GameView, tierName } from "./controller";

const text = strings.play;

/** What the history entry carries once its game has reached full time. */
interface FullTimeState {
  fullTime: string;
}

function isFullTimeState(state: unknown): state is FullTimeState {
  return (
    typeof state === "object" &&
    state !== null &&
    typeof (state as { fullTime?: unknown }).fullTime === "string"
  );
}

/** Under this share of players, an answer is a lonely one: the reveal says so. */
export const LONELY_SHARE = 2;

/** The player's language, for miles or kilometres. Browser only. */
function locale(): string {
  try {
    return globalThis.navigator?.language || "en-GB";
  } catch {
    return "en-GB";
  }
}

/** Makes the game once React subscribes, which is after mounting, and ends it on the way out. */
interface GameStore {
  subscribe(onChange: () => void): () => void;
  read(): GameController | null;
}

function createGameStore(mode: Mode, arrivedWith: unknown): GameStore {
  let current: GameController | null = null;
  return {
    subscribe(onChange) {
      // The day, the storage and the clock are the browser's.
      const today = resolveToday(new Date(), window.location.search, STADIUMS);
      const made = new GameController({
        mode,
        today,
        locale: locale(),
        restoreFullTime:
          isFullTimeState(arrivedWith) && arrivedWith.fullTime === today.dayKey,
      });
      current = made;
      made.start();
      onChange();
      return () => {
        made.dispose();
        if (current === made) current = null;
      };
    },
    read: () => current,
  };
}

function noSubscription(): () => void {
  return () => {};
}
function nothing(): null {
  return null;
}

/** The reveal's one plain sentence: how many players gave the answer. */
export function revealSentence(reveal: RevealView, mode: Mode): string {
  const { answer, row, best, turn } = reveal;
  if (answer && row) {
    const say = text.sentence[mode];
    const tone = row.share < LONELY_SHARE ? say.lonely : say.crowd;
    return tone(answer.name, formatShare(row.share));
  }
  const missed = turn.grade === "timeup" ? "timeup" : "skipped";
  if (!best) return text.grades[missed];
  return text.sentence[missed][mode](best.answer.name, formatShare(best.share));
}

/**
 * The line under an answer's name in the table: its country, for a person, a club or a
 * stadium. Nothing when it would say nothing: for a country (it would repeat its own name),
 * or when every answer to the question shares one country (the Premier League's clubs).
 */
function tablePlace(reveal: RevealView, row: TableRow): string {
  const { question } = reveal;
  if (question.measure === "capital") return "";
  const country = row.answer.country;
  return question.answers.every((answer) => answer.country === country)
    ? ""
    : country;
}

/** The reveal's table, as the kit's league table takes it: the third column is the share. */
export function tableRows(reveal: RevealView): LeagueEntry[] {
  const rows: LeagueEntry[] = [];
  for (const row of reveal.rows) {
    if (row.gapBefore) rows.push({ gap: true });
    rows.push({
      rank: row.rank,
      name: row.answer.name,
      place: tablePlace(reveal, row),
      distance: formatShare(row.share),
      points: row.points,
      you: row.isPlayer,
      id: row.answer.id,
    });
  }
  return rows;
}

export function Game({ mode }: { mode: Mode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const sky = useDeviceSky();
  // The kick-off on the home screen ends here: the heading takes the focus.
  const heading = useArrivalFocus<HTMLHeadingElement>();
  /** What is typed, and for which question: every question starts with an empty field. */
  const [field, setField] = useState({ index: -1, value: "" });
  // The history entry this page was arrived at with says whether it shows a game again.
  const [store] = useState(() => createGameStore(mode, location.state));
  const game = useSyncExternalStore(store.subscribe, store.read, nothing);

  const view: GameView | null = useSyncExternalStore(
    game?.subscribe ?? noSubscription,
    game?.read ?? nothing,
    nothing,
  );
  const session = view?.session ?? null;
  const phase = session?.phase ?? null;
  const index = session?.index ?? 0;

  const value = field.index === index ? field.value : "";
  const setValue = (typed: string) => setField({ index, value: typed });

  // Full time: the history entry remembers it, so a reload shows the card again (and the
  // menu's way in starts a new game), and the keyboard goes to SHARE.
  const dayNumber = session?.dayNumber ?? 0;
  useEffect(() => {
    if (phase !== "done") return;
    const dayKey = dayKeyFor(dayNumber);
    const state = location.state as unknown;
    if (!isFullTimeState(state) || state.fullTime !== dayKey) {
      void navigate(
        { pathname: location.pathname, search: location.search },
        {
          replace: true,
          preventScrollReset: true,
          state: { fullTime: dayKey } satisfies FullTimeState,
        },
      );
    }
    document.querySelector<HTMLElement>(".ss-play-full button")?.focus();
    // Once per arrival at full time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, dayNumber]);

  const search = location.search;
  const other: Mode = mode === "home" ? "away" : "home";

  let top: ReactNode = null;
  let bottom: ReactNode = null;

  if (game && view && session) {
    const question = questionView(session);
    const clock = clockView(session, view.now);
    const progress = progressFor(session);
    // The board holds the old total until the shot has landed.
    const resolving = session.phase === "resolving";
    const shownTotal = resolving ? progress.totalBefore : session.total;
    const career = resolving ? progress.before : progress.after;
    const lamps: (Grade | null)[] = pips(session);
    if (resolving) lamps[session.index] = null;
    const stadiumName = session.stadium.name.toUpperCase();

    if (session.phase !== "done") {
      top = (
        <Board
          mode={mode}
          stadiumName={stadiumName}
          questionNumber={question.number}
          questionCount={question.count}
          results={lamps}
          total={shownTotal}
          tierName={text.tiers[career.id]}
          tierProgress={career.progress}
          question={question.prompt}
          instruction={text.board.instruction[mode]}
          measureLine={text.board.measure[mode]}
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
          rejection={
            showRejection
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
            pointsLabel={answered ? text.gained(turn.points) : undefined}
            sentence={revealSentence(reveal, mode)}
            rows={tableRows(reveal)}
            tableLabels={text.table}
            nextLabel={reveal.isLast ? text.toFullTime : text.next}
            onNext={game.next}
          />
        );
      }
    } else if (session.phase === "done") {
      const full = text.fullTime;
      const shareLabel =
        view.share === "copied"
          ? full.copied
          : view.share === "failed"
            ? full.notCopied
            : full.share;
      bottom = (
        <FullTimeCard
          className="ss-play-full"
          mode={mode}
          heading={full.heading}
          total={session.total}
          maxTotal={MAX_TOTAL}
          totalSpoken={full.totalSpoken(session.total, MAX_TOTAL)}
          careerTitle={tierName(session.total)}
          perfectLine={isPerfect(session.total) ? full.perfect : undefined}
          results={results(session).map((line) => ({
            grade: line.turn.grade,
            points: line.turn.points,
            answer:
              line.answer?.name ??
              (line.turn.grade === "timeup" ? full.timeup : full.skipped),
          }))}
          resultsLabel={full.results}
          shareLabel={shareLabel}
          onShare={game.share}
          otherLabel={full.other[other]}
          otherMode={other}
          onPlayOther={() =>
            void navigate({ pathname: `/play/${other}`, search })
          }
          menuLabel={full.menu}
          onMenu={() => void navigate({ pathname: "/", search })}
        />
      );
    }
  }

  const stadium = session?.stadium ?? null;

  return (
    <main>
      <GameLayout
        canvas={
          <PixelStage scene={game?.scene ?? null} light={sky?.light ?? null} />
        }
        top={top}
        bottom={bottom}
      >
        {/* The scoreboard says the rest; these are for screen readers. */}
        <h1 ref={heading} tabIndex={-1} className="ss-sr">
          {text.heading[mode]}
        </h1>
        {stadium && (
          <p className="ss-sr">
            {text.stadium(stadium.name, stadium.city, stadium.country)}
          </p>
        )}
        <p className="ss-sr" role="status" aria-live="polite">
          {view?.announcement ?? ""}
        </p>
      </GameLayout>
    </main>
  );
}
