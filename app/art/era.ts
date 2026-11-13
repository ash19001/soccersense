/**
 * The era a picture is drawn in (.snaps/era-art/THEME.md): today's game (HOME and AWAY),
 * the early days of the game (RETRO) or the future (NEXT-GEN). The mode decides it once
 * (`eraOf`); the career scene hands it to every painter as a parameter, never a global.
 * Every painter takes it as an optional argument that defaults to "today", so HOME and
 * AWAY draw exactly as before.
 */

import type { Mode } from "~/game/types";

export type Era = "today" | "retro" | "nextgen";

export const ERAS: readonly Era[] = ["today", "retro", "nextgen"];

/** The era a mode is drawn in: RETRO's and NEXT-GEN's own, today's for every other mode. */
export function eraOf(mode: Mode): Era {
  return mode === "retro" ? "retro" : mode === "nextgen" ? "nextgen" : "today";
}
