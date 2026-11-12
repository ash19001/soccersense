/**
 * The mix (mix.ts) and its knobs (knobs.ts): one file holds every level, pure data that the
 * scenes may import, one number to a line with its comment; the knobs find each line, change
 * the level in memory (heard at once), and write the lines to paste back.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { LEVELS, PEAK_DB, SCORE_PEAK_DB } from "./engine";
import {
  changedKnobs,
  changesText,
  formatValue,
  knob,
  knobValue,
  knobs,
  resetKnobs,
  rewriteLine,
  setKnob,
  sourceLines,
} from "./knobs";
import { BEDS, BUSES, GAME, SOUNDS, STINGS } from "./mix";
import source from "./mix.ts?raw";

afterEach(() => resetKnobs());

/** mix.ts without its comments, so words in prose do not count. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("mix.ts", () => {
  test("is pure data: it imports only types and touches nothing of the browser", () => {
    const imports = [...code.matchAll(/^import\b.*$/gm)].map((m) => m[0]);
    expect(imports.length).toBeGreaterThan(0);
    for (const line of imports) expect(line, line).toMatch(/^import type /);
    for (const word of [
      "window",
      "document",
      "navigator",
      "localStorage",
      "AudioContext",
      "Date",
      "Math.random",
      "fetch",
      "function",
      "=>",
    ]) {
      expect(code.includes(word), word).toBe(false);
    }
  });

  test("every number is a knob on a line of its own, with a comment saying what it is", () => {
    const lines = sourceLines(source);
    const all = knobs();
    expect(all.length).toBeGreaterThan(200);
    // every knob found, and nothing found that is not one
    expect([...lines.keys()].sort()).toEqual(all.map((k) => k.path).sort());
    for (const k of all) {
      const line = lines.get(k.path);
      expect(line, k.path).toBeDefined();
      // the number on the line is the knob's
      expect(Number(/: (-?[\d.]+),/.exec(line?.text ?? "")?.[1]), k.path).toBe(
        k.value,
      );
      expect(line?.doc.length ?? 0, `${k.path} has no comment`).toBeGreaterThan(
        8,
      );
    }
  });

  test("names the recordings that are in public/sounds, and only those", () => {
    const dir = join(process.cwd(), "public", "sounds");
    const files = new Set(readdirSync(dir).filter((f) => f.endsWith(".mp3")));
    const named = new Set<string>();
    for (const [kind, sound] of Object.entries(SOUNDS)) {
      const names = sound.file?.match(/[\w-]+\.mp3/g) ?? [];
      for (const name of names) {
        expect(files.has(name), `${kind}: ${name}`).toBe(true);
        named.add(name);
      }
      // a sound with no file named has none in public/sounds either
      if (sound.file === null) {
        expect(files.has(`${kind}.mp3`), kind).toBe(false);
      }
    }
    // every file is named somewhere, but the takes inside other sounds (the claps, the hum)
    const takes = ["claps.mp3", "vuvuzela-crowd.mp3"];
    for (const file of files) {
      if (!takes.includes(file)) expect(named.has(file), file).toBe(true);
    }
  });

  test("the engine's tables are mix.ts's numbers", () => {
    expect(LEVELS.touch).toBe(SOUNDS.touch.level);
    expect(PEAK_DB.kick).toBe(SOUNDS.kick.peakDb);
    expect(SCORE_PEAK_DB.worldie).toBe(STINGS.worldie.peakDb);
    expect(Object.keys(PEAK_DB)).not.toContain("wind");
    expect(Object.keys(PEAK_DB)).not.toContain("score");
  });
});

describe("the knobs", () => {
  test("a change is in memory at once, everywhere that reads it, and a reset undoes it", () => {
    expect(setKnob("SOUNDS.touch.level", 0.3)).toBe(true);
    expect(SOUNDS.touch.level).toBe(0.3);
    expect(LEVELS.touch).toBe(0.3);
    expect(knobValue("SOUNDS.touch.level")).toBe(0.3);
    expect(setKnob("BUSES.master", 0.5)).toBe(true);
    expect(BUSES.master).toBe(0.5);
    expect(changedKnobs().map((k) => k.path)).toEqual([
      "BUSES.master",
      "SOUNDS.touch.level",
    ]);
    resetKnobs();
    expect(SOUNDS.touch.level).toBe(0.15);
    expect(BUSES.master).toBe(0.8);
    expect(changedKnobs()).toEqual([]);
  });

  test("only knobs can be set, and only to numbers", () => {
    expect(setKnob("SOUNDS.touch.file", 1)).toBe(false);
    expect(setKnob("SOUNDS.nothing.level", 1)).toBe(false);
    expect(setKnob("NOPE.x", 1)).toBe(false);
    expect(setKnob("SOUNDS.touch.level", Number.NaN)).toBe(false);
    expect(knob("SOUNDS.touch")).toBeNull();
    expect(SOUNDS.touch.level).toBe(0.15);
  });

  test("each has a sensible unit and a slider range round its value", () => {
    const of = (path: string) => knob(path);
    expect(of("SOUNDS.touch.level")?.unit).toBe("gain");
    expect(of("SOUNDS.touch.peakDb")?.unit).toBe("dBFS");
    expect(of("CROWD.places.park.recordingDb")?.unit).toBe("dB");
    expect(of("FIREWORKS.farLiftDb")?.unit).toBe("dB");
    expect(of("VUVUZELA.hum.final")?.unit).toBe("dBFS");
    expect(of("LIMITS.atOnce.click")?.unit).toBe("count");
    expect(of("LIMITS.gap.click")?.unit).toBe("seconds");
    expect(of("LIMITS.resultFade")?.unit).toBe("seconds");
    expect(of("GAME.shots.worldie.kick")?.unit).toBe("share");
    expect(of("BEDS.places.top.crowd")?.unit).toBe("share");
    expect(of("BUSES.safety")?.unit).toBe("sample");
    for (const k of knobs()) {
      expect(k.min, k.path).toBeLessThanOrEqual(k.value);
      expect(k.max, k.path).toBeGreaterThanOrEqual(k.value);
      expect(k.step, k.path).toBeGreaterThan(0);
    }
  });

  test("the changes come out as the lines of mix.ts with the new numbers", () => {
    setKnob("SOUNDS.touch.level", 0.2);
    setKnob("BEDS.places.town.crowd", 0.25);
    setKnob("GAME.shots.tapin.kick", 0.30000000000000004);
    const text = changesText(source, changedKnobs());
    const lines = sourceLines(source);
    const touch = lines.get("SOUNDS.touch.level");
    expect(text).toContain(
      `// line ${touch?.line}: SOUNDS.touch.level (was 0.15)`,
    );
    expect(text).toContain("\n    level: 0.2,\n");
    expect(text).toContain(
      "BEDS.places.town.crowd (was 0.3)\n      crowd: 0.25,",
    );
    expect(text).toContain("GAME.shots.tapin.kick (was 0.2)\n      kick: 0.3,");
    expect(text.split("\n")[0]).toBe(
      "// app/audio/mix.ts: 3 changes from /dev/sound",
    );
    // pasted over the old lines, the file says the new numbers
    const pasted = source.split(/\r?\n/);
    for (const k of changedKnobs()) {
      const at = lines.get(k.path);
      if (at) {
        pasted[at.line - 1] = rewriteLine(
          at.text,
          formatValue(k.value, k.step),
        );
      }
    }
    const after = sourceLines(pasted.join("\n"));
    expect(after.get("GAME.shots.tapin.kick")?.text).toBe("      kick: 0.3,");
    expect(after.get("SOUNDS.touch.level")?.text).toBe("    level: 0.2,");
    expect(after.size).toBe(lines.size);
    expect(changesText(source, [])).toBe("");
  });

  test("the mix's numbers are the game's (a few, as a spot check)", () => {
    expect(BUSES).toMatchObject({ master: 0.8, ambience: 0.45, room: 0.25 });
    expect(BEDS.places.final.crowd).toBe(1);
    expect(GAME.shots.golazo).toEqual({ kick: 0.75, cheer: 0.8, wind: 0.6 });
  });
});
