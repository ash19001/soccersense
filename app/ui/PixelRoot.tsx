import {
  type CSSProperties,
  type HTMLAttributes,
  type Ref,
  useEffect,
} from "react";

import { cx } from "./cx";
import { forgetDetailChoice } from "./forget-detail";
import { PixelScaleContext, pixelVariables, usePixelScale } from "./scale";

export interface PixelRootProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

/**
 * Sets --px, --fp, --cp, --tx, --snap and --nudge (in CSS px) for everything inside it and
 * keeps them in step with the window and with the device pixel ratio: each unit is a whole
 * number of device pixels, so at 125% or 150% scaling the values are fractions of a CSS
 * pixel. On the server it renders the defaults (px 3, fp 1, cp 2, tx 2, at ratio 1).
 * Everything in app/ui is sized from these variables, so the interface must live inside a
 * PixelRoot.
 *
 * After mounting it forgets the choice of detail a tab may remember from when the art had
 * two levels (`./forget-detail`).
 */
export function PixelRoot({
  ref,
  className,
  style,
  children,
  ...rest
}: PixelRootProps) {
  const scale = usePixelScale();
  // Storage is touched after mounting, never during render.
  useEffect(() => forgetDetailChoice(), []);
  const vars = { ...style, ...pixelVariables(scale) } as CSSProperties;
  return (
    <PixelScaleContext value={scale}>
      <div
        {...rest}
        ref={ref}
        className={cx("ss-root", className)}
        style={vars}
        data-orientation={scale.portrait ? "portrait" : "landscape"}
      >
        {children}
      </div>
    </PixelScaleContext>
  );
}
