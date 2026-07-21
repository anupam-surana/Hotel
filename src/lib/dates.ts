// All helpers here work in UTC deliberately: Postgres DATE columns (used for
// every calendar-date field in this app — bookings, rate overrides) have no
// timezone, and Prisma reads/writes them as Date objects at UTC midnight.
// Using UTC getters/Date.UTC() everywhere avoids off-by-one-day bugs that
// would otherwise depend on the server's local timezone.

export function dateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

export function isSameDate(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m };
}

export function addMonths({ year, month }: { year: number; month: number }, delta: number) {
  const total = (year * 12 + (month - 1)) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

// Always 6 full weeks (42 days), Sunday-start — a fixed-size grid keeps the
// layout (and the code) simple regardless of how a given month falls.
export function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const gridStart = addDays(firstOfMonth, -firstOfMonth.getUTCDay());
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

// "Today" for hotel operations means today in the hotel's own timezone, not
// the server's. en-CA formats as YYYY-MM-DD, matching dateKey()'s shape.
export function todayKeyInTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}
