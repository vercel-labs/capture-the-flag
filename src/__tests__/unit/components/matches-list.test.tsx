// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchesList, type MatchItem } from "@/components/matches-list";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const makeMatch = (overrides: Partial<MatchItem> = {}): MatchItem => ({
  id: "match-1",
  status: "completed",
  startedAt: "2026-01-01T00:00:00Z",
  completedAt: "2026-01-01T00:10:00Z",
  config: { models: ["anthropic/claude-sonnet-4", "openai/gpt-4.1"] },
  winnerId: "p1",
  players: [
    { id: "p1", modelId: "anthropic/claude-sonnet-4", score: 500 },
    { id: "p2", modelId: "openai/gpt-4.1", score: 300 },
  ],
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MatchesList", () => {
  it("renders initial matches", () => {
    const matches = [makeMatch(), makeMatch({ id: "match-2" })];
    render(<MatchesList initialMatches={matches} />);

    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(2);
  });

  it("shows empty state when no matches", () => {
    render(<MatchesList initialMatches={[]} />);
    expect(screen.getByText("No matches yet.")).toBeDefined();
  });

  it("renders match cards with correct structure", () => {
    const matches = [
      makeMatch({ id: "match-1", status: "completed" }),
      makeMatch({ id: "match-2", status: "building" }),
    ];
    render(<MatchesList initialMatches={matches} />);

    // Should render in a grid container
    const grid = screen.getAllByRole("link");
    expect(grid).toHaveLength(2);
  });
});
