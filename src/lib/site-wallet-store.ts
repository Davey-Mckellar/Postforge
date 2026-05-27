import { and, eq, gte, sql } from "drizzle-orm";

import type { CreditsStateV1 } from "@/lib/credits-store";
import { getDb } from "@/lib/db";
import { userWallets, type UserWalletRow } from "@/lib/db/schema";
import type { PlanId } from "@/lib/plans";
import { DEFAULT_PLAN } from "@/lib/plans";
import type { PaymentAlert } from "@/lib/payment-alert";
import type { ServerBillingRecord } from "@/lib/server-billing-record";
import {
  defaultWalletState,
  hydrateServerWallet,
  walletMonthKey,
} from "@/lib/wallet-hydrate";

function rowToCreditsBase(row: UserWalletRow): CreditsStateV1 {
  return {
    version: (row.walletVersion ?? 1) as 1,
    planId: (row.planId ?? DEFAULT_PLAN) as PlanId,
    balance: Math.max(0, row.credits),
    accrualMonth: row.accrualMonth || walletMonthKey(),
    welcomeApplied: Boolean(row.welcomeApplied),
  };
}

function rowToBilling(row: UserWalletRow): ServerBillingRecord {
  const pa = row.paymentAlert;
  let paymentAlert: PaymentAlert | null = null;
  if (pa && typeof pa === "object" && typeof pa.at === "string") {
    paymentAlert = {
      at: pa.at,
      invoiceId: typeof pa.invoiceId === "string" ? pa.invoiceId : null,
      attemptCount: typeof pa.attemptCount === "number" ? pa.attemptCount : null,
    };
  }
  return {
    customerId: row.stripeCustomerId ?? null,
    subscriptionId: row.stripeSubscriptionId ?? null,
    status: row.stripeSubscriptionStatus ?? null,
    priceId: row.stripePriceId ?? null,
    paymentAlert,
  };
}

async function insertDefaultRow(clerkId: string, email = ""): Promise<UserWalletRow> {
  const base = hydrateServerWallet(defaultWalletState());
  const [inserted] = await getDb()
    .insert(userWallets)
    .values({
      clerkId,
      email,
      credits: base.balance,
      planId: base.planId,
      accrualMonth: base.accrualMonth,
      welcomeApplied: base.welcomeApplied,
      walletVersion: base.version,
    })
    .onConflictDoNothing({ target: userWallets.clerkId })
    .returning();

  if (inserted) return inserted;

  const [existing] = await getDb()
    .select()
    .from(userWallets)
    .where(eq(userWallets.clerkId, clerkId))
    .limit(1);
  if (!existing) {
    throw new Error(`user_wallets: could not create or load row for clerk_id=${clerkId}`);
  }
  return existing;
}

/** Resolve wallet row for Stripe webhook / background jobs (no HTTP request). */
export async function findClerkIdByStripeCustomerId(customerId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ clerkId: userWallets.clerkId })
    .from(userWallets)
    .where(eq(userWallets.stripeCustomerId, customerId))
    .limit(1);
  return row?.clerkId ?? null;
}

export async function dbEnsureSiteRow(clerkId: string): Promise<UserWalletRow> {
  const [row] = await getDb()
    .select()
    .from(userWallets)
    .where(eq(userWallets.clerkId, clerkId))
    .limit(1);
  if (row) return row;
  return insertDefaultRow(clerkId);
}

export async function dbReadCreditsHydrated(clerkId: string): Promise<CreditsStateV1> {
  const row = await dbEnsureSiteRow(clerkId);
  return hydrateServerWallet(rowToCreditsBase(row));
}

export async function dbWriteCreditsState(clerkId: string, state: CreditsStateV1): Promise<void> {
  await getDb()
    .update(userWallets)
    .set({
      credits: state.balance,
      planId: state.planId,
      accrualMonth: state.accrualMonth,
      welcomeApplied: state.welcomeApplied,
      walletVersion: state.version,
      updatedAt: new Date(),
    })
    .where(eq(userWallets.clerkId, clerkId));
}

export async function dbReadBilling(clerkId: string): Promise<ServerBillingRecord> {
  const row = await dbEnsureSiteRow(clerkId);
  return rowToBilling(row);
}

export async function dbWriteBilling(clerkId: string, next: ServerBillingRecord): Promise<void> {
  await getDb()
    .update(userWallets)
    .set({
      stripeCustomerId: next.customerId,
      stripeSubscriptionId: next.subscriptionId,
      stripeSubscriptionStatus: next.status,
      stripePriceId: next.priceId,
      paymentAlert: next.paymentAlert,
      updatedAt: new Date(),
    })
    .where(eq(userWallets.clerkId, clerkId));
}

export async function dbTryDebit(
  clerkId: string,
  amount: number,
): Promise<{ ok: boolean; wallet: CreditsStateV1 }> {
  const amt = Math.max(0, Math.floor(amount));
  const [updated] = await getDb()
    .update(userWallets)
    .set({
      credits: sql`${userWallets.credits} - ${amt}`,
      updatedAt: new Date(),
    })
    .where(and(eq(userWallets.clerkId, clerkId), gte(userWallets.credits, amt)))
    .returning();

  if (!updated) {
    const wallet = await dbReadCreditsHydrated(clerkId);
    return { ok: false, wallet };
  }

  return { ok: true, wallet: hydrateServerWallet(rowToCreditsBase(updated)) };
}

export async function dbSetPlan(clerkId: string, planId: PlanId): Promise<CreditsStateV1> {
  await getDb()
    .update(userWallets)
    .set({ planId, updatedAt: new Date() })
    .where(eq(userWallets.clerkId, clerkId));
  return dbReadCreditsHydrated(clerkId);
}
