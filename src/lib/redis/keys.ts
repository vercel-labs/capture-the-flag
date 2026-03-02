export const redisKeys = {
  matchStatus: (matchId: string) => `ctf:match:${matchId}:status`,
  matchFlags: (matchId: string) => `ctf:match:${matchId}:flags`,
  matchScores: (matchId: string) => `ctf:match:${matchId}:scores`,
  matchCaptures: (matchId: string) => `ctf:match:${matchId}:captures`,
  matchTimeline: (matchId: string) => `ctf:match:${matchId}:timeline`,
  matchFirstCapture: (matchId: string) =>
    `ctf:match:${matchId}:first_capture`,
  matchEvents: (matchId: string) => `ctf:match:${matchId}:events`,
  activeMatches: "ctf:active_matches",
  playerFlagAttempts: (matchId: string, playerId: string) =>
    `ctf:match:${matchId}:player:${playerId}:flag_attempts`,
} as const;
