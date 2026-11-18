import {
  type FormEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Link } from "react-router";

import { BotCheck } from "./BotCheck";
import { Button } from "./Button";
import { Popup } from "./Popup";

export interface AccountLabels {
  /** The card's heading, and the dialog's name: "SIGN IN" (it signs up too); "YOUR ACCOUNT". */
  heading: string;
  headingIn: string;
  close: string;
  /** The line under the heading while nobody is signed in: what an account is for. */
  intro: string;
  /** The same line once someone is. */
  introIn: string;
  /** The player's name at the top of the card ("YOUR NAME"), and the way to change it. */
  yourName: string;
  change: string;
  changeSpoken: (name: string) => string;
  /** The address field's label: "EMAIL". */
  email: string;
  /** Sends the link: "EMAIL ME A LINK"; and while it is being sent. */
  send: string;
  sending: string;
  /** Under it: what will happen. */
  emailNote: string;
  /** The link to Google: "CONTINUE WITH GOOGLE". */
  google: string;
  /** Once the link has gone, with the address it went to; and what to do next. */
  sent: (email: string) => string;
  sentNote: string;
  /** Back to the field: "USE ANOTHER EMAIL". */
  another: string;
  /** While the server is being asked who is signed in. */
  checking: string;
  /** Asks again after the server could not be reached: "TRY AGAIN". */
  retry: string;
  /** Where the server could not be reached. */
  unreachable: string;
  /** Where no way of signing in is switched on. */
  none: string;
  /** Before the address of whoever is signed in: "SIGNED IN AS". */
  signedInAs: string;
  /** Signs the device out: "SIGN OUT"; and while it is. */
  leave: string;
  leaving: string;
  /** On the send button while the bot check has not decided yet; and if it cannot run. */
  checkWaiting: string;
  checkFailed: string;
  /** Deleting the account: the button, the question, yes and no, while, and done. */
  remove: string;
  removeAsk: string;
  removeYes: string;
  removeNo: string;
  removing: string;
  removed: string;
  /** The small print: "Signing in means you accept our Terms and Privacy." */
  agree: string;
  terms: string;
  privacy: string;
  and: string;
}

export interface AccountProps {
  labels: AccountLabels;
  open: boolean;
  /** The player's name: the account's, or the one this device keeps. */
  name: string;
  /** Who is signed in on this device, or null. */
  account: { nickname: string; email: string } | null;
  /**
   * The ways of signing in that are switched on, and the bot check's site key where asking
   * for a link needs it; null while that is not known.
   */
  ways: { email: boolean; google: boolean; check: string | null } | null;
  /** The server is being asked, has answered, or could not be reached. */
  status: "asking" | "ready" | "failed";
  /** Where the browser goes to sign in with Google. */
  googleHref: string;
  /** Where the terms and the privacy notice are. */
  termsHref: string;
  privacyHref: string;
  /** CHANGE beside the name: the name's card comes up in this one's place. */
  onChangeName(): void;
  /**
   * Sends a sign-in link to the address, with the bot check's token where there is a
   * check. Resolves to what went wrong, in words, or null.
   */
  onSend(email: string, check: string | null): Promise<string | null>;
  /** Signs the device out. Resolves to what went wrong, in words, or null. */
  onLeave(): Promise<string | null>;
  /** Deletes the account. Resolves to what went wrong, in words, or null. */
  onDelete(): Promise<string | null>;
  /** Asks the server again. */
  onRetry(): void;
  /** The close button, Escape or a press outside: called once the card has gone. */
  onClose(): void;
  /** Where the focus goes back to on closing: the button that opened it. */
  returnFocus?: RefObject<HTMLElement | null>;
}

/** How long a send waits for the bot check before saying it cannot run. */
export const CHECK_PATIENCE_MS = 15_000;

/**
 * The player's account (a `Popup`): signing in and signing up are the same here, by a link
 * sent to an email address or with Google, with no password.
 *
 * Nobody signed in: what an account is for, the player's name (CHANGE), an email field and
 * EMAIL ME A LINK (with the bot check where there is one), and CONTINUE WITH GOOGLE, each
 * only where that way is switched on. Once the link has gone it says where to, and how
 * long it works. Someone signed in: who, the name they play under (CHANGE), SIGN OUT, and
 * DELETE ACCOUNT, which asks first. The terms and the privacy notice are linked at the foot.
 */
