import type { CSSProperties } from "react";

import { cx } from "./cx";
import { LedNumber } from "./LedNumber";

export interface TimerStripProps {
  secondsLeft: number;
  secondsTotal: number;
  /** Seconds at which the strip turns red and blinks (default 5). */
  dangerAt?: number;
  /** Hide the dot-matrix seconds counter at the end of the strip. */
  hideSeconds?: boolean;
  /** Accessible name, for example "22 seconds left". */
  label?: string;
  className?: string;
}

/**
 * The clock: one lit segment per second. They go out one by one from the right, and the
 * last five turn red and blink.
 */
export function TimerStrip({
  secondsLeft,
  secondsTotal,
  dangerAt = 5,
  hideSeconds = false,
  label,
  className,
}: TimerStripProps) {
  const total = Math.max(1, Math.ceil(secondsTotal));
  const left = Math.min(total, Math.max(0, Math.ceil(secondsLeft)));
  const danger = left <= dangerAt;
  const style = { "--n": total } as CSSProperties;
  const segments = [];
  for (let i = 0; i < total; i++) {
    segments.push(
      <i key={i} className={cx("ss-timer__seg", i < left && "is-on")} />,
    );
  }
  return (
    <div
      className={cx(
        "ss-timer",
        danger && "ss-timer--danger",
        hideSeconds && "ss-timer--bare",
        className,
      )}
      style={style}
      role="timer"
      aria-label={label}
    >
      <span className="ss-timer__strip" aria-hidden="true">
        {segments}
      </span>
      {!hideSeconds && (
        <LedNumber
          className="ss-timer__seconds"
          value={left}
          digits={2}
          tone={danger ? "red" : "amber"}
          bare
          label=""
        />
      )}
    </div>
  );
}
