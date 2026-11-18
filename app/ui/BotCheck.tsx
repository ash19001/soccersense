import { useEffect, useRef } from "react";

/**
 * The bot check before a sign-in link is sent: Cloudflare Turnstile's widget, rendered in
 * place (worker/accounts/check.ts checks its token). Most people never see it: it decides
 * in the background and only asks for a click where it cannot tell
 * (`appearance: "interaction-only"`). Its script is loaded from Cloudflare the first time
 * a check is shown, never before, so a player who never opens the sign-in card loads
 * nothing of it.
 */

/** Turnstile's script, for rendering by hand. */
export const TURNSTILE_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** The part of Turnstile's script the page uses (`window.turnstile`). */
export interface Turnstile {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

type WithTurnstile = typeof globalThis & { turnstile?: Turnstile };

let loading: Promise<Turnstile> | null = null;

/** Turnstile, its script loaded once per page. */
export function loadTurnstile(): Promise<Turnstile> {
  const found = (globalThis as WithTurnstile).turnstile;
  if (found) return Promise.resolve(found);
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.onload = () => {
      const ready = (globalThis as WithTurnstile).turnstile;
      if (ready) resolve(ready);
      else reject(new Error("Turnstile's script did not set it up"));
    };
    script.onerror = () => {
      // Blocked, or offline: the next card tries again.
      loading = null;
      script.remove();
      reject(new Error("Turnstile's script did not load"));
    };
    document.head.append(script);
  });
  return loading;
}

/** For the tests: as if the page had just been opened. */
export function resetTurnstileLoader(): void {
  loading = null;
}

export interface BotCheckProps {
  /** The widget's site key (not a secret: the server says what it is). */
  siteKey: string;
  /** A token to send (the check passed), or null: none yet, run out, or failed. */
  onToken(token: string | null): void;
  /** The check cannot run here: its script did not load. */
  onUnavailable(): void;
  /** Change it for a fresh token: each works once, so after every request that sent one. */
  round: number;
}

export function BotCheck({
  siteKey,
  onToken,
  onUnavailable,
  round,
}: BotCheckProps) {
  const box = useRef<HTMLDivElement | null>(null);
  const widget = useRef<{ turnstile: Turnstile; id: string } | null>(null);
  const heard = useRef({ onToken, onUnavailable });
  useEffect(() => {
    heard.current = { onToken, onUnavailable };
  });

  useEffect(() => {
    let gone = false;
    loadTurnstile().then(
      (turnstile) => {
        if (gone || !box.current) return;
        const id = turnstile.render(box.current, {
          sitekey: siteKey,
          theme: "dark",
          size: "flexible",
          appearance: "interaction-only",
          callback: (token: string) => heard.current.onToken(token),
          "expired-callback": () => heard.current.onToken(null),
          // Turnstile tries again by itself; meanwhile there is no token.
          "error-callback": () => heard.current.onToken(null),
        });
        widget.current = { turnstile, id };
      },
      () => {
        if (!gone) heard.current.onUnavailable();
      },
    );
    return () => {
      gone = true;
      const shown = widget.current;
      widget.current = null;
      try {
        shown?.turnstile.remove(shown.id);
      } catch {
        // gone already
      }
    };
  }, [siteKey]);

  // A fresh token after one has been sent.
  const first = useRef(round);
  useEffect(() => {
    if (round === first.current) return;
    const shown = widget.current;
    heard.current.onToken(null);
    try {
      shown?.turnstile.reset(shown.id);
    } catch {
      // the next render makes a new one
    }
  }, [round]);

  return <div ref={box} className="ss-check" />;
}
