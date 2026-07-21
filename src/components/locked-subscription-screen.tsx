import { getTranslations } from "next-intl/server";
import { startSubscription } from "@/actions/billing";
import { logout } from "@/actions/auth";
import { LocaleSwitcher } from "@/components/locale-switcher";
import type { PlatformSubscription } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/types";

export async function LockedSubscriptionScreen({
  user,
  subscription,
}: {
  user: SessionUser;
  subscription: PlatformSubscription | null;
}) {
  const t = await getTranslations("subscription");
  const expired = subscription?.status === "EXPIRED";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <LocaleSwitcher />
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold">{expired ? t("trialEndedTitle") : t("lockedTitle")}</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          {user.role === "OWNER" ? t("ownerLockedBody", { hotelName: user.hotelName }) : t("staffLockedBody")}
        </p>

        {user.role === "OWNER" ? (
          <form action={startSubscription} className="mt-6">
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-base font-semibold text-white dark:bg-white dark:text-slate-900"
            >
              {t("subscribeCta")}
            </button>
          </form>
        ) : null}

        <form action={logout} className="mt-3">
          <button
            type="submit"
            className="w-full rounded-xl border border-black/15 px-4 py-3.5 text-base font-semibold dark:border-white/20"
          >
            {t("signOut")}
          </button>
        </form>
      </div>
    </div>
  );
}
