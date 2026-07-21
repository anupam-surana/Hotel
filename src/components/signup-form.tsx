import { getTranslations } from "next-intl/server";
import { createHotelAccount } from "@/actions/signup";

const inputClass =
  "w-full rounded-xl border border-black/15 px-4 py-3.5 text-base outline-none focus:border-black/40 dark:border-white/20 dark:bg-white/5 dark:focus:border-white/50";

export async function SignupForm() {
  const t = await getTranslations("signup");

  return (
    <form action={createHotelAccount} className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h2 className="font-semibold">{t("hotelDetailsHeading")}</h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="hotelName" className="text-sm font-medium">
            {t("hotelName")}
          </label>
          <input
            id="hotelName"
            name="hotelName"
            required
            maxLength={100}
            placeholder={t("hotelNamePlaceholder")}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className="text-sm font-medium">
            {t("phone")}
          </label>
          <input id="phone" name="phone" type="tel" maxLength={30} className={inputClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="address" className="text-sm font-medium">
            {t("address")}
          </label>
          <input id="address" name="address" maxLength={200} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="city" className="text-sm font-medium">
              {t("city")}
            </label>
            <input id="city" name="city" maxLength={100} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="state" className="text-sm font-medium">
              {t("state")}
            </label>
            <input id="state" name="state" maxLength={100} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pincode" className="text-sm font-medium">
              {t("pincode")}
            </label>
            <input id="pincode" name="pincode" maxLength={20} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="gstin" className="text-sm font-medium">
              {t("gstin")}
            </label>
            <input id="gstin" name="gstin" maxLength={20} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-semibold">{t("accountHeading")}</h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="ownerName" className="text-sm font-medium">
            {t("ownerName")}
          </label>
          <input id="ownerName" name="ownerName" required maxLength={100} className={inputClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="ownerEmail" className="text-sm font-medium">
            {t("ownerEmail")}
          </label>
          <input
            id="ownerEmail"
            name="ownerEmail"
            type="email"
            autoComplete="email"
            required
            maxLength={200}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="ownerPassword" className="text-sm font-medium">
            {t("password")}
          </label>
          <input
            id="ownerPassword"
            name="ownerPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className={inputClass}
          />
          <p className="text-xs text-black/50 dark:text-white/50">{t("passwordHint")}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            {t("confirmPassword")}
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
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-base font-semibold text-white dark:bg-white dark:text-slate-900"
      >
        {t("createAccount")}
      </button>
    </form>
  );
}
