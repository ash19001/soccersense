import type { Mode, Question } from "~/game/types";

import { AWAY_QUESTIONS } from "./questions/away";
import { HOME_QUESTIONS } from "./questions/home";
import { NEXT_GEN_QUESTIONS } from "./questions/next-gen";
import { RETRO_QUESTIONS } from "./questions/retro";

export { STADIUMS } from "./stadiums";
export { AWAY_QUESTIONS, HOME_QUESTIONS, NEXT_GEN_QUESTIONS, RETRO_QUESTIONS };

/** Each mode's seven questions. RETRO's and NEXT-GEN's carry every answer's years. */
const QUESTIONS: Readonly<Record<Mode, Question[]>> = {
  home: HOME_QUESTIONS,
  away: AWAY_QUESTIONS,
  retro: RETRO_QUESTIONS,
  nextgen: NEXT_GEN_QUESTIONS,
};

/**
 * The questions a mode plays (the demo ships one fixed set per mode); HOME's for anything
 * unknown.
 */
export function questionsFor(mode: Mode): Question[] {
  return Object.hasOwn(QUESTIONS, mode) ? QUESTIONS[mode] : HOME_QUESTIONS;
}
