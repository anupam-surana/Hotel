import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SignupForm } from "@/components/signup-form";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { FormErrorBanner } from "@/components/form-error-banner";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const t = await getTranslations();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <LocaleSwitcher />

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">{t("common.appName")}</h1>
          <p className="mt-1 text-ink/60 dark:text-sand/60">{t("signup.title")}</p>
        </div>

        <div className="mb-4">
          <FormErrorBanner code={error} />
        </div>

        <SignupForm />

        <p className="mt-6 text-center text-sm text-ink/60 dark:text-sand/60">
          {t("signup.alreadyHaveAccount")}{" "}
          <Link href="/login" className="font-medium underline">
            {t("auth.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
