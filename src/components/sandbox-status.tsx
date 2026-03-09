interface SandboxStatusProps {
  status: string | null;
  label?: string;
}

const STATUS_STYLES: Record<string, { color: string; dot: string }> = {
  pending: { color: "text-muted", dot: "bg-muted" },
  building: { color: "text-warning", dot: "bg-warning animate-pulse" },
  completed: { color: "text-success", dot: "bg-success" },
  failed: { color: "text-danger", dot: "bg-danger" },
  deploying: { color: "text-warning", dot: "bg-warning animate-pulse" },
  live: { color: "text-accent", dot: "bg-accent animate-pulse" },
  attacking: { color: "text-danger", dot: "bg-danger animate-pulse" },
  shutdown: { color: "text-muted", dot: "bg-muted" },
};

export function SandboxStatus({ status, label }: SandboxStatusProps) {
  const style = STATUS_STYLES[status || "pending"] || STATUS_STYLES.pending;

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      <span className={`text-xs ${style.color}`}>
        {label ? `${label}: ` : ""}
        {status || "pending"}
      </span>
    </div>
  );
}
