import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requestPasswordReset } from "@/actions/password-reset";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;
  const t = await getTranslations("passwordReset");

  const inputClass =
    "w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <LocaleSwitcher />

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">{t("forgotTitle")}</h1>
          <p className="mt-1 text-ink/60 dark:text-sand/60">{t("forgotSubtitle")}</p>
        </div>

        {sent === "1" && (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            {t("resetSent")}
          </p>
        )}
        {error === "resetLinkInvalid" && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {t("resetLinkInvalid")}
          </p>
        )}
        {error === "resetLinkExpired" && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {t("resetLinkExpired")}
          </p>
        )}

        <form action={requestPasswordReset} className="flex w-full flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              {t("emailLabel")}
            </label>
            <input id="email" name="email" type="email" autoComplete="email" required maxLength={200} className={inputClass} />
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground"
          >
            {t("sendResetLink")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink/60 dark:text-sand/60">
          <Link href="/login" className="font-medium underline">
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
