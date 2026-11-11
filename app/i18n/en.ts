// All interface text lives here, so other languages can be added later: the pages, the
// words the home screen paints on its canvas (the ball's patches, the airship's sign, the
// line under the logo) and the page titles. Question content lives in app/data.
//
// The voice is a cheerful matchday programme, in British English. Lines that carry a value
// are functions.
import type { TierId } from "~/game";

export const en = {
  siteName: "soccersense",

  home: {
    title: "soccersense: daily football trivia, one stadium a day",
    description:
      "One stadium a day and seven questions a side. Play HOME and give the answer most players give, or play AWAY and find the one hardly anyone thinks of. A new matchday every day, free to play.",
    /** Read out in place of the airship's sign, which is only pixels. */
    fact: (fact: string) => `Fact of the day: ${fact}`,
    /** The words painted on the canvas. The pixel fonts are capitals. */
    canvas: {
      home: "HOME",
      away: "AWAY",
      /** The locked patches: top and bottom, and two on the back of the ball. */
      nextgen: "NEXT-GEN",
      retro: "RETRO",
      closest: "CLOSEST",
      furthest: "FURTHEST",
      /** The airship's sign, over the fact of the day. */
      header: "DID YOU KNOW?",
      tagline: "DAILY FOOTBALL TRIVIA",
    },
    modes: {
      home: { label: "HOME", line: "The most common answer wins" },
      away: { label: "AWAY", line: "The most niche answer wins" },
    },
    /** Read out for the score on a mode that has been played today. */
    played: (points: number) => `Played today: ${points} points`,
    day: (day: number) => `DAY ${day}`,
    /** In the day's place until the page knows what day it is. */
    dayPending: "TODAY",
    /** A locked patch on the ball was pressed: shown, and read out, by its mode. */
    soon: {
      nextgen: "NEXT-GEN kicks off soon.",
      retro: "RETRO kicks off soon.",
      closest: "CLOSEST kicks off soon.",
      furthest: "FURTHEST kicks off soon.",
    },
  },

  play: {
    title: {
      home: "HOME: the most common answer wins · soccersense",
      away: "AWAY: the most niche answer wins · soccersense",
    },
    description: {
      home: "Seven questions, and the answer most players give scores 100. Go with the crowd.",
      away: "Seven questions, and the answer fewest players give scores 100. Find the deep cut.",
    },
    /** The page's heading: only read out (the scoreboard says the rest). */
    heading: { home: "The HOME match", away: "The AWAY match" },
    /** Read out under the heading once the day is known. */
    stadium: (name: string, city: string, country: string) =>
      `Today's stadium: ${name}, ${city}, ${country}.`,

    board: {
      label: "Scoreboard",
      points: "PTS",
      totalSpoken: (total: number) =>
        total === 1 ? "1 point" : `${total} points`,
      questionOf: (n: number, count: number) => `Question ${n} of ${count}`,
      timeLeft: (seconds: number) =>
        seconds === 1 ? "1 second left" : `${seconds} seconds left`,
      /** What wins, under the question. */
      instruction: {
        home: "The most common answer wins.",
        away: "The most niche answer wins.",
      },
      /** How it is scored, in a few words, under the instruction. */
      measure: {
        home: "Scored by how many players give the same answer.",
        away: "Scored by how few players give the same answer.",
      },
    },

    answer: {
      input: "Your answer",
      shoot: "SHOOT",
      pass: "PASS",
      /** The hint in the empty field, by what the question is measured by. */
      placeholder: {
        birthplace: "Type a name",
        ground: "Type a club",
        location: "Type a stadium",
        capital: "Type a country",
      },
      unknown: "Not on the teamsheet. Try another.",
      ambiguous: "Which one? Give us a bit more of the name.",
    },

    grades: {
      worldie: "WORLDIE!",
      topbins: "TOP BINS",
      goal: "GOAL!",
      ontarget: "ON TARGET",
      wide: "OFF TARGET",
      timeup: "TIME'S UP",
      skipped: "PASSED",
    },
    /** The points on the reveal's band. */
    gained: (points: number) => `+${points}`,

    /**
     * The reveal's one plain sentence: how many players gave the answer. `share` is already
     * formatted ("34%"). `crowd` is for an answer plenty of players gave, `lonely` for one
     * that only a few did (under 2%), in the tone of the mode being played.
     */
    sentence: {
      home: {
        crowd: (name: string, share: string) =>
          `${name}: about ${share} of players said the same.`,
        lonely: (name: string, share: string) =>
          `${name}: only ${share} of players said the same. Brave, but the crowd went elsewhere.`,
      },
      away: {
        crowd: (name: string, share: string) =>
          `${name}: about ${share} of players said the same. Busy round here!`,
        lonely: (name: string, share: string) =>
          `${name}: only ${share} of players went for that one. A proper deep cut!`,
      },
      /** No answer was given: the sentence names the top of the table instead. */
      skipped: {
        home: (best: string, share: string) =>
          `Passed. The crowd's favourite was ${best}: about ${share} of players said it.`,
        away: (best: string, share: string) =>
          `Passed. The deepest cut was ${best}: only ${share} of players said it.`,
      },
      timeup: {
        home: (best: string, share: string) =>
          `The whistle went. The crowd's favourite was ${best}: about ${share} of players said it.`,
        away: (best: string, share: string) =>
          `The whistle went. The deepest cut was ${best}: only ${share} of players said it.`,
      },
    },

    /** Kept for the locked modes CLOSEST and FURTHEST, which score by distance. */
    distanceSentence: {
      birthplace: (
        name: string,
        place: string,
        distance: string,
        stadium: string,
      ) => `${name} was born in ${place}: ${distance} from ${stadium}.`,
      ground: (
        name: string,
        place: string,
        distance: string,
        stadium: string,
      ) => `${name} play at ${place}: ${distance} from ${stadium}.`,
      location: (
        name: string,
        place: string,
        distance: string,
        stadium: string,
      ) => `${name} is in ${place}: ${distance} from ${stadium}.`,
      capital: (
        name: string,
        place: string,
        distance: string,
        stadium: string,
      ) =>
        `${name} is measured at its capital, ${place}: ${distance} from ${stadium}.`,
      /** No answer was given: the sentence names the top of the table instead. */
      skipped: (best: string, distance: string, stadium: string) =>
        `Passed. Top of the table was ${best}, ${distance} from ${stadium}.`,
      timeup: (best: string, distance: string, stadium: string) =>
        `The whistle went. Top of the table was ${best}, ${distance} from ${stadium}.`,
    },

    /** The reveal's table. The third column is each answer's share of players. */
    table: {
      caption: "The table",
      rank: "#",
      answer: "ANSWER",
      distance: "PICKED",
      points: "PTS",
      you: "YOU",
      gap: "Rows left out",
    },
    next: "NEXT QUESTION",
    toFullTime: "FULL TIME",

    /** The career ladder: one name per tier, as the board and the full-time card show it. */
    tiers: {
      park: "PARK KICKABOUT",
      sunday: "SUNDAY LEAGUE",
      nonleague: "NON-LEAGUE",
      lower: "LOWER LEAGUES",
      topflight: "TOP FLIGHT",
      international: "INTERNATIONAL",
      final: "WORLD CUP FINAL",
      winner: "WORLD CUP WINNER",
    } satisfies Record<TierId, string>,
    /** Read out as the ground changes round him. */
    promoted: (tier: string) => `Promoted! Up to ${tier}.`,

    fullTime: {
      heading: "FULL TIME",
      totalSpoken: (total: number, max: number) => `${total} out of ${max}`,
      perfect: "PERFECT GAME",
      results: "Your answers",
      /** The full-time list, for a question with no answer. */
      skipped: "Passed",
      timeup: "Time's up",
      share: "SHARE",
      copied: "COPIED!",
      notCopied: "NOT COPIED",
      /** Read out after SHARE. */
      copiedSpoken: "Your result is copied. Paste it wherever your mates are.",
      notCopiedSpoken:
        "The browser would not let us copy your result. Try SHARE again.",
      other: { home: "PLAY HOME", away: "PLAY AWAY" },
      menu: "MENU",
      /** Read out when the final whistle goes. */
      spoken: (total: number, max: number, tier: string) =>
        `Full time. ${total} out of ${max}. ${tier}.`,
    },

    /** Words the career scene paints on its boards and banners. The pixel fonts are capitals. */
    canvas: {
      boards: ["SOCCERSENSE", "HOT PIES", "TEA BAR", "COME ON THEN"],
      banners: ["HOMETOWN HERO", "ONE OF OUR OWN", "BRING IT HOME"],
    },

    /** The way back to the menu from the plain pages (the rules, the error page). */
    back: "BACK TO THE BALL",
  },

  howToPlay: {
    title: "How to play",
    description:
      "Every day has one stadium and two matches. Play HOME and the answer most players give scores 100. Play AWAY and the one fewest players give does. Seven questions, thirty seconds each, 700 points to play for.",
  },

  errors: {
    title: "Offside!",
    unexpected:
      "Something went wrong on our side of the pitch. Have another go.",
    notFound: "We looked all round the ground and could not find that page.",
  },
};
