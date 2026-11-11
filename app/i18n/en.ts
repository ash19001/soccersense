// All interface text lives here, so other languages can be added later: the pages, the
// words the home screen paints on its canvas (the ball's patches, the stadium sign, the
// line under the logo) and the page titles. Question content lives in app/data.
//
// The voice is a cheerful matchday programme, in British English. Lines that carry a value
// are functions.
export const en = {
  siteName: "soccersense",

  home: {
    title: "soccersense: daily football trivia, one stadium a day",
    description:
      "One stadium a day and seven questions a side. Play HOME and find the answer closest to today's ground, or play AWAY and get as far from it as you can. A new matchday every day, free to play.",
    /** Read out in place of the sign, which is only pixels. */
    stadium: (name: string, city: string, country: string) =>
      `Today's stadium: ${name}, ${city}, ${country}.`,
    /** The words painted on the canvas. The pixel fonts are capitals. */
    canvas: {
      home: "HOME",
      away: "AWAY",
      locked: "SOON",
      header: "TODAY'S STADIUM",
      tagline: "DAILY FOOTBALL TRIVIA",
    },
    modes: {
      home: { label: "HOME", line: "Closest to the stadium wins" },
      away: { label: "AWAY", line: "Furthest from it wins" },
    },
    /** Read out for the score on a mode that has been played today. */
    played: (points: number) => `Played today: ${points} points`,
    day: (day: number) => `DAY ${day}`,
    /** In the day's place until the page knows what day it is. */
    dayPending: "TODAY",
    /** A locked patch on the ball was pressed. */
    locked: "More modes are warming up on the touchline.",
  },

  play: {
    title: {
      home: "HOME: closest to the stadium wins · soccersense",
      away: "AWAY: furthest from the stadium wins · soccersense",
    },
    description: {
      home: "Seven questions, and the answer closest to today's stadium scores 100.",
      away: "Seven questions, and the answer furthest from today's stadium scores 100.",
    },
    heading: { home: "The HOME match", away: "The AWAY match" },
    stadiumHeader: "TODAY'S STADIUM",
    place: (city: string, country: string) => `${city}, ${country}`,
    rule: {
      home: "Closest to the stadium wins.",
      away: "Furthest from the stadium wins.",
    },
    /** The game itself is the next thing to be built. */
    building:
      "The groundstaff are still marking out the pitch. Kick-off is coming soon.",
    back: "BACK TO THE BALL",
  },

  howToPlay: {
    title: "How to play",
    description:
      "Every day has one stadium. Play HOME and the answer closest to it scores 100. Play AWAY and the furthest one does. Seven questions, thirty seconds each, 700 points to play for.",
  },

  errors: {
    title: "Offside!",
    unexpected:
      "Something went wrong on our side of the pitch. Have another go.",
    notFound: "We looked all round the ground and could not find that page.",
  },
};
