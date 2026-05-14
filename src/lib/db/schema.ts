import type { PaymentAlert } from "@/lib/payment-alert";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  smallint,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/** Email + password accounts (when `BBGPT_USER_AUTH=1`). Wallet `clerk_id` matches `users.id`. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 512 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  /** Onboarding questionnaire answers — persisted per account so they survive browser clears and device switches. */
  introAnswers: jsonb("intro_answers").$type<string[]>(),
  introCompletedAt: timestamp("intro_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

/**
 * Primary durable row for gated deploy "site" wallet + Stripe billing snapshot.
 * `clerkId` holds a stable user id (single-tenant default: env BBGPT_WALLET_USER_ID or `default`).
 * When you add Clerk, store each user's `user_…` id here.
 */
export const userWallets = pgTable("user_wallets", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 256 }).notNull().unique(),
  email: varchar("email", { length: 512 }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 256 }).unique(),
  credits: integer("credits").notNull().default(0),
  /** Mirrors CreditsStateV1 — subscription tier */
  planId: varchar("plan_id", { length: 32 }).notNull().default("free"),
  accrualMonth: varchar("accrual_month", { length: 7 }).notNull(),
  welcomeApplied: boolean("welcome_applied").notNull().default(false),
  walletVersion: smallint("wallet_version").notNull().default(1),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 256 }),
  stripeSubscriptionStatus: varchar("stripe_subscription_status", { length: 64 }),
  stripePriceId: varchar("stripe_price_id", { length: 256 }),
  paymentAlert: jsonb("payment_alert").$type<PaymentAlert | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type UserWalletRow = typeof userWallets.$inferSelect;
export type UserWalletInsert = typeof userWallets.$inferInsert;
