"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CtfEligibleModel } from "@/lib/ai/models";

const DEFAULT_APP_SPEC =
  "An Express.js web application with user authentication and a simple data API";
const DEFAULT_VULN_COUNT = 5;
const DEFAULT_BUILD_TIME = 600;
const DEFAULT_ATTACK_TIME = 600;

export function NewMatchForm({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<CtfEligibleModel[]>([]);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [appSpec, setAppSpec] = useState(DEFAULT_APP_SPEC);
  const [vulnCount, setVulnCount] = useState(DEFAULT_VULN_COUNT);
  const [buildTime, setBuildTime] = useState(DEFAULT_BUILD_TIME);
  const [attackTime, setAttackTime] = useState(DEFAULT_ATTACK_TIME);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/models")
      .then((res) => res.json())
      .then((data: CtfEligibleModel[]) => setModels(data))
      .catch(() => setModels([]));
  }, [open]);

  function toggleModel(modelId: string) {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedModels.size < 2) {
      setError("Select at least 2 models");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            appSpec,
            vulnerabilityCount: vulnCount,
            models: Array.from(selectedModels),
            buildTimeLimitSeconds: buildTime,
            attackTimeLimitSeconds: attackTime,
          },
        }),
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

  if (disabled) {
    return null;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="font-mono text-xs border border-accent text-accent rounded px-3 py-1.5 hover:bg-accent/10 transition-colors"
      >
        + New Match
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-card-border rounded-lg bg-card p-4 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-sm font-medium">New Match</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted text-xs hover:text-foreground font-mono"
        >
          Cancel
        </button>
      </div>

      {/* Model selection */}
      <div className="space-y-2">
        <label className="text-xs font-mono text-muted block">
          Models (min 2)
        </label>
        <div className="flex flex-wrap gap-1.5">
          {models.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => toggleModel(model.id)}
              className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
                selectedModels.has(model.id)
                  ? "border-accent text-accent bg-accent/10"
                  : "border-card-border text-muted hover:border-muted"
              }`}
              title={model.description}
            >
              {model.label}
            </button>
          ))}
          {models.length === 0 && (
            <span className="text-[10px] text-muted font-mono">
              Loading models...
            </span>
          )}
        </div>
      </div>

      {/* App spec */}
      <div className="space-y-1">
        <label className="text-xs font-mono text-muted block">App Spec</label>
        <input
          type="text"
          value={appSpec}
          onChange={(e) => setAppSpec(e.target.value)}
          className="w-full bg-background border border-card-border rounded px-2 py-1 text-xs font-mono text-foreground focus:border-accent focus:outline-none"
        />
      </div>

      {/* Numeric config fields */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted block">
            Vulnerabilities
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={vulnCount}
            onChange={(e) => setVulnCount(Number(e.target.value))}
            className="w-full bg-background border border-card-border rounded px-2 py-1 text-xs font-mono text-foreground focus:border-accent focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted block">
            Build time (s)
          </label>
          <input
            type="number"
            min={60}
            max={1800}
            value={buildTime}
            onChange={(e) => setBuildTime(Number(e.target.value))}
            className="w-full bg-background border border-card-border rounded px-2 py-1 text-xs font-mono text-foreground focus:border-accent focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-muted block">
            Attack time (s)
          </label>
          <input
            type="number"
            min={60}
            max={3600}
            value={attackTime}
            onChange={(e) => setAttackTime(Number(e.target.value))}
            className="w-full bg-background border border-card-border rounded px-2 py-1 text-xs font-mono text-foreground focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={loading || selectedModels.size < 2}
          className="font-mono text-xs border border-accent text-accent rounded px-3 py-1.5 hover:bg-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Starting..." : "Start Match"}
        </button>
        {selectedModels.size > 0 && selectedModels.size < 2 && (
          <span className="text-[10px] text-warning font-mono">
            Select {2 - selectedModels.size} more
          </span>
        )}
        {error && (
          <span className="text-xs text-danger font-mono">{error}</span>
        )}
      </div>
    </form>
  );
}
