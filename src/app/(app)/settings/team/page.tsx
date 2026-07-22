import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { inviteStaff, deactivateStaffMember, reactivateStaffMember } from "@/actions/team";
import { FormErrorBanner } from "@/components/form-error-banner";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

const ROLES = ["OWNER", "MANAGER", "FRONTDESK", "HOUSEKEEPING"] as const;

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireRole("OWNER");
  const { error } = await searchParams;
  const t = await getTranslations();
  const tRoles = await getTranslations("roles");

  const members = await prisma.user.findMany({
    where: { hotelId: user.hotelId },
    orderBy: { createdAt: "asc" },
  });

  const inputClass =
    "w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings" className="text-sm font-medium underline">
          {t("common.back")}
        </Link>
        <h1 className="mt-2 text-xl font-bold">{t("team.title")}</h1>
      </div>

      <FormErrorBanner code={error} />

      <div className="flex flex-col gap-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 p-3 dark:border-sand/10"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">
                {member.name} {member.id === user.id && <span className="text-ink/50 dark:text-sand/50">({t("team.you")})</span>}
              </p>
              <p className="truncate text-sm text-ink/60 dark:text-sand/60">{member.email}</p>
              <p className="text-xs text-ink/50 dark:text-sand/50">
                {tRoles(member.role)}
                {!member.isActive && ` · ${t("team.inactive")}`}
                {!member.emailVerifiedAt && member.isActive && ` · ${t("team.invitePending")}`}
              </p>
            </div>

            {member.id !== user.id && (
              <form
                action={
                  member.isActive
                    ? deactivateStaffMember.bind(null, member.id)
                    : reactivateStaffMember.bind(null, member.id)
                }
              >
                {member.isActive ? (
                  <ConfirmSubmitButton
                    confirmMessage={t("team.deactivateConfirm")}
                    className="shrink-0 rounded-full border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 dark:border-red-500/40 dark:text-red-400"
                  >
                    {t("team.deactivate")}
                  </ConfirmSubmitButton>
                ) : (
                  <button
                    type="submit"
                    className="shrink-0 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium dark:border-sand/20"
                  >
                    {t("team.reactivate")}
                  </button>
                )}
              </form>
            )}
          </div>
        ))}
      </div>

      <form action={inviteStaff} className="flex flex-col gap-4 rounded-xl border border-dashed border-ink/15 p-4 dark:border-sand/20">
        <h2 className="font-semibold">{t("team.inviteHeading")}</h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            {t("team.name")}
          </label>
          <input id="name" name="name" required maxLength={100} className={inputClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            {t("team.email")}
          </label>
          <input id="email" name="email" type="email" required maxLength={200} className={inputClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="role" className="text-sm font-medium">
            {t("team.role")}
          </label>
          <select id="role" name="role" required defaultValue="FRONTDESK" className={inputClass}>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {tRoles(role)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="mt-2 w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground"
        >
          {t("team.invite")}
        </button>
      </form>
    </div>
  );
}
