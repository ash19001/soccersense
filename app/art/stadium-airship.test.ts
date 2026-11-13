import { describe, expect, it } from "vitest";

import { Surface } from "~/pixel";
import { menuLayout } from "~/art/layout";
import { lightingFor } from "~/art/lighting";
import { MenuBackdrop } from "~/art/stadium";
import {
  airshipDrift,
  airshipHit,
  paintAirship,
  signPlace,
  type Airship,
} from "~/art/stadium-airship";
import { pilotAt, type CrashSite } from "~/art/stadium-airship-fall";
import { ARRIVE, RETURN } from "~/art/stadium-airship-poke";
import { mascotZone } from "~/art/stadium-mascot";
import { makeView } from "~/art/stadium-view";

// The airship (the product owner: "keep the high resolution but fix its proportions",
// "make blimp slightly smaller", then "blimp even smaller and top left"): poking it, its
// pop and fall, its sign and the plane.

const day = lightingFor({ elevation: 45, morning: false });
const night = lightingFor({ elevation: -30, morning: false });

function ship(w: number, h: number, light = day): Airship {
  return paintAirship(signPlace(makeView(w, h)), light);
}

function backdrop(w: number, h: number): MenuBackdrop {
  const b = new MenuBackdrop({
    seed: 3,
    sign: {
      header: "DID YOU KNOW?",
      text: "THE FIRST FLOODLIT MATCH WAS IN 1878.",
    },
  });
  b.resize(w, h);
  b.setLighting(day);
  return b;
}

function holes(s: Surface): number {
  let n = 0;
  for (let i = 0; i < s.data.length; i++) if (s.data[i] === 0) n++;
  return n;
}

describe("the airship", { timeout: 60_000 }, () => {
  it("hangs high in the top left, clear of the wordmark and the screen's edge", () => {
    for (const [w, h] of [
      [960, 540],
      [854, 480],
      [683, 384],
      [1440, 720],
      [234, 507],
      [260, 563],
      [271, 601],
      [360, 640],
    ]) {
      const m = menuLayout(w, h);
      const p = signPlace(makeView(w, h));
      const at = `${w}x${h}`;
      // smaller than the layout's zone, in its proportions, with room for its lamps
      expect(p.size).toBeLessThan(0.7);
      expect(p.panel.h, at).toBeGreaterThanOrEqual(44);
      expect(p.panel.w, at).toBeGreaterThanOrEqual(112);
      // nose lamp, tail and drift inside the screen, on its left
      expect(p.x - p.rx - 6, at).toBeGreaterThanOrEqual(4);
      expect(p.x, at).toBeLessThan(w / 2);
      // beside the wordmark (the widest it is drawn), or under its zone
      const wordmark = Math.ceil(Math.min(w - 52, 264) / 2);
      const right = p.x + p.rx + 8;
      if (right < m.cx - wordmark) {
        expect(p.y - p.ry, at).toBeLessThanOrEqual(16);
      } else {
        expect(p.y - p.ry - 2, at).toBeGreaterThanOrEqual(m.logo.h);
      }
      // and above the far stand's roof, down to its gondola
      expect(p.y + p.ry + 16, at).toBeLessThan(m.stand.y);
    }
    // a monitor and 1366 x 768 have room beside the wordmark
    for (const [w, h] of [
      [960, 540],
      [683, 384],
    ]) {
      expect(signPlace(makeView(w, h)).y).toBeLessThan(menuLayout(w, h).logo.h);
    }
  });

  it("drifts a few pixels, and is hit on its propeller", () => {
    for (const t of [0, 3, 7.75, 15.5]) {
      const d = airshipDrift(t);
      expect(Math.abs(d.dx)).toBeLessThanOrEqual(4);
    }
    const s = ship(960, 540);
    // the propeller is hit a blade's length above its hub
    const p = s.props[0];
    expect(airshipHit(s, s.x + p.x, s.y + p.y - 6, 0, 0)).toBe(true);
    expect(airshipHit(s, s.x + p.x + 4, s.y + p.y + 14, 0, 0)).toBe(false);
  });

  it("is under the pointer on its sign and envelope, and not on the sky beside it", () => {
    for (const [w, h] of [
      [960, 540],
      [683, 384],
      [854, 480],
      [260, 562],
      [234, 507],
    ]) {
      const b = backdrop(w, h);
      const z = signPlace(makeView(w, h)).panel;
      expect(z.w).toBeLessThan(menuLayout(w, h).scoreboard.w);
      for (const t of [0, 3.7, 11]) {
        expect(b.airshipAt(z.x + z.w / 2, z.y + z.h / 2, t), `${w}x${h}`).toBe(
          true,
        );
        expect(b.airshipAt(z.x + 6, z.y + 6, t)).toBe(true);
        expect(b.airshipAt(z.x + z.w / 2, z.y - 64, t)).toBe(false);
        expect(b.airshipAt(z.x + z.w + 80, z.y + z.h / 2, t)).toBe(false);
      }
    }
  });

  it("draws every frame of a poke, a pop and a fall, at every size, without holes", () => {
    for (const [w, h] of [
      [960, 540],
      [683, 384],
      [260, 562],
      [234, 507],
    ] as const) {
      const b = backdrop(w, h);
      b.setLighting(night);
      const r: string[] = [];
      for (let i = 0; i < 8; i++) r.push(b.pokeAirship(1 + i * 0.15));
      expect(r).toContain("pop");
      const pop = 1 + r.indexOf("pop") * 0.15;
      const s = new Surface(w, h);
      for (let d = -0.6; d < RETURN + ARRIVE + 1; d += 0.37) {
        b.draw(s, pop + d);
        expect(holes(s), `${w}x${h} at ${d.toFixed(2)}`).toBe(0);
      }
    }
  }, 60_000);

  it("draws the same pixels for the same pokes and the same clock", () => {
    const pokes = [1, 1.2, 1.4, 4, 4.1, 4.2, 4.3, 4.4, 4.5];
    const a = backdrop(960, 540);
    const b = backdrop(960, 540);
    for (const t of pokes) expect(a.pokeAirship(t)).toBe(b.pokeAirship(t));
    const sa = new Surface(960, 540);
    const sb = new Surface(960, 540);
    let moved = 0;
    for (const t of [1.05, 1.5, 4.25, 4.6, 5.5, 7.5, 9, 13, 15.5, 20]) {
      a.draw(sa, t);
      b.draw(sb, 1.05);
      b.draw(sb, t);
      expect(sa.data, `t ${t}`).toEqual(sb.data);
      const u = new Surface(960, 540);
      backdrop(960, 540).draw(u, t);
      if (u.data.some((c, i) => c !== sa.data[i])) moved++;
    }
    expect(moved).toBeGreaterThan(6);
  }, 60_000);
});

