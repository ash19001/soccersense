/**
 * Poking the airship: what the clicks do to it, as numbers. No drawing here.
 *
 * Every poke raises the airship's stress by one; stress relaxes again, falling to 1/e of
 * itself every RELAX seconds. A poke that would take it to POP_AT bursts it: about six
 * quick clicks do (five if they are very quick), while a click a second never does (the
 * stress settles at 1 / (1 - e^(-1/RELAX)), about 3.5).
 *
 * After the pop the airship falls for FALL seconds and crashes into the town; RETURN
 * seconds after the pop a new one starts to drift in from the left, and it is back in its
 * place ARRIVE seconds later.
 *
 * The state is the poke history and nothing else: `phase`, `stress` and `poseAt` are pure
 * functions of it and of the time, so the same pokes and the same clock give the same
 * pixels, whatever the size or the light.
 */

/** Seconds for the stress to relax to 1/e of itself. */
export const RELAX = 3;
/** The stress at which it bursts. */
export const POP_AT = 4.4;
/** Seconds from the pop to the crash. */
export const FALL = 2.8;
/** Seconds from the pop until the new airship starts to drift in. */
export const RETURN = 10;
/** Seconds the new airship takes to drift into its place. */
export const ARRIVE = 4.5;
/** How many pokes and pops are remembered: older ones have long relaxed. */
const KEEP = 48;
const KEEP_POPS = 8;

export type PokeResult = "wobble" | "pop" | "none";

export interface Poke {
  t: number;
  /** Where it was poked, relative to the envelope's centre at rest (NaN: not known). */
  x: number;
  y: number;
}

export type AirshipPhase =
  /** In the air: `arrive` is 1 in its place, less while a new one drifts in. */
  | { kind: "ship"; arrive: number }
  /** Burst: falling, crashed, or gone; `since` is the seconds since the pop. */
  | { kind: "down"; since: number };

export class AirshipPokes {
  /** Every poke that made it wobble, and every pop, in the order they came. */
  private pokes: Poke[] = [];
  private pops: number[] = [];

  /** A poke at time t, at (x, y) relative to the envelope's centre if known. */
  poke(t: number, x = Number.NaN, y = Number.NaN): PokeResult {
    if (!Number.isFinite(t)) return "none";
    if (this.phase(t).kind !== "ship") return "none";
    if (this.stress(t) + 1 >= POP_AT) {
      this.pops.push(t);
      if (this.pops.length > KEEP_POPS) this.pops.shift();
      return "pop";
    }
    this.pokes.push({ t, x, y });
    if (this.pokes.length > KEEP) this.pokes.shift();
    return "wobble";
  }

  /** When it last burst at or before t (NaN: not by then). */
  poppedAt(t: number): number {
    for (let i = this.pops.length - 1; i >= 0; i--) {
      if (this.pops[i] <= t) return this.pops[i];
    }
    return Number.NaN;
  }

  phase(t: number): AirshipPhase {
    const since = t - this.poppedAt(t);
    if (!(since >= 0)) return { kind: "ship", arrive: 1 };
    if (since < RETURN) return { kind: "down", since };
    return { kind: "ship", arrive: Math.min(1, (since - RETURN) / ARRIVE) };
  }

  /** Whether a poke counts at time t: it was before t, and on the airship there is now. */
  private counts(p: Poke, t: number): boolean {
    if (p.t > t) return false;
    const pop = this.poppedAt(t);
    return !(p.t <= pop);
  }

  /** The stress at time t: one for each poke of this airship, relaxing. */
  stress(t: number): number {
    let s = 0;
    for (const p of this.pokes) {
      if (this.counts(p, t)) s += Math.exp(-(t - p.t) / RELAX);
    }
    return s;
  }

  /** The last poke of this airship at or before t, if any. */
  last(t: number): Poke | null {
    for (let i = this.pokes.length - 1; i >= 0; i--) {
      if (this.counts(this.pokes[i], t)) return this.pokes[i];
    }
    return null;
  }

  /** The pokes of this airship in the last `since` seconds before t, oldest first. */
  recent(t: number, since: number, fn: (p: Poke) => void): void {
    for (const p of this.pokes) {
      if (this.counts(p, t) && t - p.t < since) fn(p);
    }
  }
}

