/**
 * The modes as pages and in turn: the address each one is played at, and the mode that
 * comes after it (the full-time card's way on to the next). Pure. The list of modes in the
 * menu's order is `MODES` (./storage.ts); the rule each is scored by, `MODE_RULES`.
 */
import { MODES } from "./storage";
import type { EraMode, Mode } from "./types";

/** The two modes ranked by an answer's year: RETRO, then NEXT-GEN. */
export const ERA_MODES: readonly EraMode[] = ["retro", "nextgen"];

/** Whether a mode is ranked by an answer's year (RETRO, NEXT-GEN) rather than its share. */
export function isEraMode(mode: Mode): mode is EraMode {
  return mode === "retro" || mode === "nextgen";
}

/**
 * The last part of each mode's address: `/play/home`, `/play/away`, `/play/retro`,
 * `/play/next-gen` (written as the mode's name is, with its hyphen).
 */
export const MODE_SLUGS: Readonly<Record<Mode, string>> = Object.freeze({
  home: "home",
  away: "away",
  retro: "retro",
  nextgen: "next-gen",
});

/** The page a mode is played at: "/play/next-gen". */
export function playPath(mode: Mode): string {
  return `/play/${MODE_SLUGS[mode]}`;
}

/**
 * The mode of a play page's address, from its last part: "/play/next-gen" (or the mode's
 * own id, "/play/nextgen") is NEXT-GEN. HOME for anything else.
 */
export function modeOfPath(pathname: string): Mode {
  const last = /([a-z-]+)\/?$/.exec(pathname.toLowerCase())?.[1] ?? "";
  for (const [mode, slug] of Object.entries(MODE_SLUGS) as [Mode, string][]) {
    if (last === slug || last === mode) return mode;
  }
  return "home";
}

/**
 * The mode the full-time card offers next (the product owner, 2026-11-15: "it should always
 * direct to next available game mode"): the first after `mode` in the menu's order, HOME,
 * AWAY, RETRO, NEXT-GEN and round to HOME again, that `played` says has not been played
 * today. Null when all the others have. The locked modes (CLOSEST, FURTHEST) are not modes
 * yet, so they are never offered.
 */
export function nextMode(
  mode: Mode,
  played: (mode: Mode) => boolean,
): Mode | null {
  const at = MODES.indexOf(mode);
  for (let k = 1; k < MODES.length; k++) {
    const next = MODES[(at + k) % MODES.length];
    if (!played(next)) return next;
  }
  return null;
}
