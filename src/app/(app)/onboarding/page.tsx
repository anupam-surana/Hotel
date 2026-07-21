import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";

function ChecklistItem({
  done,
  title,
  description,
  href,
  disabled,
  ctaLabel,
}: {
  done: boolean;
  title: string;
  description: string;
  href: string;
  disabled?: boolean;
  ctaLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-black/60 dark:text-white/60">{description}</p>
        </div>
        <span
          className={
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium " +
            (done
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60")
          }
        >
          {done ? "✓" : "—"}
        </span>
      </div>
      {!done &&
        (disabled ? (
          <span className="text-sm font-medium text-black/30 dark:text-white/30">{ctaLabel}</span>
        ) : (
          <Link href={href} className="text-sm font-medium underline">
            {ctaLabel}
          </Link>
        ))}
    </div>
  );
}

export default async function OnboardingPage() {
  const user = await requireRole("OWNER");
  const t = await getTranslations("onboarding");

  const [roomTypeCount, roomCount, channelConnectionCount, razorpaySettings] = await Promise.all([
    prisma.roomType.count({ where: { hotelId: user.hotelId, isActive: true } }),
    prisma.room.count({ where: { hotelId: user.hotelId, isActive: true } }),
    prisma.channelConnection.count({ where: { hotelId: user.hotelId, isActive: true } }),
    prisma.razorpaySettings.findUnique({ where: { hotelId: user.hotelId } }),
  ]);

  const roomsDone = roomTypeCount > 0 && roomCount > 0;
  const channelsDone = channelConnectionCount > 0;
  const paymentsDone = !!razorpaySettings;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-3">
        <ChecklistItem
          done={roomsDone}
          title={t("roomsTitle")}
          description={t("roomsDescription")}
          href="/rooms/new"
          ctaLabel={t("roomsCta")}
        />
        <ChecklistItem
          done={channelsDone}
          title={t("channelsTitle")}
          description={t("channelsDescription")}
          href="/rooms"
          disabled={!roomsDone}
          ctaLabel={roomsDone ? t("channelsCta") : t("channelsWaitingOnRooms")}
        />
        <ChecklistItem
          done={paymentsDone}
          title={t("paymentsTitle")}
          description={t("paymentsDescription")}
          href="/settings"
          ctaLabel={t("paymentsCta")}
        />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <p className="font-medium">{t("bookingPageTitle")}</p>
        <p className="text-sm text-black/60 dark:text-white/60">{t("bookingPageDescription")}</p>
        <a
          href={`/h/${user.hotelSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sm font-medium underline"
        >
          /h/{user.hotelSlug}
        </a>
      </div>

      <Link
        href="/dashboard"
        className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-center text-base font-semibold text-white dark:bg-white dark:text-slate-900"
      >
        {t("goToDashboard")}
      </Link>
    </div>
  );
}
