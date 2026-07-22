import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/login-form";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; resetComplete?: string; inviteAccepted?: string }>;
}) {
  const { callbackUrl, error, resetComplete, inviteAccepted } = await searchParams;
  const t = await getTranslations();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <LocaleSwitcher />

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">{t("common.appName")}</h1>
          <p className="mt-1 text-ink/60 dark:text-sand/60">{t("auth.signInTitle")}</p>
        </div>

        {(resetComplete === "1" || inviteAccepted === "1") && (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            {resetComplete === "1" ? t("auth.resetComplete") : t("auth.inviteAccepted")}
          </p>
        )}
        {(error === "inviteLinkInvalid" || error === "inviteLinkExpired") && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {t(`auth.${error}`)}
          </p>
        )}

        <LoginForm callbackUrl={callbackUrl} />

        <p className="mt-6 text-center text-sm text-ink/60 dark:text-sand/60">
          {t("auth.noAccount")}{" "}
          <Link href="/signup" className="font-medium underline">
            {t("auth.createAccount")}
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-ink/60 dark:text-sand/60">
          <Link href="/signup/check-email" className="font-medium underline">
            {t("auth.resendVerificationLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
