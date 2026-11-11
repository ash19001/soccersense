// The interface gallery at /dev/ui: every component of the kit in every state, over a
// stand-in backdrop. Add ?only=<name> to show one composition full-screen, exactly as the
// game would, so it can be screenshotted:
//
//   node tools/shoot.mjs "http://localhost:5173/dev/ui?only=ask-home" .snaps/ui-ask-home-390.png
//
// ?only=parts shows the loose parts alone. docs/API_UI.md lists the names and shows how to
// shoot all of them at every size in one go.
//
// All text here is sample content for looking at the skin. It is not game copy.

import { type ReactNode, useState, useSyncExternalStore } from "react";

import {
  AnswerBar,
  type AnswerBarLabels,
  Board,
  type BoardLabels,
  Button,
  type ButtonVariant,
  FullTimeCard,
  GameLayout,
  IconButton,
  type IconName,
  type LeagueEntry,
  LeagueTable,
  type LeagueTableLabels,
  LedNumber,
  MenuCaptions,
  ModeBadge,
  Panel,
  Pip,
  Pips,
  PixelRoot,
  RevealSheet,
  TierBar,
  TimerStrip,
  UI_GRADES,
  type UiGrade,
  type UiMode,
} from "~/ui";
import "~/ui/dev-gallery.css";
import type { Route } from "./+types/dev-ui";

export const meta: Route.MetaFunction = () => [
  { title: "Interface gallery · soccersense" },
  { name: "robots", content: "noindex" },
];

// --- sample content -------------------------------------------------------------------------

const MODE_LABEL: Record<UiMode, string> = { home: "HOME", away: "AWAY" };

const GRADE_LABEL: Record<UiGrade, string> = {
  worldie: "WORLDIE!",
  topbins: "TOP BINS",
  goal: "GOAL!",
  ontarget: "ON TARGET",
  wide: "OFF TARGET",
  timeup: "TIME'S UP",
  skipped: "PASSED",
};

const ANSWER_LABELS: AnswerBarLabels = {
  input: "Your answer",
  shoot: "SHOOT",
  pass: "PASS",
};

const TABLE_LABELS: LeagueTableLabels = {
  caption: "The table",
  rank: "#",
  answer: "ANSWER",
  distance: "DIST",
  points: "PTS",
  you: "YOU",
  gap: "Rows left out",
};

const REJECTION = "Not on the teamsheet. Try another.";

function boardLabels(mode: UiMode, n: number, seconds: number): BoardLabels {
  return {
    mode: MODE_LABEL[mode],
    questionOf: `Question ${n} of 7`,
    points: "PTS",
    timeLeft: `${seconds} seconds left`,
    board: "Scoreboard",
  };
}

interface AskSample {
  mode: UiMode;
  stadium: string;
  n: number;
  results: Array<UiGrade | null>;
  total: number;
  tier: string;
  tierProgress: number;
  question: string;
  instruction: string;
  measure: string;
  seconds: number;
  placeholder: string;
  typed?: string;
  rejection?: string;
  canPass?: boolean;
}

const ASK_HOME: AskSample = {
  mode: "home",
  stadium: "ANFIELD",
  n: 3,
  results: ["topbins", "goal", null, null, null, null, null],
  total: 152,
  tier: "SUNDAY LEAGUE",
  tierProgress: 0.69,
  question: "Name a club that has won the European Cup or Champions League",
  instruction: "Closest to ANFIELD wins.",
  measure: "Measured by the club's home ground.",
  seconds: 22,
  placeholder: "Type a club",
};

const ASK_AWAY: AskSample = {
  mode: "away",
  stadium: "ANFIELD",
  n: 5,
  results: ["worldie", "ontarget", "wide", "goal", null, null, null],
  total: 262,
  tier: "NON-LEAGUE",
  tierProgress: 0.91,
  question: "Name a player who has scored a Premier League goal",
  instruction: "Furthest from ANFIELD wins.",
  measure: "Measured by where the player was born.",
  seconds: 17,
  placeholder: "Type a player",
  typed: "Chris Wood",
};

const ASK_REJECT: AskSample = {
  ...ASK_HOME,
  n: 2,
  results: ["topbins", null, null, null, null, null, null],
  total: 87,
  tier: "PARK KICKABOUT",
  tierProgress: 0.97,
  question: "Name a manager who has won the Premier League",
  measure: "Measured by where the manager was born.",
  seconds: 19,
  placeholder: "Type a manager",
  typed: "Fergusson",
  rejection: REJECTION,
};

