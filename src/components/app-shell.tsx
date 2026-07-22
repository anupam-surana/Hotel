import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { logout } from "@/actions/auth";
import { LocaleSwitcher } from "@/components/locale-switcher";
import type { SessionUser } from "@/lib/auth/types";

// The bottom bar only ever holds the handful of screens used many times a
// day (real mobile tab-bar UX caps out around 5 before targets get too
// small to tap reliably) — everything else lives behind "More" so this
// never has to be redesigned as new modules ship. Housekeeping staff don't
// do front-desk work, so their bar swaps that slot for their own daily tool.
const DEFAULT_NAV_ITEMS = [
  { href: "/dashboard", key: "dashboard" as const },
  { href: "/front-desk", key: "frontDesk" as const },
  { href: "/bookings", key: "bookings" as const },
  { href: "/rooms", key: "rooms" as const },
  { href: "/more", key: "more" as const },
];

const HOUSEKEEPING_NAV_ITEMS = [
  { href: "/dashboard", key: "dashboard" as const },
  { href: "/housekeeping", key: "housekeeping" as const },
  { href: "/bookings", key: "bookings" as const },
  { href: "/rooms", key: "rooms" as const },
  { href: "/more", key: "more" as const },
];

export async function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const t = await getTranslations();
  const navItems = user.role === "HOUSEKEEPING" ? HOUSEKEEPING_NAV_ITEMS : DEFAULT_NAV_ITEMS;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-3 dark:border-sand/10">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{user.hotelName}</p>
          <p className="truncate text-xs text-ink/50 dark:text-sand/50">{user.name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LocaleSwitcher />
          <form action={logout}>
            <button
              type="submit"
              className="rounded-full border border-ink/15 px-3 py-1.5 text-sm font-medium dark:border-sand/20"
            >
              {t("auth.signOut")}
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 px-4 py-4">{children}</main>

      <nav className="sticky bottom-0 flex border-t border-ink/10 bg-background dark:border-sand/10">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 px-3 py-3 text-center text-sm font-medium"
          >
            {t(`nav.${item.key}`)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
