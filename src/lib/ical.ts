// Minimal, dependency-free ICS (RFC 5545) reader/writer — just enough for
// OTA availability calendars: all-day VEVENTs with UID/DTSTART/DTEND/SUMMARY.
// Deliberately not a general-purpose iCal library (no recurrence rules, no
// VTIMEZONE/VALARM support) — every OTA export feed we target (Booking.com,
// Airbnb, Agoda) uses plain all-day date-blocking events, and full RFC 5545
// support would be a large dependency for a feature this narrow.

export type IcsEvent = {
  uid: string;
  startDate: Date; // UTC-midnight, inclusive
  endDate: Date; // UTC-midnight, exclusive (per the all-day VEVENT convention)
  summary?: string;
};

function unfoldLines(text: string): string[] {
  // RFC 5545 line folding: a continuation line starts with a space or tab
  // and should be joined onto the previous line with that leading char removed.
  const rawLines = text.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function parseIcsDate(value: string): Date | null {
  // All-day: YYYYMMDD. Date-time: YYYYMMDDTHHMMSS(Z)? — we only ever need
  // the calendar date, never the time-of-day, for availability blocking.
  const match = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) {
    return null;
  }
  const [, y, m, d] = match;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

export function parseIcs(text: string): IcsEvent[] {
  const lines = unfoldLines(text);
  const events: IcsEvent[] = [];
  let current: Partial<IcsEvent> | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current?.uid && current.startDate && current.endDate) {
        events.push({
          uid: current.uid,
          startDate: current.startDate,
          endDate: current.endDate,
          summary: current.summary,
        });
      }
      current = null;
      continue;
    }
    if (!current) {
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }
    const rawKey = line.slice(0, colonIndex);
    const value = line.slice(colonIndex + 1);
    const key = rawKey.split(";")[0].toUpperCase();

    if (key === "UID") {
      current.uid = value;
    } else if (key === "SUMMARY") {
      current.summary = value;
    } else if (key === "DTSTART") {
      const d = parseIcsDate(value);
      if (d) current.startDate = d;
    } else if (key === "DTEND") {
      const d = parseIcsDate(value);
      if (d) current.endDate = d;
    }
  }

  return events;
}

function formatIcsDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function formatIcsDateTime(date: Date): string {
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${formatIcsDate(date)}T${hh}${mm}${ss}Z`;
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildIcs(params: {
  calendarName: string;
  events: { uid: string; startDate: Date; endDate: Date; summary: string }[];
}): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hotel Manager//Availability Export//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcsText(params.calendarName)}`,
  ];

  const stamp = formatIcsDateTime(new Date());
  for (const event of params.events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${formatIcsDate(event.startDate)}`,
      `DTEND;VALUE=DATE:${formatIcsDate(event.endDate)}`,
      `SUMMARY:${escapeIcsText(event.summary)}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
