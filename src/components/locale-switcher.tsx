import { getLocale, getTranslations } from "next-intl/server";
import { setLocale } from "@/actions/locale";

// Prominent, no-JS-required language toggle (works via plain form submit,
// important for cheap Android phones on slow connections).
export async function LocaleSwitcher() {
  const locale = await getLocale();
  const t = await getTranslations("common");

  return (
    <div
      className="inline-flex rounded-full border border-ink/10 bg-ink/5 p-1 text-sm font-medium dark:border-sand/15 dark:bg-sand/10"
      aria-label={t("language")}
    >
      {(["bn", "en"] as const).map((loc) => {
        const isActive = locale === loc;
        return (
          <form action={setLocale} key={loc}>
            <input type="hidden" name="locale" value={loc} />
            <button
              type="submit"
              className={
                "min-w-[3.5rem] rounded-full px-3 py-1.5 transition-colors " +
                (isActive
                  ? "bg-sand text-ink shadow-sm"
                  : "text-ink/60 dark:text-sand/60")
              }
              aria-current={isActive}
            >
              {loc === "bn" ? t("bengali") : t("english")}
            </button>
          </form>
        );
      })}
    </div>
  );
}
