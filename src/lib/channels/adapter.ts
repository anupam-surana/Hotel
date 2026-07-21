// The seam for OTA channel sync. Only these two operations need a new
// implementation per channel/method (e.g. a future BookingComApiAdapter
// using their real API instead of iCal). Everything else — connection
// management, diffing ChannelBlock rows against a fresh import, how blocks
// feed into the availability/overbooking guard, the sync schedule — is
// adapter-agnostic and lives outside this interface, so swapping the
// transport for one channel never touches the rest of the app.
//
// V1 syncs AVAILABILITY ONLY (blocked date ranges), never full booking
// details, guest info, or rates — and it's near-real-time (as often as the
// sync runs, expected to be a few hours), not instant.

export type BlockedRange = {
  uid: string;
  startDate: Date; // UTC-midnight, inclusive
  endDate: Date; // UTC-midnight, exclusive
};

export type AvailabilityExportInput = {
  calendarName: string;
  // Contiguous date ranges where this room type has zero rooms remaining —
  // computed the same way as everywhere else availability is checked.
  blockedRanges: { startDate: Date; endDate: Date }[];
};

export interface ChannelAdapter {
  // Pull the channel's current blocked date ranges from its calendar URL.
  import(importUrl: string): Promise<BlockedRange[]>;

  // Produce a feed of our own blocked-out dates for the channel to import.
  export(input: AvailabilityExportInput): string;
}
