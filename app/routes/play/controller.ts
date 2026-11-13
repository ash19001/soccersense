// The game's referee: one per game page. It holds the session (the rules in `~/game`),
// runs the clock, tells the career scene what to play, waits for it, saves the game as it
// goes and shares the result (a picture and the text, ./share-image.ts). React only reads
// it (`subscribe` and `read`, for `useSyncExternalStore`) and calls its handlers.
//
// Browser only: it is made after mounting, and it reads the clock and sets timers.
//
// The flow (docs/GAME_DESIGN.md sections 3 to 6):
//   asking     the clock runs. An answer the judge does not know shakes the bar (the
//              clock runs on); one it knows, PASS, or the clock running out ends the turn.
//   resolving  the clock has stopped and the shot plays (`scene.playShot(grade)`).
//   reveal     the sheet. NEXT: if the total crossed a tier line, the promotion plays first
//              (`scene.promote(total)`, no clock meanwhile), then the next question.
//   done       full time: the card, `scene.showFullTime(total)`, the game saved for the menu.
//
// The scene answers by calling back. If it never does (no canvas, the tab hidden, the
// scene stopped by an error), the game moves on by itself after a while, so it can never
// be stuck; a late answer from the scene is then ignored.

import {
  MAX_TOTAL,
  type Session,
  type StorageLike,
  type Today,
  buildShareText,
  clockView,
  createSession,
  dayKeyFor,
  dayNumber,
  isLastQuestion,
  loadGame,
  loadHistory,
  progressFor,
  reduce,
  saveSession,
  shareCardFor,
  shareInputFor,
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
  saveLive,
} from "./progress";
import { modeName, tierName, titleName } from "./names";
import { deliverShare } from "./share-flow";
import {
  type ShareKit,
  browserShareKit,
  shareCardPicture,
} from "./share-image";

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

/**
 * Where SHARE is. `making`: the picture is not ready yet (the button is busy). Then how it
 * ended: `shared` through the system share sheet; `saved` the picture downloaded and the
 * text copied (the button says SAVED!, then COPIED!: `saved` turns into `copied`);
 * `downloaded` the picture only; `copied` the text only (no picture here); `failed`
 * neither.
 */
export type ShareState =
  "idle" | "making" | "shared" | "saved" | "downloaded" | "copied" | "failed";

/** What the page draws from. A new object whenever anything on screen should change. */
export interface GameView {
  session: Session;
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
  private shareTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped whenever the game stops waiting for the scene: a late call back is ignored. */
  private waitToken = 0;
  private started = false;
  private disposed = false;

  constructor(options: GameOptions) {
    const { mode, today } = options;
    this.clock = options.clock ?? (() => Date.now());
    this.storage = options.storage;
    this.kit = options.shareKit ?? browserShareKit();
    this.copy = options.copy ?? this.kit.copy;
    this.locale = options.locale ?? "en-GB";
    const context: LiveContext = {
      mode,
      dayNumber: today.dayNumber,
      stadium: today.stadium,
      questions: questionsFor(mode),
    };
    const now = this.clock();

    // A mode is played once a day: today's finished game is shown again, at full time.
    let session: Session | null = null;
    const done = loadGame(today.dayKey, mode, this.storage);
    if (done) session = finishedSession(context, done.turns, now);
    session ??= loadLive(context, this.storage);
    session ??= createSession({
      ...context,
      now,
      noTimer: today.noTimer,
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

    this.view = {
      session,
      now,
      promoting: false,
      rejections: 0,
      share: "idle",
      announcement: "",
      streak: session.phase === "done" ? this.streakOn(session.dayNumber) : 0,
    };
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
    const { session } = this.view;
    if (session.phase === "asking") {
      saveLive(session, this.storage);
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
    this.stopClock();
    this.clearPatience();
    if (this.shareTimer !== null) clearTimeout(this.shareTimer);
    this.shareTimer = null;
    if (this.imageTimer !== null) clearTimeout(this.imageTimer);
    this.imageTimer = null;
    this.listeners.clear();
  }

  // --- the player's moves -------------------------------------------------------------

  submit = (input: string): void => {
    const { session } = this.view;
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
    const next = reduce(session, { type: "pass", now: this.clock() });
    if (next !== session && next.phase === "resolving") this.shoot(next);
  };

  /** NEXT QUESTION or FULL TIME on the reveal sheet. */
  next = (): void => {
    const { session, promoting } = this.view;
    if (session.phase !== "reveal" || promoting || this.disposed) return;

    if (isLastQuestion(session)) {
      const done = reduce(session, { type: "next", now: this.clock() });
      // The history is pruned from the real day, never from a `?day=` override.
      saveSession(done, this.storage, dayNumber(new Date(this.clock())));
      clearLive(dayKeyFor(done.dayNumber), done.mode, this.storage);
      this.scene.showFullTime(done.total);
      this.set({
        session: done,
        streak: this.streakOn(done.dayNumber),
        announcement: strings.play.fullTime.spoken(
          done.total,
          MAX_TOTAL,
          titleName(done.mode, done.total),
          tierName(done.total),
        ),
      });
      this.prepareImageSoon();
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
   * SHARE: the picture and the text summary. Where the browser can share files (mostly
   * phones) the system share sheet opens with both; elsewhere the picture is downloaded and
   * the text copied. Where no picture can be made at all, the text is copied as it always
   * was. If the picture is still being made, the button is busy until it is.
   */
  share = (): void => {
    const { session, share } = this.view;
    if (session.phase !== "done" || this.disposed || share === "making") {
      return;
    }
    const text = buildShareText(
      shareInputFor(
        session,
        tierName(session.total),
        titleName(session.mode, session.total),
        modeName(session.mode),
      ),
    );
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

  /** An answer, a pass or the clock has ended the turn: the shot plays. */
  private shoot(session: Session): void {
    this.stopClock();
    saveLive(session, this.storage);
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
    saveLive(session, this.storage);
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
    const now = this.clock();
    const session = reduce(this.view.session, { type: "next", now });
    saveLive(session, this.storage);
    this.set({ session, now, promoting: false });
    this.startClock();
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = this.clock();
    const { session } = this.view;
    const next = reduce(session, { type: "tick", now });
    if (next !== session) {
      this.shoot(next);
      return;
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
}
