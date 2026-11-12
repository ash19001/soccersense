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

/**
 * The stadium scoreboard at the top of the game screen. It does not name the day's stadium
 * (the product owner, 2026-11-11: "no need for that detail"): the question has the room.
 * The game's sound switch sits in its head, after the mode badge.
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
          {question}
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