const ASK_PASS: AskSample = {
  ...ASK_AWAY,
  seconds: 14,
  typed: "",
  canPass: true,
};

const ASK_REJECT_PASS: AskSample = {
  ...ASK_REJECT,
  seconds: 11,
  typed: "Hakan Çalhanoğlu",
  canPass: true,
};

const ASK_LAST5: AskSample = {
  ...ASK_HOME,
  seconds: 4,
  typed: "Nottingham Forest",
  canPass: true,
};

// The longest strings the layout has to survive.
const ASK_LONG: AskSample = {
  mode: "away",
  stadium: "ESTADIO SANTIAGO BERNABÉU",
  n: 7,
  results: [
    "worldie",
    "worldie",
    "worldie",
    "worldie",
    "worldie",
    "worldie",
    null,
  ],
  total: 600,
  tier: "WORLD CUP FINAL",
  tierProgress: 0.67,
  question:
    "Name a stadium that has hosted a European Cup or Champions League final",
  instruction: "Furthest from ESTADIO SANTIAGO BERNABÉU wins.",
  measure: "Measured by where the stadium is.",
  seconds: 30,
  placeholder: "Type a stadium",
  typed: "Trent Alexander-Arnold",
  rejection: REJECTION,
  canPass: true,
};

const HOME_ROWS: readonly LeagueEntry[] = [
  {
    rank: 1,
    name: "Liverpool",
    place: "Anfield, Liverpool",
    distance: "0 miles",
    points: 100,
  },
  {
    rank: 2,
    name: "Manchester United",
    place: "Old Trafford, Manchester",
    distance: "29 miles",
    points: 95,
  },
  {
    rank: 3,
    name: "Manchester City",
    place: "Etihad Stadium, Manchester",
    distance: "33 miles",
    points: 91,
  },
  { gap: true },
  {
    rank: 9,
    name: "Borussia Dortmund",
    place: "Westfalenstadion, Dortmund",
    distance: "487 miles",
    points: 64,
  },
  {
    rank: 10,
    name: "Hakan Çalhanoğlu",
    place: "Mannheim, Baden-Württemberg",
    distance: "540 miles",
    points: 61,
    you: true,
  },
  {
    rank: 11,
    name: "Olympique de Marseille",
    place: "Stade Vélodrome, Marseille",
    distance: "745 miles",
    points: 55,
  },
  { gap: true },
  {
    rank: 23,
    name: "Steaua București",
    place: "Stadionul Steaua, Bucharest",
    distance: "1,412 miles",
    points: 0,
  },
];

const AWAY_ROWS: readonly LeagueEntry[] = [
  {
    rank: 1,
    name: "Chris Wood",
    place: "Auckland, New Zealand",
    distance: "11,589 miles",
    points: 100,
  },
  {
    rank: 2,
    name: "Tim Cahill",
    place: "Sydney, New South Wales",
    distance: "10,573 miles",
    points: 99,
  },
  {
    rank: 3,
    name: "Son Heung-min",
    place: "Chuncheon, South Korea",
    distance: "5,540 miles",
    points: 97,
  },
  { gap: true },
  {
    rank: 211,
    name: "Steven Gerrard",
    place: "Whiston, Merseyside",
    distance: "7 miles",
    points: 2,
  },
  {
    rank: 212,
    name: "Trent Alexander-Arnold",
    place: "West Derby, Liverpool",
    distance: "2 miles",
    points: 0,
  },
];

function withYou(
  rows: readonly LeagueEntry[],
  name: string | null,
): LeagueEntry[] {
  return rows.map((row) =>
    "gap" in row ? row : { ...row, you: row.name === name },
  );
}

interface RevealSample {
  mode: UiMode;
  grade: UiGrade;
  points?: string;
  sentence: string;
  rows: LeagueEntry[];
  next: string;
  ask: AskSample;
  total: number;
  tier: string;
  tierProgress: number;
}

