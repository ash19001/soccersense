/**
 * The knobs of the mix: every number in mix.ts, by its path (`SOUNDS.touch.level`), for the
 * sound board at /dev/sound. It reads them, changes them in memory (the engine reads mix.ts
 * as each sound starts, so a change is heard at once; nothing is saved), and writes the lines
 * to paste back into mix.ts for the changes, found by name in mix.ts's own source.
 *
 * Pure: no browser. The board gives it mix.ts's source (`import source from "./mix.ts?raw"`).
 */

import * as MIX from "./mix";

/** The groups of mix.ts, in its order. */
export const GROUPS = [
  "BUSES",
  "SOUNDS",
  "CROWD",
  "BEDS",
  "BED_EVENTS",
  "STINGS",
  "NET",
  "FIREWORKS",
  "VUVUZELA",
  "CLAPS",
  "HOME_PAGE",
  "GAME",
  "JUGGLE",
  "LIMITS",
] as const satisfies readonly (keyof typeof MIX)[];

export type Group = (typeof GROUPS)[number];

/** What a knob's number is, for its slider and its label. */
export type Unit =
  "gain" | "share" | "dB" | "dBFS" | "count" | "seconds" | "times" | "sample";

export interface Knob {
  /** Where it is: `SOUNDS.touch.level`. */
  path: string;
  group: Group;
  /** Its last name (`level`). */
  key: string;
  value: number;
  /** Its value in mix.ts as the page loaded. */
  initial: number;
  unit: Unit;
  min: number;
  max: number;
  step: number;
}

type Tree = { [key: string]: unknown };

function root(group: Group): Tree {
  return MIX[group] as unknown as Tree;
}

/** Every number under `node`, depth first in its own order, as [path, value]. */
function walk(node: Tree, path: string, out: [string, number][]): void {
  for (const [key, value] of Object.entries(node)) {
    const here = `${path}.${key}`;
    if (typeof value === "number") out.push([here, value]);
    else if (value && typeof value === "object") walk(value as Tree, here, out);
  }
}

function paths(): [string, number][] {
  const out: [string, number][] = [];
  for (const group of GROUPS) walk(root(group), group, out);
  return out;
}

/** Every number in mix.ts as it stood when this module loaded. */
const INITIAL: ReadonlyMap<string, number> = new Map(paths());

/** The parent object of `path` and its last name, or null if it is not a knob. */
function locate(path: string): { parent: Tree; key: string } | null {
  const parts = path.split(".");
  const group = parts[0] as Group;
  if (!GROUPS.includes(group) || parts.length < 2) return null;
  let node: Tree = root(group);
  for (const part of parts.slice(1, -1)) {
    const next = node[part];
    if (!next || typeof next !== "object") return null;
    node = next as Tree;
  }
  const key = parts.at(-1) as string;
  return typeof node[key] === "number" ? { parent: node, key } : null;
}

const DBFS_KEYS = new Set(["peakDb", "rmsDb", "takeRmsDb", "humTakeRmsDb"]);
const COUNTS = new Set([
  "LIMITS.voices",
  "CLAPS.perLayer",
  "CLAPS.mostLayers",
  "BED_EVENTS.claps.perSecond",
]);
/** Powers, sizes, speeds and shares: 0 to 1. */
const SHARE_GROUPS = new Set<Group>(["NET", "HOME_PAGE", "GAME", "JUGGLE"]);

/** What a knob is, and the range its slider gives. */
export function unitOf(path: string): Unit {
  const key = path.split(".").at(-1) ?? "";
  const group = path.split(".")[0] as Group;
  if (DBFS_KEYS.has(key) || path.startsWith("VUVUZELA.hum.")) return "dBFS";
  if (key.endsWith("Db")) return "dB";
  if (COUNTS.has(path) || path.startsWith("LIMITS.atOnce.")) return "count";
  if (path.startsWith("LIMITS.gap.") || path === "LIMITS.resultFade") {
    return "seconds";
  }
  if (path.startsWith("BED_EVENTS.swell.")) return "times";
  if (path === "BUSES.safety") return "sample";
  if (
    SHARE_GROUPS.has(group) ||
    key === "people" ||
    key === "crowd" ||
    key === "softest" ||
    key === "smallest" ||
    key === "recordedQuietest" ||
    path === "VUVUZELA.smallest"
  ) {
    return "share";
  }
  return "gain";
}

function range(
  unit: Unit,
  v: number,
): { min: number; max: number; step: number } {
  switch (unit) {
    case "dBFS":
      return {
        min: Math.floor(v - 24),
        max: Math.min(0, Math.ceil(v + 12)),
        step: 0.1,
      };
    case "dB":
      return { min: Math.floor(v - 12), max: Math.ceil(v + 12), step: 0.1 };
    case "count":
      return { min: 1, max: Math.max(v * 3, v + 6), step: 1 };
    case "seconds":
      return { min: 0, max: Math.max(1, v * 3), step: 0.01 };
    case "times":
      return { min: 1, max: 2, step: 0.01 };
    case "sample":
      return { min: 0.3, max: 0.97, step: 0.01 };
    case "share":
      return { min: 0, max: 1, step: 0.01 };
    case "gain":
      return { min: 0, max: Math.max(1, Math.ceil(v * 2)), step: 0.001 };
  }
}

