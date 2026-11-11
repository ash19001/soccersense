import { cx } from "./cx";
import type { UiMode } from "./types";

export interface ModeBadgeProps {
  mode: UiMode;
  /** The visible text: "HOME" or "AWAY". */
  label: string;
  className?: string;
}

/** HOME is always warm red-orange, AWAY always teal. */
export function ModeBadge({ mode, label, className }: ModeBadgeProps) {
  return (
    <span className={cx("ss-badge", className)} data-mode={mode}>
      {label}
    </span>
  );
}