const REVEALS: Record<UiGrade, RevealSample> = {
  worldie: {
    mode: "away",
    grade: "worldie",
    points: "+100",
    sentence:
      "Chris Wood was born in Auckland, New Zealand: 11,589 miles from Anfield.",
    rows: withYou(AWAY_ROWS, "Chris Wood"),
    next: "NEXT QUESTION",
    ask: ASK_AWAY,
    total: 362,
    tier: "TOP FLIGHT",
    tierProgress: 0.02,
  },
  topbins: {
    mode: "home",
    grade: "topbins",
    points: "+95",
    sentence:
      "Manchester United play at Old Trafford, Manchester: 29 miles from Anfield.",
    rows: withYou(HOME_ROWS, "Manchester United"),
    next: "NEXT QUESTION",
    ask: ASK_HOME,
    total: 247,
    tier: "NON-LEAGUE",
    tierProgress: 0.74,
  },
  goal: {
    mode: "home",
    grade: "goal",
    points: "+61",
    sentence:
      "Hakan Çalhanoğlu was born in Mannheim, Baden-Württemberg: 540 miles from Anfield.",
    rows: withYou(HOME_ROWS, "Hakan Çalhanoğlu"),
    next: "NEXT QUESTION",
    ask: ASK_HOME,
    total: 213,
    tier: "NON-LEAGUE",
    tierProgress: 0.37,
  },
  ontarget: {
    mode: "home",
    grade: "ontarget",
    points: "+55",
    sentence:
      "Olympique de Marseille play at the Stade Vélodrome, Marseille: 745 miles from Anfield.",
    rows: withYou(HOME_ROWS, "Olympique de Marseille"),
    next: "NEXT QUESTION",
    ask: ASK_HOME,
    total: 207,
    tier: "NON-LEAGUE",
    tierProgress: 0.3,
  },
  wide: {
    mode: "away",
    grade: "wide",
    points: "+0",
    sentence:
      "Trent Alexander-Arnold was born in West Derby, Liverpool: 2 miles from Anfield.",
    rows: withYou(AWAY_ROWS, "Trent Alexander-Arnold"),
    next: "FULL TIME",
    ask: { ...ASK_AWAY, n: 7 },
    total: 262,
    tier: "NON-LEAGUE",
    tierProgress: 0.91,
  },
  timeup: {
    mode: "home",
    grade: "timeup",
    points: "+0",
    sentence:
      "The whistle beat you to it. Liverpool, at Anfield, was the answer on the doorstep.",
    rows: withYou(HOME_ROWS, null),
    next: "NEXT QUESTION",
    ask: ASK_HOME,
    total: 152,
    tier: "SUNDAY LEAGUE",
    tierProgress: 0.69,
  },
  skipped: {
    mode: "away",
    grade: "skipped",
    points: "+0",
    sentence:
      "You let that one go. Chris Wood, born in Auckland, was 11,589 miles away.",
    rows: withYou(AWAY_ROWS, null),
    next: "NEXT QUESTION",
    ask: ASK_AWAY,
    total: 262,
    tier: "NON-LEAGUE",
    tierProgress: 0.91,
  },
};

// --- stand-in backdrop ----------------------------------------------------------------------

function Backdrop({ kind }: { kind: "game" | "menu" }) {
  return (
    <div className="dev-backdrop" data-kind={kind} aria-hidden="true">
      <div className="dev-backdrop__sky" />
      <div className="dev-backdrop__stand" />
      <div className="dev-backdrop__grass" />
      {kind === "menu" && <div className="dev-backdrop__ball" />}
    </div>
  );
}

// --- compositions ---------------------------------------------------------------------------

function AskScreen({
  sample,
  contained,
}: {
  sample: AskSample;
  contained: boolean;
}) {
  const [value, setValue] = useState(sample.typed ?? "");
  const [rejections, setRejections] = useState(sample.rejection ? 1 : 0);
  return (
    <GameLayout
      contained={contained}
      canvas={<Backdrop kind="game" />}
      top={
        <Board
          mode={sample.mode}
          stadiumName={sample.stadium}
          questionNumber={sample.n}
          questionCount={7}
          results={sample.results}
          total={sample.total}
          tierName={sample.tier}
          tierProgress={sample.tierProgress}
          question={sample.question}
          instruction={sample.instruction}
          measureLine={sample.measure}
          secondsLeft={sample.seconds}
          secondsTotal={30}
          labels={boardLabels(sample.mode, sample.n, sample.seconds)}
        />
      }
      bottom={
        <AnswerBar
          mode={sample.mode}
          value={value}
          onChange={setValue}
          onSubmit={() => setRejections((n) => n + 1)}
          onPass={() => setValue("")}
          canPass={sample.canPass}
          rejection={rejections > 0 ? REJECTION : null}
          shakeKey={rejections}
          placeholder={sample.placeholder}
          labels={ANSWER_LABELS}
        />
      }
    />
  );
}

