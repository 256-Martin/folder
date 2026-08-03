CREATE TABLE "accounting_mapping" (
	"id" serial PRIMARY KEY NOT NULL,
	"mapping_key" text NOT NULL,
	"debit_account" text,
	"credit_account" text,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_setting" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'VIEW' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" integer,
	"user_name" text DEFAULT '(unknown)' NOT NULL,
	"action" text NOT NULL,
	"entity" text,
	"ref_id" text,
	"details" jsonb,
	"result" text DEFAULT 'OK' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_no" text NOT NULL,
	"item_id" integer NOT NULL,
	"supplier_id" integer,
	"purchase_date" date NOT NULL,
	"qty_received" double precision NOT NULL,
	"unit_cost" double precision,
	"quality" text,
	"purchase_id" integer,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch_rename_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"old_batch_no" text NOT NULL,
	"new_batch_no" text NOT NULL,
	"item_code" text,
	"old_purchase_date" date,
	"new_purchase_date" date,
	"changed_by_name" text DEFAULT '(unknown)' NOT NULL,
	"reason" text,
	"source_purchase_code" text,
	"status" text DEFAULT 'Applied' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deduction" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"date" date NOT NULL,
	"worker_id" integer NOT NULL,
	"deduction_type" text NOT NULL,
	"amount" double precision NOT NULL,
	"reason" text,
	"approved_by" text,
	"status" text DEFAULT 'Pending' NOT NULL,
	"notes" text,
	"voided_at" timestamp with time zone,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatch" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"date" date NOT NULL,
	"destination_name" text NOT NULL,
	"product_item_id" integer NOT NULL,
	"qty" double precision NOT NULL,
	"unit_price" double precision,
	"note" text,
	"destination_type" text,
	"person_responsible" text,
	"delivery_note_no" text,
	"sales_order_no" text,
	"voided_at" timestamp with time zone,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"date" date NOT NULL,
	"provider_id" integer NOT NULL,
	"expense_category" text,
	"period_from" date,
	"period_to" date,
	"plates" double precision,
	"plate_cost" double precision,
	"total_bill" double precision NOT NULL,
	"amount_paid" double precision DEFAULT 0 NOT NULL,
	"account_paid_from" text,
	"payment_method" text,
	"transaction_no" text,
	"paid_by" text,
	"notes" text,
	"voided_at" timestamp with time zone,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movement" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"date" date NOT NULL,
	"item_id" integer NOT NULL,
	"batch_no" text,
	"movement_type" text NOT NULL,
	"qty" double precision NOT NULL,
	"unit_cost" double precision,
	"ref_source" text,
	"by_name" text,
	"note" text,
	"issued_to_type" text,
	"issued_to" text,
	"received_by" text,
	"source_purchase_id" integer,
	"source_operation_id" integer,
	"source_dispatch_id" integer,
	"voided_at" timestamp with time zone,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"base_uom" text NOT NULL,
	"standard_cost" double precision,
	"reorder_level" double precision,
	"tracked_by_batch" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "list_option" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"value" text NOT NULL,
	"numeric_meta" double precision,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"date" date NOT NULL,
	"worker_id" integer NOT NULL,
	"plate_count" double precision NOT NULL,
	"qualified" text DEFAULT 'No' NOT NULL,
	"qualified_plates" double precision DEFAULT 0 NOT NULL,
	"unqualified_plates" double precision DEFAULT 0 NOT NULL,
	"company_contribution" double precision DEFAULT 0 NOT NULL,
	"worker_top_up" double precision DEFAULT 0 NOT NULL,
	"full_cost_deduction" double precision DEFAULT 0 NOT NULL,
	"total_worker_deduction" double precision DEFAULT 0 NOT NULL,
	"worker_cash_paid" double precision DEFAULT 0 NOT NULL,
	"net_worker_meal_balance" double precision DEFAULT 0 NOT NULL,
	"week_start" date NOT NULL,
	"company_fully_sponsored" text DEFAULT 'No',
	"food_provider_id" integer,
	"actual_plate_cost" double precision,
	"actual_company_contribution" double precision,
	"worker_required_contribution" double precision,
	"supplier_price_changed" text DEFAULT 'No',
	"contribution_changed" text DEFAULT 'No',
	"reason_for_change" text,
	"note" text,
	"approved_by" text,
	"voided_at" timestamp with time zone,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_cost_setting" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_qualification_rule" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"process_code" text NOT NULL,
	"rule_basis" text NOT NULL,
	"product" text,
	"condition" text,
	"threshold" double precision,
	"weekly_small_min" double precision,
	"weekly_large_min" double precision,
	"eating_days_earned" double precision DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_qualification_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"worker_id" integer NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"daily_days_earned" double precision DEFAULT 0 NOT NULL,
	"tuft_small_week" double precision DEFAULT 0 NOT NULL,
	"tuft_large_week" double precision DEFAULT 0 NOT NULL,
	"tuft_weekly_days" double precision DEFAULT 0 NOT NULL,
	"final_days_earned" double precision DEFAULT 0 NOT NULL,
	"plates_taken" double precision DEFAULT 0 NOT NULL,
	"qualified_plates" double precision DEFAULT 0 NOT NULL,
	"unqualified_plates" double precision DEFAULT 0 NOT NULL,
	"company_contribution" double precision DEFAULT 0 NOT NULL,
	"worker_top_up" double precision DEFAULT 0 NOT NULL,
	"full_cost_deductions" double precision DEFAULT 0 NOT NULL,
	"total_worker_deduction" double precision DEFAULT 0 NOT NULL,
	"expired_unused_days" double precision DEFAULT 0 NOT NULL,
	"status" text,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piece_rate" (
	"id" serial PRIMARY KEY NOT NULL,
	"process_id" integer NOT NULL,
	"product_item_id" integer NOT NULL,
	"rate_per_unit" double precision,
	"unit" text DEFAULT 'piece' NOT NULL,
	"effective_from" date NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "process" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sequence_no" double precision NOT NULL,
	"input_stage" text,
	"output_stage" text,
	"consumes_materials" text,
	"produces_stock_item" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_operation" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"date" date NOT NULL,
	"worker_id" integer NOT NULL,
	"process_id" integer NOT NULL,
	"product_item_id" integer NOT NULL,
	"input_batch" text,
	"output_batch" text,
	"accepted_qty" double precision DEFAULT 0 NOT NULL,
	"rejected_qty" double precision DEFAULT 0 NOT NULL,
	"reject_reason" text,
	"piece_rate_applied" double precision,
	"direct_labour_cost" double precision DEFAULT 0 NOT NULL,
	"wip_stage" text,
	"notes" text,
	"voided_at" timestamp with time zone,
	"created_by_id" integer,
	"created_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"date" date NOT NULL,
	"supplier_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"batch_no" text,
	"qty" double precision NOT NULL,
	"total_cost" double precision NOT NULL,
	"quality_notes" text,
	"voided_at" timestamp with time zone,
	"voided_by_id" integer,
	"created_by_id" integer,
	"created_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_header_setting" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" integer,
	"user_name" text DEFAULT '(unknown)' NOT NULL,
	"action" text DEFAULT 'REPORT_GENERATED' NOT NULL,
	"report_type" text NOT NULL,
	"period" text,
	"filters" text,
	"note" text,
	"status" text DEFAULT 'OK' NOT NULL,
	"output" text
);
--> statement-breakpoint
CREATE TABLE "supplier" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category_supplied" text,
	"contact" text,
	"supplier_type" text DEFAULT 'Inventory Supplier' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "void_register" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"log_type" text NOT NULL,
	"entity" text NOT NULL,
	"source_id" integer,
	"entry_code" text,
	"reason" text NOT NULL,
	"voided_by_id" integer,
	"voided_by_name" text DEFAULT '(unknown)' NOT NULL,
	"status" text DEFAULT 'Voided' NOT NULL,
	"restored_at" timestamp with time zone,
	"restored_by_name" text,
	"reversal_effect" text,
	"old_values" jsonb
);
--> statement-breakpoint
CREATE TABLE "worker" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"processes_able_to_do" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_process_skill" (
	"id" serial PRIMARY KEY NOT NULL,
	"worker_id" integer NOT NULL,
	"process_id" integer NOT NULL,
	"skill_status" text DEFAULT 'Can Do' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_purchase_id_purchase_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchase"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deduction" ADD CONSTRAINT "deduction_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deduction" ADD CONSTRAINT "deduction_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch" ADD CONSTRAINT "dispatch_product_item_id_item_id_fk" FOREIGN KEY ("product_item_id") REFERENCES "public"."item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch" ADD CONSTRAINT "dispatch_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_provider_id_supplier_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_source_purchase_id_purchase_id_fk" FOREIGN KEY ("source_purchase_id") REFERENCES "public"."purchase"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal" ADD CONSTRAINT "meal_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal" ADD CONSTRAINT "meal_food_provider_id_supplier_id_fk" FOREIGN KEY ("food_provider_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal" ADD CONSTRAINT "meal_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_qualification_summary" ADD CONSTRAINT "meal_qualification_summary_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piece_rate" ADD CONSTRAINT "piece_rate_process_id_process_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piece_rate" ADD CONSTRAINT "piece_rate_product_item_id_item_id_fk" FOREIGN KEY ("product_item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_operation" ADD CONSTRAINT "production_operation_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_operation" ADD CONSTRAINT "production_operation_process_id_process_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_operation" ADD CONSTRAINT "production_operation_product_item_id_item_id_fk" FOREIGN KEY ("product_item_id") REFERENCES "public"."item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_operation" ADD CONSTRAINT "production_operation_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_voided_by_id_app_user_id_fk" FOREIGN KEY ("voided_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_log" ADD CONSTRAINT "report_log_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "void_register" ADD CONSTRAINT "void_register_voided_by_id_app_user_id_fk" FOREIGN KEY ("voided_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_process_skill" ADD CONSTRAINT "worker_process_skill_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_process_skill" ADD CONSTRAINT "worker_process_skill_process_id_process_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_mapping_key_idx" ON "accounting_mapping" USING btree ("mapping_key");--> statement-breakpoint
CREATE UNIQUE INDEX "app_setting_key_idx" ON "app_setting" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "app_user_email_idx" ON "app_user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "audit_ts_idx" ON "audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "batch_no_idx" ON "batch" USING btree ("batch_no");--> statement-breakpoint
CREATE INDEX "batch_item_idx" ON "batch" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deduction_code_idx" ON "deduction" USING btree ("code");--> statement-breakpoint
CREATE INDEX "deduction_worker_idx" ON "deduction" USING btree ("worker_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dispatch_code_idx" ON "dispatch" USING btree ("code");--> statement-breakpoint
CREATE INDEX "dispatch_date_idx" ON "dispatch" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_code_idx" ON "expense" USING btree ("code");--> statement-breakpoint
CREATE INDEX "expense_date_idx" ON "expense" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "movement_code_idx" ON "inventory_movement" USING btree ("code");--> statement-breakpoint
CREATE INDEX "movement_item_idx" ON "inventory_movement" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "movement_date_idx" ON "inventory_movement" USING btree ("date");--> statement-breakpoint
CREATE INDEX "movement_type_idx" ON "inventory_movement" USING btree ("movement_type");--> statement-breakpoint
CREATE INDEX "movement_batch_idx" ON "inventory_movement" USING btree ("batch_no");--> statement-breakpoint
CREATE UNIQUE INDEX "item_code_idx" ON "item" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "list_option_unique_idx" ON "list_option" USING btree ("category","value");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_code_idx" ON "meal" USING btree ("code");--> statement-breakpoint
CREATE INDEX "meal_worker_idx" ON "meal" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "meal_date_idx" ON "meal" USING btree ("date");--> statement-breakpoint
CREATE INDEX "meal_week_idx" ON "meal" USING btree ("week_start");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_cost_key_idx" ON "meal_cost_setting" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_rule_id_idx" ON "meal_qualification_rule" USING btree ("rule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_summary_unique_idx" ON "meal_qualification_summary" USING btree ("worker_id","week_start");--> statement-breakpoint
CREATE INDEX "piece_rate_lookup_idx" ON "piece_rate" USING btree ("process_id","product_item_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "process_code_idx" ON "process" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "operation_code_idx" ON "production_operation" USING btree ("code");--> statement-breakpoint
CREATE INDEX "operation_date_idx" ON "production_operation" USING btree ("date");--> statement-breakpoint
CREATE INDEX "operation_worker_idx" ON "production_operation" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "operation_process_idx" ON "production_operation" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "operation_product_idx" ON "production_operation" USING btree ("product_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_code_idx" ON "purchase" USING btree ("code");--> statement-breakpoint
CREATE INDEX "purchase_date_idx" ON "purchase" USING btree ("date");--> statement-breakpoint
CREATE INDEX "purchase_item_idx" ON "purchase" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_header_key_idx" ON "report_header_setting" USING btree ("key");--> statement-breakpoint
CREATE INDEX "report_log_ts_idx" ON "report_log" USING btree ("timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_code_idx" ON "supplier" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "void_code_idx" ON "void_register" USING btree ("code");--> statement-breakpoint
CREATE INDEX "void_source_idx" ON "void_register" USING btree ("entity","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "worker_code_idx" ON "worker" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "worker_skill_unique_idx" ON "worker_process_skill" USING btree ("worker_id","process_id");