import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const LOCALE_COOKIE = "locale";
export const DEFAULT_LOCALE = "bn";
export const LOCALES = ["bn", "en"] as const;
export type AppLocale = (typeof LOCALES)[number];

export function isAppLocale(value: string | undefined): value is AppLocale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isAppLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
