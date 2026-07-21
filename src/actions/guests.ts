"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/session";
import type { IdType } from "@/generated/prisma/enums";

const ID_TYPES = ["AADHAAR", "PASSPORT", "VOTER_ID", "DRIVING_LICENSE", "OTHER"] as const;

const guestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(20),
  email: z.string().trim().max(200).optional(),
  idNumber: z.string().trim().max(100).optional(),
  address: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

function withError(path: string, code: string): never {
  redirect(`${path}?error=${code}`);
}

function readIdType(formData: FormData): IdType | null {
  const raw = formData.get("idType");
  return typeof raw === "string" && (ID_TYPES as readonly string[]).includes(raw) ? (raw as IdType) : null;
}

export async function createGuest(formData: FormData) {
  const user = await requireApiSession();
  const parsed = guestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    withError("/guests/new", "validation");
  }
  const data = parsed.data;

  const guest = await prisma.guest.create({
    data: {
      hotelId: user.hotelId,
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      idType: readIdType(formData),
      idNumber: data.idNumber || null,
      address: data.address || null,
      notes: data.notes || null,
    },
  });

  revalidatePath("/guests");
  redirect(`/guests/${guest.id}`);
}

export async function updateGuest(guestId: string, formData: FormData) {
  const user = await requireApiSession();
  const parsed = guestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    withError(`/guests/${guestId}`, "validation");
  }
  const data = parsed.data;

  await prisma.guest.updateMany({
    where: { id: guestId, hotelId: user.hotelId },
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      idType: readIdType(formData),
      idNumber: data.idNumber || null,
      address: data.address || null,
      notes: data.notes || null,
    },
  });

  revalidatePath("/guests");
  revalidatePath(`/guests/${guestId}`);
  redirect(`/guests/${guestId}`);
}
