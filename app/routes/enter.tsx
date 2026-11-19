// Where signing in lands: the page a sign-in link opens, and where a trip to Google ends
// (worker/accounts/api.ts).
//
// The emailed link is `/enter#<token>`. What follows the "#" is never sent to a server by a
// browser, so the token is in nobody's logs, and a mail scanner that fetches the address
// uses nothing up: only this page, running in the player's browser, hands the token to the
// API. Where the link was asked for from this same browser it signs in at once; anywhere
// else (another device, or a scanner that does run pages) it asks for a press first.
// The token is taken out of the address bar as soon as it has been read.
//
// A trip to Google comes back as `/enter#google` (the device is signed in: the page asks
// who as) or `/enter#failed`.
//
// A card on ink in the game's skin, like the rules' page. Not a page to be found: it asks
// not to be indexed and is not in PAGES. Nothing is read from the address until after
// mounting (the page is prerendered).

import {
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { linkAsked } from "~/game";
import { strings } from "~/i18n";
import {
  Button,
  IconButton,
  PixelRoot,
  WideMarkScript,
  isWide,
  useArrivalFocus,
  usePixelRootScale,
  useWideMark,
} from "~/ui";
import type { Route } from "./+types/enter";
import { accountStore } from "./account";

const text = strings.enter;

export const meta: Route.MetaFunction = () => [
  { title: `${text.title} · ${strings.siteName}` },
  { name: "robots", content: "noindex" },
];

/** What the page is doing, or how it went. */
type Stage =
  | { at: "reading" }
  /** A link's token, waiting for a press. */
  | { at: "confirm"; token: string }
  | { at: "working" }
  | { at: "done" }
  | { at: "failed"; words: string };

/** What a sign-in link's token looks like (worker/accounts/tokens.ts). */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

const READING: Stage = { at: "reading" };

/**
 * One arrival at the page: what the address said, and how signing in with it goes. A store
 * for `useSyncExternalStore`, so the page built ahead of time and the browser's first
 * render agree (nothing has been read yet), and the address is read once, after mounting.
 */
function arrival() {
  let stage = READING;
  let arrived = false;
  const listeners = new Set<() => void>();
  const set = (next: Stage) => {
    stage = next;
    for (const listener of [...listeners]) listener();
  };
  const enter = (token: string) => {
    set({ at: "working" });
    void accountStore.enter(token).then((done) => {
      set(done.ok ? { at: "done" } : { at: "failed", words: text.failed });
    });
  };
  return {
    subscribe(onChange: () => void): () => void {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    read: (): Stage => stage,
    server: (): Stage => READING,
    enter,
    /** Reads the address. Once: strict mode runs effects twice, and a link works once. */
    arrive(): void {
      if (arrived) return;
      arrived = true;
      const hash = window.location.hash.slice(1);
      // Out of the address bar and the history, whatever it was.
      if (hash !== "") {
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname + window.location.search,
        );
      }
      if (hash === "google") {
        set({ at: "working" });
        void accountStore.refresh().then(() => {
          set(
            accountStore.read().account
              ? { at: "done" }
              : { at: "failed", words: text.googleFailed },
          );
        });
      } else if (hash === "failed") {
        set({ at: "failed", words: text.googleFailed });
      } else if (TOKEN.test(hash)) {
        if (linkAsked(Date.now())) enter(hash);
        else set({ at: "confirm", token: hash });
      } else {
        set({ at: "failed", words: hash === "" ? text.nothing : text.failed });
      }
    },
  };
}

/**
 * The card: the pop-ups' own, standing on the page. On a monitor it is set in caption
 * pixels as they are (`data-wide`), so it is the size of the account's pop-up it follows.
 */
function Card({ children }: { children: ReactNode }) {
  const wide = isWide(usePixelRootScale());
  // On a monitor it is that size from the first paint (`useWideMark`).
  const mark = useWideMark<HTMLElement>(wide);
  return (
    <section
      ref={mark}
      className="ss-help ss-popup ss-enter"
      data-wide={wide ? "" : undefined}
      suppressHydrationWarning
    >
      <WideMarkScript />
      {children}
    </section>
  );
}

export default function Enter() {
  const account = useSyncExternalStore(
    accountStore.subscribe,
    accountStore.read,
    accountStore.server,
  );
  const heading = useArrivalFocus<HTMLHeadingElement>();
  const [flow] = useState(arrival);
  const stage = useSyncExternalStore(flow.subscribe, flow.read, flow.server);
  useEffect(() => flow.arrive(), [flow]);

  const who = account.account;
  return (
    <PixelRoot className="ss-page flex flex-col justify-center">
      <main className="ss-help-page">
        <Card>
          <div className="ss-help__head">
            <h1 ref={heading} tabIndex={-1} className="ss-help__title">
              {text.heading}
            </h1>
            <IconButton
              icon="close"
              label={text.back}
              to="/"
              variant="secondary"
              className="ss-help__close"
            />
          </div>
          <div className="ss-help__body ss-popup__body" aria-live="polite">
            {(stage.at === "reading" || stage.at === "working") && (
              <p className="ss-popup__intro">{text.working}</p>
            )}
            {stage.at === "confirm" && (
              <>
                <p className="ss-popup__intro">{text.confirm}</p>
                <Button
                  variant="primary"
                  full
                  onClick={() => flow.enter(stage.token)}
                >
                  {text.go}
                </Button>
              </>
            )}
            {stage.at === "done" && (
              <>
                <p className="ss-popup__intro">
                  {who ? text.done(who.email) : text.working}
                </p>
                {who && (
                  <p className="ss-popup__note">
                    {text.playingAs(who.nickname)}
                  </p>
                )}
                <Button variant="primary" full to="/" className="ss-acct__go">
                  {text.play}
                </Button>
              </>
            )}
            {stage.at === "failed" && (
              <>
                <p className="ss-popup__intro">{stage.words}</p>
                <Button full to="/" className="ss-acct__go">
                  {text.home}
                </Button>
              </>
            )}
          </div>
        </Card>
      </main>
    </PixelRoot>
  );
}
