import { getTranslations } from "next-intl/server";
import { createGuest } from "@/actions/guests";
import { FormErrorBanner } from "@/components/form-error-banner";
import { GuestFormFields } from "@/components/guest-form-fields";

export default async function NewGuestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("guests.newTitle")}</h1>
      <FormErrorBanner code={error} />

      <form action={createGuest} className="flex flex-col gap-4">
        <GuestFormFields />
        <button
          type="submit"
          className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3.5 text-base font-semibold text-white dark:bg-white dark:text-slate-900"
        >
          {t("guests.create")}
        </button>
      </form>
    </div>
  );
}
