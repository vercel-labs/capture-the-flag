// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MatchesList, type MatchItem } from "@/components/matches-list";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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

  it("renders model filter buttons for unique models", () => {
    const matches = [
      makeMatch({ id: "match-1" }),
      makeMatch({
        id: "match-2",
        players: [
          { id: "p3", modelId: "google/gemini-2.5-pro", score: 400 },
          { id: "p4", modelId: "anthropic/claude-sonnet-4", score: 200 },
        ],
      }),
    ];
    render(<MatchesList initialMatches={matches} />);

    // Should show filter buttons for all 3 unique models
    expect(screen.getByText("claude-sonnet-4")).toBeDefined();
    expect(screen.getByText("gpt-4.1")).toBeDefined();
    expect(screen.getByText("gemini-2.5-pro")).toBeDefined();
  });

  it("shows all matches when no model filter is selected", () => {
    const matches = [
      makeMatch({ id: "match-1" }),
      makeMatch({ id: "match-2" }),
    ];
    render(<MatchesList initialMatches={matches} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
  });

  it("filters matches when a model is selected", () => {
    const matches = [
      makeMatch({ id: "match-1" }),
      makeMatch({
        id: "match-2",
        players: [
          { id: "p3", modelId: "google/gemini-2.5-pro", score: 400 },
          { id: "p4", modelId: "xai/grok-3", score: 200 },
        ],
      }),
    ];
    render(<MatchesList initialMatches={matches} />);

    // Click on gemini filter — only match-2 has gemini
    fireEvent.click(screen.getByText("gemini-2.5-pro"));

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
  });

  it("shows matches for multiple selected models", () => {
    const matches = [
      makeMatch({
        id: "match-1",
        players: [
          { id: "p1", modelId: "anthropic/claude-sonnet-4", score: 500 },
          { id: "p2", modelId: "openai/gpt-4.1", score: 300 },
        ],
      }),
      makeMatch({
        id: "match-2",
        players: [
          { id: "p3", modelId: "google/gemini-2.5-pro", score: 400 },
          { id: "p4", modelId: "xai/grok-3", score: 200 },
        ],
      }),
      makeMatch({
        id: "match-3",
        players: [
          { id: "p5", modelId: "meta/llama-4", score: 100 },
          { id: "p6", modelId: "xai/grok-3", score: 350 },
        ],
      }),
    ];
    render(<MatchesList initialMatches={matches} />);

    // Select claude and gemini — should show match-1 and match-2
    fireEvent.click(screen.getByText("claude-sonnet-4"));
    fireEvent.click(screen.getByText("gemini-2.5-pro"));

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
  });

  it("hides new match form when matchCreationDisabled is true", () => {
    const matches = [makeMatch()];
    render(<MatchesList initialMatches={matches} matchCreationDisabled />);
    expect(screen.queryByText("+ New Match")).toBeNull();
  });

  it("hides new match form in empty state when matchCreationDisabled is true", () => {
    render(<MatchesList initialMatches={[]} matchCreationDisabled />);
    expect(screen.queryByText("+ New Match")).toBeNull();
    expect(screen.getByText("No matches yet.")).toBeDefined();
  });

  it("deselecting all models shows all matches again", () => {
    const matches = [
      makeMatch({ id: "match-1" }),
      makeMatch({
        id: "match-2",
        players: [
          { id: "p3", modelId: "google/gemini-2.5-pro", score: 400 },
          { id: "p4", modelId: "xai/grok-3", score: 200 },
        ],
      }),
    ];
    render(<MatchesList initialMatches={matches} />);

    // Select then deselect
    fireEvent.click(screen.getByText("gemini-2.5-pro"));
    expect(screen.getAllByRole("link")).toHaveLength(1);

    fireEvent.click(screen.getByText("gemini-2.5-pro"));
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
