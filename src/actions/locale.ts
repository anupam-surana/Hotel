"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isAppLocale } from "@/i18n/request";

export async function setLocale(formData: FormData) {
  const locale = formData.get("locale");
  if (typeof locale !== "string" || !isAppLocale(locale)) {
    return;
  }
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
