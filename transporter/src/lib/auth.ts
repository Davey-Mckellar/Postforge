import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
// The Auth.js Drizzle adapter is not wired in Phase 1 — JWT + credentials
// don't need it. The `accounts`, `sessions`, and `verificationTokens` tables
// still ship in the schema so Phase 3 can bolt LinkedIn on without a migration.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: "sender" | "transporter" | "both";
    } & DefaultSession["user"];
  }
}

type AppRole = "sender" | "transporter" | "both";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        (token as { id?: string }).id = (user as { id: string }).id;
        (token as { role?: AppRole }).role = (user as { role: AppRole }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token as { id?: string }).id ?? "";
        session.user.role = (token as { role?: AppRole }).role ?? "both";
      }
      return session;
    },
  },
});
