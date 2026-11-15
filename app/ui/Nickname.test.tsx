import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { strings } from "~/i18n";

import { Nickname } from "./Nickname";

const LABELS = strings.nickname;

/** "Too short" for under three characters: the test's own rule. */
function problem(text: string): string | null {
  return text.trim().length < 3 ? "Too short." : null;
}

function card(
  props: Partial<Parameters<typeof Nickname>[0]> = {},
): ReturnType<typeof vi.fn>[] {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <Nickname
      labels={LABELS}
      open
      name="NutmegNina"
      maxLength={10}
      problem={problem}
      onSave={onSave}
      onClose={onClose}
      {...props}
    />,
  );
  return [onSave, onClose];
}

function field(): HTMLInputElement {
  return screen.getByRole("textbox", { name: LABELS.field });
}

describe("Nickname", () => {
  test("is a dialog named by its heading, the field holding the name now", () => {
    card();
    expect(
      screen.getByRole("dialog", { name: LABELS.heading }),
    ).toHaveAccessibleDescription(LABELS.intro);
    expect(field()).toHaveValue("NutmegNina");
    expect(field()).toHaveAttribute("maxlength", "10");
    expect(field()).toHaveAccessibleDescription(LABELS.rules);
  });

  test("a name that cannot be used says why, and the card stays up", () => {
    const [onSave, onClose] = card();
    fireEvent.change(field(), { target: { value: "Jo" } });
    fireEvent.click(screen.getByRole("button", { name: LABELS.save }));
    expect(screen.getByText("Too short.")).toBeInTheDocument();
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field()).toHaveAccessibleDescription(`Too short. ${LABELS.rules}`);
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // Typing again takes the words away.
    fireEvent.change(field(), { target: { value: "Joe" } });
    expect(screen.queryByText("Too short.")).toBeNull();
  });

  test("SAVE keeps a good name and closes the card; so does Enter", () => {
    const [onSave, onClose] = card();
    fireEvent.change(field(), { target: { value: "TopBins" } });
    act(() => {
      fireEvent.submit(field().closest("form") as HTMLFormElement);
    });
    expect(onSave).toHaveBeenCalledWith("TopBins");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("closed, there is nothing; at build time it renders nothing either", () => {
    const html = renderToString(
      <Nickname
        labels={LABELS}
        open={false}
        name="NutmegNina"
        maxLength={10}
        problem={problem}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    expect(html).toBe("");
  });
});
