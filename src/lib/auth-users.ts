import { eq } from "drizzle-orm";

import { normalizeEmail } from "@/lib/email-normalize";
import { getDb } from "@/lib/db";
import { users, userWallets, type UserRow } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  defaultWalletState,
  hydrateServerWallet,
  walletMonthKey,
} from "@/lib/wallet-hydrate";

export type AuthUserPublic = Pick<UserRow, "id" | "email">;

export async function findUserByEmail(emailRaw: string): Promise<UserRow | null> {
  const email = normalizeEmail(emailRaw);
  if (!email) return null;
  const [row] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
  return row ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const [row] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function verifyUserCredentials(emailRaw: string, password: string): Promise<UserRow | null> {
  const user = await findUserByEmail(emailRaw);
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? user : null;
}

/** Updates password hash for an existing user (password reset flow). */
export async function updateUserPasswordHash(userId: string, passwordHash: string): Promise<boolean> {
  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  return Boolean(updated);
}

/**
 * Creates user row + wallet row (`clerk_id` = user id, email duplicated for Stripe UX).
 */
export async function registerUser(emailRaw: string, password: string): Promise<{ user: UserRow } | { error: string }> {
  const email = normalizeEmail(emailRaw);
  if (!email) return { error: "Invalid email." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const passwordHash = await hashPassword(password);

  try {
    const db = getDb();
    const [created] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
      })
      .returning();

    if (!created) return { error: "Could not create account." };

    const base = hydrateServerWallet(defaultWalletState());
    await db.insert(userWallets).values({
      clerkId: created.id,
      email,
      credits: base.balance,
      planId: base.planId,
      accrualMonth: base.accrualMonth ?? walletMonthKey(),
      welcomeApplied: base.welcomeApplied,
      walletVersion: base.version,
    });

    return { user: created };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { error: "An account with this email already exists." };
    }
    console.error("[registerUser]", msg);
    return { error: msg };
  }
}
