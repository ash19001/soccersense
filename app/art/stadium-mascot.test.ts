import { describe, expect, it } from "vitest";
import { Surface, toRgb, type Color } from "~/pixel";
import { lightingFor } from "~/art/lighting";
import { MenuBackdrop } from "~/art/stadium";
import type { CrashSite } from "~/art/stadium-airship-fall";
import { P } from "~/art/palette";
import {
  MascotPokes,
  POSES,
  TRICKS,
  drawMascot,
  MASCOT_BOX,
  mascotFrame,
  mascotZone,
} from "~/art/stadium-mascot";
import { DEFAULT_SCHEME } from "~/art/stadium-club";
import { person } from "~/art/stadium-things";
import { personLook } from "~/art/stadium-town";
import type { Town } from "~/art/stadium-town";
import type { Life } from "~/art/stadium-life";
import { project, type View } from "~/art/stadium-view";

// The mascot, a black cat in the club's kit: where he stands, his box, his size against the walkers (G's people), his
// poses and tricks, and the airship's crash and its pilot clear of him.

function backdrop(w = 960, h = 540, seed = 1): MenuBackdrop {
  const b = new MenuBackdrop({ seed, sign: { header: "A", text: "B" } });
  b.resize(w, h);
  return b;
}

const light = lightingFor({ elevation: 45, morning: false });

