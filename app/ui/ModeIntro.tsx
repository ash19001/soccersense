import { useEffect, useRef } from "react";

import { cx } from "./cx";
import type { UiMode } from "./types";

export interface ModeIntroProps {
  mode: UiMode;
  /** The mode's name, set large in its colour: "HOME". */
  name: string;
  /** What to give in it, under the name: "GIVE THE MOST COMMON ANSWER". */
  line: string;
  /**
   * The words of `line` that tell this mode from the others ("MOST COMMON"): shown in the
   * mode's light colour. Left out, or not in the line, the line is all one colour.
   */
  emphasis?: string;
  /** It is on its way out: the card shuts (ui.css, section 30). */
  leaving?: boolean;
  /**
   * The player has read it: a press anywhere on the page, or Enter, Space or Escape. Not
   * called for a key held down from the page before. Without it the card listens to nothing.
   */
  onSkip?: () => void;
  className?: string;
}

/** The keys that send the card off. Typing ahead (a letter) does not. */
const SKIP_KEYS: readonly string[] = ["Enter", " ", "Spacebar", "Escape"];

/**
 * The mode card: what the mode is, shown on the ink a game page arrives on before a new
 * game starts. The mode's name, large and in its colour, between two rules, and under it
 * the one thing to do. It goes in `GameLayout`'s free space with nothing above or below it,
 * and so stands in the middle of the screen.
 *
 * It is only looked at: hidden from screen readers (the page reads the same words out
 * itself), it takes no focus and no press of its own. `onSkip` hears the whole page
 * instead, so a press anywhere sends it off.
 */
export function ModeIntro({
  mode,
  name,
  line,
  emphasis,
  leaving = false,
  onSkip,
  className,
}: ModeIntroProps) {
  // The listener is added once; it calls whatever `onSkip` is now.
  const skip = useRef(onSkip);
  useEffect(() => {
    skip.current = onSkip;
  });

  const listening = onSkip !== undefined;
  useEffect(() => {
    if (!listening) return;
    const onPress = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      skip.current?.();
    };
    const onKey = (event: KeyboardEvent) => {
      // A key still down from the button that led here is not a press on this page.
      if (event.repeat || !SKIP_KEYS.includes(event.key)) return;
      skip.current?.();
    };
    window.addEventListener("pointerdown", onPress);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPress);
      window.removeEventListener("keydown", onKey);
    };
  }, [listening]);

  const at = emphasis ? line.indexOf(emphasis) : -1;

  return (
    <div
      className={cx("ss-intro", className)}
      data-mode={mode}
      data-leaving={leaving ? "" : undefined}
      aria-hidden="true"
    >
      <div className="ss-intro__card">
        <span className="ss-intro__rule" />
        <div className="ss-intro__words">
          <p className="ss-intro__name">{name}</p>
          <p className="ss-intro__line">
            {emphasis && at >= 0 ? (
              <>
                {line.slice(0, at)}
                <span className="ss-intro__key">{emphasis}</span>
                {line.slice(at + emphasis.length)}
              </>
            ) : (
              line
            )}
          </p>
        </div>
        <span className="ss-intro__rule" />
      </div>
    </div>
  );
}
