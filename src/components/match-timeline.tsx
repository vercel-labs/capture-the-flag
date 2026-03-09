"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VULNERABILITY_REFERENCES } from "@/lib/config/vulnerability-references";
import type { VulnerabilityCategory } from "@/lib/config/types";

interface TimelineEvent {
  eventType: string;
  playerId?: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
}

const EVENT_ICONS: Record<string, string> = {
  match_created: ">>",
  build_started: "[]",
  build_completed: "[+]",
  build_failed: "[x]",
  deploy_started: "->",
  deploy_completed: "->+",
  deploy_failed: "->x",
  vulnerability_registered: "!v",
  attack_started: "!!",
  attack_progress: "..!",
  flag_captured: "**",
  first_blood: "***",
  attack_completed: "!+",
  scoring_started: "##",
  scoring_completed: "#+",
  match_completed: "<<",
  match_failed: "xx",
};

const EVENT_COLORS: Record<string, string> = {
  match_created: "text-muted",
  build_started: "text-warning",
  build_completed: "text-success",
  build_failed: "text-danger",
  deploy_started: "text-warning",
  deploy_completed: "text-success",
  deploy_failed: "text-danger",
  vulnerability_registered: "text-warning",
  attack_started: "text-danger",
  attack_progress: "text-muted",
  flag_captured: "text-success",
  first_blood: "text-yellow-400",
  attack_completed: "text-success",
  scoring_started: "text-muted",
  scoring_completed: "text-success",
  match_completed: "text-success",
  match_failed: "text-danger",
};

// --- Pure formatting functions (exported for testing) ---

export interface EventDetail {
  header: string;
  lines?: string[];
  cweUrl?: string;
}

function formatPayloadGeneric(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string" || typeof value === "number") {
      parts.push(`${key}=${value}`);
    }
  }
  return parts.join(" ");
}

export function formatEventDetails(
  eventType: string,
  payload?: Record<string, unknown>,
): EventDetail {
  if (!payload) return { header: "" };

  switch (eventType) {
    case "vulnerability_registered": {
      const category = payload.category as string | undefined;
      const ref = category
        ? VULNERABILITY_REFERENCES[category as VulnerabilityCategory]
        : undefined;
      const cweTag = ref ? ref.cweId : "";
      const header = `[${(category ?? "unknown").toUpperCase()}]${cweTag ? ` ${cweTag}` : ""}`;
      const lines: string[] = [];
      if (payload.description) lines.push(String(payload.description));
      if (payload.location) lines.push(`location: ${payload.location}`);
      if (payload.difficulty !== undefined)
        lines.push(`difficulty: ${payload.difficulty}/10`);
      if (payload.modelId) lines.push(`defender: ${payload.modelId}`);
      return { header, lines, cweUrl: ref?.cweUrl };
    }

    case "flag_captured": {
      const attacker = payload.attackerModelId as string | undefined;
      const defender = payload.defenderModelId as string | undefined;
      const pts = payload.pointsAwarded as number | undefined;
      const header = `${attacker ?? "?"} → ${defender ?? "?"}${pts ? ` (+${pts}pts)` : ""}`;
      const lines: string[] = [];
      const category = payload.vulnerabilityCategory as string | undefined;
      if (category) {
        const ref =
          VULNERABILITY_REFERENCES[category as VulnerabilityCategory];
        lines.push(
          `${category.toUpperCase()}${ref ? ` ${ref.cweId}` : ""}`,
        );
      }
      if (payload.vulnerabilityDescription)
        lines.push(String(payload.vulnerabilityDescription));
      if (payload.method) lines.push(`method: ${payload.method}`);
      return { header, lines };
    }

    case "first_blood": {
      const attacker = payload.attackerModelId as string | undefined;
      const defender = payload.defenderModelId as string | undefined;
      return {
        header: `${attacker ?? "?"} drew first blood against ${defender ?? "?"}!`,
      };
    }

    case "scoring_completed": {
      const scores = (payload.scores ?? []) as Array<Record<string, unknown>>;
      const winnerModelId = payload.winnerModelId as string | undefined;
      const lines = scores.map((s) => {
        const model = (s.modelId ?? s.playerId ?? "?") as string;
        const total = (s.totalScore ?? s.score ?? 0) as number;
        const capture = s.capturePoints as number | undefined;
        const fb = s.firstBloodBonus as number | undefined;
        const defense = s.defensePoints as number | undefined;
        const captured = s.flagsCaptured as number | undefined;
        const lost = s.flagsLost as number | undefined;
        const isWinner = winnerModelId && model === winnerModelId;

        let line = `${model}: ${total}pts`;
        if (capture !== undefined || fb !== undefined || defense !== undefined) {
          line += ` (capture=${capture ?? 0}, firstBlood=+${fb ?? 0}, defense=${defense ?? 0})`;
        }
        if (captured !== undefined || lost !== undefined) {
          line += ` | ${captured ?? 0} captured, ${lost ?? 0} lost`;
        }
        if (isWinner) line += " [WINNER]";
        return line;
      });
      return { header: `${scores.length} players scored`, lines };
    }

    case "attack_progress": {
      const action = payload.action as string | undefined;
      if (action === "http_request") {
        const method = payload.method ?? "GET";
        const url = payload.url ?? "";
        const status = payload.status;
        return {
          header: `${method} ${url}${status !== undefined ? ` -> ${status}` : ""}`,
        };
      }
      if (action === "flag_attempt") {
        return {
          header: `flag attempt failed: ${payload.error ?? "unknown error"}`,
        };
      }
      return { header: formatPayloadGeneric(payload) };
    }

    default:
      return { header: formatPayloadGeneric(payload) };
  }
}

