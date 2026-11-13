import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { type ReactNode, useRef, useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, onTestFinished, test, vi } from "vitest";

import { strings } from "~/i18n";

import { MenuCaptions } from "./MenuCaptions";
import { RemindMe, type RemindMeLabels } from "./RemindMe";
import {
  DEFAULT_REMINDER_TIME,
  REMINDER_FILE,
  REMINDER_TIMES,
  type ReminderEvent,
  firstReminder,
  googleCalendarUrl,
  outlookCalendarUrl,
  parseTime,
  reminderIcs,
} from "./reminder";
import { DEFAULT_SCALE, PixelScaleContext, pixelScale } from "./scale";

const LABELS: RemindMeLabels = strings.remind;
const SITE = "https://soccersense.test/";

const EVENT: ReminderEvent = {
  time: "09:00",
  title: "Play soccersense",
  details: "Seven questions, today: https://soccersense.test/",
  url: SITE,
};

/** 13 November 2026, on the device's own clock. */
function local(h: number, m = 0, day = 13, month = 10): Date {
  return new Date(2026, month, day, h, m);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the reminder's times", () => {
  test("every half hour of the day is on offer, 09:00 picked first", () => {
    expect(REMINDER_TIMES).toHaveLength(48);
    expect(REMINDER_TIMES[0]).toBe("00:00");
    expect(REMINDER_TIMES[1]).toBe("00:30");
    expect(REMINDER_TIMES.at(-1)).toBe("23:30");
    expect(REMINDER_TIMES).toContain(DEFAULT_REMINDER_TIME);
  });

  test("reads a time of day, and nothing else", () => {
    expect(parseTime("09:30")).toEqual({ h: 9, m: 30 });
    expect(parseTime("7:05")).toEqual({ h: 7, m: 5 });
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("12:60")).toBeNull();
    expect(parseTime("noon")).toBeNull();
  });

  test("goes off first today if the time is still ahead, else tomorrow", () => {
    expect(firstReminder(local(8, 15), "09:00")).toEqual({
      y: 2026,
      mo: 11,
      d: 13,
      h: 9,
      mi: 0,
    });
    expect(firstReminder(local(9, 0), "09:00")).toMatchObject({ d: 14 });
    expect(firstReminder(local(21, 0), "09:00")).toMatchObject({ d: 14 });
    // the end of a month and of a year roll on
    expect(firstReminder(local(22, 0, 31, 11), "07:30")).toEqual({
      y: 2027,
      mo: 1,
      d: 1,
      h: 7,
      mi: 30,
    });
  });
});