describe("the sign's messages and the plane", { timeout: 60_000 }, () => {
  const MESSAGES = [
    { header: "Home today", text: "360 pts" },
    { header: "Daily streak", text: "4 days" },
  ];

  /** The lit lamps in the sign's panel at rest (drift taken out). */
  function panel(b: MenuBackdrop, w: number, h: number, t: number): string {
    const s = new Surface(w, h);
    b.draw(s, t);
    const z = signPlace(makeView(w, h)).panel;
    const d = airshipDrift(t);
    const out: number[] = [];
    for (let y = z.y + 4; y < z.y + z.h - 4; y++) {
      for (let x = z.x + 4; x < z.x + z.w - 4; x++) {
        out.push(s.get(x + d.dx, y + d.dy));
      }
    }
    return out.join();
  }

  it("shows the messages in turn instead of the fact", () => {
    const b = backdrop(960, 540);
    const fact = panel(b, 960, 540, 1);
    b.setMessages(MESSAGES);
    const first = panel(b, 960, 540, 1);
    const second = panel(b, 960, 540, 6);
    expect(first).not.toBe(fact);
    expect(second).not.toBe(first);
    // and round again
    expect(panel(b, 960, 540, 1 + 2 * (4 + 0.6))).toBe(first);
    b.setMessages([]);
    expect(panel(b, 960, 540, 1)).toBe(fact);
  });

  it("flies the plane with its banner by only while a pass is on", () => {
    const a = backdrop(960, 540);
    const b = backdrop(960, 540);
    b.setBanner("Did you know? Goal nets arrived in 1889.");
    const sa = new Surface(960, 540);
    const sb = new Surface(960, 540);
    a.draw(sa, 3);
    b.draw(sb, 3);
    expect(sb.data).toEqual(sa.data);
    a.draw(sa, 14);
    b.draw(sb, 14);
    let differ = 0;
    for (let i = 0; i < sa.data.length; i++)
      if (sa.data[i] !== sb.data[i]) differ++;
    expect(differ).toBeGreaterThan(1500);
  });

  it("never lets the pilot's parachute drift across the mascot", () => {
    for (const [w, h] of [
      [960, 540],
      [683, 384],
      [854, 480],
      [720, 450],
    ]) {
      for (const seed of [1, 2, 3, 4]) {
        const b = new MenuBackdrop({
          seed,
          sign: { header: "A", text: "B" },
        });
        b.resize(w, h);
        b.setLighting(day);
        const spot = b.mascotSpot();
        if (!spot) continue;
        const z = mascotZone(spot);
        const { ship, site } = (
          b as unknown as { paint(): { ship: Airship; site: CrashSite } }
        ).paint();
        // the canopy and the pilot under it, all the way down, whenever it bursts
        for (const popT of [1, 8.3, 16.7, 24.1]) {
          for (let since = 0.1; since < 7; since += 0.05) {
            const p = pilotAt(ship, site, popT, since);
            const x0 = p.x - 8;
            const x1 = p.x + 9;
            const y0 = p.y - 18;
            const y1 = p.y + 1;
            const over =
              x0 < z.x + z.w && z.x < x1 && y0 < z.y + z.h && z.y < y1;
            expect(over, `${w}x${h} seed ${seed} at ${since.toFixed(2)}`).toBe(
              false,
            );
          }
        }
      }
    }
  });
});
