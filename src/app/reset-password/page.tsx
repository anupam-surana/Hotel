import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { resetPassword } from "@/actions/password-reset";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { FormErrorBanner } from "@/components/form-error-banner";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const t = await getTranslations("passwordReset");

  if (!token) {
    redirect("/forgot-password");
  }

  const inputClass =
    "w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <LocaleSwitcher />

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">{t("resetTitle")}</h1>
        </div>

        <div className="mb-4">
          <FormErrorBanner code={error} />
        </div>

        <form action={resetPassword} className="flex w-full flex-col gap-4">
          <input type="hidden" name="token" value={token} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              {t("newPassword")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              {t("confirmNewPassword")}
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground"
          >
            {t("setNewPassword")}
          </button>
        </form>
      </div>
    </div>
  );
}
