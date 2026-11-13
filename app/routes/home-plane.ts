// Whether the plane towing the fact of the day flies over the home screen. Pure: from the
// scale alone.

import type { PixelScale } from "~/ui";

/**
 * A screen whose shorter side is at least this many CSS px is large enough for the plane.
 * Every phone is narrower than this either way up (the widest are about 440); a small
 * tablet (744), a laptop (768 high) and a monitor are not.
 */
export const PLANE_MIN_SIDE = 500;

/**
 * True on a large screen. On a phone the sky is crowded enough with the wordmark and the
 * airship, so the plane stays away (2026-11-13).
 */
export function planeFits(scale: PixelScale): boolean {
  const side = Math.min(scale.logicalW, scale.logicalH) * scale.px;
  return side >= PLANE_MIN_SIDE;
}
