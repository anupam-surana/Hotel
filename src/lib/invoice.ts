import { Prisma } from "@/generated/prisma/client";

// A short, stable code to open each hotel's invoice series, e.g.
// "Digha Sea Breeze Lodge" -> "DSBL". Not configurable in V1 — GST law
// requires sequential + unique numbers per business, not any specific
// format, so a derived prefix is enough.
export function hotelInvoicePrefix(hotelName: string): string {
  const initials = hotelName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return initials.slice(0, 6) || "INV";
}

// Hotel accommodation GST slab (current rules): tariff <= ₹7,500/night is
// 12% (6% CGST + 6% SGST); above that is 18% (9% + 9%). Place of supply for
// accommodation is always the hotel's own location, so it's always
// CGST+SGST, never IGST, regardless of the guest's home state.
export function gstRateForNightlyTariff(nightlyRate: Prisma.Decimal | string): {
  cgstRate: Prisma.Decimal;
  sgstRate: Prisma.Decimal;
} {
  const rate = new Prisma.Decimal(nightlyRate.toString());
  const half = rate.greaterThan(7500) ? 9 : 6;
  return { cgstRate: new Prisma.Decimal(half), sgstRate: new Prisma.Decimal(half) };
}
