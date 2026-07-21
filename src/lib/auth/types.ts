import type { Role } from "@/generated/prisma/enums";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  hotelId: string;
  hotelSlug: string;
  hotelName: string;
  locale: string;
};
