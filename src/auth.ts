import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/types";

declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    user?: SessionUser;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
          include: { hotel: true },
        });

        if (!user || !user.isActive || !user.hotel.isActive) {
          return null;
        }

        const passwordValid = await bcrypt.compare(password, user.passwordHash);
        if (!passwordValid) {
          return null;
        }

        if (!user.emailVerifiedAt) {
          return null;
        }

        const sessionUser: SessionUser = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          hotelId: user.hotelId,
          hotelSlug: user.hotel.slug,
          hotelName: user.hotel.name,
          locale: user.locale,
        };

        return sessionUser;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.user = user as unknown as SessionUser;
      }
      return token;
    },
    async session({ session, token }) {
      // JWT-only strategy (no DB adapter), so `AdapterUser` fields like
      // `emailVerified` never really exist — this cast is expected/safe here.
      if (token.user) {
        session.user = token.user as unknown as typeof session.user;
      }
      return session;
    },
  },
});
