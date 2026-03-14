"use client";

import { ModelAvatar } from "./model-avatar";

interface ModelFilterProps {
  models: string[];
  selected: Set<string>;
  onToggle: (modelId: string) => void;
}

function getShortName(modelId: string): string {
  const parts = modelId.split("/");
  return parts[parts.length - 1];
}

export function ModelFilter({ models, selected, onToggle }: ModelFilterProps) {
  if (models.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {models.map((modelId) => {
        const isSelected = selected.has(modelId);
        return (
          <button
            key={modelId}
            type="button"
            onClick={() => onToggle(modelId)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-mono transition-all ${
              isSelected
                ? "border-accent ring-1 ring-accent bg-accent-dim text-foreground"
                : "border-card-border bg-card text-muted opacity-60 hover:opacity-80"
            }`}
          >
            <ModelAvatar modelId={modelId} size="sm" />
            <span>{getShortName(modelId)}</span>
          </button>
        );
      })}
    </div>
  );
}