function RevealScreen({
  sample,
  contained,
}: {
  sample: RevealSample;
  contained: boolean;
}) {
  const ask = sample.ask;
  const results = ask.results.slice();
  results[ask.n - 1] = sample.grade;
  return (
    <GameLayout
      contained={contained}
      canvas={<Backdrop kind="game" />}
      top={
        <Board
          compact
          mode={sample.mode}
          stadiumName={ask.stadium}
          questionNumber={ask.n}
          questionCount={7}
          results={results}
          total={sample.total}
          tierName={sample.tier}
          tierProgress={sample.tierProgress}
          question={ask.question}
          instruction={ask.instruction}
          measureLine={ask.measure}
          secondsLeft={0}
          secondsTotal={30}
          labels={boardLabels(sample.mode, ask.n, 0)}
        />
      }
      bottom={
        <RevealSheet
          grade={sample.grade}
          mode={sample.mode}
          gradeLabel={GRADE_LABEL[sample.grade]}
          pointsLabel={sample.points}
          sentence={sample.sentence}
          rows={sample.rows}
          tableLabels={TABLE_LABELS}
          nextLabel={sample.next}
          onNext={() => {}}
          focusNext={!contained}
        />
      }
    />
  );
}

function FullTimeScreen({
  contained,
  perfect = false,
}: {
  contained: boolean;
  perfect?: boolean;
}) {
  const [shared, setShared] = useState(false);
  return (
    <GameLayout
      contained={contained}
      canvas={<Backdrop kind="game" />}
      bottom={
        <FullTimeCard
          mode="home"
          heading="FULL TIME"
          total={perfect ? 700 : 478}
          maxTotal={700}
          totalSpoken={perfect ? "700 out of 700" : "478 out of 700"}
          careerTitle={perfect ? "WORLD CUP WINNER" : "INTERNATIONAL"}
          perfectLine={perfect ? "PERFECT GAME" : undefined}
          results={
            perfect
              ? [
                  { grade: "worldie", points: 100, answer: "Liverpool" },
                  { grade: "worldie", points: 100, answer: "Kenny Dalglish" },
                  {
                    grade: "worldie",
                    points: 100,
                    answer: "Trent Alexander-Arnold",
                  },
                  { grade: "worldie", points: 100, answer: "Anfield" },
                  { grade: "worldie", points: 100, answer: "Steven Gerrard" },
                  { grade: "worldie", points: 100, answer: "Everton" },
                  { grade: "worldie", points: 100, answer: "England" },
                ]
              : [
                  { grade: "topbins", points: 95, answer: "Manchester United" },
                  { grade: "goal", points: 61, answer: "Hakan Çalhanoğlu" },
                  {
                    grade: "worldie",
                    points: 100,
                    answer: "Trent Alexander-Arnold",
                  },
                  { grade: "timeup", points: 0, answer: "Time's up" },
                  {
                    grade: "ontarget",
                    points: 55,
                    answer: "Olympique de Marseille",
                  },
                  { grade: "wide", points: 12, answer: "Steaua București" },
                  { grade: "topbins", points: 97, answer: "Sir Alex Ferguson" },
                  // 95 + 61 + 100 + 0 + 55 + 12 + 97 = 420; the sample total is only for looks.
                ]
          }
          shareLabel={shared ? "COPIED!" : "SHARE"}
          onShare={() => setShared(true)}
          otherLabel="PLAY AWAY"
          otherMode="away"
          onPlayOther={() => {}}
          menuLabel="MENU"
          onMenu={() => {}}
        />
      }
    />
  );
}

