import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { Review, type ReviewProps } from "./Review";
import { PixelScaleContext, pixelScale } from "./scale";

const props: ReviewProps = {
  labels: {
    heading: "YOUR HOME GAME",
    intro: "Today's answers.",
    close: "Close",
  },
  mode: "home",
  total: 350,
  maxTotal: 700,
  totalSpoken: "350 out of 700",
  careerTitle: "LOWER LEAGUES",
  earnedTitle: "SEASON TICKET HOLDER",
  earnedTitleSpoken: "Your title",
  results: [
    { grade: "worldie", points: 100, answer: "Arsenal", label: "WORLDIE" },
    { grade: "timeup", points: 0, answer: "Time's up" },
  ],
  resultsLabel: "Your answers",
  open: true,
  onClose: () => {},
};

describe("Review", () => {
  test("is a dialog named by its heading, with the score, the titles and the answers", () => {
    render(<Review {...props} />);
    const dialog = screen.getByRole("dialog", { name: "YOUR HOME GAME" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Today's answers.")).toBeInTheDocument();
    expect(screen.getByLabelText("350 out of 700")).toBeInTheDocument();
    expect(screen.getByText("SEASON TICKET HOLDER")).toHaveClass(
      "ss-full__title",
    );
    expect(screen.getByText("LOWER LEAGUES")).toHaveClass("ss-review__career");
    const list = screen.getByRole("list", { name: "Your answers" });
    const rows = list.querySelectorAll("li");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("data-grade", "worldie");
    expect(rows[0]).toHaveTextContent("Arsenal");
    expect(rows[0]).toHaveTextContent("WORLDIE");
    expect(rows[0]).toHaveTextContent("100");
    expect(rows[1]).toHaveTextContent("Time's up");
  });

  test("closes from its close button, and is nothing while shut", () => {
    const onClose = vi.fn();
    const { rerender } = render(<Review {...props} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<Review {...props} open={false} onClose={onClose} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("its answers keep the smaller font pixel where the card is in bigger caption pixels", () => {
    const card = (w: number, h: number) => {
      const { unmount } = render(
        <PixelScaleContext value={pixelScale(w, h)}>
          <Review {...props} />
        </PixelScaleContext>,
      );
      const caption = document
        .querySelector(".ss-review")
        ?.classList.contains("ss-review--caption");
      unmount();
      return caption;
    };
    // A monitor: caption pixels of 2, font pixels of 1.
    expect(card(1920, 1080)).toBe(true);
    // 1280 x 720: both 1, nothing to keep. A phone: no caption pixels at all.
    expect(card(1280, 720)).toBe(false);
    expect(card(402, 874)).toBe(false);
  });

  test("SHARE is an icon beside the close button, a green tick once it has worked, and the words are only read out", () => {
    // The review has no line under its heading (2026-11-13).
    const bare: ReviewProps = {
      ...props,
      labels: { heading: props.labels.heading, close: props.labels.close },
    };
    const onShare = vi.fn();
    const { rerender } = render(
      <Review
        {...bare}
        share={{ label: "Share your HOME game", onClick: onShare }}
      />,
    );
    const share = screen.getByRole("button", { name: "Share your HOME game" });
    const close = screen.getByRole("button", { name: "Close" });
    expect(share).toHaveClass("ss-btn--icon", "ss-popup__action");
    expect(share).toHaveTextContent("");
    expect(share.nextElementSibling).toBe(close);
    fireEvent.click(share);
    expect(onShare).toHaveBeenCalledTimes(1);
    // How it went is only read out: the live region is out of sight.
    const status = screen.getByRole("status");
    expect(status).toHaveClass("ss-sr");
    // No line under the heading.
    expect(document.querySelector(".ss-popup__intro")).toBeNull();
    expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-describedby");

    // Busy while its picture is made: pressed, it does nothing.
    rerender(
      <Review
        {...bare}
        share={{ label: "Share your HOME game", onClick: onShare, busy: true }}
        status="Making your picture..."
      />,
    );
    fireEvent.click(share);
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(share).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Making your picture...");
    expect(status).toHaveClass("ss-sr");
    expect(share).not.toHaveClass("is-done");

    // It worked: a tick, in green, for a moment.
    rerender(
      <Review
        {...bare}
        share={{ label: "Share your HOME game", onClick: onShare, done: true }}
        status="Picture saved, result copied."
      />,
    );
    expect(share).toHaveClass("is-done");
    expect(status).toHaveTextContent("Picture saved, result copied.");
    expect(status).toHaveClass("ss-sr");
  });
});