/** The box of what was drawn on `s` above row `below`. */
function extent(s: Surface, below = s.h) {
  let top = s.h;
  let bottom = -1;
  let left = s.w;
  let right = -1;
  for (let y = 0; y < below; y++) {
    for (let x = 0; x < s.w; x++) {
      if (s.get(x, y) === 0) continue;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  return { h: bottom - top + 1, w: right - left + 1, top, left, right };
}

function mascotExtent(frame: ReturnType<typeof mascotFrame>) {
  const s = new Surface(60, 60);
  drawMascot(s, 30, 45, { ...frame, ball: { x: 40, h: 0 } }, light);
  // above his shadow
  return extent(s, 46);
}

describe("the mascot", { timeout: 60_000 }, () => {
  it("stands on the lawn on a monitor, and is not there on a phone", () => {
    for (const [w, h] of [
      [960, 540],
      [683, 384],
      [854, 480],
      [1280, 720],
    ]) {
      const spot = backdrop(w, h).mascotSpot();
      expect(spot, `${w}x${h}`).not.toBeNull();
      expect(spot!.x).toBeLessThan(w / 2 - 80);
    }
    for (const [w, h] of [
      [260, 562],
      [234, 507],
    ]) {
      const phone = backdrop(w, h);
      expect(phone.mascotSpot(), `${w}x${h}`).toBeNull();
      expect(phone.pokeMascot(0)).toBe("busy");
    }
  });

  it("is under the pointer on him, and not beside him", () => {
    const b = backdrop();
    const s = b.mascotSpot()!;
    // his boots, his head, his ball at rest, his paws
    expect(b.mascotAt(s.x, s.y, 0)).toBe(true);
    expect(b.mascotAt(s.x, s.y - 17, 0)).toBe(true);
    expect(b.mascotAt(s.x + 11, s.y - 2, 0)).toBe(true);
    expect(b.mascotAt(s.x - 8, s.y - 7, 0)).toBe(true);
    expect(b.mascotAt(s.x + 30, s.y - 10, 0)).toBe(false);
    expect(b.mascotAt(s.x - 22, s.y - 10, 0)).toBe(false);
    expect(b.mascotAt(s.x, s.y - 50, 0)).toBe(false);
    // and the box is his
    const z = mascotZone(s);
    expect(z.w).toBe(MASCOT_BOX.left + MASCOT_BOX.right + 1);
    expect(z.h).toBe(MASCOT_BOX.up + MASCOT_BOX.down + 1);
  });

  it("is a person in a big costume beside the people: about twice a walker's height, never a giant", () => {
    // the nearest walker (G's person, the near size class)
    const walker = new Surface(40, 40);
    const look = personLook(light.lit, 0.3, 0, DEFAULT_SCHEME);
    person(walker, 20, 30, 2, look);

    const p = extent(walker);
    expect(p.h).toBeGreaterThanOrEqual(9);
    expect(p.h).toBeLessThanOrEqual(11);
    const idle = mascotExtent(mascotFrame(new MascotPokes(), 0));
    // a little more than twice a walker's height
    expect(idle.h).toBeGreaterThanOrEqual(18);
    expect(idle.h).toBeLessThanOrEqual(21);
    expect(idle.h / p.h).toBeGreaterThan(1.7);
    expect(idle.h / p.h).toBeLessThan(2.2);
    // his tail curls out to his side: it adds to his width, never to his height
    expect(idle.w).toBeGreaterThanOrEqual(14);
    expect(idle.w).toBeLessThanOrEqual(21);
    for (let i = 0; i < TRICKS.length; i++) {
      const pk = new MascotPokes();
      for (let k = 0; k <= i; k++) pk.poke(k * 10);
      for (let t = 0; t < TRICKS[i].dur; t += 0.1) {
        const e = mascotExtent(mascotFrame(pk, i * 10 + t));
        expect(e.h, TRICKS[i].name).toBeLessThanOrEqual(25);
        expect(e.w, TRICKS[i].name).toBeLessThanOrEqual(24);
      }
    }
  });

  it("stands well inside the lawn, on open grass all round", () => {
    for (const [w, h] of [
      [960, 540],
      [1280, 720],
    ]) {
      const b = backdrop(w, h);
      const spot = b.mascotSpot()!;
      const town = (b as unknown as { town: Town }).town;
      for (let y = spot.y - 20; y <= spot.y + 2; y++) {
        for (let x = spot.x - 9; x <= spot.x + 9; x++) {
          const [r, g, bl] = toRgb(town.land.get(x, y - town.top));
          expect(g > r + 8 && g > bl, `${w}x${h} ${x},${y}`).toBe(true);
        }
      }
    }
  });

  it("draws every pose inside his box, and his ball within reach", () => {
    const b = backdrop();
    const spot = b.mascotSpot()!;
    const z = mascotZone(spot);
    const bare = new Surface(960, 540);
    const s = new Surface(960, 540);
    const still = backdrop();
    for (let i = 0; i < TRICKS.length; i++) b.pokeMascot(i * 10);
    for (let t = 0; t < 40; t += 0.15) {
      b.draw(s, t);
      still.draw(bare, t);
      // whatever he changed lies inside his box, or under the ball's flight
      for (let y = 0; y < 540; y++) {
        for (let x = Math.max(0, z.x - 40); x < z.x + z.w + 40; x++) {
          if (s.get(x, y) === bare.get(x, y)) continue;
          const inside = x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h;
          // the ball flies high on the flick, the spin and the tumble
          const ballColumn = x >= spot.x - 10 && x <= spot.x + 20;
          expect(inside || ballColumn, `${t.toFixed(2)} at ${x},${y}`).toBe(
            true,
          );
        }
      }
    }
  }, 60_000);

  it("draws the same pixels for the same pokes and the same clock, and moves when poked", () => {
    const a = backdrop();
    const b = backdrop();
    a.pokeMascot(1);
    b.pokeMascot(1);
    const sa = new Surface(960, 540);
    const sb = new Surface(960, 540);
    for (const t of [0.5, 1.2, 2, 3.3, 6]) {
      a.draw(sa, t);
      b.draw(sb, t);
      expect(sa.data).toEqual(sb.data);
    }
    const still = backdrop();
    const sc = new Surface(960, 540);
    a.draw(sa, 2.2);
    still.draw(sc, 2.2);
    const z = mascotZone(a.mascotSpot()!);
    let diff = 0;
    for (let y = z.y; y < z.y + z.h; y++) {
      for (let x = z.x; x < z.x + z.w; x++) {
        if (sa.get(x, y) !== sc.get(x, y)) diff++;
      }
    }
    expect(diff).toBeGreaterThan(40);
  });

  it("uses only his own colours, and draws at night too", () => {
    const night = lightingFor({ elevation: -30, morning: false });
    for (const l of [light, night]) {
      const seen = new Set<Color>();
      for (let i = 0; i < TRICKS.length; i++) {
        const pk = new MascotPokes();
        for (let k = 0; k <= i; k++) pk.poke(k * 10);
        for (let t = 0; t < TRICKS[i].dur; t += 0.2) {
          const s = new Surface(60, 70);
          drawMascot(s, 30, 60, mascotFrame(pk, i * 10 + t), l);
          for (const c of s.data) if (c !== 0) seen.add(c as Color);
        }
      }
      // a costume, a ball, stars and a shadow: a small palette
      expect(seen.size).toBeGreaterThan(12);
      expect(seen.size).toBeLessThan(30);
    }
  });

  it("keeps the airship's crash and its pilot clear of him", () => {
    for (const [w, h] of [
      [800, 500],
      [960, 540],
      [1120, 600],
      [1280, 720],
    ]) {
      for (const el of [45, -30]) {
        const b = backdrop(w, h, 3);
        b.setLighting(lightingFor({ elevation: el, morning: false }));
        b.draw(new Surface(w, h), 0);
        const spot = b.mascotSpot();
        if (!spot) continue;
        const z = mascotZone(spot);
        const site = (b as unknown as { site: CrashSite }).site;
        const meets = (x0: number, y0: number, x1: number, y1: number) =>
          x0 < z.x + z.w && z.x < x1 && y0 < z.y + z.h && z.y < y1;
        expect(
          meets(site.x - 24, site.y - 28, site.x + 26, site.y + 6),
          `${w}x${h}`,
        ).toBe(false);
        expect(
          meets(
            site.pilotX - 8,
            site.pilotY - 20,
            site.pilotX + 10,
            site.pilotY + 4,
          ),
          `${w}x${h} pilot`,
        ).toBe(false);
      }
    }
  }, 60_000);

  it("stands in his place on the lawn, the same by day and at night, and nobody walks through him", () => {
    for (const seed of [1, 2, 7]) {
      const spots = [45, -30].map((el) => {
        const b = backdrop(960, 540, seed);
        b.setLighting(lightingFor({ elevation: el, morning: false }));
        b.draw(new Surface(960, 540), 0);
        return { b, spot: b.mascotSpot()! };
      });
      // the light never moves him
      expect(spots[1].spot).toEqual(spots[0].spot);
      const { b, spot } = spots[0];
      // his place (x 100, y 384 at 960 x 540): on the lawn level with the ball
      expect(Math.abs(spot.x - 100)).toBeLessThanOrEqual(16);
      expect(Math.abs(spot.y - 384)).toBeLessThanOrEqual(8);
      // no walker's figure (6 x 10 over its feet) meets him, his ball or his shadow
      const life = (b as unknown as { life: Life }).life;
      const view = (b as unknown as { view: View }).view;
      for (let t = 0; t < 180; t += 0.5) {
        life.people(
          t,
          (X, V) => {
            const p = project(view, X, V);
            const meets =
              p.x + 3 >= spot.x - 10 &&
              p.x - 2 <= spot.x + 15 &&
              p.y >= spot.y - 22 &&
              p.y - 10 <= spot.y + 2;
            expect(meets).toBe(false);
          },
          true,
        );
      }
    }
  }, 60_000);
  it("is a black cat: black fur, bright green eyes, whiskers, and a tail that moves", () => {
    const night = lightingFor({ elevation: -30, morning: false });
    for (const l of [light, night]) {
      const s = new Surface(60, 60);
      drawMascot(s, 30, 45, { pose: POSES.stand, ball: { x: 40, h: 0 } }, l);
      const count = (c: Color) => s.data.filter((v) => v === c).length;
      // his eyes: two of them, the bright green catching the light, by day and at night
      expect(count(P.ledGreen)).toBeGreaterThanOrEqual(6);
      // black fur: the head is mostly the darkest blues
      let fur = 0;
      let head = 0;
      for (let y = 26; y < 36; y++) {
        for (let x = 22; x < 39; x++) {
          const c = s.get(x, y);
          if (c === 0) continue;
          head++;
          const [r, g, b] = toRgb(c);
          if (r + g + b < 3 * 70) fur++;
        }
      }
      expect(fur / head).toBeGreaterThan(0.5);
      // whiskers out past his cheeks on both sides
      expect(count(l.lit(P.mist))).toBeGreaterThanOrEqual(4);
    }
    // the tail sways: the same pose, a different tail
    const a = new Surface(60, 60);
    const b = new Surface(60, 60);
    drawMascot(
      a,
      30,
      45,
      { pose: POSES.stand, ball: { x: 40, h: 0 }, tail: 0 },
      light,
    );
    drawMascot(
      b,
      30,
      45,
      { pose: POSES.stand, ball: { x: 40, h: 0 }, tail: 1 },
      light,
    );
    let moved = 0;
    for (let i = 0; i < a.data.length; i++)
      if (a.data[i] !== b.data[i]) moved++;
    expect(moved).toBeGreaterThan(4);
    // and it sways of itself over a second, standing still
    const pk = new MascotPokes();
    const tails = new Set<number>();
    for (let t = 0; t < 2; t += 0.05) tails.add(mascotFrame(pk, t).tail ?? 0);
    expect(tails.size).toBeGreaterThanOrEqual(3);
  });

  it("catches the floodlights on his edge at night, so a black cat never vanishes on the dark lawn", () => {
    const night = lightingFor({ elevation: -30, morning: false });
    const edge = (l: typeof light) => {
      const s = new Surface(60, 60);
      drawMascot(s, 30, 45, { pose: POSES.stand, ball: { x: 40, h: 0 } }, l);
      // the right-hand edge of his head, ears to chin
      let lit = 0;
      for (let y = 26; y < 36; y++) {
        let x = 59;
        while (x > 0 && s.get(x, y) === 0) x--;
        const [r, g, b] = toRgb(s.get(x, y));
        if (r + g + b > 3 * 110) lit++;
      }
      return lit;
    };
    expect(edge(night)).toBeGreaterThan(edge(light));
    expect(edge(night)).toBeGreaterThanOrEqual(5);
  });
});