function MenuScreen({
  contained,
  played = false,
  notice = false,
}: {
  contained: boolean;
  played?: boolean;
  /** A locked patch was pressed and the pointer is over AWAY: the notice, and a lit card. */
  notice?: boolean;
}) {
  return (
    <GameLayout
      contained={contained}
      canvas={<Backdrop kind="menu" />}
      bottom={
        <MenuCaptions
          modes={[
            {
              mode: "home",
              label: "HOME",
              line: "Closest to the stadium wins",
              score: played ? 478 : null,
              scoreSpoken: "Played today: 478 points",
            },
            {
              mode: "away",
              label: "AWAY",
              line: "Furthest from it wins",
            },
          ]}
          onSelect={() => {}}
          lit={notice ? "away" : null}
          notice={notice ? "More modes are on their way to the ground." : null}
          howToPlay={{ label: "How to play", to: "/how-to-play" }}
          dayLabel="DAY 12"
        />
      }
    />
  );
}

interface Composition {
  name: string;
  title: string;
  render: (contained: boolean) => ReactNode;
}

const COMPOSITIONS: readonly Composition[] = [
  {
    name: "ask-home",
    title: "Asking, HOME",
    render: (c) => <AskScreen sample={ASK_HOME} contained={c} />,
  },
  {
    name: "ask-away",
    title: "Asking, AWAY",
    render: (c) => <AskScreen sample={ASK_AWAY} contained={c} />,
  },
  {
    name: "ask-reject",
    title: "Rejected answer",
    render: (c) => <AskScreen sample={ASK_REJECT} contained={c} />,
  },
  {
    name: "ask-pass",
    title: "PASS available",
    render: (c) => <AskScreen sample={ASK_PASS} contained={c} />,
  },
  {
    name: "ask-reject-pass",
    title: "Rejected, PASS available",
    render: (c) => <AskScreen sample={ASK_REJECT_PASS} contained={c} />,
  },
  {
    name: "ask-last5",
    title: "Last five seconds",
    render: (c) => <AskScreen sample={ASK_LAST5} contained={c} />,
  },
  {
    name: "ask-long",
    title: "Longest strings",
    render: (c) => <AskScreen sample={ASK_LONG} contained={c} />,
  },
  ...UI_GRADES.map((grade): Composition => ({
    name: `reveal-${grade}`,
    title: `Reveal: ${GRADE_LABEL[grade]}`,
    render: (c) => <RevealScreen sample={REVEALS[grade]} contained={c} />,
  })),
  {
    name: "fulltime",
    title: "Full time",
    render: (c) => <FullTimeScreen contained={c} />,
  },
  {
    name: "fulltime-perfect",
    title: "Full time, perfect game",
    render: (c) => <FullTimeScreen contained={c} perfect />,
  },
  {
    name: "menu",
    title: "Menu captions",
    render: (c) => <MenuScreen contained={c} />,
  },
  {
    name: "menu-played",
    title: "Menu captions, HOME played",
    render: (c) => <MenuScreen contained={c} played />,
  },
  {
    name: "menu-notice",
    title: "Menu captions, a notice up and AWAY lit",
    render: (c) => <MenuScreen contained={c} notice />,
  },
];

// --- the parts on their own -----------------------------------------------------------------

const VARIANTS: readonly ButtonVariant[] = [
  "primary",
  "mode",
  "secondary",
  "ghost",
];
const ICON_NAMES: readonly IconName[] = ["question", "back", "share", "close"];

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="dev-block">
      <h3 className="dev-block__title">{title}</h3>
      <div className="dev-block__body">{children}</div>
    </section>
  );
}

