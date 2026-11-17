import type { CSSProperties, ReactNode } from "react";

import { strings } from "~/i18n";

import { cx } from "./cx";
import { LedNumber } from "./LedNumber";
import { ModeBadge } from "./ModeBadge";
import { Pips } from "./Pips";
import { SoundToggle, type SoundToggleLabels } from "./SoundToggle";
import { TierBar } from "./TierBar";
import { TimerStrip } from "./TimerStrip";
import type { UiGrade, UiMode } from "./types";

export interface BoardLabels {
  /** The mode badge: "HOME" or "AWAY". */
  mode: string;
  /** Read out for the result lights: "Question 3 of 7". */
  questionOf: string;
  /** Small caption beside the total: "PTS". */
  points: string;
  /** Read out for the total: "347 points". */
  totalSpoken?: string;
  /** Read out for the clock: "22 seconds left". */
  timeLeft?: string;
  /** Accessible name of the whole board: "Scoreboard". */
  board?: string;
}

export interface BoardProps {
  mode: UiMode;
  /** 1-based. */
  questionNumber: number;
  questionCount: number;
  /** One entry per question: the grade once answered, `null` before. */
  results: ReadonlyArray<UiGrade | null>;
  /** Running total, 0 to 700. */
  total: number;
  tierName: string;
  /** Progress to the next tier, 0 to 1. */
  tierProgress: number;
  question: string;
  /** "Closest to ANFIELD wins." */
  instruction: string;
  /** "Measured by where the manager was born." */
  measureLine: string;
  secondsLeft: number;
  secondsTotal: number;
  /**
   * True from the moment an answer is in: the question shrinks to a small recap and the
   * measure line and the clock go, so the board clears the shot and the reveal.
   */
  compact?: boolean;
  labels: BoardLabels;
  /**
   * The sound switch in the head, after the mode badge, with these words (default:
   * `strings.sound`), or `false` for none.
   */
  sound?: SoundToggleLabels | false;
  className?: string;
}

/** A character's time as the question types on, in milliseconds: about 60 a second. */
export const TYPE_CHAR_MS = 16;
/** The longest a question takes to type on: a long one types faster, to be done by then. */
export const TYPE_MAX_MS = 700;
/**
 * After the last letter the ball that dribbled the question on hops, settles and turns into
 * a glint (ui.css, section 10): this long, in milliseconds. The question is all there
 * before it starts.
 */
export const TYPE_SETTLE_MS = 400;

/** A word of the question as it types on: its text, its letters, and the characters before it. */
export interface TypedWord {
  text: string;
  letters: number;
  before: number;
}

/**
 * The question cut up for typing on: its words and, as plain strings, the spaces between
 * them, in order (joined, they are the question again, character for character), with how
 * long one character takes (`charMs`) and the whole question (`totalMs`).
 */
export function typedQuestion(question: string): {
  parts: (TypedWord | string)[];
  charMs: number;
  totalMs: number;
} {
  const parts: (TypedWord | string)[] = [];
  let count = 0;
  for (const piece of question.split(/(\s+)/)) {
    if (piece === "") continue;
    // (letters as the eye counts them: a letter outside the basic plane is one)
    const letters = [...piece].length;
    parts.push(
      /^\s/.test(piece) ? piece : { text: piece, letters, before: count },
    );
    count += letters;
  }
  const charMs = Math.min(TYPE_CHAR_MS, TYPE_MAX_MS / Math.max(1, count));
  return { parts, charMs, totalMs: charMs * count };
}

/**
 * The question, dribbled on: a small football runs along the line, and each word is
 * uncovered from its left behind it in as many steps as it has letters, starting when the
 * characters before it are done. So the text arrives in reading order at one even speed,
 * line after line, each word landing gold and cooling to chalk; after the last letter the
 * ball hops, settles and goes out in a glint (ui.css, section 10).
 *
 * The words are all in the page from the first moment, in their final places (nothing
 * moves or wraps again as it types, and a screen reader hears the whole question at once).
 * The ball is each word's own (a pseudo-element, shown only while that word types), so it
 * needs no measuring: where the word is, the ball is. The last word also holds the mark
 * the ball settles on.
 */
function TypedQuestion({ question }: { question: string }): ReactNode {
  const { parts, charMs } = typedQuestion(question);
  let last = -1;
  parts.forEach((part, i) => {
    if (typeof part !== "string") last = i;
  });
  return (
    <span
      className="ss-board__typed"
      style={{ "--ss-type": `${charMs}ms` } as CSSProperties}
    >
      {parts.map((part, i) =>
        typeof part === "string" ? (
          part
        ) : (
          <span
            key={i}
            className="ss-board__word"
            style={
              {
                "--n": part.letters,
                // (one more: the ball's steps, the last of them in the space after)
                "--m": part.letters + 1,
                "--d": part.before,
              } as CSSProperties
            }
          >
            <span className="ss-board__ink">{part.text}</span>
            {i === last && <i className="ss-board__end" aria-hidden="true" />}
          </span>
        ),
      )}
    </span>
  );
}

/**
 * The stadium scoreboard at the top of the game screen. It does not name the day's stadium
 * (the product owner, 2026-11-11: "no need for that detail"; nothing does, since 2026-11-17):
 * the question has the room.
 * The game's sound switch sits in its head, after the mode badge.
 *
 * A new question is dribbled on (`TypedQuestion`): when the board first shows, and whenever
 * `questionNumber` or `question` changes. Going compact does not type it again, and a
 * board that starts compact (a game carried on at its reveal) does not type at all.
 */
export function Board({
  mode,
  questionNumber,
  questionCount,
  results,
  total,
  tierName,
  tierProgress,
  question,
  instruction,
  measureLine,
  secondsLeft,
  secondsTotal,
  compact = false,
  labels,
  sound = strings.sound,
  className,
}: BoardProps) {
  const lamps: Array<UiGrade | null> = [];
  for (let i = 0; i < questionCount; i++) lamps.push(results[i] ?? null);
  return (
    <section
      className={cx(
        "ss-panel ss-panel--bolted ss-board",
        compact && "ss-board--compact",
        className,
      )}
      data-mode={mode}
      aria-label={labels.board}
    >
      <i className="ss-board__hanger" aria-hidden="true" />
      <i className="ss-board__hanger" aria-hidden="true" />
      <div className="ss-board__head">
        <ModeBadge mode={mode} label={labels.mode} />
        {sound && <SoundToggle labels={sound} />}
        <span className="ss-board__total">
          <LedNumber
            value={total}
            digits={3}
            label={labels.totalSpoken ?? `${total} ${labels.points}`}
          />
          <span className="ss-board__pts" aria-hidden="true">
            {labels.points}
          </span>
        </span>
      </div>
      <div className="ss-board__run">
        <Pips
          results={lamps}
          current={compact ? null : questionNumber - 1}
          label={labels.questionOf}
        />
        <TierBar name={tierName} progress={tierProgress} />
      </div>
      <div className="ss-board__screen">
        <h2 className="ss-board__question" aria-live="polite">
          {/* A new key is a new element: its words' animations start again. */}
          <TypedQuestion
            key={`${questionNumber} ${question}`}
            question={question}
          />
        </h2>
        <p className="ss-board__instruction">{instruction}</p>
        {!compact && <p className="ss-board__measure">{measureLine}</p>}
      </div>
      {!compact && (
        <TimerStrip
          secondsLeft={secondsLeft}
          secondsTotal={secondsTotal}
          label={labels.timeLeft}
        />
      )}
    </section>
  );
}
