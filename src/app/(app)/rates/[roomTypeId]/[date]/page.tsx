import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { formatCurrency, formatFullDate } from "@/lib/format";
import { monthKey, parseDateKey } from "@/lib/dates";
import { clearRateOverride, saveRateOverride } from "@/actions/rates";
import { FormErrorBanner } from "@/components/form-error-banner";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

export default async function RateEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomTypeId: string; date: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireRole("OWNER", "MANAGER");
  const { roomTypeId, date: dateStr } = await params;
  const { error } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations();

  const roomType = await prisma.roomType.findFirst({
    where: { id: roomTypeId, hotelId: user.hotelId, isActive: true },
    include: { rooms: { where: { isActive: true }, select: { id: true } } },
  });
  if (!roomType || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    notFound();
  }

  const date = parseDateKey(dateStr);
  const override = await prisma.rateAvailability.findUnique({
    where: { roomTypeId_date: { roomTypeId, date } },
  });

  const backHref = `/rates/${roomTypeId}?month=${monthKey(date)}`;

  return (
    <div className="flex flex-col gap-4">
      <Link href={backHref} className="text-sm font-medium text-black/60 dark:text-white/60">
        ← {t("rateEdit.backToCalendar")}
      </Link>

      <div>
        <h1 className="text-xl font-bold">{formatFullDate(date, locale)}</h1>
        <p className="text-sm text-black/60 dark:text-white/60">{roomType.name}</p>
      </div>

      <FormErrorBanner code={error} />

      <form action={saveRateOverride.bind(null, roomTypeId, dateStr)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="price" className="text-sm font-medium">
            {t("rateEdit.price")}
          </label>
          <input
            id="price"
            name="price"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            defaultValue={override?.price?.toString() ?? ""}
            placeholder={formatCurrency(roomType.basePrice.toString(), locale)}
            className="w-full rounded-xl border border-black/15 px-4 py-3.5 text-base outline-none focus:border-black/40 dark:border-white/20 dark:bg-white/5 dark:focus:border-white/50"
          />
          <p className="text-xs text-black/50 dark:text-white/50">{t("rateEdit.priceHint")}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="availableOverride" className="text-sm font-medium">
            {t("rateEdit.availableOverride")}
          </label>
          <input
            id="availableOverride"
            name="availableOverride"
            type="number"
            inputMode="numeric"
            min={0}
            max={999}
            defaultValue={override?.availableOverride ?? ""}
            placeholder={String(roomType.rooms.length)}
            className="w-full rounded-xl border border-black/15 px-4 py-3.5 text-base outline-none focus:border-black/40 dark:border-white/20 dark:bg-white/5 dark:focus:border-white/50"
          />
          <p className="text-xs text-black/50 dark:text-white/50">{t("rateEdit.availableOverrideHint")}</p>
        </div>

        <label className="flex items-center gap-2.5 rounded-xl border border-black/15 px-4 py-3.5 dark:border-white/20">
          <input
            type="checkbox"
            name="closedOut"
            defaultChecked={override?.closedOut ?? false}
            className="h-5 w-5"
          />
          <span className="text-sm font-medium">{t("rateEdit.closedOut")}</span>
        </label>

        <button
          type="submit"
          className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3.5 text-base font-semibold text-white dark:bg-white dark:text-slate-900"
        >
          {t("common.save")}
        </button>
      </form>

      {override && (
        <form action={clearRateOverride.bind(null, roomTypeId, dateStr)}>
          <ConfirmSubmitButton
            confirmMessage={t("rateEdit.resetConfirm")}
            className="w-full rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-600 dark:border-red-500/40 dark:text-red-400"
          >
            {t("rateEdit.reset")}
          </ConfirmSubmitButton>
        </form>
      )}
    </div>
  );
}
