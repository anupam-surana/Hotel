import { LocaleSwitcher } from "@/components/locale-switcher";

export function PublicHeader({ hotelName }: { hotelName: string }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3 dark:border-white/10">
      <p className="truncate text-sm font-semibold">{hotelName}</p>
      <LocaleSwitcher />
    </header>
  );
}
