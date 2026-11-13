/**
 * The art once had two detail levels, and `?detail=1` asked for the old one, remembered for
 * the tab in `sessionStorage` under this key. There is one level now (the art is simply
 * drawn at twice the old detail), and `?detail` means nothing: `PixelRoot` calls
 * `forgetDetailChoice` after it mounts, so a tab that still remembers a choice from before
 * loses it on its first visit. The key lives only as long as the tab, so this can go once
 * no tab from before the change can be open.
 */

/** Where a tab remembered its choice of the old art (`sessionStorage`). */
export const OLD_DETAIL_STORAGE_KEY = "soccersense:detail";

/**
 * Browser only (an effect or a handler): forget any choice of detail the tab remembers.
 * Free to call again; it never throws (blocked storage is left as it is).
 */
export function forgetDetailChoice(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage?.removeItem(OLD_DETAIL_STORAGE_KEY);
  } catch {
    // Blocked storage: nothing to forget that anything still reads.
  }
}
