import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";

// Everything not frequent enough to earn a spot in the bottom tab bar.
// Add a line here (not to app-shell's NAV_ITEMS) as each new module ships.
const MORE_ITEMS = [
  { href: "/guests", key: "guests" as const, roles: null },
  { href: "/rates", key: "rates" as const, roles: null },
  // HOUSEKEEPING already has this in their primary tab bar (see app-shell.tsx).
  { href: "/housekeeping", key: "housekeeping" as const, roles: ["OWNER", "MANAGER", "FRONTDESK"] as const },
  { href: "/reports", key: "reports" as const, roles: ["OWNER", "MANAGER"] as const },
  { href: "/settings", key: "settings" as const, roles: ["OWNER"] as const },
  { href: "/onboarding", key: "onboarding" as const, roles: ["OWNER"] as const },
];

export default async function MorePage() {
  const user = await requireSession();
  const t = await getTranslations();

  const items = MORE_ITEMS.filter((item) => !item.roles || (item.roles as readonly string[]).includes(user.role));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("nav.more")}</h1>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-ink/10 px-4 py-3.5 text-base font-medium dark:border-sand/10"
          >
            {t(`nav.${item.key}`)}
          </Link>
        ))}
      </div>
    </div>
  );
}
