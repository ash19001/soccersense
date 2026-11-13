// What the how-to-play card says, from the interface text and the game's own numbers: the
// pop-up on the home screen and the page at /how-to-play show the same card.

import { SHOT_ORDER, SHOT_POINTS, TIERS } from "~/game";
import { strings } from "~/i18n";
import type { HowToPlayCardProps } from "~/ui";

export type HowToPlayContent = Pick<
  HowToPlayCardProps,
  "labels" | "shots" | "tiers"
>;

export function howToPlayContent(): HowToPlayContent {
  const text = strings.howToPlay;
  return {
    labels: {
      heading: text.heading,
      close: text.close,
      intro: text.intro,
      shots: text.shots.heading,
      points: text.shots.points,
      career: text.career.heading,
      step: text.career.step,
      disclaimer: strings.legal.disclaimer,
    },
    shots: SHOT_ORDER.map((shot) => ({
      grade: shot,
      label: strings.play.shots[shot],
      points: SHOT_POINTS[shot],
    })),
    tiers: TIERS.map((tier) => ({
      name: strings.play.tiers[tier.id],
      from: tier.from,
    })),
  };
}
