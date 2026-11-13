// The daily reminder the Remind me pop-up adds to a calendar (RemindMe.tsx): a calendar
// file (.ics) made on the device, and the addresses that open Google Calendar and Outlook
// on the web with the event filled in. Pure: the time of day, the moment of the press and
// the words are all passed in.
//
// The event is at a FLOATING time (no time zone): 09:00 wherever the player's calendar is.
// That is what a daily reminder means, and it keeps working when the clocks change.

export interface ReminderEvent {
  /** The time of day it goes off: "09:00". */
  time: string;
  /** Its title in the calendar: "Play soccersense". */
  title: string;
  /** Its notes: what to play, and the address. */
  details: string;
  /** The site's address, also given to the calendar as the event's link. */
  url: string;
  /** How long it lasts, in minutes (default 15). */
  minutes?: number;
}

/** The times on offer: every half hour of the day, "00:00" to "23:30". */
export const REMINDER_TIMES: readonly string[] = Array.from(
  { length: 48 },
  (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 === 0 ? "00" : "30"}`,
);

/** The time picked when the pop-up opens. */
export const DEFAULT_REMINDER_TIME = "09:00";

/** The file's name when it is saved. */
export const REMINDER_FILE = "soccersense-reminder.ics";

const DEFAULT_MINUTES = 15;

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/** "09:30" as hours and minutes, or null if it is not a time of day. */
export function parseTime(time: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

/** A moment on the device's own clock (local time), without a time zone. */
interface LocalMoment {
  y: number;
  mo: number; // 1 to 12
  d: number;
  h: number;
  mi: number;
}

/**
 * The first time the reminder goes off: today at `time` if that is still ahead of `now`
 * (on the device's clock), otherwise tomorrow. A time that is not one counts as 09:00.
 */
export function firstReminder(now: Date, time: string): LocalMoment {
  const { h, m } = parseTime(time) ?? { h: 9, m: 0 };
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  if (day.getTime() <= now.getTime()) day.setDate(day.getDate() + 1);
  return {
    y: day.getFullYear(),
    mo: day.getMonth() + 1,
    d: day.getDate(),
    h,
    mi: m,
  };
}

/** The same moment `minutes` later (the calendar's arithmetic, so a month's end rolls on). */
function later(at: LocalMoment, minutes: number): LocalMoment {
  const t = new Date(Date.UTC(at.y, at.mo - 1, at.d, at.h, at.mi + minutes));
  return {
    y: t.getUTCFullYear(),
    mo: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
    h: t.getUTCHours(),
    mi: t.getUTCMinutes(),
  };
}

/** "20261114T090000": a floating date and time, as calendars write it. */
function basic(at: LocalMoment): string {
  return `${pad(at.y, 4)}${pad(at.mo)}${pad(at.d)}T${pad(at.h)}${pad(at.mi)}00`;
}

/** "2026-11-14T09:00:00" */
function extended(at: LocalMoment): string {
  return `${pad(at.y, 4)}-${pad(at.mo)}-${pad(at.d)}T${pad(at.h)}:${pad(at.mi)}:00`;
}

/** "20261113T141500Z": a moment in UTC. */
function stamp(now: Date): string {
  return (
    `${pad(now.getUTCFullYear(), 4)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  );
}

/** A value in an .ics file: backslashes, semicolons, commas and line breaks escaped. */
function icsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Lines of an .ics file are at most 75 bytes; a longer one goes on in the next line, which
 * starts with a space (RFC 5545, 3.1). Never splits a character.
 */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/**
 * The calendar file: one event that repeats every day from its first time on, with an
 * alert when it starts. The same time of day always has the same UID, so adding it again
 * at that time updates it instead of making a second one (in calendars that look).
 */
export function reminderIcs(event: ReminderEvent, now: Date): string {
  const start = firstReminder(now, event.time);
  const end = later(start, event.minutes ?? DEFAULT_MINUTES);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//soccersense//Daily reminder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:daily-${pad(start.h)}${pad(start.mi)}@soccersense`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${basic(start)}`,
    `DTEND:${basic(end)}`,
    "RRULE:FREQ=DAILY",
    `SUMMARY:${icsText(event.title)}`,
    `DESCRIPTION:${icsText(event.details)}`,
    `URL:${event.url}`,
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(event.title)}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/**
 * Google Calendar's "new event" page with the event filled in, repeating daily. The times
 * are floating, so they are read in the calendar's own time zone; `timeZone` (the device's,
 * an IANA name) pins them to it instead when given.
 */
export function googleCalendarUrl(
  event: ReminderEvent,
  now: Date,
  timeZone?: string,
): string {
  const start = firstReminder(now, event.time);
  const end = later(start, event.minutes ?? DEFAULT_MINUTES);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    details: event.details,
    dates: `${basic(start)}/${basic(end)}`,
    recur: "RRULE:FREQ=DAILY",
  });
  if (timeZone) params.set("ctz", timeZone);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Outlook on the web's "new event" page with the event filled in. Its link cannot say that
 * the event repeats: the pop-up asks the player to set that (or to use the file).
 */
export function outlookCalendarUrl(event: ReminderEvent, now: Date): string {
  const start = firstReminder(now, event.time);
  const end = later(start, event.minutes ?? DEFAULT_MINUTES);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    body: event.details,
    startdt: extended(start),
    enddt: extended(end),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
