/**
 * What the game page asks of its scene (app/routes/play/controller.ts): the career for HOME,
 * AWAY, RETRO and NEXT-GEN (./career.ts), the world map for CLOSEST and FURTHEST (./map.ts).
 */

import type { Grade } from "~/game/types";

import type { Scene } from "./scene";

/** Where an answer's ball comes down, in CLOSEST and FURTHEST: its place and how far. */
export interface ShotLanding {
  lat: number;
  lng: number;
  /** Whole kilometres from the day's place, or null if not known. */
  km: number | null;
}

export interface GameScene extends Scene {
  /** The total so far, as the scene shows it (the career's tier). */
  setTotal(total: number): void;
  /** Wait on ink: the mode card is up over it. */
  holdOpening(): void;
  /** The card has gone: the scene opens. */
  beginOpening(): void;
  /** True while it waits on ink. */
  readonly waiting: boolean;
  /**
   * The turn's shot: called back once it has played. `landing`: where the answer's ball
   * comes down, for the map (the career has no use for it).
   */
  playShot(
    shot: Grade,
    onDone?: () => void,
    landing?: ShotLanding | null,
  ): void;
  /** The total crossed a tier: called back once it has played. */
  promote(total: number, onDone?: () => void): void;
  /** Full time. */
  showFullTime(total: number): void;
  /** A new question is being asked (the map comes back to its pin). */
  ask?(): void;
  /**
   * The board over the picture ends at row `y` of it (the page measures it: scene-edges.ts):
   * the map keeps the day's place and its name under it. The career has no use for it.
   */
  setCeiling?(y: number | null): void;
}
