"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MatchConfig } from "@/lib/config/types";

interface RerunMatchButtonProps {
  config: Partial<MatchConfig>;
  hidden?: boolean;
}

export function RerunMatchButton({ config, hidden }: RerunMatchButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hidden) return null;

  async function handleRerun() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) {
        throw new Error(`Failed to start match (${res.status})`);
      }
      router.push("/matches");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start match");
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRerun}
        disabled={loading}
        className="font-mono text-xs border border-card-border rounded px-3 py-1.5 hover:border-accent hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Starting..." : "Re-run Match"}
      </button>
      {error && <span className="text-xs text-danger font-mono">{error}</span>}
    </div>
  );
}
