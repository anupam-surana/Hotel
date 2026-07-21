function intlLocale(locale: string): string {
  return locale === "bn" ? "bn-IN" : "en-IN";
}

// Locale-aware ₹ formatting. Amounts come from Prisma as Decimal | string | number.
export function formatCurrency(amount: number | string, locale: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

// Plain numbers (e.g. "3 rooms left") also need Bengali-numeral formatting in bn-IN.
export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

// `date` must be a UTC-midnight Date (see src/lib/dates.ts) — timeZone: "UTC"
// keeps the displayed day from shifting based on the server's local timezone.
export function formatMonthLabel(year: number, month: number, locale: string): string {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatFullDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

// Compact form for table columns / list rows where space is tight.
export function formatShortDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}
