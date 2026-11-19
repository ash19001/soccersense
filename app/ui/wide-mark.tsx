import { type RefObject, useLayoutEffect, useRef } from "react";

import { useLive } from "./live";
import { WIDE_BOOT } from "./scale-boot";

/**
 * For a part of a prerendered page that marks itself `data-wide` on a monitor (so that its
 * CSS sets it in caption pixels). The build-time HTML cannot know the screen, and React's
 * first render over it must say the same, so the mark used to arrive a moment after the
 * first paint, and the whole part grew and moved (Google PageSpeed, 2026-11-19: 0.15 to
 * 0.30 of layout shift on a desktop for the rules and the legal pages).
 *
 * Now the build-time HTML carries a script first inside the part (`WideMarkScript`) that
 * marks it as the browser reads the page, from what the root's own script found
 * (./scale-boot). Give the element this hook's ref, its usual
 * `data-wide={wide ? "" : undefined}` and `suppressHydrationWarning` (the script has
 * changed it by the time React arrives), and render `<WideMarkScript />` as its first
 * child. If the window is no longer wide when the page goes live, the mark the script left
 * is taken off here: React only removes what it put on.
 */
export function useWideMark<E extends HTMLElement = HTMLDivElement>(
  wide: boolean,
): RefObject<E | null> {
  const live = useLive();
  const ref = useRef<E | null>(null);
  useLayoutEffect(() => {
    if (live && !wide) ref.current?.removeAttribute("data-wide");
  }, [live, wide]);
  return ref;
}

/**
 * First inside a part that uses `useWideMark`: in the build-time HTML, the script that
 * marks the part before the first paint; nothing once the page is live, or in a part first
 * rendered in the browser (a pop-up), which knows its screen from the start.
 */
export function WideMarkScript() {
  const live = useLive();
  if (live) return null;
  return <script dangerouslySetInnerHTML={{ __html: WIDE_BOOT }} />;
}
