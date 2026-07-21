import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { LockedSubscriptionScreen } from "@/components/locked-subscription-screen";
import { isLocked, showsPastDueBanner } from "@/lib/subscription";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const subscription = await prisma.platformSubscription.findUnique({ where: { hotelId: user.hotelId } });

  if (isLocked(subscription)) {
    return <LockedSubscriptionScreen user={user} subscription={subscription} />;
  }

  const t = await getTranslations("subscription");

  return (
    <AppShell user={user}>
      {showsPastDueBanner(subscription) && (
        <Link
          href="/settings"
          className="mb-4 block rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
        >
          {t("pastDueBanner")}
        </Link>
      )}
      {children}
    </AppShell>
  );
}