// --- Component ---

export function MatchTimeline({
  matchId,
  initialEvents = [],
}: {
  matchId: string;
  initialEvents?: TimelineEvent[];
}) {
  const [events, setEvents] = useState<TimelineEvent[]>(initialEvents);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 40;
    isAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  }, []);

  // Auto-scroll when new events arrive
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el && isAtBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [events.length]);

  // Scroll to bottom on initial mount
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const eventSource = new EventSource(`/api/matches/${matchId}/events`);

    eventSource.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as TimelineEvent;
        if (event.eventType === "stream_end") {
          eventSource.close();
          return;
        }
        setEvents((prev) => [...prev, event]);
      } catch {
        // ignore parse errors
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, [matchId]);

  return (
    <div className="border border-card-border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-card-border flex items-center justify-between">
        <h3 className="font-mono text-sm font-medium">Timeline</h3>
        <span className="text-xs text-muted">{events.length} events</span>
      </div>
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="max-h-96 overflow-y-auto font-mono text-xs"
      >
        {events.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted">
            Waiting for events...
          </div>
        ) : (
          events.map((event, i) => {
            const detail = formatEventDetails(event.eventType, event.payload);
            return (
              <div
                key={i}
                className="px-4 py-1.5 border-b border-card-border/30 hover:bg-card-border/10"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`${EVENT_COLORS[event.eventType] || "text-muted"} w-8 shrink-0`}
                  >
                    {EVENT_ICONS[event.eventType] || ".."}
                  </span>
                  <span className="text-muted w-16 shrink-0">
                    {event.timestamp
                      ? new Date(event.timestamp).toLocaleTimeString("en-US", {
                          hour12: false,
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })
                      : ""}
                  </span>
                  <span
                    className={
                      EVENT_COLORS[event.eventType] || "text-foreground"
                    }
                  >
                    {event.eventType.replace(/_/g, " ")}
                  </span>
                  {detail.header && (
                    <span className="text-muted">
                      {detail.cweUrl ? (
                        <>
                          {detail.header.split(detail.cweUrl ? "CWE-" : "\0")[0]}
                          <a
                            href={detail.cweUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-foreground"
                          >
                            {detail.header.match(/CWE-\d+/)?.[0] ?? ""}
                          </a>
                          {detail.header.split(/CWE-\d+/)[1] ?? ""}
                        </>
                      ) : (
                        detail.header
                      )}
                    </span>
                  )}
                </div>
                {detail.lines && detail.lines.length > 0 && (
                  <div className="ml-[6.5rem] mt-0.5 space-y-0.5">
                    {detail.lines.map((line, j) => (
                      <div key={j} className="text-muted/70">
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
