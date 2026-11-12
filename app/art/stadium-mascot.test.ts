import { describe, expect, it } from "vitest";
import { Surface, toRgb } from "~/pixel";
import { lightingFor } from "~/art/lighting";
import { MenuBackdrop } from "~/art/stadium";
import type { CrashSite } from "~/art/stadium-airship-fall";
import { FALL } from "~/art/stadium-airship-poke";
import { FIREWORKS } from "~/art/stadium-life";
import { GOAL_AT, MATCH_PERIOD } from "~/art/stadium-match";
import {
  MascotPokes,
  TRICKS,
  drawMascot,
  mascotFrame,
  mascotWork,
  mascotZone,
} from "~/art/stadium-mascot";
import type { Town } from "~/art/stadium-town";
import type { SoundCue } from "~/scenes/scene";

function backdrop(w = 480, h = 270, seed = 1): MenuBackdrop {
  const b = new MenuBackdrop({ seed, sign: { header: "A", text: "B" } });
  b.resize(w, h);
  return b;
}

describe("the mascot", () => {
  it("stands on the lawn on a monitor, and is not there on a phone", () => {
    for (const [w, h] of [
      [480, 270],
      [560, 300],
      [640, 360],
      [720, 360],
    ]) {
      const spot = backdrop(w, h).mascotSpot();
      expect(spot, `${w}x${h}`).not.toBeNull();
      // left of the ball
      expect(spot!.x).toBeLessThan(w / 2 - 40);
    }
    const phone = backdrop(130, 281);
    expect(phone.mascotSpot()).toBeNull();
    expect(phone.mascotAt(65, 200, 0)).toBe(false);
    expect(phone.pokeMascot(0)).toBe("busy");
  });

  it("is under the pointer on him, and not beside him", () => {
    const b = backdrop();
    const s = b.mascotSpot()!;
    // his boots, his head, his ball at rest, and a little round him
    expect(b.mascotAt(s.x, s.y, 0)).toBe(true);
    expect(b.mascotAt(s.x, s.y - 7, 0)).toBe(true);
    expect(b.mascotAt(s.x + 4, s.y - 1, 0)).toBe(true);
    expect(b.mascotAt(s.x - 5, s.y - 10, 0)).toBe(true);
    expect(b.mascotAt(s.x + 12, s.y - 4, 0)).toBe(false);
    expect(b.mascotAt(s.x - 9, s.y - 4, 0)).toBe(false);
    expect(b.mascotAt(s.x, s.y - 20, 0)).toBe(false);
    expect(b.mascotAt(Number.NaN, s.y, 0)).toBe(false);
  });

  it("is the size of a person in a big costume: a little taller than the people, much wider", () => {
    // a walker in the aerial view is 5 px tall and 3 wide (stadium-things.ts, person)
    const light = lightingFor({ elevation: 45, morning: false });
    const work = mascotWork();
    const extent = (frame: ReturnType<typeof mascotFrame>) => {
      const s = new Surface(40, 40);
      drawMascot(s, 20, 30, { ...frame, ball: { x: 40, h: 0 } }, light, work);
      let top = 40;
      let bottom = -1;
      let left = 40;
      let right = -1;
      for (let y = 0; y < 30; y++) {
        for (let x = 0; x < 40; x++) {
          if (s.get(x, y) === 0) continue;
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
      }
      return { h: bottom - top + 1, w: right - left + 1 };
    };
    const idle = extent(mascotFrame(new MascotPokes(), 0));
    expect(idle.h).toBeGreaterThanOrEqual(7);
    expect(idle.h).toBeLessThanOrEqual(9);
    expect(idle.w).toBeGreaterThanOrEqual(5);
    expect(idle.w).toBeLessThanOrEqual(8);
    // never a giant, whatever he is doing
    for (let i = 0; i < TRICKS.length; i++) {
      const p = new MascotPokes();
      for (let k = 0; k <= i; k++) p.poke(k * 10);
      for (let t = 0; t < TRICKS[i].dur; t += 0.1) {
        const e = extent(mascotFrame(p, i * 10 + t));
        expect(e.h, TRICKS[i].name).toBeLessThanOrEqual(10);
        expect(e.w, TRICKS[i].name).toBeLessThanOrEqual(9);
      }
    }
  });

  it("stands well inside the lawn, on open grass all round", () => {
    for (const [w, h] of [
      [480, 270],
      [640, 360],
    ]) {
      const b = backdrop(w, h);
      const spot = b.mascotSpot()!;
      const town = (b as unknown as { town: Town }).town;
      for (let y = spot.y - 10; y <= spot.y + 2; y++) {
        for (let x = spot.x - 6; x <= spot.x + 7; x++) {
          const [r, g, bl] = toRgb(town.land.get(x, y - town.top));
          expect(g > r + 8 && g > bl, `${w}x${h} ${x},${y}`).toBe(true);
        }
      }
    }
  });

  it("does a trick when clicked, is busy while it plays, then does the next one", () => {
    const b = backdrop();
    let t = 2;
    for (let i = 0; i < TRICKS.length * 2; i++) {
      expect(b.pokeMascot(t)).toBe("trick");
      expect(b.pokeMascot(t + 0.1)).toBe("busy");
      expect(b.pokeMascot(t + TRICKS[i % TRICKS.length].dur - 0.05)).toBe(
        "busy",
      );
      t += TRICKS[i % TRICKS.length].dur + 0.5;
    }
    expect(b.pokeMascot(Number.NaN)).toBe("busy");
  });

  it("has at least four different tricks, taken in turn", () => {
    expect(TRICKS.length).toBeGreaterThanOrEqual(4);
    expect(new Set(TRICKS.map((r) => r.name)).size).toBe(TRICKS.length);
    const pokes = new MascotPokes();
    let t = 0;
    for (let i = 0; i < 7; i++) {
      pokes.poke(t);
      expect(pokes.active(t + 0.5)?.trick).toBe(i % TRICKS.length);
      t += 10;
    }
  });

  it("goes back to his idle loop after a trick, with the ball at his feet", () => {
    const pokes = new MascotPokes();
    pokes.poke(3);
    const end = 3 + TRICKS[0].dur;
    const after = mascotFrame(pokes, end + 0.01);
    expect(after.ball.h).toBe(0);
    // every trick ends with the ball at rest at his feet
    for (const r of TRICKS) {
      const p = new MascotPokes();
      for (let k = 0; k < TRICKS.indexOf(r); k++) p.poke(k * 10);
      const start = TRICKS.indexOf(r) * 10;
      p.poke(start);
      expect(mascotFrame(p, start + r.dur - 0.01).ball.h, r.name).toBe(0);
      expect(mascotFrame(p, start).ball.h, r.name).toBeGreaterThanOrEqual(0);
    }
  });

  it("draws the same pixels for the same pokes and the same clock, and moves when poked", () => {
    const a = backdrop();
    const b = backdrop();
    a.pokeMascot(1);
    b.pokeMascot(1);
    const sa = new Surface(480, 270);
    const sb = new Surface(480, 270);
    for (const t of [0.5, 1.2, 2, 3.3, 6]) {
      a.draw(sa, t);
      b.draw(sb, t);
      expect(sa.data).toEqual(sb.data);
    }
    const still = backdrop();
    const sc = new Surface(480, 270);
    a.draw(sa, 2.2);
    still.draw(sc, 2.2);
    const z = mascotZone(a.mascotSpot()!);
    let diff = 0;
    for (let y = z.y - 30; y < z.y + z.h; y++) {
      for (let x = z.x - 10; x < z.x + z.w + 10; x++) {
        if (sa.get(x, y) !== sc.get(x, y)) diff++;
      }
    }
    expect(diff).toBeGreaterThan(10);
  });

  it("keeps the airship's crash and its pilot clear of him", () => {
    for (const [w, h] of [
      [400, 250],
      [480, 270],
      [560, 300],
      [640, 360],
      [720, 360],
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
          meets(site.x - 12, site.y - 14, site.x + 13, site.y + 3),
          `${w}x${h}`,
        ).toBe(false);
        expect(
          meets(
            site.pilotX - 4,
            site.pilotY - 10,
            site.pilotX + 5,
            site.pilotY + 2,
          ),
          `${w}x${h} pilot`,
        ).toBe(false);
      }
    }
  });
});

