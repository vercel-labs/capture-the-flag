"use client";

import { useEffect, useState } from "react";

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
  attack_started: "!!",
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
  build_completed: "text-accent",
  build_failed: "text-danger",
  deploy_started: "text-warning",
  deploy_completed: "text-accent",
  deploy_failed: "text-danger",
  attack_started: "text-danger",
  flag_captured: "text-accent",
  first_blood: "text-yellow-400",
  attack_completed: "text-accent",
  scoring_started: "text-muted",
  scoring_completed: "text-accent",
  match_completed: "text-accent",
  match_failed: "text-danger",
};

export function MatchTimeline({
  matchId,
  initialEvents = [],
}: {
  matchId: string;
  initialEvents?: TimelineEvent[];
}) {
  const [events, setEvents] = useState<TimelineEvent[]>(initialEvents);

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
      <div className="max-h-96 overflow-y-auto font-mono text-xs">
        {events.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted">
            Waiting for events...
          </div>
        ) : (
          events.map((event, i) => (
            <div
              key={i}
              className="px-4 py-1.5 border-b border-card-border/30 hover:bg-card-border/10 flex items-start gap-2"
            >
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
              <span className={EVENT_COLORS[event.eventType] || "text-foreground"}>
                {event.eventType.replace(/_/g, " ")}
              </span>
              {event.payload && (
                <span className="text-muted truncate">
                  {formatPayload(event.payload)}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatPayload(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string" || typeof value === "number") {
      parts.push(`${key}=${value}`);
    }
  }
  return parts.join(" ");
}
