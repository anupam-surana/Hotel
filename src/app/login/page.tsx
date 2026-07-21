import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/login-form";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const t = await getTranslations();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <LocaleSwitcher />

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">{t("common.appName")}</h1>
          <p className="mt-1 text-black/60 dark:text-white/60">{t("auth.signInTitle")}</p>
        </div>
        <LoginForm callbackUrl={callbackUrl} />

        <p className="mt-6 text-center text-sm text-black/60 dark:text-white/60">
          {t("auth.noAccount")}{" "}
          <Link href="/signup" className="font-medium underline">
            {t("auth.createAccount")}
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-black/60 dark:text-white/60">
          <Link href="/signup/check-email" className="font-medium underline">
            {t("auth.resendVerificationLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
