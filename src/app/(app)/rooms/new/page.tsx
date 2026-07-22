import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth/session";
import { createRoomType } from "@/actions/rooms";
import { FormErrorBanner } from "@/components/form-error-banner";

export default async function NewRoomTypePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("OWNER", "MANAGER");
  const { error } = await searchParams;
  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("roomType.newTitle")}</h1>
      <FormErrorBanner code={error} />

      <form action={createRoomType} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            {t("roomType.name")}
          </label>
          <input
            id="name"
            name="name"
            required
            maxLength={100}
            placeholder={t("roomType.namePlaceholder")}
            className="w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium">
            {t("roomType.description")}
          </label>
          <textarea
            id="description"
            name="description"
            maxLength={1000}
            rows={3}
            className="w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="maxAdults" className="text-sm font-medium">
              {t("roomType.maxAdults")}
            </label>
            <input
              id="maxAdults"
              name="maxAdults"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              defaultValue={2}
              required
              className="w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="maxChildren" className="text-sm font-medium">
              {t("roomType.maxChildren")}
            </label>
            <input
              id="maxChildren"
              name="maxChildren"
              type="number"
              inputMode="numeric"
              min={0}
              max={20}
              defaultValue={0}
              required
              className="w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="basePrice" className="text-sm font-medium">
            {t("roomType.basePrice")}
          </label>
          <input
            id="basePrice"
            name="basePrice"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            required
            className="w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="photoUrl" className="text-sm font-medium">
            {t("roomType.photoUrl")}
          </label>
          <input
            id="photoUrl"
            name="photoUrl"
            type="url"
            maxLength={2000}
            placeholder={t("roomType.photoUrlPlaceholder")}
            className="w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50"
          />
          <p className="text-xs text-ink/50 dark:text-sand/50">{t("roomType.photoUrlHint")}</p>
        </div>

        <button
          type="submit"
          className="mt-2 w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground"
        >
          {t("roomType.create")}
        </button>
      </form>
    </div>
  );
}
