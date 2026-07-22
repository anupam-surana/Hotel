import { getTranslations } from "next-intl/server";
import { resendVerification } from "@/actions/signup";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; resent?: string }>;
}) {
  const { error, resent } = await searchParams;
  const t = await getTranslations("signup");

  const inputClass =
    "w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <LocaleSwitcher />

      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold">{t("checkEmailTitle")}</h1>

        {error === "expired" && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {t("verifyLinkExpired")}
          </p>
        )}
        {error === "invalid" && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {t("verifyLinkInvalid")}
          </p>
        )}
        {resent === "1" && !error && (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            {t("resendSent")}
          </p>
        )}
        {!error && !resent && <p className="mt-4 text-ink/60 dark:text-sand/60">{t("checkEmailBody")}</p>}

        <form action={resendVerification} className="mt-8 flex flex-col gap-3 text-left">
          <label htmlFor="email" className="text-sm font-medium">
            {t("resendLabel")}
          </label>
          <input id="email" name="email" type="email" required maxLength={200} className={inputClass} />
          <button
            type="submit"
            className="w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base font-semibold dark:border-sand/20"
          >
            {t("resendVerification")}
          </button>
        </form>
      </div>
    </div>
  );
}
