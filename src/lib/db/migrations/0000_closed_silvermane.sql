CREATE TYPE "public"."match_status" AS ENUM('pending', 'building', 'deploying', 'attacking', 'scoring', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."vulnerability_category" AS ENUM('xss', 'sqli', 'csrf', 'idor', 'ssrf', 'auth_bypass', 'path_traversal', 'command_injection', 'information_disclosure', 'broken_access_control', 'security_misconfiguration');--> statement-breakpoint
CREATE TABLE "flag_captures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"attacker_player_id" uuid NOT NULL,
	"defender_player_id" uuid NOT NULL,
	"vulnerability_id" uuid,
	"submitted_flag" text NOT NULL,
	"is_valid" boolean NOT NULL,
	"points_awarded" integer DEFAULT 0,
	"method" text,
	"captured_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leaderboard_stats" (
	"model_id" text PRIMARY KEY NOT NULL,
	"total_matches" integer DEFAULT 0,
	"total_wins" integer DEFAULT 0,
	"total_flags_captured" integer DEFAULT 0,
	"total_flags_lost" integer DEFAULT 0,
	"total_points" integer DEFAULT 0,
	"avg_capture_time" real,
	"win_rate" real DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "match_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"player_id" uuid,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "match_status" DEFAULT 'pending' NOT NULL,
	"config" jsonb NOT NULL,
	"slack_channel_id" text,
	"slack_thread_ts" text,
	"winner_id" uuid,
	"started_at" timestamp with time zone DEFAULT now(),
	"build_started_at" timestamp with time zone,
	"attack_started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"model_id" text NOT NULL,
	"sandbox_id" text,
	"app_url" text,
	"build_status" text DEFAULT 'pending',
	"attack_status" text DEFAULT 'pending',
	"total_flags_captured" integer DEFAULT 0,
	"total_flags_lost" integer DEFAULT 0,
	"score" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "vulnerabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"category" "vulnerability_category" NOT NULL,
	"description" text NOT NULL,
	"flag_token" text NOT NULL,
	"location" text,
	"difficulty" integer DEFAULT 5 NOT NULL,
	"captured_by_player_id" uuid,
	"point_value" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "vulnerabilities_flag_token_unique" UNIQUE("flag_token")
);
--> statement-breakpoint
ALTER TABLE "flag_captures" ADD CONSTRAINT "flag_captures_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag_captures" ADD CONSTRAINT "flag_captures_attacker_player_id_players_id_fk" FOREIGN KEY ("attacker_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag_captures" ADD CONSTRAINT "flag_captures_defender_player_id_players_id_fk" FOREIGN KEY ("defender_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag_captures" ADD CONSTRAINT "flag_captures_vulnerability_id_vulnerabilities_id_fk" FOREIGN KEY ("vulnerability_id") REFERENCES "public"."vulnerabilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vulnerabilities" ADD CONSTRAINT "vulnerabilities_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vulnerabilities" ADD CONSTRAINT "vulnerabilities_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vulnerabilities" ADD CONSTRAINT "vulnerabilities_captured_by_player_id_players_id_fk" FOREIGN KEY ("captured_by_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;