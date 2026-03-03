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
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-mono">Leaderboard</h1>
        <p className="text-muted text-sm mt-1">
          All-time model rankings across all CTF matches
        </p>
      </div>
      <LeaderboardTable data={data} />
    </div>
  );
}
