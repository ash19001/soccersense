// The game's referee: one per game page. It holds the session (the rules in `~/game`),
// runs the clock, tells the career scene what to play, waits for it, saves the game as it
// goes and shares the result (a picture and the text, ./share-image.ts). React only reads
// it (`subscribe` and `read`, for `useSyncExternalStore`) and calls its handlers.
//
// Browser only: it is made after mounting, and it reads the clock and sets timers.
//
// Who decides. The site's server runs the game (./server.ts, worker/games): it sends each
// question as its clock starts, judges what is typed and sends the reveal. The referee
// here asks it, waits (`waiting`), and shows what comes back; if it cannot be reached it
// says so (`trouble`) and asks again. The page has no answers, so nothing in it can be
// read ahead. The server stores nothing about a player with no account: it hands the game
// back after every move as a sealed ticket, which is kept on this device (`hold`) and sent
// with the next move, so a reload carries on from it. In development and in the tests,
// where no server is given, the page runs the game itself by the same rules (`reduce`),
// with the questions built into it: those are left out of a production build.
//
// The flow (docs/GAME_DESIGN.md sections 3 to 6):
//   the card   before a new game only: the mode card is up on the ink the page arrives on
//              (`view.intro`), the scene waits behind it (`scene.holdOpening()`) and no
//              clock runs. It goes by itself after `INTRO_MS`, or at once on a press
//              (`skipIntro`); then the scene opens and question 1's clock starts. A game
//              carried on after a reload, or shown again at full time, has no card.
//   asking     the clock runs. An answer the judge does not know shakes the bar (the
//              clock runs on); one it knows, PASS, or the clock running out ends the turn.
//              At the whistle, an answer typed but not sent counts as sent (`type`).
//   resolving  the clock has stopped and the shot plays (`scene.playShot(grade)`).
//   reveal     the sheet. NEXT: if the total crossed a tier line, the promotion plays first
//              (`scene.promote(total)`, no clock meanwhile), then the next question.
//   done       full time: the card, `scene.showFullTime(total)`, the game saved for the menu.
//
// The scene answers by calling back. If it never does (no canvas, the tab hidden, the
// scene stopped by an error), the game moves on by itself after a while, so it can never
// be stuck; a late answer from the scene is then ignored.

import {
  type GameSnapshot,
  MAX_TOTAL,
  QUESTION_COUNT,
  type Session,
  type StorageLike,
  type Today,
  blankQuestion,
  canPass,
  clockView,
  createSession,
  dayKeyFor,
  dayNumber,
  isLastQuestion,
  loadGame,
  loadHistory,
  nextMode,
  progressFor,
  reduce,
  saveSession,
  sessionFrom,
  shareCardFor,
  storedQuestions,
  streakFor,
} from "~/game";
import { questionsFor } from "~/data";
import { strings } from "~/i18n";
import { CareerScene } from "~/scenes/career";
import {
  type LiveContext,
  clearLive,
  finishedSession,
  loadLive,
  loadTicket,
  saveLive,
  saveTicket,
} from "./progress";
import { modeName, shareText, tierName, titleName } from "./names";
import { type GameServer, type Reply, ServerError, gameServer } from "./server";
import { deliverShare } from "./share-flow";
import {
  type ShareKit,
  browserShareKit,
  shareCardPicture,
  shareLink,
} from "./share-image";

/** How long the mode card stays up before a new game, unless a press sends it off. */
export const INTRO_MS = 2400;
/** How long the card takes to go (ui.css, section 30); then the scene opens. */
export const INTRO_LEAVE_MS = 200;
/** How often the clock is looked at while a question is asked. */
export const TICK_MS = 100;
/** A shot that has not reported back after this long is taken as played. */
export const SHOT_PATIENCE_MS = 5000;
/** The same for a promotion. */
export const PROMOTION_PATIENCE_MS = 4000;
/** How long SHARE shows how it went. */
export const SHARE_LABEL_MS = 2500;
/** The share picture is made this long after full time, once the card has come in. */
export const SHARE_IMAGE_DELAY_MS = 700;
/** The waits before a request the server did not answer is sent again, the last repeated. */
export const SERVER_RETRY_MS: readonly number[] = [500, 1000, 2000, 4000, 8000];

