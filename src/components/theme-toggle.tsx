"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const themes = ["dark", "light", "system"] as const;
const icons: Record<string, string> = {
  dark: "\u263D",
  light: "\u2600",
  system: "\u25D1",
};

const emptySubscribe = () => () => {};

function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return <span className="font-mono text-xs text-muted w-16" />;
  }

  const current = theme ?? "dark";
  const next = themes[(themes.indexOf(current as (typeof themes)[number]) + 1) % themes.length];

  return (
    <button
      onClick={() => setTheme(next)}
      className="font-mono text-xs text-muted hover:text-foreground transition-colors"
      aria-label={`Theme: ${current}`}
    >
      {icons[current]} {current}
    </button>
  );
}