describe("cuesBetween", () => {
  const tile = (b: MenuBackdrop, from: number, to: number, dt: number) => {
    const out: SoundCue[] = [];
    const n = Math.ceil((to - from) / dt - 1e-9);
    for (let i = 0; i < n; i++) {
      const t0 = from + i * dt;
      const t1 = i === n - 1 ? to : from + (i + 1) * dt;
      out.push(...b.cuesBetween(t0, t1));
    }
    return out;
  };
  const count = (cues: SoundCue[], kind: SoundCue["kind"]) =>
    cues.filter((c) => c.kind === kind).length;

  it("hears the match only as a faint cheer and distant rockets at the goal, never a horn", () => {
    const b = backdrop();
    b.draw(new Surface(480, 270), 0);
    // every cue with the time it is heard at
    const heard: { t: number; cue: SoundCue }[] = [];
    const dt = 1 / 60;
    for (let i = 0; i < 6 * MATCH_PERIOD * 60; i++) {
      for (const cue of b.cuesBetween(i * dt, (i + 1) * dt)) {
        heard.push({ t: (i + 1) * dt, cue });
      }
    }
    const cues = heard.map((h) => h.cue);
    for (const kind of ["vuvuzela", "whistle", "ooh", "groan"] as const) {
      expect(count(cues, kind), kind).toBe(0);
    }
    // a very small cheer as each goal goes in, and nothing else
    expect(cues.every((c) => c.kind === "cheer" || c.kind === "firework")).toBe(
      true,
    );
    const cheers = heard.filter((h) => h.cue.kind === "cheer");
    expect(cheers.map((h) => h.cue)).toEqual(
      Array.from({ length: 6 }, () => ({ kind: "cheer", size: 0.1 })),
    );
    cheers.forEach((h, k) => {
      expect(h.t).toBeCloseTo(GOAL_AT + k * MATCH_PERIOD, 1);
    });
    // the rockets: distant, a few each goal, and only in the seconds after it
    const rockets = heard.filter((h) => h.cue.kind === "firework");
    expect(rockets.length).toBeGreaterThanOrEqual(6 * 2);
    expect(rockets.length % 6).toBe(0);
    for (const h of rockets) {
      expect(h.cue).toEqual({ kind: "firework", distant: true });
      const since = (h.t % MATCH_PERIOD) - GOAL_AT;
      expect(since).toBeGreaterThan(0);
      expect(since).toBeLessThan(FIREWORKS);
    }
  });

  it("hears only the cheer on a phone, where no rocket has room", () => {
    const b = backdrop(130, 281);
    b.draw(new Surface(130, 281), 0);
    const cues = tile(b, 0, MATCH_PERIOD, 1 / 60);
    expect(cues.filter((c) => c.kind !== "touch" && c.kind !== "kick")).toEqual(
      [{ kind: "cheer", size: 0.1 }],
    );
  });

  it("is pure, and never hears a thing twice across spans that meet", () => {
    const b = backdrop();
    for (let i = 0; i < TRICKS.length; i++) b.pokeMascot(10 + i * 10);
    expect(b.cuesBetween(20, 21)).toEqual(b.cuesBetween(20, 21));
    const fine = tile(b, 0, 60, 1 / 60);
    const coarse = tile(b, 0, 60, 0.37);
    for (const kind of ["touch", "kick", "thud"] as const) {
      expect(count(fine, kind), kind).toBe(count(coarse, kind));
    }
    expect(count(fine, "touch")).toBeGreaterThan(8);
  });

  it("hears only the last second of a long span, and nothing of an empty one", () => {
    const b = backdrop();
    expect(b.cuesBetween(0, 200)).toEqual(b.cuesBetween(199, 200));
    expect(b.cuesBetween(5, 5)).toEqual([]);
    expect(b.cuesBetween(6, 5)).toEqual([]);
    expect(b.cuesBetween(Number.NaN, 5)).toEqual([]);
  });

  it("hears the mascot's touches and kicks during a trick, and none while he idles", () => {
    const b = backdrop();
    expect(count(tile(b, 100, 110, 0.1), "touch")).toBe(0);
    b.pokeMascot(100);
    const cues = tile(b, 100, 100 + TRICKS[0].dur, 1 / 60);
    expect(count(cues, "touch")).toBe(TRICKS[0].cues.length);
    // the tumble has a big kick, and a bump as he lands on his bottom
    for (let i = 1; i < 4; i++) b.pokeMascot(100 + i * 10);
    const tumble = tile(b, 130, 130 + TRICKS[3].dur, 1 / 60);
    expect(tumble.some((c) => c.kind === "kick" && c.power > 0.5)).toBe(true);
    expect(count(tumble, "thud")).toBe(1);
    // nothing but touches, kicks and that bump (and the match far off, its goal at 106)
    for (const c of tile(b, 100, 150, 1 / 60)) {
      expect(["touch", "kick", "thud", "cheer", "firework"]).toContain(c.kind);
    }
  });

  it("hears the airship come down", () => {
    const b = backdrop();
    b.draw(new Surface(480, 270), 0);
    let pop = Number.NaN;
    for (let t = 50; t < 52; t += 0.15) {
      if (b.pokeAirship(t) === "pop") {
        pop = t;
        break;
      }
    }
    expect(Number.isFinite(pop)).toBe(true);
    const cues = tile(b, pop, pop + 6, 1 / 60);
    expect(count(cues, "thud") + count(cues, "splash")).toBe(1);
    expect(
      b
        .cuesBetween(pop + FALL - 0.01, pop + FALL + 0.01)
        .some((c) => c.kind === "thud" || c.kind === "splash"),
    ).toBe(true);
  });
});