/**
 * Whether the page may run a game itself, with the questions built into it: in development
 * and in the tests. A production build has neither: this is false there, the bundler drops
 * what it guards (the questions and their answers with it), and the server runs every game.
 */
const PAGE_MAY_RUN: boolean = import.meta.env.DEV;

/**
 * Where SHARE is. `making`: the picture is not ready yet (the button is busy). Then how it
 * ended: `shared` through the system share sheet; `saved` the picture downloaded and the
 * text copied (the button says SAVED!, then COPIED!: `saved` turns into `copied`);
 * `downloaded` the picture only; `copied` the text only (no picture here); `failed`
 * neither.
 */
export type ShareState =
  "idle" | "making" | "shared" | "saved" | "downloaded" | "copied" | "failed";

/**
 * The mode card before a new game: `showing` while it is up, `leaving` while it goes (the
 * scene still waits on ink), null once the game is on, and for a game that has no card.
 */
export type IntroState = "showing" | "leaving" | null;

/** What the page draws from. A new object whenever anything on screen should change. */
export interface GameView {
  session: Session;
  /** The mode card (see `IntroState`). While it is not null there is no board and no bar. */
  intro: IntroState;
  /** The time the clock was last read at (for the board's clock and PASS). */
  now: number;
  /** A promotion is playing: the sheet has gone and the next question waits. */
  promoting: boolean;
  /** How many answers the judge has turned down this game: the bar's shake. */
  rejections: number;
  share: ShareState;
  /** The last thing to read out that no component says itself (a promotion, full time). */
  announcement: string;
  /** At full time, the daily streak this game kept going (days in a row); 0 before. */
  streak: number;
  /**
   * At full time, the mode the card offers next: the next in the menu's order not played
   * today (`nextMode`). Null before full time, and once every other mode has been played.
   */
  next: Session["mode"] | null;
  /**
   * The server has not yet said what the player's game is (none, one in progress, one
   * finished): nothing of the game is drawn. Never true where the page runs the game.
   */
  loading: boolean;
  /** A request is with the server and not yet answered: the bar and NEXT wait. */
  waiting: boolean;
  /** The server cannot be reached: the page says so, and keeps asking. */
  trouble: boolean;
}

export interface GameOptions {
  mode: Session["mode"];
  today: Today;
  /** `Date.now`, unless a test says otherwise. */
  clock?: () => number;
  /** Omit for `localStorage`; null for none. */
  storage?: StorageLike | null;
  /** The player's language, for miles or kilometres. Default "en-GB". */
  locale?: string;
  /** Copies the share text. Default: the share kit's (the browser's clipboard). */
  copy?: (text: string) => Promise<void>;
  /** The browser's side of SHARE (the picture, the share sheet, a download). */
  shareKit?: ShareKit;
  /**
   * The server that runs the game. Left out, or null: the page runs it itself, in
   * development and the tests; a production build always asks the site's own server.
   */
  server?: GameServer | null;
}

// The names a result goes by: also the home screen's (its review and SHARE), so they live
// in ./names.ts, away from the scene.
export { modeName, tierName, titleName } from "./names";

export class GameController {
  readonly scene: CareerScene;
  /** The player's language, for miles or kilometres. */
  readonly locale: string;
  private readonly clock: () => number;
  private readonly storage: StorageLike | null | undefined;
  private readonly copy: (text: string) => Promise<void>;
  private readonly kit: ShareKit;
  /** The share picture, once asked for: its making, and the PNG when it is made. */
  private image: {
    made: Promise<Blob | null>;
    ready: boolean;
    blob: Blob | null;
  } | null = null;
  private imageTimer: ReturnType<typeof setTimeout> | null = null;
  private view: GameView;
  private readonly listeners = new Set<() => void>();
  private ticker: ReturnType<typeof setInterval> | null = null;
  private patience: ReturnType<typeof setTimeout> | null = null;
  private introTimer: ReturnType<typeof setTimeout> | null = null;
  /** What a new game is made from: the first question's clock starts after the card. */
  private readonly context: LiveContext;
  private shareTimer: ReturnType<typeof setTimeout> | null = null;
  /** What is in the answer field, not sent yet, and for which question: the whistle's. */
  private draft: { index: number; text: string } = { index: -1, text: "" };
  /** Bumped whenever the game stops waiting for the scene: a late call back is ignored. */
  private waitToken = 0;
  private started = false;
  private disposed = false;
  /** Who runs the game: the server, or null for the page itself. */
  private readonly server: GameServer | null;
  /** The wait before a request is sent again. */
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  /** Requests in a row the server has not answered. */
  private failures = 0;
  /** Bumped with every request: an answer to an earlier one is ignored. */
  private requests = 0;
  /**
   * The game as the server last sealed it, to send with the next move. Null before a
   * game, and where the server keeps the game itself (an account's).
   */
  private ticket: string | null = null;

