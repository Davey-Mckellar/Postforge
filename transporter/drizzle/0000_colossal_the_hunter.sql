CREATE TYPE "public"."award_status" AS ENUM('confirmed', 'picked_up', 'in_transit', 'delivered', 'disputed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."bid_status" AS ENUM('open', 'withdrawn', 'countered', 'accepted', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."capacity_status" AS ENUM('open', 'matched', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('not_implemented');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('open', 'bidding', 'awarded', 'in_transit', 'delivered', 'disputed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('sender', 'transporter', 'both');--> statement-breakpoint
CREATE TYPE "public"."verification_tier" AS ENUM('unverified', 'basic', 'verified');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
	"userId" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"capacity_offer_id" uuid,
	"bid_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"transporter_id" uuid NOT NULL,
	"agreed_price" numeric NOT NULL,
	"status" "award_status" DEFAULT 'confirmed' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'not_implemented' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid,
	"capacity_offer_id" uuid,
	"bidder_id" uuid NOT NULL,
	"amount" numeric NOT NULL,
	"message" text,
	"parent_bid_id" uuid,
	"status" "bid_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "capacity_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transporter_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"available_window_start" timestamp,
	"available_window_end" timestamp,
	"capacity_kg" numeric,
	"asking_price" numeric,
	"status" "capacity_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"cargo_description" text,
	"weight_kg" numeric,
	"declared_value" numeric,
	"target_price" numeric,
	"pickup_window_start" timestamp,
	"pickup_window_end" timestamp,
	"status" "shipment_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'both' NOT NULL,
	"verification_tier" "verification_tier" DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account" ADD CONSTRAINT "account_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "awards" ADD CONSTRAINT "awards_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "awards" ADD CONSTRAINT "awards_capacity_offer_id_capacity_offers_id_fk" FOREIGN KEY ("capacity_offer_id") REFERENCES "public"."capacity_offers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "awards" ADD CONSTRAINT "awards_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "awards" ADD CONSTRAINT "awards_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "awards" ADD CONSTRAINT "awards_transporter_id_users_id_fk" FOREIGN KEY ("transporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bids" ADD CONSTRAINT "bids_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bids" ADD CONSTRAINT "bids_capacity_offer_id_capacity_offers_id_fk" FOREIGN KEY ("capacity_offer_id") REFERENCES "public"."capacity_offers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bids" ADD CONSTRAINT "bids_bidder_id_users_id_fk" FOREIGN KEY ("bidder_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bids" ADD CONSTRAINT "bids_parent_bid_id_bids_id_fk" FOREIGN KEY ("parent_bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "capacity_offers" ADD CONSTRAINT "capacity_offers_transporter_id_users_id_fk" FOREIGN KEY ("transporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session" ADD CONSTRAINT "session_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shipments" ADD CONSTRAINT "shipments_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