/** How the airship is shaken about at a moment: everything relative to its rest. */
export interface Pose {
  /** Whole pixels it is pushed from its place. */
  dx: number;
  dy: number;
  /** Tilt, radians, nose down positive. */
  angle: number;
  /** Squash and stretch of the envelope. */
  sx: number;
  sy: number;
  /** A dent: how deep (pixels), where (relative to the envelope's centre) and how wide. */
  dent: number;
  dentX: number;
  dentY: number;
  dentR: number;
  /** The sign's text is off this frame. */
  flicker: boolean;
  /** 0..1 of the way to bursting, now. */
  stress: number;
}

const TAU = Math.PI * 2;

/**
 * The airship's pose at time t, or null when it is simply at rest (drawn the old, quick
 * way). `rx` and `ry` are the envelope's half length and height; `offscreen` how far left
 * it must start to come in from out of sight.
 */
export function poseAt(
  state: AirshipPokes,
  t: number,
  rx: number,
  ry: number,
  offscreen: number,
): Pose | null {
  const ph = state.phase(t);
  if (ph.kind !== "ship") return null;
  const last = state.last(t);
  const stress = Math.min(1, state.stress(t) / POP_AT);
  const a = last ? t - last.t : Infinity;
  if (ph.arrive >= 1 && (a > 4 || stress < 0.02)) return null;
  const pose: Pose = {
    dx: 0,
    dy: 0,
    angle: 0,
    sx: 1,
    sy: 1,
    dent: 0,
    dentX: 0,
    dentY: 0,
    dentR: 1,
    flicker: false,
    stress,
  };
  if (ph.arrive < 1) {
    // drifting in from the left, slowing as it comes, nose a little down then level
    const u = ph.arrive;
    const ease = 1 - (1 - u) ** 3;
    pose.dx = -Math.round((1 - ease) * offscreen);
    pose.angle = 0.05 * (1 - u) * Math.sin(TAU * u * 1.5);
  }
  if (last && a <= 4) {
    // how hard this poke landed: harder the more stressed it was
    const hit = Math.min(1, (state.stress(last.t) || 1) / POP_AT);
    const known = Number.isFinite(last.x) && Number.isFinite(last.y);
    const side = known && last.x < 0 ? 1 : known && last.x > 0 ? -1 : 1;
    const decay = (k: number): number => Math.exp(-a / k);
    pose.dx += Math.round(
      side * (4 + 10 * hit) * decay(0.55) * Math.sin((TAU * a) / 1.1),
    );
    pose.dy += Math.round(
      (2 + 5 * hit) * decay(0.5) * Math.sin((TAU * a) / 0.8),
    );
    pose.angle +=
      side * (0.035 + 0.09 * hit) * decay(0.9) * Math.sin((TAU * a) / 1.3);
    const squash = 0.07 * (1 + hit) * decay(0.22) * Math.cos((TAU * a) / 0.42);
    pose.sy = 1 - squash;
    pose.sx = 1 + squash * 0.6;
    pose.dent = (5 + 6 * hit) * decay(0.18) * Math.cos((TAU * a) / 0.7);
    // where: the poke, pulled on to the envelope; or the top of its middle
    let px = known ? last.x : rx * 0.12;
    let py = known ? last.y : -ry * 0.8;
    const e = Math.hypot(px / rx, py / ry);
    if (e > 1) {
      px /= e;
      py /= e;
    }
    pose.dentX = px;
    pose.dentY = py;
    pose.dentR = 12 + 10 * hit;
    // the sign flickers, longer the harder the poke
    if (a < 0.25 + 0.45 * hit) pose.flicker = Math.floor(a * 18) % 2 === 1;
  }
  // close to bursting it trembles and swells
  if (stress > 0.7) {
    const k = (stress - 0.7) / 0.3;
    pose.dx += Math.floor(t * 16) % 2 === 0 ? 0 : k > 0.4 ? 2 : 0;
    pose.sx *= 1 + 0.035 * k;
    pose.sy *= 1 + 0.05 * k;
  }
  return pose;
}
