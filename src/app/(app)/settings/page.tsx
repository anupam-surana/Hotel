import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { connectRazorpay, disconnectRazorpay } from "@/actions/settings";
import { startSubscription, cancelSubscriptionAction } from "@/actions/billing";
import { formatFullDate } from "@/lib/format";
import { FormErrorBanner } from "@/components/form-error-banner";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireRole("OWNER");
  const { error } = await searchParams;
  const t = await getTranslations();
  const locale = await getLocale();

  const [razorpaySettings, subscription] = await Promise.all([
    prisma.razorpaySettings.findUnique({ where: { hotelId: user.hotelId } }),
    prisma.platformSubscription.findUnique({ where: { hotelId: user.hotelId } }),
  ]);

  const inputClass =
    "w-full rounded-xl border border-black/15 px-4 py-3.5 text-base outline-none focus:border-black/40 dark:border-white/20 dark:bg-white/5 dark:focus:border-white/50";

  const canReSubscribe =
    !subscription || subscription.status === "CANCELLED" || subscription.status === "EXPIRED";
  const canCancel = subscription?.status === "ACTIVE" || subscription?.status === "PAST_DUE";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">{t("nav.settings")}</h1>
      <FormErrorBanner code={error} />

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold">{t("subscription.settingsTitle")}</h2>
          <p className="text-sm text-black/60 dark:text-white/60">{t("subscription.settingsDescription")}</p>
        </div>

        {subscription && (
          <div className="flex flex-col gap-1 rounded-2xl border border-black/10 p-4 dark:border-white/10">
            <p className="text-sm font-medium">{t(`subscription.status.${subscription.status}`)}</p>
            <p className="text-xs text-black/50 dark:text-white/50">
              {t("subscription.renewsOn")}: {formatFullDate(subscription.currentPeriodEnd, locale)}
            </p>
          </div>
        )}

        {canReSubscribe && (
          <form action={startSubscription}>
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-base font-semibold text-white dark:bg-white dark:text-slate-900"
            >
              {t("subscription.subscribeCta")}
            </button>
          </form>
        )}

        {canCancel && (
          <form action={cancelSubscriptionAction}>
            <ConfirmSubmitButton
              confirmMessage={t("subscription.cancelConfirm")}
              className="w-full rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-600 dark:border-red-500/40 dark:text-red-400"
            >
              {t("subscription.cancel")}
            </ConfirmSubmitButton>
          </form>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("settings.bookingPageTitle")}</h2>
        <p className="text-sm text-black/60 dark:text-white/60">{t("settings.bookingPageDescription")}</p>
        <a
          href={`/h/${user.hotelSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all rounded-xl border border-black/15 px-4 py-3 text-sm font-medium underline dark:border-white/20"
        >
          /h/{user.hotelSlug}
        </a>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold">{t("settings.razorpayTitle")}</h2>
          <p className="text-sm text-black/60 dark:text-white/60">{t("settings.razorpayDescription")}</p>
        </div>

        {razorpaySettings ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
              {t("settings.connected")}
            </p>
            <p className="text-sm text-black/70 dark:text-white/70">
              {t("settings.keyIdLabel")}: <span className="font-mono">{razorpaySettings.keyId}</span>
            </p>
            <form action={disconnectRazorpay}>
              <ConfirmSubmitButton
                confirmMessage={t("settings.disconnectConfirm")}
                className="w-full rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-600 dark:border-red-500/40 dark:text-red-400"
              >
                {t("settings.disconnect")}
              </ConfirmSubmitButton>
            </form>
          </div>
        ) : (
          <form action={connectRazorpay} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="keyId" className="text-sm font-medium">
                {t("settings.keyIdLabel")}
              </label>
              <input id="keyId" name="keyId" required className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="keySecret" className="text-sm font-medium">
                {t("settings.keySecretLabel")}
              </label>
              <input id="keySecret" name="keySecret" type="password" required className={inputClass} />
            </div>
            <button
              type="submit"
              className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3.5 text-base font-semibold text-white dark:bg-white dark:text-slate-900"
            >
              {t("settings.connect")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
