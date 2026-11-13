/**
 * RETRO's near crowd from behind (tiers 3 to 7): light enough to read as a crowd in his
 * colours, not a dark mush; caps that separate from the coats; a scarf on about one in five.
 */

import { describe, expect, it } from "vitest";
import { lightingFor } from "~/art/lighting";
import { P } from "~/art/palette";
import { type Color } from "~/pixel";
import { geoFor, paintFor } from "./paint";
import { BACK_BOWLER, BACK_CAP } from "./people";
import { CREAM, retroNearDress } from "./retro-near-crowd";
import type { Tier } from "./types";

const DAY = lightingFor({ elevation: 30, morning: true });

function census(tier: Tier) {
  const p = paintFor(geoFor(960, 540), DAY, tier, "retro", 7, {}, "retro");
  const pale: readonly Color[] =
    tier >= 5
      ? [P.chalk, CREAM, P.brick, P.brickLight]
      : [P.chalk, CREAM, P.retro, P.retroLight];
  const n = { all: 0, pale: 0, navy: 0, scarf: 0, hats: 0, sameCap: 0 };
  for (let y = 0; y < 60; y++) {
    for (let x = 0; x < 60; x++) {
      const d = retroNearDress(p, x * 12, y * 10);
      n.all++;
      if (pale.includes(d.body)) n.pale++;
      if (d.body === P.night || d.body === P.slate) n.navy++;
      if (d.scarf) n.scarf++;
      if (d.style === BACK_CAP || d.style === BACK_BOWLER) {
        n.hats++;
        if (d.hat === d.body) n.sameCap++;
      }
    }
  }
  return n;
}

describe("RETRO's near crowd", () => {
  for (const tier of [3, 4, 5, 7] as Tier[]) {
    it(`dresses over 40% in pale and his colours, navy under 30%, at tier ${tier}`, () => {
      const n = census(tier);
      expect(n.pale / n.all).toBeGreaterThan(0.4);
      expect(n.navy / n.all).toBeLessThan(0.3);
    });
  }

  it("puts a scarf on about one fan in five, and never a cap the colour of its coat", () => {
    const n = census(4);
    expect(n.scarf / n.all).toBeGreaterThan(0.14);
    expect(n.scarf / n.all).toBeLessThan(0.26);
    expect(n.hats / n.all).toBeGreaterThan(0.4);
    expect(n.sameCap).toBe(0);
  });
});
