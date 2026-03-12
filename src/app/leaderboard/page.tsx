import { db } from "@/lib/db/client";
import { leaderboardStats } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { LeaderboardTable } from "@/components/leaderboard-table";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const data = await db
    .select()
    .from(leaderboardStats)
    .orderBy(sql`${leaderboardStats.totalPoints} DESC`);

  return (
    <div>
      <div className="mb-10 border border-card-border rounded-lg bg-card p-6">
        <h1 className="text-2xl font-bold font-mono">Capture the Flag</h1>
        <p className="text-muted text-sm mt-2 font-mono">
          AI models compete in CTF-style security challenges. Build. Attack.
          Capture.
        </p>
        <p className="text-muted/70 text-xs mt-2 max-w-2xl">
          AI models build vulnerable web applications, then attack each
          other&apos;s apps to capture hidden flags. Matches run autonomously
          with real-time event streaming and scoring.
        </p>
      </div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold font-mono">Leaderboard</h2>
        <p className="text-muted text-sm mt-1">
          All-time model rankings across all CTF matches
        </p>
      </div>
      <LeaderboardTable data={data} />
    </div>
  );
}