export function Account({ open, ...rest }: AccountProps) {
  return open ? <Card {...rest} /> : null;
}

function Card({
  labels,
  name,
  account,
  ways,
  status,
  googleHref,
  termsHref,
  privacyHref,
  onChangeName,
  onSend,
  onLeave,
  onDelete,
  onRetry,
  onClose,
  returnFocus,
}: Omit<AccountProps, "open">) {
  const fieldId = useId();
  const noteId = useId();
  const errorId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** The address a link has just been sent to. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Deleting: asked, and the answer awaited. */
  const [asking, setAsking] = useState(false);
  /** The account was deleted from this card. */
  const [removed, setRemoved] = useState(false);
  const working = useRef(false);

  // The bot check: its token, a fresh one asked for after each send, and a send waiting
  // for it (the address, and how long it waits).
  const [token, setToken] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const waitingFor = useRef<string | null>(null);
  const patience = useRef<ReturnType<typeof setTimeout> | null>(null);
  const check = ways?.check ?? null;
  useEffect(
    () => () => {
      if (patience.current !== null) clearTimeout(patience.current);
    },
    [],
  );

  /** One request at a time; `after` gets what went wrong, or null. */
  const run = (
    request: () => Promise<string | null>,
    after: (problem: string | null) => void,
  ) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    void request()
      .catch(() => labels.unreachable)
      .then((problem) => {
        working.current = false;
        setBusy(false);
        after(problem);
      });
  };

  const send = (email: string, withToken: string | null) => {
    run(
      () => onSend(email, withToken),
      (problem) => {
        // The token is spent either way.
        if (check !== null) setRound((n) => n + 1);
        if (problem === null) setSentTo(email);
        else setError(problem);
      },
    );
  };

  /** No send waits for the check any more. */
  const stopWaiting = () => {
    waitingFor.current = null;
    setWaiting(false);
    if (patience.current !== null) clearTimeout(patience.current);
    patience.current = null;
  };

  /** The check has decided (a token), or its token has run out (null). */
  const onToken = (next: string | null) => {
    setToken(next);
    const email = waitingFor.current;
    // A send that waited for the check goes now.
    if (next !== null && email !== null) {
      stopWaiting();
      send(email, next);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (working.current || waitingFor.current !== null) return;
    const email = value.trim();
    setError(null);
    if (check !== null && token === null) {
      // The check has not decided yet: the send waits for it, a while.
      waitingFor.current = email;
      setWaiting(true);
      patience.current = setTimeout(() => {
        stopWaiting();
        setError(labels.checkFailed);
      }, CHECK_PATIENCE_MS);
      return;
    }
    send(email, check === null ? null : token);
  };

  const nameRow = (
    <div className="ss-acct__row">
      <span className="ss-popup__k">{labels.yourName}</span>
      <span className="ss-acct__name">
        <span className="ss-acct__v">{account?.nickname ?? name}</span>
        <button
          type="button"
          className="ss-acct__link ss-acct__change"
          aria-label={labels.changeSpoken(account?.nickname ?? name)}
          aria-haspopup="dialog"
          onClick={onChangeName}
        >
          {labels.change}
        </button>
      </span>
    </div>
  );

  const errorLine = (
    <p id={errorId} className="ss-nick__error" aria-live="assertive">
      {error}
    </p>
  );

  let body;
  if (account && asking) {
    body = (
      <div className="ss-acct__form">
        <p className="ss-acct__ask">{labels.removeAsk}</p>
        {errorLine}
        <Button
          variant="mode"
          mode="home"
          full
          disabled={busy}
          className="ss-acct__go"
          onClick={() =>
            run(onDelete, (problem) => {
              if (problem === null) {
                setAsking(false);
                setRemoved(true);
              } else {
                setError(problem);
              }
            })
          }
        >
          {busy ? labels.removing : labels.removeYes}
        </Button>
        <Button
          full
          disabled={busy}
          onClick={() => {
            setAsking(false);
            setError(null);
          }}
        >
          {labels.removeNo}
        </Button>
      </div>
    );
  } else if (account) {
    body = (
      <div className="ss-acct__form">
        <div className="ss-acct__row">
          <span className="ss-popup__k">{labels.signedInAs}</span>
          <span className="ss-acct__v">{account.email}</span>
        </div>
        {nameRow}
        {errorLine}
        <Button
          full
          disabled={busy}
          className="ss-acct__go"
          onClick={() => run(onLeave, setError)}
        >
          {busy ? labels.leaving : labels.leave}
        </Button>
        <Button
          variant="ghost"
          full
          disabled={busy}
          onClick={() => {
            setError(null);
            setAsking(true);
          }}
        >
          {labels.remove}
        </Button>
      </div>
    );
  } else if (sentTo !== null) {
    body = (
      <div className="ss-acct__form">
        <p className="ss-popup__status" role="status">
          {labels.sent(sentTo)}
        </p>
        <p className="ss-popup__note">{labels.sentNote}</p>
        <Button
          variant="ghost"
          full
          className="ss-acct__go"
          onClick={() => {
            setSentTo(null);
            setError(null);
          }}
        >
          {labels.another}
        </Button>
      </div>
    );
  } else if (!ways) {
    body =
      status === "failed" ? (
        <div className="ss-acct__form">
          <p className="ss-nick__error" role="alert">
            {labels.unreachable}
          </p>
          <Button full className="ss-acct__go" onClick={onRetry}>
            {labels.retry}
          </Button>
        </div>
      ) : (
        <p className="ss-popup__note" role="status">
          {labels.checking}
        </p>
      );
  } else {
    body = (
      <div className="ss-acct__form">
        {!ways.email && !ways.google && (
          <p className="ss-popup__note">{labels.none}</p>
        )}
        {ways.email && (
          <form className="ss-acct__form" onSubmit={submit} noValidate>
            <label htmlFor={fieldId} className="ss-popup__k">
              {labels.email}
            </label>
            <input
              id={fieldId}
              className="ss-input"
              type="email"
              name="email"
              value={value}
              maxLength={254}
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              enterKeyHint="send"
              aria-invalid={error !== null ? true : undefined}
              aria-describedby={
                error !== null ? `${errorId} ${noteId}` : noteId
              }
              onChange={(event) => {
                setValue(event.currentTarget.value);
                setError(null);
              }}
            />
            {check !== null && (
              <BotCheck
                siteKey={check}
                round={round}
                onToken={onToken}
                onUnavailable={() => {
                  stopWaiting();
                  setError(labels.checkFailed);
                }}
              />
            )}
            {errorLine}
            <Button
              variant="primary"
              type="submit"
              full
              disabled={busy || waiting}
              className="ss-acct__go"
            >
              {waiting
                ? labels.checkWaiting
                : busy
                  ? labels.sending
                  : labels.send}
            </Button>
            <p id={noteId} className="ss-popup__note">
              {labels.emailNote}
            </p>
          </form>
        )}
        {ways.google && (
          // A page load, not a request: Google's own page comes next.
          <a
            className="ss-btn ss-btn--secondary ss-btn--full ss-acct__google"
            href={googleHref}
          >
            <span className="ss-btn__label">{labels.google}</span>
          </a>
        )}
      </div>
    );
  }

  return (
    <Popup
      open
      heading={account ? labels.headingIn : labels.heading}
      intro={account ? labels.introIn : labels.intro}
      close={labels.close}
      onClose={onClose}
      returnFocus={returnFocus}
      className="ss-acct"
    >
      {removed && !account && (
        <p className="ss-popup__status" role="status">
          {labels.removed}
        </p>
      )}
      {/* Nobody signed in: the name this device plays under, whatever the server says. */}
      {!account && nameRow}
      {body}
      <p className="ss-legal ss-acct__small">
        {/* Once signed in, only the two links. */}
        {!account && `${labels.agree} `}
        <Link className="ss-acct__link" to={termsHref}>
          {labels.terms}
        </Link>{" "}
        {labels.and}{" "}
        <Link className="ss-acct__link" to={privacyHref}>
          {labels.privacy}
        </Link>
        .
      </p>
    </Popup>
  );
}
