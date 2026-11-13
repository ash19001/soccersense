/**
 * The era layer over the people's frames (.snaps/era-art/THEME.md): RETRO's and NEXT-GEN's
 * looks are laid over the fill art of every frame (before `figure()` outlines it), never a
 * second copy of it. Today's art passes through untouched.
 */

import type { Era } from "../era";
import { nextgenFrames } from "./nextgen";
import { retroFrames } from "./retro";

/** Whose frames: the footballer adult or youth, the keeper, the fetch's frames. */
export type FrameWho = "adult" | "youth" | "keeper" | "fetch";

/** Split fill art into frames of rows (blank lines between frames). */
function split(art: string): string[][] {
  const out: string[][] = [];
  let cur: string[] | undefined;
  for (const raw of art.split("\n")) {
    const line = raw.trim();
    if (line === "") {
      cur = undefined;
      continue;
    }
    if (cur === undefined) {
      cur = [];
      out.push(cur);
    }
    cur.push(line);
  }
  return out;
}

/** The art of an animation in an era (fill art, frames joined by blank lines). */
export function eraFrames(
  era: Era,
  who: FrameWho,
  anim: string,
  art: string,
): string {
  if (era === "today") return art;
  const frames = split(art);
  const done =
    era === "retro"
      ? retroFrames(who, anim, frames)
      : nextgenFrames(who, anim, frames);
  return done.map((rows) => rows.join("\n")).join("\n\n");
}