  constructor(options: GameOptions) {
    const { mode, today } = options;
    this.clock = options.clock ?? (() => Date.now());
    this.storage = options.storage;
    this.kit = options.shareKit ?? browserShareKit();
    this.copy = options.copy ?? this.kit.copy;
    this.locale = options.locale ?? "en-GB";
    this.server = options.server ?? (PAGE_MAY_RUN ? null : gameServer());
    const context: LiveContext = {
      mode,
      dayNumber: today.dayNumber,
      stadium: today.stadium,
      // The page's own questions, where it runs the game. Where the server does, blanks:
      // each question arrives as it is asked.
      questions:
        PAGE_MAY_RUN && !this.server
          ? questionsFor(mode)
          : Array.from({ length: QUESTION_COUNT }, () => blankQuestion(mode)),
    };
    this.context = context;
    const now = this.clock();

    // A mode is played once a day: today's finished game is shown again, at full time. It
    // is kept on the device with what it asked, so the server need not be asked for it.
    let session: Session | null = null;
    const done = loadGame(today.dayKey, mode, this.storage);
    if (done) {
      const questions =
        this.server || done.prompts
          ? storedQuestions(mode, done.turns, done.prompts)
          : context.questions;
      session = finishedSession({ ...context, questions }, done.turns, now);
    }
    if (!this.server) session ??= loadLive(context, this.storage);
    // A game the server runs is kept on this device as the ticket the server sealed: there
    // is one if a game was left in progress. Where it stands now (its clock has been
    // running) is not known until the server has looked at it (`start`).
    if (this.server && session === null) {
      this.ticket = loadTicket(today.dayKey, mode, this.storage);
    }
    const loading = this.ticket !== null;
    // A new game: the mode card first. Its clock is set again when the card goes.
    const fresh = session === null && !loading;
    session ??= createSession({
      ...context,
      now,
      noTimer: today.noTimer || loading,
    });

    this.scene = new CareerScene({
      seed: today.dayNumber,
      mode,
      labels: strings.play.canvas,
    });
    if (session.phase === "done") {
      this.scene.showFullTime(session.total);
    } else if (session.phase === "reveal") {
      // A promotion this turn earned has not been played yet: it plays on NEXT.
      this.scene.setTotal(progressFor(session).totalBefore);
    } else {
      this.scene.setTotal(session.total);
    }
    // On ink until the game is known: behind the mode card, or while the server is asked.
    if (fresh || loading) this.scene.holdOpening();

    this.view = {
      session,
      intro: fresh ? "showing" : null,
      now,
      promoting: false,
      rejections: 0,
      share: "idle",
      announcement: "",
      streak: session.phase === "done" ? this.streakOn(session.dayNumber) : 0,
      next: session.phase === "done" ? this.nextOn(session) : null,
      loading,
      waiting: false,
      trouble: false,
    };
  }

  /** The mode to offer after `done`, from the games this device has kept for its day. */
  private nextOn(done: Session): Session["mode"] | null {
    const dayKey = dayKeyFor(done.dayNumber);
    return nextMode(
      done.mode,
      (mode) => loadGame(dayKey, mode, this.storage) !== null,
    );
  }

  /** The daily streak on `day`, from the history this device keeps (0 if it cannot list it). */
  private streakOn(day: number): number {
    const days = loadHistory(
      day,
      this.storage as Parameters<typeof loadHistory>[1],
    ).map((game) => game.day);
    return streakFor(days, day).current;
  }

