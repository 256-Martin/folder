CREATE TABLE "share_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"token_hint" text NOT NULL,
	"mode" text NOT NULL,
	"label" text,
	"guest_user_id" integer NOT NULL,
	"created_by_id" integer,
	"created_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_name" text,
	"last_used_at" timestamp with time zone,
	"uses" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "share_link" ADD CONSTRAINT "share_link_guest_user_id_app_user_id_fk" FOREIGN KEY ("guest_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_link" ADD CONSTRAINT "share_link_created_by_id_app_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "share_link_token_idx" ON "share_link" USING btree ("token_hash");