function Parts() {
  return (
    <div className="dev-parts">
      <Block title="Type">
        <p className="ss-t25">Jersey 25: +100 620/700</p>
        <p className="ss-t20">Jersey 20: FULL TIME, TOP BINS</p>
        <p className="ss-t15">
          Jersey 15: Name a club that has won the European Cup
        </p>
        <p className="ss-t10">
          Jersey 10: Hakan Çalhanoğlu was born in Mannheim, 540 miles from
          Anfield.
        </p>
      </Block>

      <Block title="Buttons: rest, pressed, focus, disabled">
        {VARIANTS.map((variant) => (
          <div key={variant} className="dev-row">
            <Button variant={variant} mode="home">
              {variant === "mode" ? "SHOOT" : variant.toUpperCase()}
            </Button>
            <Button variant={variant} mode="home" forceState="pressed">
              PRESSED
            </Button>
            <Button variant={variant} mode="home" forceState="focus">
              FOCUS
            </Button>
            <Button variant={variant} mode="home" disabled>
              OFF
            </Button>
          </div>
        ))}
        <div className="dev-row">
          <Button variant="mode" mode="away">
            SHOOT
          </Button>
          <Button variant="mode" mode="away" forceState="pressed">
            PRESSED
          </Button>
          <Button variant="mode" mode="away" forceState="focus">
            FOCUS
          </Button>
        </div>
        <Button variant="mode" mode="home" full>
          NEXT QUESTION
        </Button>
        <Button variant="primary" full>
          SHARE
        </Button>
      </Block>

      <Block title="Icon buttons and badges">
        <div className="dev-row">
          {ICON_NAMES.map((icon) => (
            <IconButton key={icon} icon={icon} label={icon} />
          ))}
          <IconButton icon="question" label="pressed" forceState="pressed" />
          <IconButton icon="close" label="focus" forceState="focus" />
          <IconButton icon="share" label="off" disabled />
        </div>
        <div className="dev-row">
          <IconButton icon="share" label="share" variant="primary" />
          <IconButton icon="back" label="back" variant="mode" mode="home" />
          <IconButton icon="back" label="back" variant="mode" mode="away" />
          <IconButton icon="close" label="close" variant="ghost" />
        </div>
        <div className="dev-row">
          <ModeBadge mode="home" label="HOME" />
          <ModeBadge mode="away" label="AWAY" />
        </div>
      </Block>

      <Block title="Panels">
        <Panel>
          <p>Bolted frame. The board and the answer bar are made of this.</p>
        </Panel>
        <Panel variant="plain">
          <p>Plain plate, for small captions.</p>
        </Panel>
      </Block>

      <Block title="LED numbers">
        <div className="dev-row">
          <LedNumber value={347} digits={3} />
          <LedNumber value={7} digits={3} />
          <LedNumber value={700} tone="gold" />
          <LedNumber value={4} digits={2} tone="red" />
          <LedNumber value="+87" tone="green" />
          <LedNumber value="0123456789" tone="chalk" />
        </div>
        <div className="dev-row">
          <LedNumber value="478/700" size="lg" />
        </div>
        <div className="dev-row">
          <LedNumber value="700/700" size="lg" tone="gold" />
        </div>
        <div className="dev-row">
          <LedNumber value={22} digits={2} bare label="" />
          <LedNumber value={4} digits={2} tone="red" bare label="" />
          <LedNumber value="+-:/" tone="chalk" />
        </div>
      </Block>

      <Block title="Result lamps">
        <div className="dev-row">
          {UI_GRADES.map((grade) => (
            <Pip key={grade} grade={grade} />
          ))}
          <Pip grade={null} state="current" />
          <Pip grade={null} />
        </div>
        <div className="dev-row">
          <Pips
            results={["worldie", "topbins", "goal", null, null, null, null]}
            current={3}
            label="Question 4 of 7"
          />
        </div>
        <div className="dev-row">
          <Pips
            results={[
              "ontarget",
              "wide",
              "timeup",
              "skipped",
              "goal",
              "topbins",
              "worldie",
            ]}
            label="All answered"
          />
        </div>
      </Block>

      <Block title="Career tier">
        <TierBar name="PARK KICKABOUT" progress={0} />
        <TierBar name="SUNDAY LEAGUE" progress={0.03} />
        <TierBar name="LOWER LEAGUES" progress={0.5} />
        <TierBar name="WORLD CUP WINNER" progress={1} />
      </Block>

      <Block title="Clock">
        <TimerStrip secondsLeft={30} secondsTotal={30} />
        <TimerStrip secondsLeft={17} secondsTotal={30} />
        <TimerStrip secondsLeft={5} secondsTotal={30} />
        <TimerStrip secondsLeft={1} secondsTotal={30} />
        <TimerStrip secondsLeft={0} secondsTotal={30} />
        <TimerStrip secondsLeft={31} secondsTotal={45} hideSeconds />
      </Block>

      <Block title="Answer bar: empty, rejected, judging">
        <div className="dev-answer">
          <AnswerBar
            mode="home"
            value=""
            onChange={() => {}}
            onSubmit={() => {}}
            placeholder="Type a manager"
            labels={ANSWER_LABELS}
          />
        </div>
        <div className="dev-answer dev-answer--tall">
          <AnswerBar
            mode="away"
            value="Fergusson"
            onChange={() => {}}
            onSubmit={() => {}}
            onPass={() => {}}
            canPass
            rejection={REJECTION}
            shakeKey={0}
            labels={ANSWER_LABELS}
          />
        </div>
        <div className="dev-answer">
          <AnswerBar
            mode="home"
            value="Sir Alex Ferguson"
            onChange={() => {}}
            onSubmit={() => {}}
            busy
            labels={ANSWER_LABELS}
          />
        </div>
      </Block>

      <Block title="Menu captions: as buttons, as plain captions">
        <MenuCaptions
          modes={[
            {
              mode: "home",
              label: "HOME",
              line: "Closest to the stadium wins",
            },
            { mode: "away", label: "AWAY", line: "Furthest from it wins" },
          ]}
          onSelect={() => {}}
          howToPlay={{ label: "How to play", to: "/how-to-play" }}
          dayLabel="DAY 1"
        />
        <MenuCaptions
          modes={[
            {
              mode: "home",
              label: "HOME",
              line: "Closest to the stadium wins",
              score: 478,
              scoreSpoken: "Played today: 478 points",
            },
            {
              mode: "away",
              label: "AWAY",
              line: "Furthest from it wins",
              score: 700,
              scoreSpoken: "Played today: 700 points",
            },
          ]}
          howToPlay={{ label: "How to play", onClick: () => {} }}
          dayLabel="DAY 365"
        />
      </Block>

      <Block title="Menu captions: a notice, and AWAY lit from the ball">
        <div className="dev-answer--tall">
          <MenuCaptions
            modes={[
              {
                mode: "home",
                label: "HOME",
                line: "Closest to the stadium wins",
              },
              { mode: "away", label: "AWAY", line: "Furthest from it wins" },
            ]}
            onSelect={() => {}}
            lit="away"
            notice="More modes are on their way."
            howToPlay={{ label: "How to play", to: "/how-to-play" }}
            dayLabel="DAY 1"
          />
        </div>
      </Block>

      <Block title="League table">
        <div className="dev-table" data-mode="home">
          <LeagueTable
            rows={withYou(HOME_ROWS, "Hakan Çalhanoğlu")}
            labels={TABLE_LABELS}
            followYou={false}
          />
        </div>
        <div className="dev-table" data-mode="away">
          <LeagueTable
            rows={withYou(AWAY_ROWS, "Chris Wood")}
            labels={TABLE_LABELS}
            followYou={false}
          />
        </div>
      </Block>
    </div>
  );
}

