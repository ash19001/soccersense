import type { CSSProperties } from "react";

import { cx } from "./cx";

export interface TierBarProps {
  /** Career tier name: "SUNDAY LEAGUE". */
  name: string;
  /** Progress to the next tier, 0 to 1. */
  progress: number;
  className?: string;
}

/**
 * The career bar: the tier name on a track that fills with gold towards the next
 * promotion. The name is drawn twice (gold on the track, ink on the fill) so it stays
 * readable wherever the edge of the fill falls.
 */
export function TierBar({ name, progress, className }: TierBarProps) {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const style = { "--p": p.toFixed(4) } as CSSProperties;
  return (
    <span
      className={cx("ss-tier", className)}
      role="progressbar"
      aria-label={name}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p * 100)}
    >
      <span className="ss-tier__name" aria-hidden="true">
        {name}
      </span>
      <span
        className={cx("ss-tier__fill", p > 0 && "is-started")}
        style={style}
        aria-hidden="true"
      >
        <span className="ss-tier__name">{name}</span>
      </span>
    </span>
  );
}
