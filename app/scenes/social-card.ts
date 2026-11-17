/**
 * The link preview's picture: what a chat, a feed or a search result shows beside a link to
 * the site (the page's `og:image`, app/routes/seo.ts).
 *
 *   const card = drawSocialCard({ labels, sign });   // 600 x 315
 *   encodePng(card, SOCIAL_CARD.scale);              // 1200 x 630, the size previews ask for
 *
 * It is the home screen itself, by day, at rest: the wordmark, the ball in front of the
 * stadium, the town behind. A preview is small (often 500 pixels across, less on a phone),
 * so the scene is drawn small and magnified twice: the wordmark is then a third of the
 * picture's width and still reads at a thumbnail's size. At this size the ball shows each
 * mode's badge and not its name, as it does in a small window.
 *
 * The airship's sign says what the site is (`sign`), in place of the fact of the day: a
 * fact scrolls, and a still would cut it off mid-word.
 *
 * Pure: no clock, no randomness. `tools/social-card.ts` writes `public/social-card.png`
 * from it (`pnpm social-card`), and a test holds the file to this drawing.
 */

import { Surface } from "~/pixel";
import { lightingFor } from "~/art/lighting";
import type { MenuSign } from "~/art/stadium";
import { MenuScene, type MenuLabels } from "./menu";

/** The picture's size in its own pixels, and the whole-number scale it is saved at. */
export const SOCIAL_CARD = Object.freeze({ w: 600, h: 315, scale: 2 });

/** The day whose picture it is: day 1's stadium and its club's colours. */
const DAY = 1;

/** What the picture says: the home screen's own words, and the airship's sign. */
export interface SocialCardWords {
  labels: MenuLabels;
  /** Short: neither line scrolls in a still. */
  sign: MenuSign;
}

/** The link preview's picture, 600 x 315. */
export function drawSocialCard(words: SocialCardWords): Surface {
  const scene = new MenuScene({
    seed: DAY,
    fact: "",
    messages: [words.sign],
    labels: words.labels,
    intro: false,
  });
  scene.resize(SOCIAL_CARD.w, SOCIAL_CARD.h);
  scene.setLighting(lightingFor({ elevation: 45, morning: false }));
  const s = new Surface(SOCIAL_CARD.w, SOCIAL_CARD.h);
  scene.draw(s);
  return s;
}
