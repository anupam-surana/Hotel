import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";

export default async function RatesIndexPage() {
  const user = await requireSession();
  const t = await getTranslations("rates");

  const firstRoomType = await prisma.roomType.findFirst({
    where: { hotelId: user.hotelId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!firstRoomType) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="rounded-2xl border border-dashed border-black/15 p-6 text-center text-sm text-black/60 dark:border-white/20 dark:text-white/60">
          {t("noRoomTypes")}
        </p>
      </div>
    );
  }

  redirect(`/rates/${firstRoomType.id}`);
}
