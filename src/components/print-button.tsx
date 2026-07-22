"use client";

export function PrintButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
    >
      {children}
    </button>
  );
}
