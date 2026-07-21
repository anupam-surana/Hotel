import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Names with no ASCII letters/digits (e.g. an all-Bengali hotel name)
  // slugify down to an empty string — fall back to a random slug.
  return base || `hotel-${crypto.randomBytes(3).toString("hex")}`;
}

export async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let candidate = baseSlug;
  let suffix = 2;
  while (await prisma.hotel.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
