import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  pgEnum,
} from "drizzle-orm/pg-core";
import {
  matchStatusValues,
  vulnerabilityCategoryValues,
} from "@/lib/config/types";

export const matchStatusEnum = pgEnum("match_status", matchStatusValues);
export const vulnerabilityCategoryEnum = pgEnum(
  "vulnerability_category",
  vulnerabilityCategoryValues
);

export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: matchStatusEnum("status").notNull().default("pending"),
  config: jsonb("config").notNull(),
  slackChannelId: text("slack_channel_id"),
  slackThreadTs: text("slack_thread_ts"),
  winnerId: uuid("winner_id"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  buildStartedAt: timestamp("build_started_at", { withTimezone: true }),
  attackStartedAt: timestamp("attack_started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  modelId: text("model_id").notNull(),
  sandboxId: text("sandbox_id"),
  appUrl: text("app_url"),
  buildStatus: text("build_status").default("pending"),
  attackStatus: text("attack_status").default("pending"),
  totalFlagsCaptured: integer("total_flags_captured").default(0),
  totalFlagsLost: integer("total_flags_lost").default(0),
  score: integer("score").default(0),
});

export const vulnerabilities = pgTable("vulnerabilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  category: vulnerabilityCategoryEnum("category").notNull(),
  description: text("description").notNull(),
  flagToken: text("flag_token").notNull().unique(),
  location: text("location"),
  difficulty: integer("difficulty").notNull().default(5),
  capturedByPlayerId: uuid("captured_by_player_id").references(
    () => players.id
  ),
  pointValue: integer("point_value").notNull().default(100),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const flagCaptures = pgTable("flag_captures", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  attackerPlayerId: uuid("attacker_player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  defenderPlayerId: uuid("defender_player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  vulnerabilityId: uuid("vulnerability_id").references(
    () => vulnerabilities.id
  ),
  submittedFlag: text("submitted_flag").notNull(),
  isValid: boolean("is_valid").notNull(),
  pointsAwarded: integer("points_awarded").default(0),
  method: text("method"),
  capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow(),
});

export const leaderboardStats = pgTable("leaderboard_stats", {
  modelId: text("model_id").primaryKey(),
  totalMatches: integer("total_matches").default(0),
  totalWins: integer("total_wins").default(0),
  totalFlagsCaptured: integer("total_flags_captured").default(0),
  totalFlagsLost: integer("total_flags_lost").default(0),
  totalPoints: integer("total_points").default(0),
  avgCaptureTime: real("avg_capture_time"),
  winRate: real("win_rate").default(0),
});

export const matchEvents = pgTable("match_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  playerId: uuid("player_id").references(() => players.id),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
