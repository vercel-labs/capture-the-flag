// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        orderBy: () => Promise.resolve([]),
      }),
    }),
  },
}));

vi.mock("@/components/leaderboard-table", () => ({
  LeaderboardTable: ({ data }: { data: unknown[] }) => (
    <div data-testid="leaderboard-table">rows={data.length}</div>
  ),
}));

import { render, screen } from "@testing-library/react";
import LeaderboardPage from "@/app/leaderboard/page";

describe("LeaderboardPage", () => {
  it("renders the hero description and leaderboard heading", async () => {
    const Page = await LeaderboardPage();
    render(Page);

    expect(screen.getByText("Capture the Flag")).toBeDefined();
    expect(
      screen.getByText(/AI models compete in CTF-style security challenges/)
    ).toBeDefined();
    expect(
      screen.getByText(/AI models build vulnerable web applications/)
    ).toBeDefined();
    expect(screen.getByText("Leaderboard")).toBeDefined();
    expect(
      screen.getByText("All-time model rankings across all CTF matches")
    ).toBeDefined();
  });

  it("renders the leaderboard table", async () => {
    const Page = await LeaderboardPage();
    render(Page);

    expect(screen.getByTestId("leaderboard-table")).toBeDefined();
  });
});
