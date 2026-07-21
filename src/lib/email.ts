import { Resend } from "resend";

// One-off transactional email (signup verification only, for now) — no
// templating library, just a plain HTML string sent through Resend.
function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }
  return new Resend(apiKey);
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const verifyUrl = `${process.env.NEXTAUTH_URL}/api/verify-email?token=${token}`;

  // No Resend account configured yet (local dev without RESEND_API_KEY) —
  // print the link instead of failing signup outright. Production must set
  // RESEND_API_KEY/EMAIL_FROM (see .env.example) to actually deliver email.
  if (!process.env.RESEND_API_KEY) {
    console.log(`[dev] Verification email for ${to}: ${verifyUrl}`);
    return;
  }

  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM is not set");
  }

  await getClient().emails.send({
    from,
    to,
    subject: "Verify your email to activate your hotel account",
    html: `
      <p>Thanks for signing up. Click the link below to verify your email and activate your account:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  });
}
