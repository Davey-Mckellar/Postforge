ALTER TYPE "public"."payment_status" ADD VALUE 'authorized';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'captured';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'refunded';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'failed';--> statement-breakpoint
ALTER TABLE "awards" ADD COLUMN "stripe_payment_intent_id" text;--> statement-breakpoint
ALTER TABLE "awards" ADD COLUMN "stripe_charge_id" text;--> statement-breakpoint
ALTER TABLE "awards" ADD COLUMN "stripe_transfer_id" text;--> statement-breakpoint
ALTER TABLE "awards" ADD COLUMN "stripe_connect_account_id" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "commitment_hold_amount" numeric;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "commitment_hold_intent_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_connect_account_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "linkedin_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nsc_mc_number" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "fmcsa_mc_number" text;