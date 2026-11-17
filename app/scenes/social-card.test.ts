// @vitest-environment node
// The link preview's picture: the drawing (social-card.ts), and the file the site serves
// (public/social-card.png), which must hold exactly that drawing.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { P } from "~/art/palette";
import { strings } from "~/i18n";
import { TRANSPARENT, type Surface } from "~/pixel";
import { SOCIAL_IMAGE, socialCardWords } from "~/routes/seo";
import { decodePng } from "../../tools/png";
import { SOCIAL_CARD, drawSocialCard } from "./social-card";

const W: number = SOCIAL_CARD.w;
const H: number = SOCIAL_CARD.h;
const K: number = SOCIAL_CARD.scale;

/** How many pixels of `a` differ from `b`'s, inside a rectangle. */
function differing(
  a: Surface,
  b: Surface,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) if (a.get(x, y) !== b.get(x, y)) n++;
  }
  return n;
}

describe("the link preview's picture", () => {
  const card = drawSocialCard(socialCardWords());

  it("is the size previews ask for once magnified: 1200 x 630", () => {
    expect([card.w, card.h]).toEqual([W, H]);
    expect([W * K, H * K]).toEqual([SOCIAL_IMAGE.width, SOCIAL_IMAGE.height]);
    // and close to the 1.91 to 1 a preview is cropped to
    expect(W / H).toBeCloseTo(1.91, 1);
  });

  it("is painted all over: a preview shows it on any colour of page", () => {
    let clear = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) if (card.get(x, y) === TRANSPARENT) clear++;
    }
    expect(clear).toBe(0);
  });

  it("is the same picture every time", () => {
    const again = drawSocialCard(socialCardWords());
    expect(differing(card, again, 0, 0, W, H)).toBe(0);
  });

  it("says what the site is on the airship's sign, whole, where the fact would scroll", () => {
    // the sign is in the top left quarter: other words there change it, and only it
    const other = drawSocialCard({
      ...socialCardWords(),
      sign: { header: "DAILY FOOTBALL", text: "QUIZZES" },
    });
    expect(differing(card, other, 0, 0, W / 2, H / 2)).toBeGreaterThan(20);
    expect(differing(card, other, W / 2, 0, W, H)).toBe(0);
    expect(differing(card, other, 0, H / 2, W, H)).toBe(0);
    // both lines fit the sign, so neither scrolls: a longer second line would be cut off
    expect(strings.seo.cardSign.header.length).toBeLessThanOrEqual(14);
    expect(strings.seo.cardSign.text.length).toBeLessThanOrEqual(10);
    // and the description of the picture quotes the sign as it reads
    expect(strings.seo.cardAlt).toContain(
      `${strings.seo.cardSign.header} ${strings.seo.cardSign.text}`,
    );
  });

  it("has the wordmark across the top, in the middle, with clear sky either side", () => {
    // the wordmark's plate is ink: its columns are the ones with a lot of ink in the top
    // band (a bird in the sky is a pixel or two of it)
    const top = Math.round(H * 0.15);
    let x0 = W;
    let x1 = -1;
    for (let x = 0; x < W; x++) {
      let ink = 0;
      for (let y = 0; y < top; y++) if (card.get(x, y) === P.ink) ink++;
      if (ink < 6) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
    }
    expect(x1).toBeGreaterThan(x0);
    // a third of the picture's width or more: it reads at a thumbnail's size
    expect(x1 - x0 + 1).toBeGreaterThan(W / 3);
    expect(Math.abs((x0 + x1) / 2 - (W - 1) / 2)).toBeLessThanOrEqual(2);
    expect(x0).toBeGreaterThan(W * 0.2);
  });
});

describe("public/social-card.png", () => {
  const file = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "public",
      SOCIAL_IMAGE.path.slice(1),
    ),
  );

  it("is small enough for every preview to take: under 300 KB", () => {
    expect(file.length).toBeLessThan(300_000);
  });

  it("holds exactly the drawing, every pixel of it twice across and down (pnpm seo)", () => {
    const { w, h, rgba } = decodePng(file);
    expect([w, h]).toEqual([SOCIAL_IMAGE.width, SOCIAL_IMAGE.height]);
    const card = drawSocialCard(socialCardWords());
    let wrong = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = card.get(Math.floor(x / K), Math.floor(y / K));
        const o = (y * w + x) * 4;
        if (
          rgba[o] !== (c & 0xff) ||
          rgba[o + 1] !== ((c >>> 8) & 0xff) ||
          rgba[o + 2] !== ((c >>> 16) & 0xff) ||
          rgba[o + 3] !== c >>> 24
        ) {
          wrong++;
        }
      }
    }
    // not this many: the home screen's art has changed since the file was written
    expect(wrong, "run `pnpm seo` to write the picture again").toBe(0);
  });
});
