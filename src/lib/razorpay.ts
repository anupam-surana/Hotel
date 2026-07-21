import crypto from "node:crypto";

// Thin fetch-based wrapper around Razorpay's Payment Links / Subscriptions
// APIs — deliberately not the `razorpay` SDK package, since these are small
// plain REST surfaces (HTTP Basic Auth with key_id:key_secret) and a raw
// fetch keeps one fewer dependency.
//
// Two separate credential scopes use this same module: the Payment Links
// functions below take each HOTEL's own keyId/keySecret (RazorpaySettings,
// for collecting money from that hotel's guests); the Subscriptions
// functions further down take the PLATFORM's own keyId/keySecret (env vars,
// for billing hotels their ₹999/month). Never mix the two up.

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

export class RazorpayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RazorpayError";
  }
}

function authHeader(keyId: string, keySecret: string): string {
  return "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

export type RazorpayPaymentLink = {
  id: string;
  shortUrl: string;
  status: string; // "created" | "paid" | "cancelled" | "expired" | "partially_paid"
};

export async function createPaymentLink(params: {
  keyId: string;
  keySecret: string;
  amountRupees: number;
  description: string;
  referenceId: string;
  customerName?: string;
  customerContact?: string;
  customerEmail?: string;
}): Promise<RazorpayPaymentLink> {
  let res: Response;
  try {
    res = await fetch(`${RAZORPAY_API_BASE}/payment_links`, {
      method: "POST",
      headers: {
        Authorization: authHeader(params.keyId, params.keySecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(params.amountRupees * 100),
        currency: "INR",
        description: params.description,
        reference_id: params.referenceId,
        customer: {
          name: params.customerName,
          contact: params.customerContact,
          email: params.customerEmail,
        },
        notify: { sms: false, email: false },
      }),
    });
  } catch {
    throw new RazorpayError("Could not reach Razorpay. Check your connection and try again.");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new RazorpayError(data?.error?.description || "Razorpay rejected the request.");
  }
  return { id: data.id, shortUrl: data.short_url, status: data.status };
}

export async function fetchPaymentLinkStatus(
  keyId: string,
  keySecret: string,
  linkId: string
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${RAZORPAY_API_BASE}/payment_links/${linkId}`, {
      headers: { Authorization: authHeader(keyId, keySecret) },
    });
  } catch {
    throw new RazorpayError("Could not reach Razorpay. Check your connection and try again.");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new RazorpayError(data?.error?.description || "Razorpay rejected the request.");
  }
  return data.status;
}

// ---------- Platform subscriptions (platform's own Razorpay account) ----------

export async function createPlan(params: {
  keyId: string;
  keySecret: string;
  name: string;
  amountRupees: number;
}): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${RAZORPAY_API_BASE}/plans`, {
      method: "POST",
      headers: {
        Authorization: authHeader(params.keyId, params.keySecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        period: "monthly",
        interval: 1,
        item: {
          name: params.name,
          amount: Math.round(params.amountRupees * 100),
          currency: "INR",
        },
      }),
    });
  } catch {
    throw new RazorpayError("Could not reach Razorpay. Check your connection and try again.");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new RazorpayError(data?.error?.description || "Razorpay rejected the request.");
  }
  return data.id;
}

export async function createCustomer(params: {
  keyId: string;
  keySecret: string;
  name: string;
  email: string;
  contact?: string;
}): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${RAZORPAY_API_BASE}/customers`, {
      method: "POST",
      headers: {
        Authorization: authHeader(params.keyId, params.keySecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: params.name,
        email: params.email,
        contact: params.contact,
        fail_existing: 0, // if a customer with this email already exists, reuse it
      }),
    });
  } catch {
    throw new RazorpayError("Could not reach Razorpay. Check your connection and try again.");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new RazorpayError(data?.error?.description || "Razorpay rejected the request.");
  }
  return data.id;
}

export type RazorpaySubscription = {
  id: string;
  shortUrl: string;
  status: string;
};

export async function createSubscription(params: {
  keyId: string;
  keySecret: string;
  planId: string;
  customerId: string;
  notes?: Record<string, string>;
}): Promise<RazorpaySubscription> {
  let res: Response;
  try {
    res = await fetch(`${RAZORPAY_API_BASE}/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: authHeader(params.keyId, params.keySecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan_id: params.planId,
        customer_id: params.customerId,
        customer_notify: 1,
        total_count: 120, // 10 years of monthly cycles — Razorpay requires a bound; this is effectively "until cancelled"
        notes: params.notes,
      }),
    });
  } catch {
    throw new RazorpayError("Could not reach Razorpay. Check your connection and try again.");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new RazorpayError(data?.error?.description || "Razorpay rejected the request.");
  }
  return { id: data.id, shortUrl: data.short_url, status: data.status };
}

export async function cancelSubscription(
  keyId: string,
  keySecret: string,
  subscriptionId: string
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${RAZORPAY_API_BASE}/subscriptions/${subscriptionId}/cancel`, {
      method: "POST",
      headers: {
        Authorization: authHeader(keyId, keySecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
  } catch {
    throw new RazorpayError("Could not reach Razorpay. Check your connection and try again.");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new RazorpayError(data?.error?.description || "Razorpay rejected the request.");
  }
}

export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  // Buffers must be equal length for timingSafeEqual — mismatched length
  // (e.g. a malformed header) means the signature is invalid, not a crash.
  if (expected.length !== signature.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
