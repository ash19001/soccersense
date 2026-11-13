import { type RefObject, useId, useState } from "react";

import { Button } from "./Button";
import type { Bitmap } from "./PixelGlyph";
import { Popup } from "./Popup";
import {
  DEFAULT_REMINDER_TIME,
  REMINDER_FILE,
  REMINDER_TIMES,
  type ReminderEvent,
  googleCalendarUrl,
  outlookCalendarUrl,
  reminderIcs,
} from "./reminder";

/** A bell: the Remind me button's icon, 9 x 9 like the kit's others. */
export const BELL: Bitmap = [
  "....#....",
  "...###...",
  "..#####..",
  "..#####..",
  "..#####..",
  ".#######.",
  "#########",
  ".........",
  "...###...",
];

export interface RemindMeLabels {
  /** The button's name and tooltip: "Remind me". */
  open: string;
  /** The card's heading, and the dialog's name: "DAILY REMINDER". */
  heading: string;
  close: string;
  /** The line under the heading, and the dialog's description. */
  intro: string;
  /** The time picker's label: "TIME". */
  time: string;
  /** The calendar file's button: "DOWNLOAD .ICS FILE". */
  file: string;
  /** Under it: what the file is for. */
  fileNote: string;
  google: string;
  outlook: string;
  /** Under the two: Outlook's link cannot repeat the event by itself. */
  outlookNote: string;
  /** Read out after a link's name: "(opens in a new tab)". */
  newTab: string;
  /** Announced once the file is saved. */
  saved: (file: string) => string;
  /** The quiet line at the foot: "Email reminders are coming." */
  email: string;
  /** The event in the calendar. */
  event: {
    title: string;
    /** Its notes, with the site's address. */
    details: (url: string) => string;
  };
}

export interface RemindMeProps {
  labels: RemindMeLabels;
  open: boolean;
  /** The close button, Escape or a press outside: called once the card has gone. */
  onClose(): void;
  /** Where the focus goes back to on closing: the Remind me button. */
  returnFocus?: RefObject<HTMLElement | null>;
  /** The site's address in the event. Default: this page's own site, read on opening. */
  url?: string;
  /** The times on offer (default every half hour) and the one picked at first ("09:00"). */
  times?: readonly string[];
  defaultTime?: string;
}

/** The address of the site the page is on: its origin and "/". */
function siteAddress(): string {
  try {
    return new URL("/", window.location.href).href;
  } catch {
    return "";
  }
}

/** The device's time zone (an IANA name), if the browser says. */
function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** Saves `text` as a file named `name`, made on the device: nothing is sent anywhere. */
function saveFile(name: string, text: string, type: string): void {
  const link = document.createElement("a");
  let address: string;
  let made = false;
  if (typeof Blob === "function" && typeof URL.createObjectURL === "function") {
    address = URL.createObjectURL(new Blob([text], { type }));
    made = true;
  } else {
    address = `data:${type},${encodeURIComponent(text)}`;
  }
  link.href = address;
  link.download = name;
  link.rel = "noopener";
  link.style.display = "none";
  // Not a button: the click sound has already played for the press that got here.
  document.body.append(link);
  link.click();
  link.remove();
  if (made) window.setTimeout(() => URL.revokeObjectURL(address), 30_000);
}

/**
 * The Remind me pop-up (a `Popup`): the player picks a time of day and adds a reminder that
 * repeats every day to their calendar, three ways: a calendar file (.ics) made on the
 * device and saved, or Google Calendar or Outlook on the web opened in a new tab with the
 * event filled in. The event says what to play and links to the site. Nothing is sent
 * anywhere and no address is asked for; a quiet line says email reminders are coming.
 */
export function RemindMe({ open, ...rest }: RemindMeProps) {
  return open ? <Card {...rest} /> : null;
}

function Card({
  labels,
  onClose,
  returnFocus,
  url,
  times = REMINDER_TIMES,
  defaultTime = DEFAULT_REMINDER_TIME,
}: Omit<RemindMeProps, "open">) {
  const timeId = useId();
  // Read once, when the pop-up opens (never at build time: it is only rendered open).
  const [now] = useState(() => new Date());
  const [site] = useState(() => url ?? siteAddress());
  const [zone] = useState(deviceTimeZone);
  const [time, setTime] = useState(() =>
    times.includes(defaultTime) ? defaultTime : (times[0] ?? defaultTime),
  );
  const [saved, setSaved] = useState<string | null>(null);

  const event: ReminderEvent = {
    time,
    title: labels.event.title,
    details: labels.event.details(site),
    url: site,
  };

  const download = () => {
    saveFile(
      REMINDER_FILE,
      reminderIcs(event, new Date()),
      "text/calendar;charset=utf-8",
    );
    setSaved(labels.saved(REMINDER_FILE));
  };

  return (
    <Popup
      open
      heading={labels.heading}
      intro={labels.intro}
      close={labels.close}
      onClose={onClose}
      returnFocus={returnFocus}
      className="ss-remind"
    >
      <div className="ss-remind__time">
        <label htmlFor={timeId} className="ss-popup__k">
          {labels.time}
        </label>
        <span className="ss-remind__pick">
          <select
            id={timeId}
            className="ss-remind__select"
            value={time}
            onChange={(e) => {
              setTime(e.currentTarget.value);
              setSaved(null);
            }}
          >
            {times.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </span>
      </div>
      <div className="ss-popup__ways">
        <Button variant="primary" full onClick={download}>
          {labels.file}
        </Button>
        <p className="ss-popup__note">{labels.fileNote}</p>
        <div className="ss-remind__links">
          <a
            className="ss-btn ss-btn--secondary ss-btn--full"
            href={googleCalendarUrl(event, now, zone)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="ss-btn__label">
              {labels.google}
              <span className="ss-sr"> {labels.newTab}</span>
            </span>
          </a>
          <a
            className="ss-btn ss-btn--secondary ss-btn--full"
            href={outlookCalendarUrl(event, now)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="ss-btn__label">
              {labels.outlook}
              <span className="ss-sr"> {labels.newTab}</span>
            </span>
          </a>
        </div>
        <p className="ss-popup__note">{labels.outlookNote}</p>
      </div>
      <p className="ss-popup__status" role="status" aria-live="polite">
        {saved}
      </p>
      <p className="ss-popup__quiet">{labels.email}</p>
    </Popup>
  );
}
