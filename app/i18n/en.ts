// All interface text lives here, so other languages can be added later: the pages, the
// words the home screen paints on its canvas (the ball's patches, the airship's sign, the
// line under the logo) and the page titles. Question content lives in app/data.
//
// The voice is a cheerful matchday programme, in British English. Lines that carry a value
// are functions.
import type {
  AccountProblem,
  AwayTitleId,
  Grade,
  HomeTitleId,
  NextgenTitleId,
  NicknameProblem,
  RetroTitleId,
  Shot,
  TierId,
} from "~/game";

export const en = {
  siteName: "soccersense",

  /**
   * What search engines and link previews are told about the site as a whole
   * (app/routes/seo.ts). Each page's own title and description are with its words below.
   */
  seo: {
    /**
     * The link preview's picture (public/social-card.png, drawn by
     * app/scenes/social-card.ts), described for anyone who cannot see it.
     */
    cardAlt:
      "The soccersense home screen in pixel art: a football in front of a stadium, the soccersense wordmark above it, and an airship whose sign reads DAILY FOOTBALL TRIVIA.",
    /**
     * The airship's sign in that picture, in place of the fact of the day. Neither line
     * scrolls in a still: 14 small letters over 10 large ones at most.
     */
    cardSign: { header: "DAILY FOOTBALL", text: "TRIVIA" },
    /** The kind of game it is, for structured data (schema.org's `genre`). */
    genre: ["Trivia", "Sports"],
    /** Where it is played, for structured data (schema.org's `gamePlatform`). */
    platform: "Web browser",
  },

  /** The speaker button in the corner of the home screen and the game. */
  sound: {
    /** Its name for screen readers: a switch, read as "Sound, on" or "Sound, off". */
    label: "Sound",
    /** Its tooltip, by state. */
    on: "Sound on",
    off: "Sound off",
    /**
     * Its tooltip while the sound is on but the browser is still holding it: a page is
     * silent until its first click, tap or key, on every load and refresh.
     */
    waiting: "Sound on: it starts when you click or tap",
  },

  home: {
    /**
     * The page's title in a tab and in search results: the name, then what it is. Under 60
     * characters, or a search result cuts it short.
     */
    title: "soccersense: the daily football trivia game",
    /**
     * The page's meta description, the lines under the title in a search result, and what
     * the page says of itself where scripts are off: what it is first, then the four ways to
     * play. Under 160 characters, or a search result cuts it short.
     */
    description:
      "Free daily football trivia: seven questions a match and four ways to win. Give the most common answer, the most uncommon, the oldest or the most recent.",
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
      /** On the plane's banner, before the fact of the day. */
      header: "DID YOU KNOW?",
      tagline: "DAILY FOOTBALL TRIVIA",
      /**
       * The airship's sign as the ball turns to gold (the easter egg: the ball kept spinning
       * by hand). Short, as every message of the sign: 12 small letters a line at most. It
       * is the only thing that says so (the page reads the same words out).
       */
      golden: { header: "GOLDEN BALL!", text: "YOU FOUND IT" },
    },
    /**
     * The airship's sign: short messages about the player's day, one after another
     * (app/routes/home-sign.ts). A green header over an amber line, in lamps: capitals, and
     * short, so nothing scrolls on the smallest sign (a 100 px window, every size): a header
     * of 12 small letters at most, a line of 8 big or 12 small ones. A title, longer, is
     * shown alone, on two small lines with no header.
     */
    sign: {
      /**
       * A mode played today: its label over its total ("NEXT-GEN" over "360 PTS"), then
       * over its place out of everyone on the board ("37 OF 1,284"), then the title it
       * earned, alone. The place is a bare number: the longest the board can give,
       * "1891 OF 1,891", just fits the smallest sign in small letters; with "#" or "TH"
       * it would not.
       */
      points: (points: number) => `${points} PTS`,
      rank: (rank: number, count: number) =>
        `${rank} OF ${count.toLocaleString("en-GB")}`,
      /** "DAILY STREAK" over "4 DAYS". */
      streak: "DAILY STREAK",
      days: (days: number) => (days === 1 ? "1 DAY" : `${days} DAYS`),
      /** A mode not played yet: its label over "IS WAITING". */
      isWaiting: "IS WAITING",
      /** "PLAYED TODAY" over "1,136". */
      crowd: "PLAYED TODAY",
      count: (count: number) => count.toLocaleString("en-GB"),
    },
    /**
     * The daily streak by the day plate: a flame and the days in a row with a finished game.
     * Read out: "Daily streak: 4 days in a row".
     */
    streak: {
      spoken: (days: number) =>
        days === 0
          ? "No daily streak yet. Finish today's game to start one."
          : `Daily streak: ${days} ${days === 1 ? "day" : "days"} in a row`,
      /** Its tooltip. */
      title: "Daily streak",
    },
    modes: {
      home: { label: "HOME", line: "The most common answer wins" },
      away: { label: "AWAY", line: "The most uncommon answer wins" },
      retro: { label: "RETRO", line: "The oldest answer wins" },
      nextgen: { label: "NEXT-GEN", line: "The most recent answer wins" },
    },
    /** Read out for the score on a mode that has been played today. */
    played: (points: number) => `Played today: ${points} points`,
    /**
     * A mode played today: each mode is played once a day, so its card has a button that
     * opens the day's game again in a pop-up (as does its patch on the ball).
     */
    review: {
      /** The button's name for screen readers: "Review your HOME game". */
      open: (mode: string) => `Review your ${mode} game`,
      /** The pop-up's heading: "YOUR HOME GAME". */
      heading: (mode: string) => `YOUR ${mode} GAME`,
      close: "Close",
    },
    /** SHARE on a played mode's card: shared as its full-time card shares it. */
    share: {
      /** The button's name and tooltip: "Share your HOME game". */
      open: (mode: string) => `Share your ${mode} game`,
      /**
       * How it went, on the plate over the cards (and read out): short, as the plate is
       * narrow beside the ball on a monitor.
       */
      making: "Making your picture...",
      shared: "Shared. Nice one!",
      saved: "Picture saved, link copied.",
      downloaded: "Picture saved. The text could not be copied.",
      copied: "Link copied. Paste it anywhere.",
      failed: "Could not copy the link. Try again.",
    },
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
      /**
       * Under the table, in place of "1,284 played today": the player's own line, where
       * they came today in this mode ("You're 37th of 1,284")...
       */
      mine: (rank: number, count: number) => {
        const tens = rank % 100;
        const suffix =
          tens >= 11 && tens <= 13
            ? "th"
            : (["th", "st", "nd", "rd"][rank % 10] ?? "th");
        return `You're ${rank}${suffix} of ${count.toLocaleString("en-GB")}`;
      },
      /** ...or, not played yet, a nudge (short: the monitor's panel shows one line). */
      nudge: (count: number) => `${count.toLocaleString("en-GB")} played. You?`,
      /** Over the strip of the player's last seven days in the mode. */
      week: "LAST 7 DAYS",
      /** The days under the bars, Sunday first (`Date.getUTCDay`). */
      weekdays: ["SU", "MO", "TU", "WE", "TH", "FR", "SA"],
      /** The same, read out. */
      weekdaysSpoken: [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      /** The seven read out in one go: "Your last 7 days of RETRO: Monday 340, ...". */
      weekSpoken: (mode: string, days: string) =>
        `Your last 7 days of ${mode}: ${days}.`,
      daySpoken: (day: string, points: number | null) =>
        points === null ? `${day} not played` : `${day} ${points} points`,
      /** The link to the stats pop-up, at the strip's top right. */
      more: "ALL STATS",
    },
    /**
     * The modes' lines, shorter, as the captions show them (the full line, `modes`, is what
     * screen readers hear).
     */
    short: {
      home: "Most common wins",
      away: "Most uncommon wins",
      retro: "Oldest wins",
      nextgen: "Newest wins",
    },
    /** Shorter still, for a phone's cards: two lines at most beside the badge. */
    tiny: {
      home: "Most common",
      away: "Most uncommon",
      retro: "Oldest",
      nextgen: "Newest",
    },
  },

  play: {
    title: {
      home: "HOME: the most common answer wins · soccersense",
      away: "AWAY: the most uncommon answer wins · soccersense",
      retro: "RETRO: the oldest answer wins · soccersense",
      nextgen: "NEXT-GEN: the most recent answer wins · soccersense",
    },
    description: {
      home: "Seven football questions, and the answer most players give scores 100. Go with the crowd.",
      away: "Seven football questions, and the most uncommon answer, the one fewest players give, scores 100. Find the deep cut.",
      retro:
        "Seven football questions, and the oldest answer, the one furthest back in the game's history, scores 100. Dust off the record books.",
      nextgen:
        "Seven football questions, and the most recent answer, the one that happened last, scores 100. Keep up with the latest.",
    },
    /** The page's heading: only read out (the scoreboard says the rest). */
    heading: {
      home: "The HOME match",
      away: "The AWAY match",
      retro: "The RETRO match",
      nextgen: "The NEXT-GEN match",
    },
    /**
     * The mode card: on the ink the page arrives on, before a new game, the mode's name
     * (`home.modes`) over what to give in it. `key` is the part of the line that tells the
     * mode from the others, shown in its colour (it must be in the line, letter for letter).
     * `spoken` is the name and the line read out together.
     */
    intro: {
      line: {
        home: "GIVE THE MOST COMMON ANSWER",
        away: "GIVE THE MOST UNCOMMON ANSWER",
        retro: "GIVE THE OLDEST ANSWER",
        nextgen: "GIVE THE MOST RECENT ANSWER",
      },
      key: {
        home: "MOST COMMON",
        away: "MOST UNCOMMON",
        retro: "OLDEST",
        nextgen: "MOST RECENT",
      },
      spoken: {
        home: "HOME. Give the most common answer.",
        away: "AWAY. Give the most uncommon answer.",
        retro: "RETRO. Give the oldest answer.",
        nextgen: "NEXT-GEN. Give the most recent answer.",
      },
    },
    /** The game waits for the site's server to say what day it is (`gameClock`). */
    clock: {
      failing: "Can't check today's date. Check your connection.",
    },
    /** The site's server runs the game: what the page says while it cannot be reached. */
    server: {
      /** Before a game is on, and above the answer bar while one is. */
      trouble: "Can't reach the game. Check your connection.",
      /** On the reveal's button while the next question cannot be fetched. */
      retrying: "TRYING AGAIN",
    },

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
        retro: "The oldest answer wins.",
        nextgen: "The most recent answer wins.",
      },
      /** How it is scored, in a few words, under the instruction. */
      measure: {
        home: "Scored by how many players give the same answer.",
        away: "Scored by how few players give the same answer.",
        retro: "Scored by how far back it first happened.",
        nextgen: "Scored by how recently it last happened.",
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
      /**
       * RETRO: the oldest answers are the worldies. `year` is the first year the answer
       * counted (a club's first title, a country's first final): "1889".
       */
      retro: {
        worldie: (name: string, year: string) =>
          `${name}: first did it in ${year}. Straight out of the history books. Worldie!`,
        golazo: (name: string, year: string) =>
          `${name}: first did it in ${year}. Proper old school.`,
        trivela: (name: string, year: string) =>
          `${name}: first did it in ${year}. A good dig through the archives.`,
        toepoke: (name: string, year: string) =>
          `${name}: first did it in ${year}. A fair way back, but not the start.`,
        tapin: (name: string, year: string) =>
          `${name}: first did it in ${year}. Not all that long ago, really.`,
        miss: (name: string, year: string) =>
          `${name}: first did it in ${year}. Right answer, but that's practically yesterday!`,
      } satisfies Record<Shot, (name: string, year: string) => string>,
      /**
       * NEXT-GEN: the most recent answers are the worldies. `year` is the last year the
       * answer counted (a club's latest title): "2026".
       */
      nextgen: {
        worldie: (name: string, year: string) =>
          `${name}: last did it in ${year}. Hot off the press. Worldie!`,
        golazo: (name: string, year: string) =>
          `${name}: last did it in ${year}. The ink's still wet.`,
        trivela: (name: string, year: string) =>
          `${name}: last did it in ${year}. Fresh enough to remember the kits.`,
        toepoke: (name: string, year: string) =>
          `${name}: last did it in ${year}. A few seasons back now.`,
        tapin: (name: string, year: string) =>
          `${name}: last did it in ${year}. That's going back a bit.`,
        miss: (name: string, year: string) =>
          `${name}: last did it in ${year}. Right answer, but that's ancient history!`,
      } satisfies Record<Shot, (name: string, year: string) => string>,
      /**
       * No answer was given: the sentence names the top of the table instead. The second
       * value is a share ("34%") in HOME and AWAY, a year ("1889") in RETRO and NEXT-GEN.
       */
      skipped: {
        home: (best: string, share: string) =>
          `Passed. The crowd's favourite was ${best}: about ${share} of players said it.`,
        away: (best: string, share: string) =>
          `Passed. The deepest cut was ${best}: only ${share} of players said it.`,
        retro: (best: string, year: string) =>
          `Passed. The oldest answer was ${best}, all the way back in ${year}.`,
        nextgen: (best: string, year: string) =>
          `Passed. The most recent answer was ${best}, as recently as ${year}.`,
      },
      timeup: {
        home: (best: string, share: string) =>
          `The whistle went. The crowd's favourite was ${best}: about ${share} of players said it.`,
        away: (best: string, share: string) =>
          `The whistle went. The deepest cut was ${best}: only ${share} of players said it.`,
        retro: (best: string, year: string) =>
          `The whistle went. The oldest answer was ${best}, all the way back in ${year}.`,
        nextgen: (best: string, year: string) =>
          `The whistle went. The most recent answer was ${best}, as recently as ${year}.`,
      },
    },

    /**
     * Kept for the locked modes CLOSEST and FURTHEST, which score by distance. The stadium is
     * never named: it is "today's stadium" and no more.
     */
    distanceSentence: {
      birthplace: (name: string, place: string, distance: string) =>
        `${name} was born in ${place}: ${distance} from today's stadium.`,
      ground: (name: string, place: string, distance: string) =>
        `${name} play at ${place}: ${distance} from today's stadium.`,
      location: (name: string, place: string, distance: string) =>
        `${name} is in ${place}: ${distance} from today's stadium.`,
      capital: (name: string, place: string, distance: string) =>
        `${name} is measured at its capital, ${place}: ${distance} from today's stadium.`,
      /** No answer was given: the sentence names the top of the table instead. */
      skipped: (best: string, distance: string) =>
        `Passed. Top of the table was ${best}, ${distance} from today's stadium.`,
      timeup: (best: string, distance: string) =>
        `The whistle went. Top of the table was ${best}, ${distance} from today's stadium.`,
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
      /**
       * The third column's heading in RETRO and NEXT-GEN, where it holds a year in place of
       * the share: the first year each answer counted, or the last.
       */
      year: { retro: "FIRST", nextgen: "LATEST" },
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
      /**
       * The same in RETRO and NEXT-GEN, with the year in place of the share: "Your answer:
       * Liverpool, first did it in 1901. MISS, 0 points."
       */
      spokenYear: {
        retro: (answer: string, year: string, shot: string, points: number) =>
          `Your answer: ${answer}, first did it in ${year}. ${shot}, ${points} points.`,
        nextgen: (answer: string, year: string, shot: string, points: number) =>
          `Your answer: ${answer}, last did it in ${year}. ${shot}, ${points} points.`,
      },
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
     * of the obscure. Shown big on the full-time card and on the share picture.
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
      /** RETRO: the keeper of football's past, from born yesterday to there at the start. */
      retro: {
        yesterday: "BORN YESTERDAY",
        almanac: "FLICKS THE ALMANAC",
        blackwhite: "BLACK AND WHITE TV",
        leather: "HEAVY LEATHER BALL",
        programmes: "PROGRAMME COLLECTOR",
        longshorts: "SHORTS PAST THE KNEE",
        historian: "TERRACE HISTORIAN",
        ledger: "KEEPER OF THE LEDGER",
        archive: "LIVING ARCHIVE",
        kickoff: "THERE AT KICK-OFF",
      } satisfies Record<RetroTitleId, string>,
      /** NEXT-GEN: first with the news, from still on dial-up to here from the future. */
      nextgen: {
        dialup: "STILL ON DIAL-UP",
        teletext: "SCORES ON TELETEXT",
        replays: "WAITING FOR REPLAYS",
        groupchat: "ON THE GROUP CHAT",
        alerts: "NOTIFICATIONS ON",
        liveblog: "LIVE BLOG REGULAR",
        rumours: "TRANSFER RUMOUR MILL",
        firstnews: "FIRST WITH THE NEWS",
        ahead: "AHEAD OF THE WHISTLE",
        future: "FROM THE FUTURE",
      } satisfies Record<NextgenTitleId, string>,
    },

    fullTime: {
      heading: "FULL TIME",
      totalSpoken: (total: number, max: number) => `${total} out of ${max}`,
      perfect: "PERFECT GAME",
      /** The daily streak this game kept going, beside the title: "STREAK 4". */
      streak: (days: number) => `STREAK ${days}`,
      /** Read out for it. */
      streakSpoken: (days: number) =>
        `Daily streak: ${days} ${days === 1 ? "day" : "days"} in a row`,
      results: "Your answers",
      /** The full-time list, for a question with no answer. */
      skipped: "Passed",
      timeup: "Time's up",
      share: "SHARE",
      copied: "COPIED!",
      notCopied: "NOT COPIED",
      /** Read out after SHARE. */
      copiedSpoken: "The link is copied. Paste it wherever your mates are.",
      notCopiedSpoken:
        "The browser would not let us copy the link. Try SHARE again.",
      /**
       * SHARE with a picture (docs/GAME_DESIGN.md 6.4): the share sheet where the browser
       * can share files (mostly phones), else the picture downloaded and the text copied.
       * The button's words are kept short (7 letters at most): a longer one wraps the
       * full-time card's row of buttons on a monitor and on small phones.
       */
      making: "MAKING",
      /** The share sheet took it. */
      shared: "SENT!",
      /**
       * The picture downloaded. When the text is copied too, the button says this and
       * then `copied`; when the clipboard said no, only this.
       */
      downloaded: "SAVED!",
      /** Read out while the picture is made, and after each way SHARE can end. */
      makingSpoken: "Making your picture.",
      sharedSpoken: "Shared. Nice one.",
      savedSpoken:
        "Your picture is downloaded and the link is copied. Send both wherever your mates are.",
      downloadedSpoken:
        "Your picture is downloaded. The browser would not let us copy the text.",
      /**
       * The text SHARE copies (and hands to the share sheet) with the picture: the player's
       * own line, and where to play under it. Nothing of the result, which is the
       * picture's. `link` is the site's address, "https://" and all, so that a chat makes
       * a link of it.
       */
      message: {
        intro: "Check out what I got on soccersense!",
        invite: (link: string) => `Test your football trivia on ${link}`,
      },
      /** The share image's own words (`paintShareCard` in ~/art/share-card). */
      image: {
        /** The file: "soccersense-day-12-home.png". */
        fileName: (day: number, mode: string) =>
          `soccersense-day-${day}-${mode}.png`,
        /** The share sheet's title. */
        title: (day: number, mode: string) => `soccersense #${day} ${mode}`,
        /**
         * A question cut down for its row: no "Name a", nothing in brackets, "has won"
         * as "won" (and "has hosted", "has played in"). The card shortens what is left to
         * fit, at a word.
         */
        prompt: (prompt: string) => {
          const short = prompt
            .replace(/\s*\([^)]*\)/g, "")
            .replace(/^Name (a|an) /i, "")
            .replace(/\bhas (won|hosted|played)\b/g, "$1")
            .trim();
          return short.charAt(0).toUpperCase() + short.slice(1);
        },
        /** In an answer's place after a pass or a time-up. */
        noAnswer: "no answer",
      },
      /**
       * The button on to the next mode not played today, in the menu's order (HOME, AWAY,
       * RETRO, NEXT-GEN, round to HOME; none once all four are played). Keyed by the mode
       * it starts. Ten letters at most: "PLAY NEXT-GEN" wraps the card's row of three
       * buttons at 1920 x 1080 and on a 390 x 844 phone, so every mode's button is its name
       * alone, the same for all four (in the mode's colour, it reads as the way there);
       * `otherSpoken` is its name for screen readers.
       */
      other: {
        home: "HOME",
        away: "AWAY",
        retro: "RETRO",
        nextgen: "NEXT-GEN",
      },
      otherSpoken: (mode: string) => `Play ${mode}`,
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
      /** NEXT-GEN's holographic boards, in place of the boards above. */
      nextgen: {
        boards: ["SOCCERSENSE", "DRONE PIES", "HOLO SEATS", "SCAN TO CHEER"],
      },
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

  /**
   * The player's stats: a pop-up over the home screen, behind the chart button beside the
   * "?" (Stats in ~/ui). Today's result per mode, then each mode over the year this device
   * keeps, and the daily streak.
   */
  stats: {
    /** The button's name and tooltip. */
    open: "Your stats",
    heading: "YOUR STATS",
    close: "Close",
    /** The one line under the heading, and the dialog's description. */
    /** A first visit: nothing finished yet. */
    empty:
      "No games yet. Finish a match and your results start piling up here.",
    today: "TODAY",
    notPlayed: "Not played yet",
    /** Read out for today's seven shots: "Question 3: TRIVELA, 60 points". */
    shot: (n: number, shot: string, points: number) =>
      `Question ${n}: ${shot}, ${points} points`,
    /** Read out before them. */
    shots: "Today's answers",
    /** Read out for today's total: "420 points". */
    total: (total: number) => `${total} points`,
    played: "PLAYED",
    average: "AVERAGE",
    best: "BEST",
    /** Under the best total: the day it was made. */
    bestDay: (day: number) => `DAY ${day}`,
    /** Read out for the best total: "520 points, on day 3". */
    bestSpoken: (total: number, day: number) =>
      `${total} points, on day ${day}`,
    /** A number there is none of yet: the average of a mode never played. */
    blank: "-",
    /** The tally of how the answers went, read out. */
    tally: "Your answers so far",
    /** In the tally, for a pass or a time-up. */
    none: "NO ANSWER",
    streak: "STREAK",
    /** The streak: days in a row with a finished game. */
    days: (days: number) => (days === 1 ? "1 DAY" : `${days} DAYS`),
    streakBest: (days: number) => `BEST ${days}`,
    /** Read out for the streak: "Streak: 3 days in a row. Best: 5." */
    streakSpoken: (current: number, best: number) =>
      `Streak: ${current} ${current === 1 ? "day" : "days"} in a row. Best: ${best}.`,
  },

  /**
   * The daily reminder: a pop-up over the home screen, behind the bell beside the day
   * (RemindMe in ~/ui). The player picks a time and adds an event that repeats every day to
   * their calendar: a file made on the device, or Google Calendar or Outlook on the web.
   */
  /** The player's nickname: made up on the first visit, changed from the leaderboard. */
  nickname: {
    heading: "YOUR NAME",
    /** The one line under the heading, and the dialog's description. */
    intro: "The name the leaderboards show for you. Change it any time.",
    close: "Close",
    field: "NAME",
    rules: "3 to 13 letters or numbers. Spaces, - and _ are fine too.",
    save: "SAVE",
    /** On SAVE while an account's name is being changed on the server. */
    saving: "SAVING",
    /** Under the field when the server turns an account's name down. */
    taken: "Somebody has that name. Try another.",
    reserved: "That name is kept back. Try another.",
    offensive: "That name is not allowed. Try another.",
    /** Under the field when a name cannot be used (`NicknameProblem` in ~/game). */
    problems: {
      short: "Too short: 3 characters at least.",
      long: "Too long: 13 characters at most.",
      characters: "Only letters, numbers, spaces, - and _.",
      letter: "It needs at least one letter.",
    } satisfies Record<NicknameProblem, string>,
  },
  /**
   * The player's account: a pop-up over the home screen (Account in ~/ui), reached from the
   * name's card. An account is optional: it keeps a player's name and games on the server,
   * so they are the same on every device. Signing in is by a link sent to an email
   * address, or with Google: there are no passwords.
   */
  account: {
    /**
     * In the top right corner of the home screen: the player's name (a press changes it)
     * and SIGN IN, or ACCOUNT once signed in. On a phone one button opens the account's
     * card, which has the name too.
     */
    menu: {
      signIn: "SIGN IN",
      open: "ACCOUNT",
      /** Read out for the name, and its tooltip. */
      nameSpoken: (name: string) => `Change your name, ${name}`,
      /** Read out for SIGN IN or ACCOUNT. */
      signInSpoken: "Sign in or make an account",
      openSpoken: "Your account",
      /** The phone's one button. */
      phone: (name: string) => `Your name and account: ${name}`,
    },
    /** The card's heading: nobody signed in (it signs up too), and somebody. */
    heading: "SIGN IN",
    headingIn: "YOUR ACCOUNT",
    close: "Close",
    /** The one line under the heading, and the dialog's description: nobody signed in. */
    intro:
      "New or back, it's the same: sign in by email or with Google. An account keeps your name, streak and stats on every device. Only accounts are on the leaderboards.",
    /** The same line once someone is signed in. */
    introIn: "Your name, streak and stats are kept for you on every device.",
    /** The player's name, at the top of the card, and the way to change it. */
    yourName: "YOUR NAME",
    change: "CHANGE",
    changeSpoken: (name: string) => `Change your name, ${name}`,
    email: "EMAIL",
    send: "EMAIL ME A LINK",
    sending: "SENDING",
    emailNote: "We'll email you a link that signs you in. No password.",
    google: "CONTINUE WITH GOOGLE",
    /** Once the link has gone. */
    sent: (email: string) => `Link sent to ${email}.`,
    sentNote: "Open it to sign in. It works once, for 15 minutes.",
    another: "USE ANOTHER EMAIL",
    checking: "Checking who is signed in.",
    retry: "TRY AGAIN",
    unreachable: "Can't reach the game. Check your connection.",
    none: "Signing in isn't switched on yet. Check back soon.",
    signedInAs: "SIGNED IN AS",
    leave: "SIGN OUT",
    leaving: "SIGNING OUT",
    /** The bot check (Cloudflare Turnstile), while it has not decided yet, and if it fails. */
    checkWaiting: "CHECKING",
    checkFailed:
      "The check that you're not a robot didn't load. Try again, or continue with Google.",
    /** Deleting the account: the button, the question, and the answer. */
    remove: "DELETE ACCOUNT",
    removeAsk:
      "Delete your account for good? Your name, games, streak and stats go from our server, and you're signed out everywhere. This device keeps its own copy of your games.",
    removeYes: "DELETE FOR GOOD",
    removeNo: "KEEP MY ACCOUNT",
    removing: "DELETING",
    removed: "Your account has been deleted.",
    /** At the foot of the card. */
    agree: "Signing in means you accept our",
    terms: "Terms",
    privacy: "Privacy",
    and: "and",
    /** Why the server would not do what was asked (`AccountProblem` in ~/game). */
    problems: {
      bad_email: "That doesn't look like an email address.",
      bot_check:
        "We couldn't check you're not a robot. Wait a moment, then try again.",
      too_many:
        "We've just sent a few. Check your inbox, or try again in 15 minutes.",
      not_set_up: "Signing in isn't switched on yet. Check back soon.",
      bad_link: "That link has been used or has run out. Ask for a new one.",
      signed_out: "You're signed out. Sign in again.",
      bad_name: "That name can't be used.",
      taken: "Somebody has that name. Try another.",
      failed: "That didn't work. Try again in a moment.",
    } satisfies Record<AccountProblem, string>,
  },
  /**
   * The page a sign-in link opens, and where a trip to Google ends: /enter
   * (app/routes/enter.tsx).
   */
  enter: {
    /** The page's title in the browser's tab. */
    title: "Sign in",
    heading: "SIGN IN",
    /** The way back to the menu, where the pop-ups have their close button. */
    back: "Back to the menu",
    /** While the link is being used. */
    working: "Signing you in.",
    /** A link opened in a browser that did not ask for it: a press signs in. */
    confirm: "Press the button to sign in on this device.",
    go: "SIGN IN",
    /** Signed in: who as, and the way on. */
    done: (email: string) => `You're in. Signed in as ${email}.`,
    playingAs: (nickname: string) => `You play as ${nickname}.`,
    play: "PLAY",
    /** The link did not work, or Google did not sign anyone in. */
    failed:
      "That didn't sign you in. The link may have been used or have run out.",
    googleFailed: "Google didn't sign you in. Try again from the menu.",
    /** The page opened with no link at all. */
    nothing: "Nothing to sign in with here. Ask for a link from the menu.",
    home: "BACK TO THE MENU",
  },
  remind: {
    /** The button's name and tooltip. */
    open: "Remind me",
    heading: "DAILY REMINDER",
    close: "Close",
    /** The one line under the heading, and the dialog's description. */
    intro: "Pick a time and we'll pop a daily kick-off into your calendar.",
    time: "TIME",
    file: "DOWNLOAD CALENDAR FILE",
    fileNote:
      "An .ics file for Apple Calendar and most others: open it to add it.",
    google: "GOOGLE",
    outlook: "OUTLOOK",
    outlookNote: "In Outlook, set the event to repeat every day.",
    newTab: "(opens in a new tab)",
    /** Announced once the file is saved. */
    saved: (file: string) => `Saved ${file}. Open it to add the reminder.`,
    /** The quiet line at the foot. */
    email: "Email reminders are coming.",
    /** The event in the calendar. */
    event: {
      title: "Play soccersense",
      details: (url: string) =>
        `Today's seven football questions are out. Play HOME, AWAY, RETRO or NEXT-GEN: ${url}`,
    },
  },

  /**
   * Support: a pop-up over the home screen, behind the heart beside the bell (Support in
   * ~/ui). Its two links are set in app/data/links.ts.
   */
  support: {
    /** The button's name and tooltip. */
    open: "Support us",
    heading: "SUPPORT US",
    close: "Close",
    /** The line of thanks under the heading, and the dialog's description. */
    intro:
      "Thanks for playing! Tell us how to make soccersense better, or buy us a coffee to keep the questions coming.",
    idea: "SEND US AN IDEA",
    coffee: "BUY US A COFFEE",
    /** On a button whose link is not set yet. */
    soon: "COMING SOON",
    newTab: "(opens in a new tab)",
  },

  /** Small print at the foot of the rules and the stats. */
  legal: {
    disclaimer:
      "soccersense is an independent fan game. It is not affiliated with, endorsed or sponsored by FIFA, UEFA or any league, club or player. All names and brands belong to their owners and are used for identification only.",
    /** The two pages, linked from the small print. */
    privacyLink: "Privacy",
    termsLink: "Terms",
  },

  /**
   * The privacy notice and the terms (/privacy, /terms: app/routes/privacy.tsx and
   * terms.tsx). A draft written to match what the game does, for the product owner to have
   * checked. `contact` is where questions go.
   */
  pages: {
    back: "Back to the game",
    /** The bar along the top: the game's name (a link home) and PLAY. */
    home: "soccersense: back to the game",
    play: "PLAY",
    /** The foot's links, read out as a group. */
    nav: "The site's pages",
    updated: "Last updated 17 November 2026",
    contact: "info@soccersense.io",
  },
  privacy: {
    title: "Privacy",
    description:
      "What soccersense, the daily football trivia game, keeps about you, why and for how long. Play without an account and nothing is stored.",
    heading: "PRIVACY",
    sections: [
      {
        heading: "In short",
        paragraphs: [
          "You can play without telling us anything, and then nothing about you is kept on our server. If you make an account, we keep your email address, your name and your games so they're the same on every device. We don't sell data, show ads or track you.",
        ],
      },
      {
        heading: "Who we are",
        paragraphs: [
          "soccersense is a daily football trivia game at soccersense.io. For anything about your data, email info@soccersense.io.",
        ],
      },
      {
        heading: "Playing without an account",
        paragraphs: [
          "Your games, streak, stats, name and settings are kept in your browser's storage on your device, not on our server.",
          "While you play, our server sends each question and checks each answer. It keeps nothing about you afterwards and sets no cookie: your game in progress is a sealed record that your own browser holds.",
        ],
      },
      {
        heading: "If you make an account",
        paragraphs: ["We keep:"],
        list: [
          "your email address;",
          "if you sign in with Google, Google's ID for you (we ask Google for your email address and that ID, not your name or picture);",
          "the name the leaderboards show for you;",
          "your games: your answers and scores, including the games your device had played before you signed in, for your streak and stats;",
          "a record of each device you're signed in on;",
          "the sign-in links we've emailed you.",
        ],
      },
      {
        heading: "Why",
        paragraphs: [
          "To sign you in, keep your games and stats on every device, and show your name and scores on the leaderboards. We rely on providing the game you've asked for, and on our legitimate interest in keeping it fair and free of abuse.",
          "Other players see your name and your score on the leaderboards. They never see your email address.",
        ],
      },
      {
        heading: "Cookies and storage",
        paragraphs: [
          "Only accounts get a cookie: one that keeps you signed in, and a short-lived one while you sign in with Google. Both are needed to sign in, so we don't ask before setting them. There are no advertising or analytics cookies.",
          "Your browser's storage holds your games and settings so the game works. Clearing your site data removes them from that device.",
        ],
      },
      {
        heading: "Who else handles it",
        paragraphs: [
          "These companies work on our behalf and only as we instruct them. Some may handle data outside the UK, with the safeguards UK data protection law requires.",
        ],
        list: [
          "Cloudflare hosts the site and runs our server and database. When you ask for a sign-in link, its Turnstile check looks at your browser to tell people from bots.",
          "Resend sends the sign-in emails.",
          "Google, only if you choose to continue with Google.",
        ],
      },
      {
        heading: "How long we keep it",
        list: [
          "Your account and games: until you delete your account.",
          "A signed-in device: 90 days after its last visit.",
          "Sign-in links: one day.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "You can change your name at any time, and delete your account from Your account: that removes your name, games and sign-ins from our server straight away.",
          "To get a copy of your data, correct it, or ask anything else, email info@soccersense.io. If you're unhappy with how we've handled your data, you can complain to the Information Commissioner's Office at ico.org.uk.",
        ],
      },
      {
        heading: "Children",
        paragraphs: [
          "Accounts are for people aged 13 and over. Anyone can play without one.",
        ],
      },
      {
        heading: "Changes",
        paragraphs: [
          "If this notice changes, we'll update this page and the date at the top.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms",
    description:
      "The rules for playing soccersense, the daily football trivia game, and for having an account: play fair and pick a decent name.",
    heading: "TERMS",
    sections: [
      {
        heading: "The game",
        paragraphs: [
          "soccersense is a free daily football trivia game. We work to keep it running and the questions right, but it's provided as it is, and we can't promise it will always be available or free of mistakes.",
        ],
      },
      {
        heading: "Accounts",
        paragraphs: [
          "You don't need an account to play. To make one you must be 13 or over. Anyone who can open your sign-in emails can sign in as you, so keep your email account safe. You can delete your account at any time from Your account.",
        ],
      },
      {
        heading: "Your name",
        paragraphs: [
          "Your name is shown to other players. Don't pick one that is offensive, pretends to be someone else, or advertises anything. We may change a name that breaks this, or close the account.",
        ],
      },
      {
        heading: "Play fair",
        paragraphs: [
          "Don't use scripts, bots or other tricks to play, to get round the once-a-day rule, or to climb the leaderboards. We may remove scores or accounts that do, and limit or block traffic that harms the game.",
        ],
      },
      {
        heading: "Football names",
        paragraphs: [
          "soccersense is an independent fan game. It is not affiliated with, endorsed or sponsored by FIFA, UEFA or any league, club or player. All names and brands belong to their owners and are used for identification only.",
        ],
      },
      {
        heading: "Our responsibility",
        paragraphs: [
          "We're not responsible for any loss that comes from using the game, except where the law doesn't allow us to exclude it.",
        ],
      },
      {
        heading: "Changes",
        paragraphs: [
          "We may update these terms. The date at the top says when they last changed, and playing after a change means you accept the new terms.",
        ],
      },
      {
        heading: "The law",
        paragraphs: [
          "These terms are governed by the law of England and Wales. Questions: info@soccersense.io.",
        ],
      },
    ],
  },

  /**
   * The approval desk (/admin): the product owner's page for the week's drafted questions.
   * Not a page for players: plain words, no game voice.
   */
  admin: {
    title: "Question approval",
    intro:
      "The questions drafted for each day wait here to be approved. A mode is played on a day only when all seven of its questions are approved.",
    tokenLabel: "Admin token",
    tokenHelp:
      "The secret called ADMIN_TOKEN that you set in Cloudflare. It is kept in this browser only.",
    signIn: "Open the desk",
    signOut: "Sign out",
    notSetUp:
      "The desk is shut: no ADMIN_TOKEN is set in Cloudflare yet, or it is shorter than 24 characters.",
    wrongToken: "That token was not accepted.",
    failed: "Could not reach the server. Try again.",
    loading: "Loading...",
    earlier: "Earlier",
    later: "Later",
    thisWeek: "From today",
    dayColumn: "Day",
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    day: (weekday: string, date: string, day: number) =>
      `${weekday} ${date} (day ${day})`,
    today: "today",
    /** A day and mode's seven places, counted: "5 approved, 2 draft". */
    counts: (approved: number, draft: number, rejected: number) =>
      [
        approved > 0 ? `${approved} approved` : "",
        draft > 0 ? `${draft} draft` : "",
        rejected > 0 ? `${rejected} rejected` : "",
      ]
        .filter(Boolean)
        .join(", "),
    scheduled: "Scheduled",
    nothing: "Nothing drafted",
    missing: (n: number) => `${n} missing`,
    pick: "Pick a day and mode above to see its questions.",
    game: (mode: string, day: string) => `${mode}: ${day}`,
    place: (n: number) => `Question ${n}`,
    emptyPlace: "Nothing has been drafted for this place.",
    status: { draft: "Draft", approved: "Approved", rejected: "Rejected" },
    answers: (n: number) => `${n} answers`,
    approve: "Approve",
    reject: "Reject",
    toDraft: "Back to draft",
    approveAll: "Approve all drafts",
    reason: "Why it is rejected (for the next draft)",
    show: "Show answers",
    hide: "Hide answers",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    editHelp:
      "The question as data. Saving checks it and puts it back as a draft.",
    notSaved: "It was not saved:",
    badJson: "That is not valid JSON.",
    note: "Drafter's note",
    review: "Reviewer's note",
    measured: (label: string) => `Measured by ${label}`,
    columns: {
      name: "Answer",
      shot: "Shot",
      share: "Share",
      years: "Years",
      aliases: "Also accepted",
      place: "Place",
    },
  },

  errors: {
    title: "Offside!",
    unexpected:
      "Something went wrong on our side of the pitch. Have another go.",
    notFound: "We looked all round the ground and could not find that page.",
  },
};
