import type { PaymentAlert } from "@/lib/payment-alert";
import {
  boolean, index, integer, jsonb, pgTable, serial, smallint, text, timestamp, uuid, varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 512 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  introAnswers: jsonb("intro_answers").$type<string[]>(),
  introCompletedAt: timestamp("intro_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

export const userWallets = pgTable("user_wallets", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 256 }).notNull().unique(),
  email: varchar("email", { length: 512 }).notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 256 }).unique(),
  credits: integer("credits").notNull().default(0),
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

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  planId: text("plan_id").notNull().default("free"),
  aiCredits: integer("ai_credits").notNull().default(0),
  activationStatus: text("activation_status").notNull().default("PENDING"),
  firstScheduledPostAt: timestamp("first_scheduled_post_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export type OrganizationRow = typeof organizations.$inferSelect;
export type OrganizationInsert = typeof organizations.$inferInsert;

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  voiceProfile: jsonb("voice_profile"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export type BrandRow = typeof brands.$inferSelect;
export type BrandInsert = typeof brands.$inferInsert;

export const aiRuns = pgTable("ai_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  brandId: uuid("brand_id").references(() => brands.id),
  model: text("model").notNull(),
  runType: text("run_type").notNull(),
  estimatedTokens: integer("estimated_tokens"),
  reservedCredits: integer("reserved_credits").notNull().default(0),
  actualInputTokens: integer("actual_input_tokens"),
  actualOutputTokens: integer("actual_output_tokens"),
  chargedCredits: integer("charged_credits"),
  status: text("status").notNull().default("PENDING"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export type AiRunRow = typeof aiRuns.$inferSelect;
export type AiRunInsert = typeof aiRuns.$inferInsert;

export const aiUsageLedger = pgTable(
  "ai_usage_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    aiRunId: uuid("ai_run_id").references(() => aiRuns.id),
    amount: integer("amount").notNull(),
    type: text("type").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("ai_usage_ledger_organization_id_idx").on(table.organizationId)],
);
export type AiUsageLedgerRow = typeof aiUsageLedger.$inferSelect;
export type AiUsageLedgerInsert = typeof aiUsageLedger.$inferInsert;

export const contentBatches = pgTable(
  "content_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    brandId: uuid("brand_id").notNull().references(() => brands.id),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
    itemCount: integer("item_count").notNull().default(30),
    status: text("status").notNull().default("DRAFT"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("content_batches_organization_id_idx").on(table.organizationId)],
);
export type ContentBatchRow = typeof contentBatches.$inferSelect;
export type ContentBatchInsert = typeof contentBatches.$inferInsert;

export const drafts = pgTable(
  "drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    brandId: uuid("brand_id").notNull().references(() => brands.id),
    batchId: uuid("batch_id").references(() => contentBatches.id),
    caption: text("caption").notNull(),
    pillar: text("pillar"),
    visualBrief: text("visual_brief"),
    platform: text("platform").notNull().default("INSTAGRAM"),
    status: text("status").notNull().default("DRAFT"),
    suggestedAt: timestamp("suggested_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("drafts_organization_id_idx").on(table.organizationId)],
);
export type DraftRow = typeof drafts.$inferSelect;
export type DraftInsert = typeof drafts.$inferInsert;

export const scheduledPosts = pgTable(
  "scheduled_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    brandId: uuid("brand_id").notNull().references(() => brands.id),
    draftId: uuid("draft_id").references(() => drafts.id),
    caption: text("caption").notNull(),
    platform: text("platform").notNull().default("INSTAGRAM"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    status: text("status").notNull().default("SCHEDULED"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("scheduled_posts_organization_id_idx").on(table.organizationId)],
);
export type ScheduledPostRow = typeof scheduledPosts.$inferSelect;
export type ScheduledPostInsert = typeof scheduledPosts.$inferInsert;
