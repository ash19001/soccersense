import {
  type CSSProperties,
  type HTMLAttributes,
  type Ref,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

import { cx } from "./cx";
import { forgetDetailChoice } from "./forget-detail";
import { useLive } from "./live";
import { PixelScaleContext, pixelVariables, usePixelScale } from "./scale";
import { SCALE_BOOT } from "./scale-boot";

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
 * The build-time HTML carries a small script first inside the element (`./scale-boot`): the
 * browser runs it as it reads the page and it writes the real screen's units over the
 * defaults, so the page is laid out once, where it will stay, instead of as a phone's and
 * then again. React's first render over that HTML still says the defaults (the two must
 * match); the render that follows says the real ones, and an effect then says every unit
 * again, because React only writes the ones it believes have changed.
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
  const live = useLive();
  const own = useRef<HTMLDivElement | null>(null);
  const setRef = useCallback(
    (element: HTMLDivElement | null) => {
      own.current = element;
      if (typeof ref === "function") return ref(element);
      if (ref) ref.current = element;
    },
    [ref],
  );
  // Storage is touched after mounting, never during render.
  useEffect(() => forgetDetailChoice(), []);
  // What the script wrote before React took over is not what React thinks is there: once
  // the real scale is in, every unit is said again (a window turned or resized between the
  // two would otherwise keep a unit of the old size).
  useLayoutEffect(() => {
    const element = own.current;
    if (!live || !element) return;
    for (const [name, value] of Object.entries(pixelVariables(scale))) {
      if (element.style.getPropertyValue(name) !== value) {
        element.style.setProperty(name, value);
      }
    }
    const orientation = scale.portrait ? "portrait" : "landscape";
    if (element.getAttribute("data-orientation") !== orientation) {
      element.setAttribute("data-orientation", orientation);
    }
    // The script's note to the marks inside it (`WIDE_BOOT`) has done its work.
    element.removeAttribute("data-boot-wide");
  }, [live, scale]);
  const vars = { ...style, ...pixelVariables(scale) } as CSSProperties;
  return (
    <PixelScaleContext value={scale}>
      <div
        {...rest}
        ref={setRef}
        className={cx("ss-root", className)}
        style={vars}
        data-orientation={scale.portrait ? "portrait" : "landscape"}
        // The script below has rewritten this element's units by the time React arrives.
        suppressHydrationWarning
      >
        {!live && <script dangerouslySetInnerHTML={{ __html: SCALE_BOOT }} />}
        {children}
      </div>
    </PixelScaleContext>
  );
}