function knobOf(path: string, value: number): Knob {
  const initial = INITIAL.get(path) ?? value;
  const unit = unitOf(path);
  return {
    path,
    group: path.split(".")[0] as Group,
    key: path.split(".").at(-1) ?? path,
    value,
    initial,
    unit,
    ...range(unit, initial),
  };
}

/** Every knob, with its value now, in mix.ts's order. */
export function knobs(): Knob[] {
  return paths().map(([path, value]) => knobOf(path, value));
}

/** One knob now, or null if `path` is not one. */
export function knob(path: string): Knob | null {
  const at = locate(path);
  return at ? knobOf(path, at.parent[at.key] as number) : null;
}

/** A knob's value now (NaN if `path` is not one). */
export function knobValue(path: string): number {
  const at = locate(path);
  return at ? (at.parent[at.key] as number) : Number.NaN;
}

/**
 * Sets a knob in memory: from now on every sound reads the new value. False if `path` is
 * not a knob or `value` is not a number. Nothing is saved: a reload is mix.ts again.
 */
export function setKnob(path: string, value: number): boolean {
  const at = locate(path);
  if (!at || !Number.isFinite(value)) return false;
  at.parent[at.key] = value;
  return true;
}

/** Every knob back to mix.ts's value. */
export function resetKnobs(): void {
  for (const [path, value] of INITIAL) setKnob(path, value);
}

/** The knobs whose value is not mix.ts's any more. */
export function changedKnobs(): Knob[] {
  return knobs().filter((k) => k.value !== k.initial);
}

/** A value as it would be written in mix.ts: no float noise, at its step. */
export function formatValue(value: number, step = 0.001): string {
  const places = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
  const fixed = value.toFixed(places);
  return String(Number(fixed));
}

/** A knob's line in mix.ts: its number (1 from the top), its text, and its comment. */
export interface SourceLine {
  line: number;
  text: string;
  doc: string;
}

const LEAF = /^(\s*)("?[\w-]+"?): (-?\d+(?:\.\d+)?),(.*)$/;
const OPEN_CONST = /^export const (\w+)\b.*\{\s*$/;
const OPEN_KEY = /^\s*("?[\w-]+"?): \{\s*$/;

/** The comment just above line `i` (a `/** ... *\/` block), as one line of text. */
function docAbove(lines: readonly string[], i: number): string {
  let j = i - 1;
  if (j < 0) return "";
  const one = /^\s*\/\*\*\s*(.*?)\s*\*\/\s*$/.exec(lines[j]);
  if (one) return one[1];
  if (!/^\s*\*\/\s*$/.test(lines[j])) return "";
  const parts: string[] = [];
  for (j--; j >= 0; j--) {
    const start = /^\s*\/\*\*\s*(.*)$/.exec(lines[j]);
    if (start) {
      if (start[1]) parts.unshift(start[1]);
      break;
    }
    parts.unshift(lines[j].replace(/^\s*\*\s?/, ""));
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Finds every knob's line in mix.ts's source by its path: an `export const X = {` opens a
 * group, a `name: {` a level under it, a `}` closes one, and `name: 1.5,` is a knob.
 */
export function sourceLines(source: string): Map<string, SourceLine> {
  const lines = source.split(/\r?\n/);
  const out = new Map<string, SourceLine>();
  const stack: string[] = [];
  let inComment = false;
  lines.forEach((text, i) => {
    const trimmed = text.trim();
    if (inComment) {
      if (trimmed.includes("*/")) inComment = false;
      return;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) inComment = true;
      return;
    }
    if (trimmed.startsWith("//")) return;
    if (trimmed.startsWith("}")) {
      stack.pop();
      return;
    }
    const group = OPEN_CONST.exec(text);
    if (group) {
      stack.length = 0;
      stack.push(group[1]);
      return;
    }
    const open = OPEN_KEY.exec(text);
    if (open) {
      stack.push(open[1].replace(/"/g, ""));
      return;
    }
    if (trimmed.endsWith("{")) {
      // an interface or a type: not data
      stack.push("?");
      return;
    }
    const leaf = LEAF.exec(text);
    if (leaf && stack.length > 0 && !stack.includes("?")) {
      const path = [...stack, leaf[2].replace(/"/g, "")].join(".");
      out.set(path, { line: i + 1, text, doc: docAbove(lines, i) });
    }
  });
  return out;
}

/** A knob's line with a new value in it, the rest (indent, name, comment) as it is. */
export function rewriteLine(text: string, value: string): string {
  const leaf = LEAF.exec(text);
  return leaf ? `${leaf[1]}${leaf[2]}: ${value},${leaf[4]}` : text;
}

/**
 * The changes, as lines to paste into mix.ts: for each, where it is (the line number and
 * the path, and what it was) and the line with its new value.
 */
export function changesText(source: string, changed: readonly Knob[]): string {
  if (changed.length === 0) return "";
  const where = sourceLines(source);
  const out = [
    `// app/audio/mix.ts: ${changed.length} change${changed.length === 1 ? "" : "s"} from /dev/sound`,
  ];
  for (const k of changed) {
    const value = formatValue(k.value, k.step);
    const line = where.get(k.path);
    out.push(
      `// line ${line?.line ?? "?"}: ${k.path} (was ${formatValue(k.initial, k.step)})`,
    );
    out.push(line ? rewriteLine(line.text, value) : `${k.key}: ${value},`);
  }
  return out.join("\n");
}
