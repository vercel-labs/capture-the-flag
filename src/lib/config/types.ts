import { z } from "zod/v4";

export const matchConfigSchema = z.object({
  appSpec: z
    .string()
    .default(
      "An Express.js web application with user authentication and a simple data API"
    ),
  vulnerabilityCount: z.number().int().min(1).max(20).default(5),
  models: z
    .array(z.string())
    .min(2)
    .default([
      "anthropic/claude-sonnet-4",
      "openai/gpt-4.1",
    ]),
  buildTimeLimitSeconds: z.number().int().min(60).max(1800).default(600),
  attackTimeLimitSeconds: z.number().int().min(60).max(3600).default(600),
});

export type MatchConfig = z.infer<typeof matchConfigSchema>;

export const matchStatusValues = [
  "pending",
  "building",
  "deploying",
  "attacking",
  "scoring",
  "completed",
  "failed",
  "cancelled",
] as const;

export type MatchStatus = (typeof matchStatusValues)[number];

export const vulnerabilityCategoryValues = [
  "xss",
  "sqli",
  "csrf",
  "idor",
  "ssrf",
  "auth_bypass",
  "path_traversal",
  "command_injection",
  "information_disclosure",
  "broken_access_control",
  "security_misconfiguration",
] as const;

export type VulnerabilityCategory =
  (typeof vulnerabilityCategoryValues)[number];

export const matchEventTypes = [
  "match_created",
  "build_started",
  "build_progress",
  "build_completed",
  "build_failed",
  "vulnerability_registered",
  "deploy_started",
  "deploy_completed",
  "deploy_failed",
  "attack_started",
  "attack_progress",
  "flag_captured",
  "first_blood",
  "attack_completed",
  "scoring_started",
  "scoring_completed",
  "match_completed",
  "match_failed",
  "match_cancelled",
] as const;

export type MatchEventType = (typeof matchEventTypes)[number];
