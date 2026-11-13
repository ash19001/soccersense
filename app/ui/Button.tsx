import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { Link } from "react-router";

import { ICONS, type IconName } from "./bitmaps";
import { cx } from "./cx";
import { PixelGlyph } from "./PixelGlyph";
import type { UiMode } from "./types";

/**
 * primary: gold, the one main action on a screen.
 * mode: the mode's colour (HOME warm, AWAY teal). Needs `mode`.
 * secondary: steel plate.
 * ghost: flat ink plate with a chalk outline, for the least important action.
 */
export type ButtonVariant = "primary" | "mode" | "secondary" | "ghost";

/** Only for the gallery: draws a state without the pointer or keyboard. */
export type ForcedState = "pressed" | "focus";

interface SharedProps {
  variant?: ButtonVariant;
  /** Required when variant is "mode". */
  mode?: UiMode;
  /** Stretch to the full width of the container. */
  full?: boolean;
  /** Render a router link that looks like the button. */
  to?: string;
  forceState?: ForcedState;
  ref?: Ref<HTMLButtonElement>;
}

export interface ButtonProps
  extends
    SharedProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
}

function classes(
  base: string,
  {
    variant = "secondary",
    full,
    forceState,
    className,
  }: SharedProps & { className?: string },
): string {
  return cx(
    "ss-btn",
    base,
    `ss-btn--${variant}`,
    full && "ss-btn--full",
    forceState === "pressed" && "is-pressed",
    forceState === "focus" && "is-focus",
    className,
  );
}

/** A chunky pixel button. The darker bottom edge disappears while it is pressed. */
export function Button({
  variant = "secondary",
  mode,
  full,
  to,
  forceState,
  className,
  children,
  type = "button",
  ref,
  ...rest
}: ButtonProps) {
  const cls = classes("", { variant, full, forceState, className });
  const label = <span className="ss-btn__label">{children}</span>;
  if (to !== undefined && !rest.disabled) {
    return (
      <Link
        to={to}
        className={cls}
        data-mode={mode}
        aria-label={rest["aria-label"]}
      >
        {label}
      </Link>
    );
  }
  return (
    <button {...rest} ref={ref} type={type} className={cls} data-mode={mode}>
      {label}
    </button>
  );
}

export interface IconButtonProps
  extends
    Omit<SharedProps, "full">,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  icon: IconName;
  /** Accessible name (the icon has no visible text). */
  label: string;
}

/** A square button with a pixel icon. Always at least 44 CSS px. */
export function IconButton({
  icon,
  label,
  variant = "secondary",
  mode,
  to,
  forceState,
  className,
  type = "button",
  ref,
  ...rest
}: IconButtonProps) {
  const cls = classes("ss-btn--icon", { variant, forceState, className });
  const glyph = (
    <span className="ss-btn__label">
      <PixelGlyph bitmap={ICONS[icon]} unit="ip" />
    </span>
  );
  if (to !== undefined && !rest.disabled) {
    return (
      <Link
        to={to}
        className={cls}
        data-mode={mode}
        aria-label={label}
        title={label}
      >
        {glyph}
      </Link>
    );
  }
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={cls}
      data-mode={mode}
      aria-label={label}
      title={label}
    >
      {glyph}
    </button>
  );
}
