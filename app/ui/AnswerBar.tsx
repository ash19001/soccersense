import { type FormEvent, type Ref, useId } from "react";

import { Button } from "./Button";
import { cx } from "./cx";
import type { UiMode } from "./types";

export interface AnswerBarLabels {
  /** Name of the text field for screen readers: "Your answer". */
  input: string;
  /** "SHOOT" */
  shoot: string;
  /** "PASS" */
  pass: string;
}

export interface AnswerBarProps {
  value: string;
  onChange: (value: string) => void;
  /** Enter or the SHOOT button. Called with the current value. */
  onSubmit: (value: string) => void;
  onPass?: () => void;
  /** Shows the PASS button. */
  canPass?: boolean;
  /** "Not on the teamsheet. Try another." Shown above the bar and announced politely. */
  rejection?: string | null;
  /**
   * The bar shakes once each time this number changes to a new non-zero value (count the
   * rejections). Left out, it shakes once when `rejection` appears.
   */
  shakeKey?: number;
  /** While an answer is being judged: the field is read-only and the buttons are off. */
  busy?: boolean;
  mode: UiMode;
  placeholder?: string;
  labels: AnswerBarLabels;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
}

/** The answer field, the SHOOT button, and (after a while) PASS. */
export function AnswerBar({
  value,
  onChange,
  onSubmit,
  onPass,
  canPass = false,
  rejection = null,
  shakeKey,
  busy = false,
  mode,
  placeholder,
  labels,
  autoFocus,
  inputRef,
  className,
}: AnswerBarProps) {
  const id = useId();
  const fieldId = `${id}-answer`;
  const messageId = `${id}-message`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!busy) onSubmit(value);
  }

  const shake =
    shakeKey === undefined
      ? rejection
        ? "ss-shake-a"
        : null
      : shakeKey > 0
        ? shakeKey % 2 === 1
          ? "ss-shake-a"
          : "ss-shake-b"
        : null;

  return (
    <form
      className={cx("ss-answer", className)}
      data-mode={mode}
      onSubmit={handleSubmit}
      noValidate
      autoComplete="off"
    >
      <div className="ss-answer__above">
        <p
          id={messageId}
          className={cx("ss-answer__reject", !rejection && "is-empty")}
          role="status"
          aria-live="polite"
        >
          <span className="ss-answer__card" aria-hidden="true" />
          {/* A fresh node for every rejection, so the same words are announced again. */}
          <span key={shakeKey ?? 0}>{rejection}</span>
        </p>
        {canPass && (
          <Button
            className="ss-answer__pass"
            variant="secondary"
            onClick={onPass}
            disabled={busy}
          >
            {labels.pass}
          </Button>
        )}
      </div>
      <div className={cx("ss-panel ss-answer__bar", shake)}>
        <label className="ss-sr" htmlFor={fieldId}>
          {labels.input}
        </label>
        <input
          ref={inputRef}
          id={fieldId}
          className="ss-input"
          type="text"
          inputMode="text"
          enterKeyHint="go"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          maxLength={60}
          placeholder={placeholder}
          value={value}
          readOnly={busy}
          aria-invalid={rejection ? true : undefined}
          aria-describedby={rejection ? messageId : undefined}
          // The game puts the caret in the field when a question starts.
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
        />
        <Button type="submit" variant="mode" mode={mode} disabled={busy}>
          {labels.shoot}
        </Button>
      </div>
    </form>
  );
}
