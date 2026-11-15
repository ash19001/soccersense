import { type FormEvent, type RefObject, useId, useRef, useState } from "react";

import { Button } from "./Button";
import { Popup } from "./Popup";

export interface NicknameLabels {
  /** The card's heading, and the dialog's name: "YOUR NAME". */
  heading: string;
  /** The line under the heading, and the dialog's description. */
  intro: string;
  close: string;
  /** The field's label: "NAME". */
  field: string;
  /** Under the field: what a name can be. */
  rules: string;
  /** Keeps the name and closes the card: "SAVE". */
  save: string;
}

export interface NicknameProps {
  labels: NicknameLabels;
  open: boolean;
  /** The player's name now: the field starts with it. */
  name: string;
  /** The most characters the field takes. */
  maxLength: number;
  /** What is wrong with a name as typed, in words, or null if it can be used. */
  problem(text: string): string | null;
  /** SAVE with a name that can be used: keep it. The card then closes. */
  onSave(text: string): void;
  /** The close button, Escape, a press outside, or a save: called once the card has gone. */
  onClose(): void;
  /** Where the focus goes back to on closing: the link that opened it. */
  returnFocus?: RefObject<HTMLElement | null>;
}

/**
 * The player's name (a `Popup`): the nickname the leaderboards show, in a field to change,
 * and SAVE. A name that cannot be used says why under
 * the field and the card stays up; a good one is kept and the card closes.
 */
export function Nickname({ open, ...rest }: NicknameProps) {
  return open ? <Card {...rest} /> : null;
}

function Card({
  labels,
  name,
  maxLength,
  problem,
  onSave,
  onClose,
  returnFocus,
}: Omit<NicknameProps, "open">) {
  const fieldId = useId();
  const rulesId = useId();
  const errorId = useId();
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const close = useRef<(() => void) | null>(null);
  const saved = useRef(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saved.current) return;
    const wrong = problem(value);
    if (wrong !== null) {
      setError(wrong);
      return;
    }
    saved.current = true;
    onSave(value);
    close.current?.();
  };

  return (
    <Popup
      open
      heading={labels.heading}
      intro={labels.intro}
      close={labels.close}
      onClose={onClose}
      returnFocus={returnFocus}
      className="ss-nick"
      dismissRef={close}
    >
      <form className="ss-nick__form" onSubmit={submit} noValidate>
        <label htmlFor={fieldId} className="ss-popup__k">
          {labels.field}
        </label>
        <input
          id={fieldId}
          className="ss-input"
          type="text"
          value={value}
          maxLength={maxLength}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-invalid={error !== null ? true : undefined}
          aria-describedby={error !== null ? `${errorId} ${rulesId}` : rulesId}
          onChange={(event) => {
            setValue(event.currentTarget.value);
            setError(null);
          }}
        />
        <p id={errorId} className="ss-nick__error" aria-live="assertive">
          {error}
        </p>
        <p id={rulesId} className="ss-popup__note">
          {labels.rules}
        </p>
        <Button variant="primary" type="submit" full className="ss-nick__save">
          {labels.save}
        </Button>
      </form>
    </Popup>
  );
}
