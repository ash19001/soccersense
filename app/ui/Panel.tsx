import type { HTMLAttributes, Ref } from "react";

import { cx } from "./cx";

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  /** Element to render (default "div"). */
  as?: "div" | "section" | "aside" | "form";
  /** "frame" is the bolted scoreboard frame; "plain" is a flat dark plate with an outline. */
  variant?: "frame" | "plain";
  /** Drop the four corner bolts. */
  noBolts?: boolean;
  ref?: Ref<HTMLElement>;
}

/** A dark scoreboard panel with a bolted steel frame and a hard drop shadow. */
export function Panel({
  as = "div",
  variant = "frame",
  noBolts = false,
  className,
  children,
  ref,
  ...rest
}: PanelProps) {
  const Tag = as as "div";
  return (
    <Tag
      {...rest}
      ref={ref as Ref<HTMLDivElement>}
      className={cx(
        "ss-panel",
        variant === "plain" && "ss-panel--plain",
        variant === "frame" && !noBolts && "ss-panel--bolted",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