describe("the calendar file", () => {
  const ics = reminderIcs(EVENT, local(14, 0));
  const lines = ics.split("\r\n");

  test("is one event that repeats every day, at a floating time, with an alert", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("BEGIN:VEVENT");
    // tomorrow at 09:00, no time zone: 09:00 wherever the calendar is
    expect(lines).toContain("DTSTART:20261114T090000");
    expect(lines).toContain("DTEND:20261114T091500");
    expect(lines).toContain("RRULE:FREQ=DAILY");
    expect(lines).toContain("SUMMARY:Play soccersense");
    expect(lines).toContain(`URL:${SITE}`);
    expect(lines).toContain("BEGIN:VALARM");
    expect(lines).toContain("TRIGGER:PT0M");
    expect(lines.filter((l) => l === "END:VEVENT")).toHaveLength(1);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  test("is stamped in UTC and has one UID per time of day", () => {
    expect(ics).toMatch(/\r\nDTSTAMP:\d{8}T\d{6}Z\r\n/);
    expect(lines).toContain("UID:daily-0900@soccersense");
    expect(reminderIcs({ ...EVENT, time: "18:30" }, local(14))).toContain(
      "UID:daily-1830@soccersense",
    );
  });

  test("escapes the text and folds long lines at 75 bytes", () => {
    const long = reminderIcs(
      {
        ...EVENT,
        title: "Play, now; or later\\never",
        details: `Line one\nLine two, ${"é".repeat(60)}`,
      },
      local(14),
    );
    expect(long).toContain("SUMMARY:Play\\, now\\; or later\\\\never");
    expect(long).toContain("DESCRIPTION:Line one\\nLine two\\, ");
    const encoder = new TextEncoder();
    for (const line of long.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    // unfolded, the description is whole again
    const unfolded = long.replace(/\r\n /g, "");
    expect(unfolded).toContain(`Line two\\, ${"é".repeat(60)}`);
  });
});

describe("the calendars on the web", () => {
  test("Google: the event filled in, every day, in the device's time zone", () => {
    const url = new URL(googleCalendarUrl(EVENT, local(8), "Europe/London"));
    expect(url.origin).toBe("https://calendar.google.com");
    const q = url.searchParams;
    expect(q.get("action")).toBe("TEMPLATE");
    expect(q.get("text")).toBe("Play soccersense");
    expect(q.get("details")).toBe(EVENT.details);
    expect(q.get("dates")).toBe("20261113T090000/20261113T091500");
    expect(q.get("recur")).toBe("RRULE:FREQ=DAILY");
    expect(q.get("ctz")).toBe("Europe/London");
    expect(
      new URL(googleCalendarUrl(EVENT, local(8))).searchParams.has("ctz"),
    ).toBe(false);
  });

  test("Outlook: the event filled in (it cannot be told to repeat)", () => {
    const url = new URL(outlookCalendarUrl(EVENT, local(14)));
    expect(url.origin).toBe("https://outlook.live.com");
    const q = url.searchParams;
    expect(q.get("rru")).toBe("addevent");
    expect(q.get("subject")).toBe("Play soccersense");
    expect(q.get("body")).toBe(EVENT.details);
    expect(q.get("startdt")).toBe("2026-11-14T09:00:00");
    expect(q.get("enddt")).toBe("2026-11-14T09:15:00");
  });
});

const MONITOR = pixelScale(1920, 1080);

function at(scale: typeof MONITOR, node: ReactNode) {
  return <PixelScaleContext value={scale}>{node}</PixelScaleContext>;
}

/** The home screen's part: the bell in the captions and the pop-up it opens. */
function Host({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const bell = useRef<HTMLButtonElement | null>(null);
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
        stats={{ label: "Your stats", onClick: () => {} }}
        remind={{ label: LABELS.open, onClick: () => setOpen(true), open }}
        remindRef={bell}
      />
      <RemindMe
        labels={LABELS}
        url={SITE}
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        returnFocus={bell}
      />
    </>
  );
}

function openIt(scale = DEFAULT_SCALE, onClose?: () => void) {
  render(at(scale, <Host onClose={onClose} />));
  const opener = screen.getByRole("button", { name: "Remind me" });
  act(() => opener.focus());
  fireEvent.click(opener);
  const dialog = document.querySelector("dialog");
  if (!dialog) throw new Error("no dialog");
  return { opener, dialog };
}

describe("the Remind me button", () => {
  test("is a bell beside the day plate, named for screen readers", () => {
    openIt();
    const bell = screen.getByRole("button", { name: "Remind me" });
    expect(bell.closest(".ss-menu__day")).not.toBeNull();
    expect(bell.closest(".ss-menu__more")).not.toBeNull();
    expect(bell).toHaveAttribute("title", "Remind me");
    expect(bell).toHaveAttribute("aria-haspopup", "dialog");
    expect(bell).toHaveAttribute("aria-expanded", "true");
    expect(bell.querySelector("svg")).not.toBeNull();
    // the stats button is still the last thing beside the cards
    expect(document.querySelector(".ss-menu__side")?.lastElementChild).toBe(
      screen.getByRole("button", { name: "Your stats" }),
    );
  });

  test("is not there unless asked for", () => {
    render(
      <MenuCaptions
        modes={[]}
        howToPlay={{ label: "How to play" }}
        dayLabel="DAY 2"
      />,
    );
    expect(document.querySelector(".ss-menu__more")).toBeNull();
  });
});

describe("RemindMe", () => {
  test("is nothing while it is not open, and nothing at build time", () => {
    render(<RemindMe labels={LABELS} open={false} onClose={() => {}} />);
    expect(document.querySelector("dialog")).toBeNull();
    expect(
      renderToString(
        <RemindMe labels={LABELS} open={false} onClose={() => {}} />,
      ),
    ).toBe("");
  });

  test("opens as a modal dialog named by its heading, the focus on its close button", () => {
    const { dialog } = openIt();
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveClass("ss-help-dialog");
    expect(dialog).toHaveAccessibleName(LABELS.heading);
    expect(dialog).toHaveAccessibleDescription(LABELS.intro);
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  test("a monitor gets the card in the middle over a dither", () => {
    const { dialog } = openIt(MONITOR);
    expect(dialog).toHaveAttribute("data-wide");
    expect(dialog.querySelector(".ss-help-dialog__dither")).not.toBeNull();
  });

  test("picks 09:00 first, and the calendars follow the time picked", () => {
    openIt();
    const time = screen.getByRole("combobox", { name: LABELS.time });
    expect(time).toHaveValue("09:00");
    expect(time.querySelectorAll("option")).toHaveLength(48);
    fireEvent.change(time, { target: { value: "18:30" } });
    const google = screen.getByRole("link", { name: /GOOGLE/ });
    const outlook = screen.getByRole("link", { name: /OUTLOOK/ });
    expect(
      new URL(google.getAttribute("href") ?? "").searchParams.get("dates"),
    ).toMatch(/T183000\/\d{8}T184500$/);
    expect(
      new URL(outlook.getAttribute("href") ?? "").searchParams.get("startdt"),
    ).toMatch(/T18:30:00$/);
  });

  test("the two calendars open in a new tab, and say so", () => {
    openIt();
    for (const name of [/GOOGLE/, /OUTLOOK/]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAccessibleName(expect.stringContaining(LABELS.newTab));
      expect(link).toHaveClass("ss-btn");
    }
    const details = new URL(
      screen.getByRole("link", { name: /GOOGLE/ }).getAttribute("href") ?? "",
    ).searchParams.get("details");
    expect(details).toBe(LABELS.event.details(SITE));
    expect(details).toContain(SITE);
  });

  test("saves the calendar file on the device and says so", async () => {
    let made: Blob | null = null;
    // The test DOM has no object URLs: lend it a pair for this test only.
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: (blob: Blob) => {
        made = blob;
        return "blob:reminder";
      },
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: () => {},
    });
    onTestFinished(() => {
      Reflect.deleteProperty(URL, "createObjectURL");
      Reflect.deleteProperty(URL, "revokeObjectURL");
    });
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });
    const { dialog } = openIt();
    const status = within(dialog).getByRole("status");
    expect(status).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("button", { name: LABELS.file }));
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe(REMINDER_FILE);
    expect(clicked[0].getAttribute("href")).toBe("blob:reminder");
    expect(clicked[0].isConnected).toBe(false);
    expect(made).not.toBeNull();
    const blob = made as unknown as Blob;
    expect(blob.type).toBe("text/calendar;charset=utf-8");
    const text = await blob.text();
    expect(text).toContain("RRULE:FREQ=DAILY");
    expect(text).toMatch(/DTSTART:\d{8}T090000\r\n/);
    expect(status).toHaveTextContent(LABELS.saved(REMINDER_FILE));
  });

  test("says email reminders are coming, and asks for no address", () => {
    const { dialog } = openIt();
    expect(screen.getByText(LABELS.email)).toBeInTheDocument();
    expect(dialog.querySelector("input")).toBeNull();
  });

  test("closes by its close button, and the focus goes back to the bell", () => {
    const onClose = vi.fn();
    const { opener } = openIt(DEFAULT_SCALE, onClose);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector("dialog")).toBeNull();
    expect(opener).toHaveFocus();
    expect(opener).toHaveAttribute("aria-expanded", "false");
  });

  test("closes by a press outside the card, not by one on it", () => {
    const onClose = vi.fn();
    const { dialog } = openIt(DEFAULT_SCALE, onClose);
    const intro = screen.getByText(LABELS.intro);
    fireEvent.pointerDown(intro);
    fireEvent.click(intro);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(dialog);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("closes by Escape, and the focus goes back to the bell", () => {
    const onClose = vi.fn();
    const { opener } = openIt(DEFAULT_SCALE, onClose);
    fireEvent.keyDown(screen.getByRole("button", { name: "Close" }), {
      key: "Escape",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(opener).toHaveFocus();
  });

  test("keeps the focus inside: Tab from the last stop goes back to the first", () => {
    openIt();
    const close = screen.getByRole("button", { name: "Close" });
    const outlook = screen.getByRole("link", { name: /OUTLOOK/ });
    act(() => outlook.focus());
    expect(fireEvent.keyDown(outlook, { key: "Tab" })).toBe(false);
    expect(close).toHaveFocus();
    expect(fireEvent.keyDown(close, { key: "Tab", shiftKey: true })).toBe(
      false,
    );
    expect(outlook).toHaveFocus();
  });
});
