import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

import { type Slider, createSlider, prefersReducedMotion } from "./slide";

/**
 * Marks everything that leaves at the kick-off by sliding down off the screen (the menu
 * captions, and on a phone the trophy button): they all go the same distance, so they move
 * together.
 */
export const STOW_ATTR = "data-stow";

/** The top of `el` on screen as it would be without its transform (a translate). */
function restingTop(el: Element): number {
  const top = el.getBoundingClientRect().top;
  if (typeof DOMMatrixReadOnly !== "function") return top;
  const transform = getComputedStyle(el).transform;
  if (!transform || transform === "none") return top;
  try {
    return top - new DOMMatrixReadOnly(transform).m42;
  } catch {
    return top;
  }
}

/**
 * How far down (CSS px) the things marked `STOW_ATTR` go so that the highest of them is
 * just off the bottom of the screen; null where that cannot be measured.
 */
export function stowDistance(doc: Document): number | null {
  const height = doc.defaultView?.innerHeight ?? 0;
  let top = Infinity;
  for (const el of doc.querySelectorAll(`[${STOW_ATTR}]`)) {
    top = Math.min(top, restingTop(el));
  }
  if (!(height > 0) || !Number.isFinite(top)) return null;
  const distance = Math.ceil(height - top);
  return distance > 0 ? distance : null;
}

/** Back to the resting state the classes give. */
function settle(el: HTMLElement | null): void {
  el?.style.removeProperty("transform");
  el?.removeAttribute("data-sliding");
}

/**
 * The kick-off's way out for an element marked `STOW_ATTR`: when `stowed` turns on it
 * slides down off the screen with `createSlider` (every frame, eased, on whole device
 * pixels), held in view by `data-sliding` while it moves; at rest its `is-stowed` class
 * hides it. Coming back is instant, and so is everything under reduced motion.
 */
export function useStowSlide(
  ref: RefObject<HTMLElement | null>,
  stowed: boolean,
): void {
  const slide = useRef<Slider | null>(null);
  const was = useRef(stowed);

  useLayoutEffect(() => {
    const el = ref.current;
    const before = was.current;
    was.current = stowed;
    if (!el) return;
    const slider = (slide.current ??= createSlider({
      apply: (y) => {
        ref.current?.style.setProperty("transform", `translateY(${y}px)`);
      },
      end: () => settle(ref.current),
    }));
    if (!stowed || before === stowed || prefersReducedMotion()) {
      slider.stop();
      settle(el);
      return;
    }
    const distance = stowDistance(el.ownerDocument);
    if (distance === null) {
      slider.stop();
      settle(el);
      return;
    }
    el.setAttribute("data-sliding", "");
    slider.to(distance, 0);
  }, [ref, stowed]);

  useEffect(() => () => slide.current?.stop(), []);
}
