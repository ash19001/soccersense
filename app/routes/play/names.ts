// The game's own words for a result, as the full-time card, the share picture and the home
// screen's review say them, and the words SHARE sends with the picture. Pure: from the
// interface text.

import { type Mode, careerFor, titleFor } from "~/game";
import { strings } from "~/i18n";

/** The tier's name, as the board and the card show it. */
export function tierName(total: number): string {
  return strings.play.tiers[careerFor(total).id];
}

/** The title a total earned in a mode, as the full-time card and the share picture show it. */
export function titleName(mode: Mode, total: number): string {
  const titles: Readonly<Record<string, string>> = strings.play.titles[mode];
  return titles[titleFor(mode, total)] ?? "";
}

/** The mode's name as the badge shows it: "NEXT-GEN". */
export function modeName(mode: Mode): string {
  return strings.home.modes[mode].label;
}

/**
 * The text SHARE copies (and hands to the share sheet) with the picture, the same wherever
 * SHARE is pressed and whatever the game was:
 *
 *     Check out what I got on soccersense!
 *     Test your football trivia on https://...
 *
 * It says nothing of the result: that is the picture's (the product owner, 2026-11-17: "it
 * shouldn't say all that extra stuff because it's in the image. Only first line and last
 * line"). `link` is the address to send people to (`shareLink()` in ./share-image.ts). With
 * none, the second line is left out.
 */
export function shareText(link: string): string {
  const words = strings.play.fullTime.message;
  return link ? `${words.intro}\n${words.invite(link)}` : words.intro;
}
