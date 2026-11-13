// The game's own words for a result, as the full-time card, the share text, the share
// picture and the home screen's review say them. Pure: from the interface text.

import { type Mode, careerFor, titleFor } from "~/game";
import { strings } from "~/i18n";

/** The tier's name, as the board and the card show it. */
export function tierName(total: number): string {
  return strings.play.tiers[careerFor(total).id];
}

/** The title a total earned in a mode, as the full-time card and the share text show it. */
export function titleName(mode: Mode, total: number): string {
  const titles: Readonly<Record<string, string>> = strings.play.titles[mode];
  return titles[titleFor(mode, total)] ?? "";
}

/** The mode's name as the badge shows it: "NEXT-GEN". */
export function modeName(mode: Mode): string {
  return strings.home.modes[mode].label;
}
