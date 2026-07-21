"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

export type LoginState = { error?: string } | undefined;

export async function authenticate(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: (formData.get("redirectTo") as string) || "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "invalid" };
    }
    throw error; // NEXT_REDIRECT on success — must propagate, not be swallowed
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
