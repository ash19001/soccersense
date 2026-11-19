/**
 * CLOSEST's and FURTHEST's sample questions (2026-11-18): ranked by how far each answer's
 * place is from the day's place (`placeForDay`, ../places.ts), nearest first in CLOSEST and
 * furthest first in FURTHEST.
 *
 * For testing only, until the weekly drafts have their own: each is one of the other modes'
 * sample questions whose answers are spread over the world, under its own id, with every
 * place and coordinate as that question checked it (docs/data-notes). So a player of the
 * sample meets the same question in two modes. A distance mode's shots are worked out from
 * the day's place as it is played (`shotsOf`), never filed: the shots these answers carry
 * are their first mode's, and are not read.
 */

import type { DistanceMode, Question } from "~/game/types";

import { AWAY_QUESTIONS } from "./away";
import { HOME_QUESTIONS } from "./home";
import { NEXT_GEN_QUESTIONS } from "./next-gen";
import { RETRO_QUESTIONS } from "./retro";

/** Another mode's sample question, as the sample's question of a distance mode. */
function asDistance(mode: DistanceMode, from: Question | undefined): Question {
  if (!from) throw new Error(`a ${mode} sample question is missing`);
  return { ...from, id: `${mode}-${from.id}`, mode };
}

/**
 * A distance mode's sample: each of the other modes' sample questions named by its prompt.
 * Its calls below are marked pure (\`@__PURE__\`): without that the bundler kept the lists in
 * the page's code, where nothing reads them, and with them every sample answer (a
 * production page has none: CLAUDE.md).
 */
function distanceSample(
  mode: DistanceMode,
  picks: readonly (readonly [readonly Question[], string])[],
): Question[] {
  return picks.map(([list, prompt]) =>
    asDistance(
      mode,
      list.find((q) => q.prompt === prompt),
    ),
  );
}

/** CLOSEST: the answer nearest the day's place wins. */
export const CLOSEST_QUESTIONS: Question[] = /* @__PURE__ */ distanceSample(
  "closest",
  [
    [HOME_QUESTIONS, "Name a men's Ballon d'Or winner"],
    [AWAY_QUESTIONS, "Name a stadium that has hosted a men's World Cup final"],
    [HOME_QUESTIONS, "Name a country that has won the men's World Cup"],
    [NEXT_GEN_QUESTIONS, "Name a club that has won the FIFA Club World Cup"],
    [AWAY_QUESTIONS, "Name a club that has won the Copa Libertadores"],
    [RETRO_QUESTIONS, "Name a country that has hosted the men's Euros"],
    [
      HOME_QUESTIONS,
      "Name a club that has won the European Cup or Champions League",
    ],
  ],
);

/** FURTHEST: the answer furthest from the day's place wins. */
export const FURTHEST_QUESTIONS: Question[] = /* @__PURE__ */ distanceSample(
  "furthest",
  [
    [AWAY_QUESTIONS, "Name a country that has hosted the men's World Cup"],
    [AWAY_QUESTIONS, "Name a men's World Cup top scorer (Golden Boot winner)"],
    [AWAY_QUESTIONS, "Name a country that has won the Africa Cup of Nations"],
    [
      AWAY_QUESTIONS,
      "Name a manager who has won the Champions League (1993 onwards)",
    ],
    [
      RETRO_QUESTIONS,
      "Name a country that has won men's Olympic football gold",
    ],
    [
      NEXT_GEN_QUESTIONS,
      "Name a country that has played in a men's World Cup final",
    ],
    [HOME_QUESTIONS, "Name a Premier League Golden Boot winner"],
  ],
);
