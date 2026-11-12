/**
 * Where the sound is: the place an ambience stands for, and how many people are there to
 * cheer. The beds (ambience.ts) are chosen by place, and the crowd voices (cheer, groan, ooh
 * in voices.ts) are sized by it: a few mates whooping in the park, a whole stadium at the
 * World Cup, and on the home page a stadium heard from across town.
 */

import type { Ambience } from "~/scenes/scene";

import { CROWD } from "./mix";

/** The places, in career order after the home page's town. */
export const PLACES = [
  "town",
  "park",
  "sunday",
  "nonleague",
  "lower",
  "top",
  "international",
  "final",
  "winners",
] as const;

export type Place = (typeof PLACES)[number];

/** The career tiers' places, by tier (0 to 7). */
export const TIER_PLACES: readonly Place[] = PLACES.slice(1);

/**
 * The place an ambience stands for. The town is the home page whatever the tier. Otherwise
 * the career tier wins when there is one, and a venue alone stands for a typical tier: the
 * park a kickabout, a ground non-league, a stadium the top flight.
 */
export function placeOf(ambience: Pick<Ambience, "venue" | "tier">): Place {
  if (ambience.venue === "town") return "town";
  const tier = ambience.tier;
  if (typeof tier === "number" && Number.isFinite(tier)) {
    const i = Math.max(0, Math.min(7, Math.round(tier)));
    return TIER_PLACES[i];
  }
  switch (ambience.venue) {
    case "park":
      return "park";
    case "ground":
      return "nonleague";
    case "stadium":
      return "top";
  }
}

/** Who is there to make a crowd sound. */
export interface Crowd {
  /** 0 a few mates on the touchline, 1 a whole stadium at a final. */
  people: number;
  /** Heard from far away (the home page's town): faint, dark, nobody close. */
  far: boolean;
}

/** The crowd at a place (how many people: `CROWD.places[place].people` in mix.ts). */
export function crowdAt(place: Place): Crowd {
  const people: Readonly<Record<Place, { people: number }>> = CROWD.places;
  return { people: people[place].people, far: place === "town" };
}

/** Where a cue is heard when no scene has said: a stadium, the game's usual place. */
export const DEFAULT_CROWD: Crowd = crowdAt("top");
