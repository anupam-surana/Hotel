import { getTranslations } from "next-intl/server";

// `code` is one of the keys under messages.formErrors, passed via ?error=<code>
// from a server action redirect (see src/actions/*.ts).
export async function FormErrorBanner({ code }: { code?: string }) {
  if (!code) return null;
  const t = await getTranslations("formErrors");

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
      {t(code)}
    </div>
  );
}
