import { Resend } from "resend";

// Transactional emails (verification, password reset, staff invites,
// booking confirmations) — no templating library, just plain HTML strings
// sent through Resend.
function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }
  return new Resend(apiKey);
}

async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  // No Resend account configured — only acceptable outside production;
  // print the content instead of failing the calling flow outright. Gated
  // on NODE_ENV (not just the env var's presence) so a misconfigured
  // production deploy fails loudly instead of silently never sending.
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set");
    }
    console.log(`[dev] Email to ${params.to}: ${params.subject}\n${params.html}`);
    return;
  }

  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM is not set");
  }

  await getClient().emails.send({ from, to: params.to, subject: params.subject, html: params.html });
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const verifyUrl = `${process.env.NEXTAUTH_URL}/api/verify-email?token=${token}`;
  await sendEmail({
    to,
    subject: "Verify your email to activate your hotel account",
    html: `
      <p>Thanks for signing up. Click the link below to verify your email and activate your account:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
  await sendEmail({
    to,
    subject: "Reset your password",
    html: `
      <p>Click the link below to set a new password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
    `,
  });
}

export async function sendStaffInviteEmail(
  to: string,
  token: string,
  params: { hotelName: string; inviterName: string; role: string }
): Promise<void> {
  const acceptUrl = `${process.env.NEXTAUTH_URL}/accept-invite?token=${token}`;
  await sendEmail({
    to,
    subject: `You've been invited to join ${params.hotelName}`,
    html: `
      <p>${params.inviterName} has invited you to join <strong>${params.hotelName}</strong> as ${params.role}.</p>
      <p><a href="${acceptUrl}">Click here to set your password and get started</a></p>
      <p>This link expires in 7 days.</p>
    `,
  });
}

export async function sendBookingConfirmationEmail(
  to: string,
  params: {
    guestName: string;
    hotelName: string;
    checkIn: string;
    checkOut: string;
    roomTypeName: string;
    totalAmount: string;
    hotelSlug: string;
    bookingId: string;
  }
): Promise<void> {
  const confirmationUrl = `${process.env.NEXTAUTH_URL}/h/${params.hotelSlug}/confirmation/${params.bookingId}`;
  await sendEmail({
    to,
    subject: `Your booking at ${params.hotelName} is confirmed`,
    html: `
      <p>Hi ${params.guestName},</p>
      <p>Your booking at <strong>${params.hotelName}</strong> is confirmed:</p>
      <ul>
        <li>Room: ${params.roomTypeName}</li>
        <li>Check-in: ${params.checkIn}</li>
        <li>Check-out: ${params.checkOut}</li>
        <li>Total: ${params.totalAmount}</li>
      </ul>
      <p><a href="${confirmationUrl}">View your booking</a></p>
    `,
  });
}
