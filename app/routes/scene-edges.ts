/**
 * Where the interface over a picture begins and ends, told to its scene in the picture's own
 * pixels, so that what matters in the picture stays clear of it:
 *
 * - the home page's cards under the ball (`watchFloor`, MenuScene.setFloor): the ball rests
 *   above them (2026-11-18);
 * - the game page's board over the map (`watchCeiling`, MapScene.setCeiling): the day's place
 *   and its name stay under it (2026-11-18: on a monitor the name ran into the board).
 *
 * Measured as laid out (offsetTop, which leaves transforms out: the captions slide off the
 * screen at the kick-off, and that is not a new place for them), and again whenever the
 * window, the picture or the measured part changes size.
 */

/** Anything with a floor to set: the home screen's MenuScene. */
export interface HasFloor {
  setFloor(y: number | null): void;
}

/** Anything with a ceiling to set: CLOSEST's and FURTHEST's MapScene. */
export interface HasCeiling {
  setCeiling?(y: number | null): void;
}

/** The top of `el`'s box, from the top of the page or the fixed box it is in, as laid out. */
function layoutTop(el: HTMLElement): number {
  let top = 0;
  for (
    let at: HTMLElement | null = el;
    at;
    at = at.offsetParent instanceof HTMLElement ? at.offsetParent : null
  ) {
    top += at.offsetTop;
  }
  return top;
}

/** The picture (not the floating sprites over it). */
function canvasOf(doc: Document): HTMLCanvasElement | null {
  return doc.querySelector<HTMLCanvasElement>(
    ".ss-stage__canvas:not(.ss-stage__float)",
  );
}

/** A row of the page, `y` CSS pixels from its top, as a row of the picture. */
function toPicture(canvas: HTMLCanvasElement, y: number): number | null {
  if (canvas.offsetHeight <= 0) return null;
  return ((y - layoutTop(canvas)) * canvas.height) / canvas.offsetHeight;
}

/**
 * The row of the picture the cards begin at: the top of the highest card under it, or null
 * where there is no picture or no card to measure.
 */
export function measureFloor(doc: Document): number | null {
  const canvas = canvasOf(doc);
  const cards = doc.querySelectorAll<HTMLElement>(".ss-menu .ss-menu__card");
  if (!canvas || cards.length === 0) return null;
  let top = Infinity;
  for (const card of cards) top = Math.min(top, layoutTop(card));
  const y = toPicture(canvas, top);
  return y === null ? null : Math.floor(y);
}

/**
 * The row of the picture the board over it ends at, while it is a question's (its tallest:
 * a reveal's is cut down), or null where there is none to measure then.
 */
export function measureCeiling(doc: Document): number | null {
  const canvas = canvasOf(doc);
  const board = doc.querySelector<HTMLElement>(".ss-board");
  if (!canvas || !board || board.classList.contains("ss-board--compact")) {
    return null;
  }
  const y = toPicture(canvas, layoutTop(board) + board.offsetHeight);
  return y === null ? null : Math.ceil(y);
}

/**
 * Call `measure` now and whenever the window, the picture or `parts` change size, until the
 * returned function is called. A part made later (the board comes after the mode card) is
 * watched from when it is there: the page's changes are looked through for one, and nothing
 * more is done for the rest of them (the clock, the typed question).
 */
function watch(doc: Document, measure: () => void, parts: string): () => void {
  measure();
  if (typeof ResizeObserver === "undefined") return () => {};
  const sizes = new ResizeObserver(measure);
  const watched = new Set<Element>();
  /** Watch what is not watched yet; true if there was any. */
  const observe = (): boolean => {
    let found = false;
    for (const el of [canvasOf(doc), ...doc.querySelectorAll(parts)]) {
      if (el && !watched.has(el)) {
        watched.add(el);
        sizes.observe(el);
        found = true;
      }
    }
    return found;
  };
  sizes.observe(doc.documentElement);
  observe();
  const changes =
    typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver(() => {
          if (observe()) measure();
        });
  changes?.observe(doc.body, { childList: true, subtree: true });
  return () => {
    sizes.disconnect();
    changes?.disconnect();
  };
}

/** Keep `scene`'s floor up to date until the returned function is called. */
export function watchFloor(
  scene: HasFloor,
  doc: Document = document,
): () => void {
  return watch(
    doc,
    () => {
      const y = measureFloor(doc);
      if (y !== null) scene.setFloor(y);
    },
    ".ss-menu",
  );
}

/**
 * Keep `scene`'s ceiling up to date until the returned function is called. A board cut
 * down for a reveal, or no board, leaves it where the last question's put it.
 */
export function watchCeiling(
  scene: HasCeiling,
  doc: Document = document,
): () => void {
  if (!scene.setCeiling) return () => {};
  return watch(
    doc,
    () => {
      const y = measureCeiling(doc);
      if (y !== null) scene.setCeiling?.(y);
    },
    ".ss-board",
  );
}
