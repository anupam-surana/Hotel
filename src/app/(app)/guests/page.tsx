import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireSession();
  const { q } = await searchParams;
  const t = await getTranslations();
  const tg = await getTranslations("guests");

  const guests = await prisma.guest.findMany({
    where: {
      hotelId: user.hotelId,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { bookings: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{tg("title")}</h1>
        <Link
          href="/guests/new"
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
        >
          {tg("addGuest")}
        </Link>
      </div>

      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={tg("searchPlaceholder")}
          className="w-full rounded-xl border border-black/15 px-4 py-3 text-base outline-none focus:border-black/40 dark:border-white/20 dark:bg-white/5 dark:focus:border-white/50"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl border border-black/15 px-4 py-3 text-sm font-medium dark:border-white/20"
        >
          {t("common.search")}
        </button>
      </form>

      {guests.length === 0 && (
        <p className="rounded-2xl border border-dashed border-black/15 p-6 text-center text-sm text-black/60 dark:border-white/20 dark:text-white/60">
          {q ? tg("noResults") : tg("noGuests")}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {guests.map((guest) => (
          <Link
            key={guest.id}
            href={`/guests/${guest.id}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{guest.name}</p>
              <p className="text-sm text-black/60 dark:text-white/60">{guest.phone}</p>
            </div>
            {guest._count.bookings > 1 && (
              <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-500/15 dark:text-blue-300">
                {tg("repeatGuest")}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