// --- the page -------------------------------------------------------------------------------

function subscribeToNothing(): () => void {
  return () => {};
}

function readSearch(): string {
  return window.location.search;
}

function serverSearch(): null {
  return null;
}

export default function DevUi() {
  // The query string is only known in the browser. `null` is the build-time render.
  const search = useSyncExternalStore(
    subscribeToNothing,
    readSearch,
    serverSearch,
  );
  const params = new URLSearchParams(search ?? "");
  if (search === null) return <div className="dev-blank" />;

  const only = params.get("only");
  if (only === "parts") {
    return (
      <PixelRoot className="dev-gallery">
        <Parts />
      </PixelRoot>
    );
  }
  const single = COMPOSITIONS.find((c) => c.name === only);
  if (single) return <>{single.render(false)}</>;

  return (
    <PixelRoot className="dev-gallery">
      <header className="dev-header">
        <h1 className="ss-t20">Interface gallery</h1>
        <p>
          Every part of the kit over a stand-in backdrop. Open one full-screen
          with <code>?only=name</code>.
        </p>
        <nav className="dev-nav" aria-label="Compositions">
          {COMPOSITIONS.map((c) => (
            <a key={c.name} href={`?only=${c.name}`}>
              {c.name}
            </a>
          ))}
          <a href="?only=parts">parts</a>
        </nav>
        {only && (
          <p className="dev-warning">No composition is called {only}.</p>
        )}
      </header>
      <h2 className="dev-heading ss-t15">Screens</h2>
      <div className="dev-frames">
        {COMPOSITIONS.map((c) => (
          <figure key={c.name} className="dev-frame">
            <figcaption>
              <a href={`?only=${c.name}`}>{c.name}</a> {c.title}
            </figcaption>
            <div className="dev-frame__screen">{c.render(true)}</div>
          </figure>
        ))}
      </div>
      <h2 className="dev-heading ss-t15">Parts</h2>
      <Parts />
    </PixelRoot>
  );
}
