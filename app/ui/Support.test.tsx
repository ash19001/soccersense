import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, test, vi } from "vitest";

import { COFFEE_URL, IDEAS_URL, usableLink } from "~/data/links";
import { strings } from "~/i18n";

import { MenuCaptions } from "./MenuCaptions";
import { Support, type SupportLabels } from "./Support";

const LABELS: SupportLabels = strings.support;

/** A disabled button's name: its words, then "COMING SOON". */
function soon(words: string): RegExp {
  return new RegExp(`^${words}\\W+${LABELS.soon}$`);
}

describe("the Support links", () => {
  test("the two in app/data/links.ts are still placeholders", () => {
    expect(usableLink(IDEAS_URL)).toBeNull();
    expect(usableLink(COFFEE_URL)).toBeNull();
  });

  test("a real page or address is used as it is", () => {
    expect(usableLink("https://forms.soccersense.app/ideas")).toBe(
      "https://forms.soccersense.app/ideas",
    );
    expect(usableLink(" http://ko-fi.test.app/x ")).toBe(
      "http://ko-fi.test.app/x",
    );
    expect(usableLink("mailto:ideas@soccersense.app")).toBe(
      "mailto:ideas@soccersense.app",
    );
  });

  test("placeholders, empty and unsafe links are not", () => {
    for (const url of [
      "",
      "not a link",
      "https://example.com/coffee",
      "https://www.example.org/ideas",
      "https://ideas.example",
      "https://site.invalid/",
      "mailto:someone@example.com",
      "mailto:nobody",
      "javascript:alert(1)",
      "ftp://soccersense.app/",
    ]) {
      expect(usableLink(url), url).toBeNull();
    }
  });
});

/** The home screen's part: the heart in the captions and the pop-up it opens. */
function Host({
  ideas,
  coffee,
  onClose,
}: {
  ideas: string | null;
  coffee: string | null;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const heart = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <MenuCaptions
        modes={[
          { mode: "home", label: "HOME", line: "Common" },
          { mode: "away", label: "AWAY", line: "Uncommon" },
        ]}
        howToPlay={{ label: "How to play", onClick: () => {} }}
        dayLabel="DAY 2"
        sound={false}
        remind={{ label: "Remind me", onClick: () => {} }}
        support={{ label: LABELS.open, onClick: () => setOpen(true), open }}
        supportRef={heart}
      />
      <Support
        labels={LABELS}
        ideas={ideas}
        coffee={coffee}
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        returnFocus={heart}
      />
    </>
  );
}

function openIt(
  links: { ideas: string | null; coffee: string | null },
  onClose?: () => void,
) {
  render(<Host {...links} onClose={onClose} />);
  const opener = screen.getByRole("button", { name: LABELS.open });
  act(() => opener.focus());
  fireEvent.click(opener);
  const dialog = document.querySelector("dialog");
  if (!dialog) throw new Error("no dialog");
  return { opener, dialog };
}

const NONE = { ideas: null, coffee: null };
const BOTH = {
  ideas: "https://forms.soccersense.app/ideas",
  coffee: "https://coffee.soccersense.app/",
};

describe("the Support button", () => {
  test("is a heart under the bell, beside the day plate", () => {
    openIt(NONE);
    const heart = screen.getByRole("button", { name: LABELS.open });
    const bell = screen.getByRole("button", { name: "Remind me" });
    expect(bell.nextElementSibling).toBe(heart);
    expect(heart.closest(".ss-menu__day")).not.toBeNull();
    expect(heart).toHaveAttribute("title", LABELS.open);
    expect(heart).toHaveAttribute("aria-haspopup", "dialog");
    expect(heart).toHaveAttribute("aria-expanded", "true");
  });
});

describe("Support", () => {
  test("is nothing while it is not open", () => {
    render(
      <Support labels={LABELS} {...NONE} open={false} onClose={() => {}} />,
    );
    expect(document.querySelector("dialog")).toBeNull();
  });

  test("opens as a modal dialog named by its heading, the thanks as its description", () => {
    const { dialog } = openIt(NONE);
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveClass("ss-help-dialog");
    expect(dialog).toHaveAccessibleName(LABELS.heading);
    expect(dialog).toHaveAccessibleDescription(LABELS.intro);
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  test("a link not set yet is a button that says Coming soon and cannot be pressed", () => {
    openIt(NONE);
    for (const words of [LABELS.idea, LABELS.coffee]) {
      const button = screen.getByRole("button", { name: soon(words) });
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent(LABELS.soon);
    }
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  test("a link that is set opens in a new tab, and says so", () => {
    openIt(BOTH);
    const idea = screen.getByRole("link", { name: new RegExp(LABELS.idea) });
    const coffee = screen.getByRole("link", {
      name: new RegExp(LABELS.coffee),
    });
    expect(idea).toHaveAttribute("href", BOTH.ideas);
    expect(coffee).toHaveAttribute("href", BOTH.coffee);
    for (const link of [idea, coffee]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAccessibleName(expect.stringContaining(LABELS.newTab));
      expect(link).toHaveClass("ss-btn");
      expect(link).not.toHaveTextContent(LABELS.soon);
    }
    expect(coffee).toHaveClass("ss-btn--primary");
  });

  test("one set and one not", () => {
    openIt({ ideas: BOTH.ideas, coffee: null });
    expect(
      screen.getByRole("link", { name: new RegExp(LABELS.idea) }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: soon(LABELS.coffee) }),
    ).toBeDisabled();
  });

  test("closes by its close button and Escape, and the focus goes back to the heart", () => {
    const onClose = vi.fn();
    const { opener } = openIt(NONE, onClose);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector("dialog")).toBeNull();
    expect(opener).toHaveFocus();
    expect(opener).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(opener);
    fireEvent.keyDown(screen.getByRole("button", { name: "Close" }), {
      key: "Escape",
    });
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(opener).toHaveFocus();
  });

  test("keeps the focus inside: with neither link set, Tab stays on the close button", () => {
    openIt(NONE);
    const close = screen.getByRole("button", { name: "Close" });
    expect(fireEvent.keyDown(close, { key: "Tab" })).toBe(false);
    expect(close).toHaveFocus();
  });
});
