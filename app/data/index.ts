import type { Mode, Question } from "~/game/types";

import { AWAY_QUESTIONS } from "./questions/away";
import { HOME_QUESTIONS } from "./questions/home";

export { STADIUMS } from "./stadiums";
export { AWAY_QUESTIONS, HOME_QUESTIONS };

export function questionsFor(mode: Mode): Question[] {
  return mode === "home" ? HOME_QUESTIONS : AWAY_QUESTIONS;
}
