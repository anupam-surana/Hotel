"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { authenticate } from "@/actions/auth";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(authenticate, undefined);

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <input type="hidden" name="redirectTo" value={callbackUrl || "/dashboard"} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          {t("email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium">
            {t("password")}
          </label>
          <Link href="/forgot-password" className="text-sm font-medium underline">
            {t("forgotPassword")}
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-xl border border-ink/15 px-4 py-3.5 text-base outline-none focus:border-ink/40 dark:border-sand/20 dark:bg-sand/5 dark:focus:border-sand/50"
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
          {t("signInError")}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground transition-opacity disabled:opacity-60"
      >
        {pending ? t("signingIn") : t("signIn")}
      </button>
    </form>
  );
}
