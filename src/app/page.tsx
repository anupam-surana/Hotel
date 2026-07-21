import { redirect } from "next/navigation";

// Unauthenticated visitors never reach this — proxy.ts already redirected
// them to /login. Signed-in visitors land here on "/", so just forward them.
export default function Home() {
  redirect("/dashboard");
}
