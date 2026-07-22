import { getTranslations } from "next-intl/server";

const ID_TYPES = ["AADHAAR", "PASSPORT", "VOTER_ID", "DRIVING_LICENSE", "OTHER"] as const;

export async function GuestFormFields({
  defaultValues,
}: {
  defaultValues?: {
    name: string;
    phone: string;
    email: string | null;
    idType: string | null;
    idNumber: string | null;
    address: string | null;
    notes: string | null;
  };
}) {
  const t = await getTranslations();
  const inputClass =
    "w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50";

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          {t("guests.name")}
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={200}
          defaultValue={defaultValues?.name}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="text-sm font-medium">
          {t("guests.phone")}
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          maxLength={20}
          defaultValue={defaultValues?.phone}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          {t("guests.email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          maxLength={200}
          defaultValue={defaultValues?.email ?? ""}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="idType" className="text-sm font-medium">
            {t("guests.idType")}
          </label>
          <select
            id="idType"
            name="idType"
            defaultValue={defaultValues?.idType ?? ""}
            className={inputClass}
          >
            <option value="">{t("guests.idTypeNone")}</option>
            {ID_TYPES.map((idType) => (
              <option key={idType} value={idType}>
                {t(`guests.idTypes.${idType}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="idNumber" className="text-sm font-medium">
            {t("guests.idNumber")}
          </label>
          <input
            id="idNumber"
            name="idNumber"
            maxLength={100}
            defaultValue={defaultValues?.idNumber ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="address" className="text-sm font-medium">
          {t("guests.address")}
        </label>
        <textarea
          id="address"
          name="address"
          rows={2}
          maxLength={500}
          defaultValue={defaultValues?.address ?? ""}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium">
          {t("guests.notes")}
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          maxLength={1000}
          defaultValue={defaultValues?.notes ?? ""}
          className={inputClass}
        />
      </div>
    </>
  );
}
