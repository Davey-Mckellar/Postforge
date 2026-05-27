CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"plan_id" text DEFAULT 'free' NOT NULL,
	"ai_credits" integer DEFAULT 0 NOT NULL,
	"activation_status" text DEFAULT 'PENDING' NOT NULL,
	"first_scheduled_post_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"voice_profile" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "brands" ADD CONSTRAINT "brands_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;

CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"brand_id" uuid,
	"model" text NOT NULL,
	"run_type" text NOT NULL,
	"estimated_tokens" integer,
	"reserved_credits" integer DEFAULT 0 NOT NULL,
	"actual_input_tokens" integer,
	"actual_output_tokens" integer,
	"charged_credits" integer,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE no action ON UPDATE no action;

CREATE TABLE "ai_usage_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"ai_run_id" uuid,
	"amount" integer NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "ai_usage_ledger" ADD CONSTRAINT "ai_usage_ledger_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "ai_usage_ledger" ADD CONSTRAINT "ai_usage_ledger_ai_run_id_ai_runs_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "ai_runs"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "ai_usage_ledger_organization_id_idx" ON "ai_usage_ledger" USING btree ("organization_id");

CREATE TABLE "content_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"item_count" integer DEFAULT 30 NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "content_batches" ADD CONSTRAINT "content_batches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "content_batches" ADD CONSTRAINT "content_batches_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "content_batches" ADD CONSTRAINT "content_batches_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "content_batches_organization_id_idx" ON "content_batches" USING btree ("organization_id");

CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"batch_id" uuid,
	"caption" text NOT NULL,
	"pillar" text,
	"visual_brief" text,
	"platform" text DEFAULT 'INSTAGRAM' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"suggested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "drafts" ADD CONSTRAINT "drafts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "drafts" ADD CONSTRAINT "drafts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "drafts" ADD CONSTRAINT "drafts_batch_id_content_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "content_batches"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "drafts_organization_id_idx" ON "drafts" USING btree ("organization_id");

CREATE TABLE "scheduled_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"draft_id" uuid,
	"caption" text NOT NULL,
	"platform" text DEFAULT 'INSTAGRAM' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"posted_at" timestamp with time zone,
	"status" text DEFAULT 'SCHEDULED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "drafts"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "scheduled_posts_organization_id_idx" ON "scheduled_posts" USING btree ("organization_id");
