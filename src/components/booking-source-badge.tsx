import { getTranslations } from "next-intl/server";
import type { BookingSource } from "@/generated/prisma/enums";

export async function BookingSourceBadge({ source }: { source: BookingSource }) {
  const t = await getTranslations("bookingSource");
  return (
    <span className="inline-block shrink-0 rounded-full border border-ink/15 px-2.5 py-1 text-xs font-medium dark:border-sand/20">
      {t(source)}
    </span>
  );
}
