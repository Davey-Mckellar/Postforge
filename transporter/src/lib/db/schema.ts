import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  pgEnum,
  integer,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

export const userRoleEnum = pgEnum("user_role", ["sender", "transporter", "both"]);
export const verificationTierEnum = pgEnum("verification_tier", [
  "unverified",
  "basic",
  "verified",
]);
export const shipmentStatusEnum = pgEnum("shipment_status", [
  "open",
  "bidding",
  "awarded",
  "in_transit",
  "delivered",
  "disputed",
  "cancelled",
]);
export const capacityStatusEnum = pgEnum("capacity_status", [
  "open",
  "matched",
  "completed",
  "cancelled",
]);
export const bidStatusEnum = pgEnum("bid_status", [
  "open",
  "withdrawn",
  "countered",
  "accepted",
  "rejected",
  "expired",
]);
export const awardStatusEnum = pgEnum("award_status", [
  "confirmed",
  "picked_up",
  "in_transit",
  "delivered",
  "disputed",
  "cancelled",
]);
// Phase 2 wires Stripe Connect; the enum ships the target values now so
// authorize/capture flows can be added without an ALTER TYPE dance later.
export const paymentStatusEnum = pgEnum("payment_status", [
  "not_implemented",
  "authorized",
  "captured",
  "refunded",
  "failed",
]);

/* ------------------------------------------------------------------ */
/*  Users (shared with Auth.js Drizzle adapter)                        */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  image: text("image"),
  role: userRoleEnum("role").notNull().default("both"),
  verificationTier: verificationTierEnum("verification_tier").notNull().default("unverified"),
  // Phase 2 / Phase 3 identity — nullable so Phase 1 code writes nothing.
  stripeCustomerId: text("stripe_customer_id"),
  stripeConnectAccountId: text("stripe_connect_account_id"),
  linkedinVerifiedAt: timestamp("linkedin_verified_at"),
  nscMcNumber: text("nsc_mc_number"),
  fmcsaMcNumber: text("fmcsa_mc_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/*  Auth.js adapter tables (accounts / sessions / verificationTokens)  */
/* ------------------------------------------------------------------ */

export const accounts = pgTable(
  "account",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    pk: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  }),
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    pk: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

/* ------------------------------------------------------------------ */
/*  Marketplace tables                                                 */
/* ------------------------------------------------------------------ */

export const shipments = pgTable("shipments", {
  id: uuid("id").defaultRandom().primaryKey(),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  cargoDescription: text("cargo_description"),
  weightKg: numeric("weight_kg"),
  declaredValue: numeric("declared_value"),
  targetPrice: numeric("target_price"),
  pickupWindowStart: timestamp("pickup_window_start"),
  pickupWindowEnd: timestamp("pickup_window_end"),
  status: shipmentStatusEnum("status").notNull().default("open"),
  // Phase 2 commitment hold — placeholder until Stripe capture-on-no-show lands.
  commitmentHoldAmount: numeric("commitment_hold_amount"),
  commitmentHoldIntentId: text("commitment_hold_intent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const capacityOffers = pgTable("capacity_offers", {
  id: uuid("id").defaultRandom().primaryKey(),
  transporterId: uuid("transporter_id")
    .notNull()
    .references(() => users.id),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  availableWindowStart: timestamp("available_window_start"),
  availableWindowEnd: timestamp("available_window_end"),
  capacityKg: numeric("capacity_kg"),
  askingPrice: numeric("asking_price"),
  status: capacityStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bids = pgTable("bids", {
  id: uuid("id").defaultRandom().primaryKey(),
  shipmentId: uuid("shipment_id").references(() => shipments.id),
  capacityOfferId: uuid("capacity_offer_id").references(() => capacityOffers.id),
  bidderId: uuid("bidder_id")
    .notNull()
    .references(() => users.id),
  amount: numeric("amount").notNull(),
  message: text("message"),
  // self-reference for counter-offers; not exercised in Phase 1 UI
  parentBidId: uuid("parent_bid_id").references((): AnyPgColumn => bids.id),
  status: bidStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

export const awards = pgTable("awards", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Exactly one of shipmentId / capacityOfferId is set for a given award —
  // this comes from which side of the marketplace the accepted bid lived on.
  // No CHECK constraint yet; route logic maintains the invariant.
  shipmentId: uuid("shipment_id").references(() => shipments.id),
  capacityOfferId: uuid("capacity_offer_id").references(() => capacityOffers.id),
  bidId: uuid("bid_id")
    .notNull()
    .references(() => bids.id),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id),
  transporterId: uuid("transporter_id")
    .notNull()
    .references(() => users.id),
  agreedPrice: numeric("agreed_price").notNull(),
  status: awardStatusEnum("status").notNull().default("confirmed"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("not_implemented"),
  // Phase 2 Stripe Connect targets — Phase 1 writes nothing here.
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeChargeId: text("stripe_charge_id"),
  stripeTransferId: text("stripe_transfer_id"),
  stripeConnectAccountId: text("stripe_connect_account_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
