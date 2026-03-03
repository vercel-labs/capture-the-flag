const MODEL_COLORS: Record<string, string> = {
  anthropic: "bg-orange-500",
  openai: "bg-emerald-500",
  xai: "bg-blue-500",
  google: "bg-red-500",
  meta: "bg-indigo-500",
};

function getProviderColor(modelId: string): string {
  const provider = modelId.split("/")[0];
  return MODEL_COLORS[provider] || "bg-zinc-500";
}

function getInitials(modelId: string): string {
  const parts = modelId.split("/");
  const model = parts[parts.length - 1];
  return model
    .split("-")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ModelAvatar({
  modelId,
  size = "md",
}: {
  modelId: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-8 h-8 text-xs",
    lg: "w-10 h-10 text-sm",
  };

  return (
    <div
      className={`${getProviderColor(modelId)} ${sizeClasses[size]} rounded-full flex items-center justify-center font-mono font-bold text-white`}
      title={modelId}
    >
      {getInitials(modelId)}
    </div>
  );
}
