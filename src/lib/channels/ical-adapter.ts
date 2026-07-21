import { parseIcs, buildIcs } from "@/lib/ical";
import { dateKey } from "@/lib/dates";
import type { ChannelAdapter, AvailabilityExportInput } from "./adapter";

const FETCH_TIMEOUT_MS = 15_000;

export class IcsFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IcsFetchError";
  }
}

// The only concrete adapter in V1. A future direct-API adapter (e.g. for a
// channel that offers a real booking API instead of a calendar export)
// implements the same ChannelAdapter interface and swaps in per-connection
// without touching sync orchestration, the UI, or the availability guard.
export const iCalAdapter: ChannelAdapter = {
  async import(importUrl) {
    let response: Response;
    try {
      response = await fetch(importUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch (error) {
      throw new IcsFetchError(`Could not reach the calendar URL (${(error as Error).message}).`);
    }
    if (!response.ok) {
      throw new IcsFetchError(`Calendar URL returned HTTP ${response.status}.`);
    }

    const text = await response.text();
    const events = parseIcs(text);

    // Availability only: UID + dates are all we read or store. Guest names
    // or booking references some OTAs put in SUMMARY/DESCRIPTION are
    // deliberately dropped here, never persisted.
    return events.map((e) => ({ uid: e.uid, startDate: e.startDate, endDate: e.endDate }));
  },

  export(input: AvailabilityExportInput) {
    return buildIcs({
      calendarName: input.calendarName,
      events: input.blockedRanges.map((range) => ({
        uid: `blocked-${dateKey(range.startDate)}-${dateKey(range.endDate)}@hotel-manager`,
        startDate: range.startDate,
        endDate: range.endDate,
        summary: "Not available",
      })),
    });
  },
};
