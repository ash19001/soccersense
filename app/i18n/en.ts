// All interface text lives here, so other languages can be added later: the pages, the
// words the home screen paints on its canvas (the ball's patches, the airship's sign, the
// line under the logo) and the page titles. Question content lives in app/data.
//
// The voice is a cheerful matchday programme, in British English. Lines that carry a value
// are functions.
import type { AwayTitleId, Grade, HomeTitleId, Shot, TierId } from "~/game";

export const en = {
  siteName: "soccersense",

  /** The speaker button in the corner of the home screen and the game. */
  sound: {
    /** Its name for screen readers: a switch, read as "Sound, on" or "Sound, off". */
    label: "Sound",
    /** Its tooltip, by state. */
    on: "Sound on",
    off: "Sound off",
  },

  home: {
    title: "soccersense: daily football trivia, one stadium a day",
    description:
      "One stadium a day and seven questions a side. Play HOME and give the answer most players give, or play AWAY and find the most uncommon one, the answer hardly anyone thinks of. A new matchday every day, free to play.",
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
      /** Two more on the rim, a quarter turn round: past HOME and past AWAY. */
      guesswho: "GUESS WHO",
      shootout: "SHOOTOUT",
      /** The airship's sign, over the fact of the day. */
      header: "DID YOU KNOW?",
      tagline: "DAILY FOOTBALL TRIVIA",
    },
    modes: {
      home: { label: "HOME", line: "The most common answer wins" },
      away: { label: "AWAY", line: "The most uncommon answer wins" },
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
      guesswho:
        "GUESS WHO: read the back of the shirt and fill in the gaps. Coming soon.",
      shootout:
        "SHOOTOUT: questions from the spot, on lives, not the clock. Coming soon.",
    },
    /** Today's top ten per mode: a panel on a monitor, a sheet behind a trophy on a phone. */
    leaderboard: {
      heading: "TODAY'S TOP 10",
      tabs: "Today's leaderboards",
      caption: (mode: string) => `Today's top 10, ${mode}`,
      rank: "#",
      name: "PLAYER",
      points: "PTS",
      you: "YOU",
      /** Read out for the player's own row: "You: 37th of 1,284". */
      youSpoken: (rank: number, count: number) => {
        const tens = rank % 100;
        const suffix =
          tens >= 11 && tens <= 13
            ? "th"
            : (["th", "st", "nd", "rd"][rank % 10] ?? "th");
        return `You: ${rank}${suffix} of ${count.toLocaleString("en-GB")}`;
      },
      gap: "Rows left out",
      played: (count: number) =>
        `${count.toLocaleString("en-GB")} played today`,
      open: "Today's top 10",
      close: "Close the leaderboard",
      /** The tab on the panel's edge (a monitor) that slides it away and back. */
      toggle: "Leaderboard",
      hide: "Hide the leaderboard",
      show: "Show the leaderboard",
    },
  },

  play: {
    title: {
      home: "HOME: the most common answer wins · soccersense",
      away: "AWAY: the most uncommon answer wins · soccersense",
    },
    description: {
      home: "Seven questions, and the answer most players give scores 100. Go with the crowd.",
      away: "Seven questions, and the most uncommon answer, the one fewest players give, scores 100. Find the deep cut.",
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
        away: "The most uncommon answer wins.",
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

    /** The reveal's band: which shot it was, or no answer. */
    grades: {
      worldie: "WORLDIE!",
      golazo: "GOLAZO!",
      trivela: "TRIVELA",
      toepoke: "TOE POKE",
      tapin: "TAP IN",
      miss: "MISS",
      timeup: "TIME'S UP",
      skipped: "PASSED",
    } satisfies Record<Grade, string>,
    /** Each shot's name in the reveal's table and on the full-time card. */
    shots: {
      worldie: "WORLDIE",
      golazo: "GOLAZO",
      trivela: "TRIVELA",
      toepoke: "TOE POKE",
      tapin: "TAP IN",
      miss: "MISS",
    } satisfies Record<Shot, string>,
    /** The points on the reveal's band (none for a miss, a pass or a time-up). */
    gained: (points: number) => `+${points}`,

    /**
     * The reveal's one plain sentence: how many players gave the answer, and what that made
     * it, in the tone of the mode being played. `picked` is `sentence.picked` of the share.
     */
    sentence: {
      /**
       * How many players gave it, from a formatted share ("34%"): `crowd` for an answer
       * plenty of players gave, `lonely` for one only a few did (under 2%).
       */
      picked: {
        crowd: (share: string) => `about ${share}`,
        lonely: (share: string) => `only ${share}`,
      },
      /** HOME: the most common answers are the worldies. */
      home: {
        worldie: (name: string, picked: string) =>
          `${name}: ${picked} of players said the same. The whole ground was with you. Worldie!`,
        golazo: (name: string, picked: string) =>
          `${name}: ${picked} of players said the same. Near the top of the crowd's list.`,
        trivela: (name: string, picked: string) =>
          `${name}: ${picked} of players said the same. A good crowd pick.`,
        toepoke: (name: string, picked: string) =>
          `${name}: ${picked} of players said the same. Some of the crowd were with you.`,
        tapin: (name: string, picked: string) =>
          `${name}: ${picked} of players said the same. Most of the crowd went elsewhere.`,
        miss: (name: string, picked: string) =>
          `${name}: ${picked} of players said the same. Right answer, but the crowd went elsewhere.`,
      } satisfies Record<Shot, (name: string, picked: string) => string>,
      /** AWAY: the most uncommon answers are the worldies. */
      away: {
        worldie: (name: string, picked: string) =>
          `${name}: ${picked} of players went for that one. Nobody saw it coming. Worldie!`,
        golazo: (name: string, picked: string) =>
          `${name}: ${picked} of players went for that one. Well off the beaten track.`,
        trivela: (name: string, picked: string) =>
          `${name}: ${picked} of players went for that one. Not many saw that coming.`,
        toepoke: (name: string, picked: string) =>
          `${name}: ${picked} of players went for that one. A few got there with you.`,
        tapin: (name: string, picked: string) =>
          `${name}: ${picked} of players went for that one. Plenty got there first.`,
        miss: (name: string, picked: string) =>
          `${name}: ${picked} of players said the same. Right answer, but busy round here!`,
      } satisfies Record<Shot, (name: string, picked: string) => string>,
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

    /**
     * The reveal's table: one answer for each shot that scores. The third column is each
     * answer's share of players, the fourth its shot.
     */
    table: {
      caption: "One answer for each shot that scores, best first",
      rank: "#",
      answer: "ANSWER",
      distance: "PICKED",
      shot: "SHOT",
      points: "PTS",
      you: "YOU",
      gap: "Rows left out",
    },
    /**
     * The player's answer above the reveal's table when it did not score (it is not a row):
     * a listed miss, a pass or a time-up.
     */
    yours: {
      /** In place of a name after a pass or a time-up. */
      none: "NO ANSWER",
      /** The tag after a pass or a time-up (a listed miss uses `shots.miss`). */
      timeup: "TIME'S UP",
      skipped: "PASSED",
      /** Read out: "Your answer: Blackburn Rovers, picked by 2%. MISS, 0 points." */
      spoken: (answer: string, picked: string, shot: string, points: number) =>
        `Your answer: ${answer}, picked by ${picked}. ${shot}, ${points} points.`,
      /** Read out after a pass or a time-up: "No answer: TIME'S UP, 0 points." */
      spokenNone: (shot: string, points: number) =>
        `No answer: ${shot}, ${points} points.`,
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

    /**
     * The title earned at full time, by the total (`titleFor` in ~/game: from 0, 10, 120, 220,
     * 300, 380, 460, 540 and 620, and 700 alone). HOME: the crowd's favourite. AWAY: the scout
     * of the obscure. Shown big on the full-time card and put in the share text.
     */
    titles: {
      home: {
        wrongend: "IN THE WRONG END",
        findingseat: "STILL FINDING A SEAT",
        turnstile: "QUEUING TO GET IN",
        piequeue: "PIE QUEUE REGULAR",
        seasonticket: "SEASON TICKET HOLDER",
        knowschants: "KNOWS ALL THE CHANTS",
        startschants: "STARTS THE CHANTS",
        voice: "VOICE OF THE TERRACE",
        whisperer: "CROWD WHISPERER",
        hivemind: "THE HIVE MIND",
      } satisfies Record<HomeTitleId, string>,
      away: {
        herd: "ONE OF THE HERD",
        backpages: "READS THE BACK PAGES",
        highlights: "WATCHES HIGHLIGHTS",
        retroshirt: "OWNS ONE RETRO SHIRT",
        thirdkit: "THIRD KIT COLLECTOR",
        fanzine: "FANZINE SUBSCRIBER",
        lowerleague: "LOWER-LEAGUE SCOUT",
        beforecool: "KNEW THEM FIRST",
        deepcuts: "DEEP CUT SPECIALIST",
        hipster: "HIPSTER'S HIPSTER",
      } satisfies Record<AwayTitleId, string>,
    },

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
      spoken: (total: number, max: number, title: string, tier: string) =>
        `Full time. ${total} out of ${max}: ${title}. ${tier}.`,
      /** Read out before the title on the card: "Your title: SEASON TICKET HOLDER". */
      titleSpoken: "Your title",
    },

    /** Words the career scene paints on its boards and banners. The pixel fonts are capitals. */
    canvas: {
      boards: ["SOCCERSENSE", "HOT PIES", "TEA BAR", "COME ON THEN"],
      banners: ["HOMETOWN HERO", "ONE OF OUR OWN", "BRING IT HOME"],
    },

    /** The way back to the menu from the plain pages (the rules, the error page). */
    back: "BACK TO THE BALL",
  },

  /**
   * The rules: a pop-up over the home screen, behind the "?" button (HowToPlay in ~/ui),
   * and the same card on its own page at /how-to-play for old links. As little as can be:
   * a line on the day, then the shots and the career, whose names come from `play.shots`
   * and `play.tiers`. Each mode's own rule is on the home screen and the board, not here.
   */
  howToPlay: {
    /** The "?" button's name, and the page's title. */
    title: "How to play",
    /** The page's meta description. */
    description:
      "Seven football questions a day, 30 seconds each. Every answer is a shot; your points take a footballer from the park to the World Cup.",
    heading: "HOW TO PLAY",
    close: "Close",
    /** The one line under the heading, and the dialog's description. */
    intro: "7 questions a day. 30 seconds each.",
    shots: {
      heading: "POINTS",
      /** Read out after a shot's name, for the number beside it. */
      points: (points: number) => `${points} points`,
    },
    career: {
      heading: "YOUR CAREER",
      /** Read out for each step of the ladder. */
      step: (tier: string, from: number) => `${tier}, from ${from} points`,
    },
  },

  errors: {
    title: "Offside!",
    unexpected:
      "Something went wrong on our side of the pitch. Have another go.",
    notFound: "We looked all round the ground and could not find that page.",
  },
};