  // --- for useSyncExternalStore -------------------------------------------------------

  subscribe = (onChange: () => void): (() => void) => {
    this.listeners.add(onChange);
    return () => this.listeners.delete(onChange);
  };

  read = (): GameView => this.view;

  private set(change: Partial<GameView>): void {
    this.view = { ...this.view, ...change };
    for (const listener of this.listeners) listener();
  }

  // --- life ---------------------------------------------------------------------------

  /** Start the clock (or carry on a saved game's). Safe to call more than once. */
  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    const { session, intro } = this.view;
    if (this.view.loading) {
      this.open();
      return;
    }
    if (intro) {
      // Nothing is kept yet: a reload while the card is up starts the same new game.
      this.set({ announcement: strings.play.intro.spoken[session.mode] });
      this.introTimer = setTimeout(this.leaveIntro, INTRO_MS);
      return;
    }
    if (session.phase === "asking") {
      this.keep(session);
      this.startClock();
      this.tick();
    } else if (session.phase === "done") {
      this.prepareImageSoon();
    }
  }

  /** Stop every timer and stop listening to the scene. The page is going. */
  dispose(): void {
    this.disposed = true;
    this.waitToken++;
    this.requests++;
    this.clearRetry();
    this.stopClock();
    this.clearPatience();
    this.clearIntroTimer();
    if (this.shareTimer !== null) clearTimeout(this.shareTimer);
    this.shareTimer = null;
    if (this.imageTimer !== null) clearTimeout(this.imageTimer);
    this.imageTimer = null;
    this.listeners.clear();
  }

  // --- the player's moves -------------------------------------------------------------

  /** A press while the mode card is up: it has been read, and goes now. */
  skipIntro = (): void => {
    this.leaveIntro();
  };

  /**
   * The answer field changed. Nothing happens now, but if the clock runs out before the
   * player presses Enter, what is there counts as sent (`reduce`'s whistle).
   */
  type = (text: string): void => {
    this.draft = { index: this.view.session.index, text };
  };

  submit = (input: string): void => {
    const { session } = this.view;
    if (this.view.intro || this.view.loading) return;
    if (this.server) {
      this.sendAnswer(input, false);
      return;
    }
    const next = reduce(session, { type: "submit", input, now: this.clock() });
    if (next === session) return;
    if (next.phase === "resolving") {
      this.shoot(next);
    } else {
      this.set({
        session: next,
        now: this.clock(),
        rejections: this.view.rejections + 1,
      });
    }
  };

  pass = (): void => {
    const { session } = this.view;
    if (this.view.intro || this.view.loading) return;
    if (this.server) {
      this.sendPass();
      return;
    }
    const next = reduce(session, { type: "pass", now: this.clock() });
    if (next !== session && next.phase === "resolving") this.shoot(next);
  };

  /** NEXT QUESTION or FULL TIME on the reveal sheet. */
  next = (): void => {
    const { session, promoting, waiting } = this.view;
    if (session.phase !== "reveal" || promoting || waiting || this.disposed) {
      return;
    }

    if (isLastQuestion(session)) {
      // Full time is the page's to show: the server has had every answer. Where it keeps
      // the game itself (no ticket: an account's), it is told the card is up, so that it
      // sends the card too if the game is asked for again; nothing is lost if that never
      // arrives.
      if (this.server && this.ticket === null) {
        void this.server
          .next(session.mode, null, session.dayNumber, session.index)
          .catch(() => undefined);
      }
      this.fullTime(reduce(session, { type: "next", now: this.clock() }));
      return;
    }

    const progress = progressFor(session);
    if (progress.promotions.length === 0) {
      this.advance();
      return;
    }
    const token = ++this.waitToken;
    this.set({
      promoting: true,
      announcement: strings.play.promoted(tierName(session.total)),
    });
    this.patience = setTimeout(
      () => this.promoted(token),
      PROMOTION_PATIENCE_MS,
    );
    this.scene.promote(session.total, () => this.promoted(token));
  };

  /**
   * SHARE: the picture, and the two lines of text that go with it (`shareText`). Where the
   * browser can share files (mostly phones) the system share sheet opens with both;
   * elsewhere the picture is downloaded and the text copied. Where no picture can be made
   * at all, the text alone is copied. If the picture is still being made, the button is
   * busy until it is.
   */
  share = (): void => {
    const { session, share } = this.view;
    if (session.phase !== "done" || this.disposed || share === "making") {
      return;
    }
    const text = shareText(shareLink());
    if (!this.kit.canMakeImage()) {
      this.deliver(text, null);
      return;
    }
    const image = this.prepareImage();
    if (image.ready) {
      this.deliver(text, image.blob);
      return;
    }
    this.clearShareTimer();
    this.set({
      share: "making",
      announcement: strings.play.fullTime.makingSpoken,
    });
    void image.made.then((blob) => {
      if (!this.disposed) this.deliver(text, blob);
    });
  };

  /**
   * Hands the picture and the text to the share sheet, or downloads and copies them
   * (./share-flow.ts, as the home screen's SHARE does), then says how it went.
   */
  private deliver(text: string, blob: Blob | null): void {
    const { session } = this.view;
    const words = strings.play.fullTime.image;
    void deliverShare(this.kit, this.copy, {
      text,
      blob,
      fileName: words.fileName(session.dayNumber, session.mode),
      title: words.title(session.dayNumber, modeName(session.mode)),
    }).then((outcome) => this.settleShare(outcome));
  }

  /** Shows (and reads out) how SHARE went, then puts the button back. */
  private settleShare(state: Exclude<ShareState, "making">): void {
    if (this.disposed) return;
    this.clearShareTimer();
    const full = strings.play.fullTime;
    if (state === "idle") {
      this.set({ share: "idle" });
      return;
    }
    const spoken: Record<Exclude<ShareState, "idle" | "making">, string> = {
      shared: full.sharedSpoken,
      saved: full.savedSpoken,
      downloaded: full.downloadedSpoken,
      copied: full.copiedSpoken,
      failed: full.notCopiedSpoken,
    };
    this.set({
      share: state,
      announcement: spoken[state],
    });
    this.shareTimer = setTimeout(() => {
      this.shareTimer = null;
      if (state === "saved") {
        // The button said SAVED!; now it says COPIED! for as long again.
        this.set({ share: "copied" });
        this.shareTimer = setTimeout(() => {
          this.shareTimer = null;
          this.set({ share: "idle" });
        }, SHARE_LABEL_MS);
        return;
      }
      this.set({ share: "idle" });
    }, SHARE_LABEL_MS);
  }

  private clearShareTimer(): void {
    if (this.shareTimer !== null) clearTimeout(this.shareTimer);
    this.shareTimer = null;
  }

  /** Makes the share picture a moment after full time, so SHARE has it ready. */
  private prepareImageSoon(): void {
    if (this.image || this.imageTimer !== null || this.disposed) return;
    if (!this.kit.canMakeImage()) return;
    this.imageTimer = setTimeout(() => {
      this.imageTimer = null;
      if (!this.disposed) this.prepareImage();
    }, SHARE_IMAGE_DELAY_MS);
  }

  /** The share picture: started now if it has not been. */
  private prepareImage(): NonNullable<GameController["image"]> {
    if (this.imageTimer !== null) clearTimeout(this.imageTimer);
    this.imageTimer = null;
    if (this.image) return this.image;
    const { session } = this.view;
    const picture = shareCardPicture(
      shareCardFor(session),
      titleName(session.mode, session.total),
      tierName(session.total),
    );
    let made: Promise<Blob | null>;
    try {
      made = this.kit.makeImage(picture);
    } catch {
      made = Promise.resolve(null);
    }
    const image: NonNullable<GameController["image"]> = {
      made: made.catch(() => null),
      ready: false,
      blob: null,
    };
    image.made = image.made.then((blob) => {
      image.ready = true;
      image.blob = blob;
      return blob;
    });
    this.image = image;
    return image;
  }

  // --- the flow -----------------------------------------------------------------------

  /** The mode card starts to go: the scene waits on ink a moment more. */
  private leaveIntro = (): void => {
    if (this.disposed || this.view.intro !== "showing") return;
    this.clearIntroTimer();
    this.set({ intro: "leaving" });
    this.introTimer = setTimeout(this.kickOff, INTRO_LEAVE_MS);
  };

  /** The card has gone: the scene opens and question 1 is asked, its clock starting now. */
  private kickOff = (): void => {
    if (this.disposed || this.view.intro === null) return;
    this.clearIntroTimer();
    const { server } = this;
    if (server) {
      // The server sends question 1 as it starts its clock: the ink stays until it has.
      const { mode } = this.context;
      this.send(
        () => server.start(mode),
        (reply) => this.arrive(this.hold(reply)),
      );
      return;
    }
    const now = this.clock();
    const session = createSession({
      ...this.context,
      now,
      noTimer: this.view.session.noTimer,
    });
    this.keep(session);
    this.scene.beginOpening();
    this.set({ session, now, intro: null, announcement: "" });
    this.startClock();
    this.tick();
  };

  private clearIntroTimer(): void {
    if (this.introTimer !== null) clearTimeout(this.introTimer);
    this.introTimer = null;
  }

  /** An answer, a pass or the clock has ended the turn: the shot plays. */
  private shoot(session: Session): void {
    this.stopClock();
    this.keep(session);
    const token = ++this.waitToken;
    this.set({ session, now: this.clock() });
    const grade = session.turns[session.index].grade;
    this.patience = setTimeout(() => this.resolved(token), SHOT_PATIENCE_MS);
    this.scene.playShot(grade, () => this.resolved(token));
  }

  private resolved(token: number): void {
    if (token !== this.waitToken || this.disposed) return;
    this.waitToken++;
    this.clearPatience();
    const session = reduce(this.view.session, { type: "resolved" });
    this.keep(session);
    this.set({ session });
  }

  private promoted(token: number): void {
    if (token !== this.waitToken || this.disposed) return;
    this.waitToken++;
    this.clearPatience();
    this.advance();
  }

  /** On to the next question, with a fresh clock from now. */
  private advance(): void {
    const { server } = this;
    if (server) {
      // The server sends the next question as it starts its clock.
      const { mode, dayNumber: day, index } = this.view.session;
      this.send(
        () => server.next(mode, this.ticket, day, index),
        (reply) => this.asked(this.hold(reply), index + 1),
      );
      return;
    }
    const now = this.clock();
    const session = reduce(this.view.session, { type: "next", now });
    this.keep(session);
    this.set({ session, now, promoting: false });
    this.startClock();
  }

  private tick = (): void => {
    if (this.disposed || this.view.intro || this.view.loading) return;
    const now = this.clock();
    const { session } = this.view;
    const draft =
      this.draft.index === session.index ? this.draft.text : undefined;
    if (this.server) {
      // The server blows the whistle. At the page's zero it is sent what is in the field,
      // once: if it says the question is still open (its clock is behind), again.
      if (
        session.phase === "asking" &&
        session.deadline !== null &&
        now >= session.deadline &&
        !this.view.waiting
      ) {
        this.sendAnswer(draft ?? "", true);
      }
    } else {
      const next = reduce(session, { type: "tick", now, draft });
      if (next !== session) {
        this.shoot(next);
        return;
      }
    }
    // Only tell the page when something it shows has changed.
    const before = clockView(session, this.view.now);
    const after = clockView(session, now);
    if (
      before.secondsLeft !== after.secondsLeft ||
      before.canPass !== after.canPass
    ) {
      this.set({ now });
    }
  };

  private startClock(): void {
    this.stopClock();
    if (this.disposed || this.view.session.phase !== "asking") return;
    this.ticker = setInterval(this.tick, TICK_MS);
  }

  private stopClock(): void {
    if (this.ticker !== null) clearInterval(this.ticker);
    this.ticker = null;
  }

  private clearPatience(): void {
    if (this.patience !== null) clearTimeout(this.patience);
    this.patience = null;
  }

  /** Full time: the game is kept for the menu, and the card comes up. */
  private fullTime(done: Session): void {
    // The history is pruned from the real day, never from a `?day=` override.
    saveSession(done, this.storage, dayNumber(new Date(this.clock())));
    clearLive(dayKeyFor(done.dayNumber), done.mode, this.storage);
    this.scene.showFullTime(done.total);
    this.set({
      session: done,
      loading: false,
      intro: null,
      promoting: false,
      streak: this.streakOn(done.dayNumber),
      next: this.nextOn(done),
      announcement: strings.play.fullTime.spoken(
        done.total,
        MAX_TOTAL,
        titleName(done.mode, done.total),
        tierName(done.total),
      ),
    });
    this.prepareImageSoon();
  }

  /**
   * Keeps the game so far on the device, so a reload carries on with it. Only where the
   * page runs the game: one the server runs is kept as its ticket (`hold`).
   */
  private keep(session: Session): void {
    if (!this.server) saveLive(session, this.storage);
  }

  /**
   * Takes what the server said after a move: its ticket is the game from now on, kept on
   * the device under the game's own day so that a reload carries on from it.
   */
  private hold(reply: Reply): GameSnapshot {
    this.ticket = reply.ticket;
    if (reply.ticket !== null && reply.game.phase !== "done") {
      saveTicket(
        dayKeyFor(reply.game.day),
        reply.game.mode,
        reply.ticket,
        this.storage,
      );
    }
    return reply.game;
  }

  /** The game in hand is no game any more: its ticket is dropped, here and on the device. */
  private forget(): void {
    this.ticket = null;
    const { dayNumber: day, mode } = this.view.session;
    clearLive(dayKeyFor(day), mode, this.storage);
  }

  // --- the server's game --------------------------------------------------------------

  /**
   * Sends a request to the server until it answers. Meanwhile the page waits (`waiting`);
   * if the server cannot be reached the page says so (`trouble`) and the request is sent
   * again after a wait: the same move, with the same ticket, so it is played once (a move
   * whose answer was lost was never kept). An answer to anything but the latest request
   * is ignored.
   */
  private send<T>(ask: () => Promise<T>, heard: (answer: T) => void): void {
    if (this.disposed) return;
    const token = ++this.requests;
    this.clearRetry();
    if (!this.view.waiting) this.set({ waiting: true });
    const go = (): void => {
      this.retryTimer = null;
      ask().then(
        (answer) => {
          if (token !== this.requests || this.disposed) return;
          this.failures = 0;
          const trouble = strings.play.server.trouble;
          // One change of what is on screen: the answer's own.
          this.view = {
            ...this.view,
            waiting: false,
            trouble: false,
            ...(this.view.announcement === trouble && { announcement: "" }),
          };
          heard(answer);
          this.set({});
        },
        (error: unknown) => {
          if (token !== this.requests || this.disposed) return;
          if (error instanceof ServerError && error.kind === "gone") {
            // The server will not take the game up (its ticket is another day's, or the
            // day's questions were changed under it): it is dropped, for a new one.
            this.view = { ...this.view, waiting: false };
            this.forget();
            this.open();
            return;
          }
          const wait =
            SERVER_RETRY_MS[
              Math.min(this.failures, SERVER_RETRY_MS.length - 1)
            ] ?? 8000;
          this.failures++;
          if (!this.view.trouble) {
            this.set({
              trouble: true,
              announcement: strings.play.server.trouble,
            });
          }
          this.retryTimer = setTimeout(go, wait);
        },
      );
    };
    go();
  }

  private clearRetry(): void {
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  /** The page's session for what the server sent. */
  private sessionOf(snapshot: GameSnapshot): Session {
    return sessionFrom(snapshot, this.context.stadium);
  }

  /**
   * Takes up the game left on this device: the server looks at its ticket and says where
   * it stands now (its clock has been running). With no ticket, or one the server will
   * not take up, it is a new game and the mode card.
   */
  private open(): void {
    const { server, ticket } = this;
    if (!server) return;
    this.waitToken++;
    this.clearPatience();
    this.stopClock();
    this.clearIntroTimer();
    if (ticket === null) {
      this.newGame();
      return;
    }
    if (!this.view.loading || this.view.intro || this.view.promoting) {
      this.set({ loading: true, intro: null, promoting: false });
    }
    const { mode } = this.context;
    this.send(
      () => server.look(mode, ticket),
      (reply) => {
        if (reply) {
          this.arrive(this.hold(reply));
        } else {
          this.forget();
          this.newGame();
        }
      },
    );
  }

  /** No game yet today: the mode card, on the ink, then question 1. */
  private newGame(): void {
    const { server } = this;
    if (!server) return;
    const { mode } = this.context;
    this.scene.holdOpening();
    if (!this.scene.waiting) {
      // The scene is already open (the game was taken away under the page): there is no
      // ink to put the card on, so the new game starts at once.
      if (!this.view.loading || this.view.promoting) {
        this.set({ loading: true, intro: null, promoting: false });
      }
      this.send(
        () => server.start(mode),
        (reply) => this.arrive(this.hold(reply)),
      );
      return;
    }
    const now = this.clock();
    this.set({
      session: createSession({ ...this.context, now, noTimer: true }),
      now,
      loading: false,
      intro: "showing",
      announcement: strings.play.intro.spoken[mode],
    });
    this.introTimer = setTimeout(this.leaveIntro, INTRO_MS);
  }

  /**
   * The game as the server sent it, taken whole: on coming back to the page, when a new
   * game starts, and whenever what came back is not what the page expected. The scene is
   * set to where the game is, with no shot replayed.
   */
  private arrive(snapshot: GameSnapshot): void {
    this.waitToken++;
    this.clearPatience();
    this.stopClock();
    this.clearIntroTimer();
    const session = this.sessionOf(snapshot);
    if (session.phase === "done") {
      this.fullTime(session);
      return;
    }
    // A promotion the last turn earned has not been played yet: it plays on NEXT.
    this.scene.setTotal(
      session.phase === "reveal"
        ? progressFor(session).totalBefore
        : session.total,
    );
    this.scene.beginOpening();
    this.set({
      session,
      now: this.clock(),
      loading: false,
      intro: null,
      promoting: false,
      announcement: "",
    });
    if (session.phase === "asking") {
      this.startClock();
      this.tick();
    }
  }

  /** The next question, as the server sent it: its clock is already running. */
  private asked(snapshot: GameSnapshot, index: number): void {
    if (snapshot.phase !== "asking" || snapshot.index !== index) {
      this.arrive(snapshot);
      return;
    }
    this.set({
      session: this.sessionOf(snapshot),
      now: this.clock(),
      promoting: false,
    });
    this.startClock();
  }

  /**
   * An answer for the server to judge. `whistle`: it is what was in the field as the
   * page's clock ran out, sent even if that is nothing.
   */
  private sendAnswer(input: string, whistle: boolean): void {
    const { server } = this;
    const { session, waiting } = this.view;
    if (!server || waiting || session.phase !== "asking") return;
    if (!whistle && input.trim() === "") return;
    const { mode, dayNumber: day, index } = session;
    this.send(
      () => server.answer(mode, this.ticket, day, index, input, whistle),
      (reply) => this.verdict(this.hold(reply), index, !whistle),
    );
  }

  private sendPass(): void {
    const { server } = this;
    const { session, waiting } = this.view;
    if (!server || waiting || !canPass(session, this.clock())) return;
    const { mode, dayNumber: day, index } = session;
    this.send(
      () => server.pass(mode, this.ticket, day, index),
      (reply) => this.verdict(this.hold(reply), index, false),
    );
  }

  /**
   * What the server said to an answer or a pass on question `index`: decided (the shot
   * plays, then the sheet), or not an answer the judge knows (the bar shakes if `shake`,
   * and the clock runs on).
   */
  private verdict(snapshot: GameSnapshot, index: number, shake: boolean): void {
    const { session } = this.view;
    const mine =
      session.phase === "asking" &&
      session.index === index &&
      snapshot.index === index;
    if (mine && snapshot.phase === "reveal") {
      this.shoot({ ...this.sessionOf(snapshot), phase: "resolving" });
    } else if (mine && snapshot.phase === "asking") {
      this.set({
        session: this.sessionOf(snapshot),
        now: this.clock(),
        rejections: this.view.rejections + (shake && snapshot.rejected ? 1 : 0),
      });
    } else {
      this.arrive(snapshot);
    }
  }
}
