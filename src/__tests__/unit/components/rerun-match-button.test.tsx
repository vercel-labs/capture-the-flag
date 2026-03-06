// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RerunMatchButton } from "@/components/rerun-match-button";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  mockPush.mockClear();
});

const sampleConfig = {
  appSpec: "A todo app",
  models: ["anthropic/claude-sonnet-4", "openai/gpt-4.1"],
  vulnerabilityCount: 5,
};

describe("RerunMatchButton", () => {
  it("renders the button with correct text", () => {
    render(<RerunMatchButton config={sampleConfig} />);
    expect(screen.getByRole("button", { name: "Re-run Match" })).toBeDefined();
  });

  it("calls POST /api/matches with the config and redirects on success", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ runId: "run-123" }), { status: 201 })
    );

    render(<RerunMatchButton config={sampleConfig} />);
    fireEvent.click(screen.getByRole("button", { name: "Re-run Match" }));

    expect(screen.getByRole("button", { name: "Starting..." })).toBeDefined();

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: sampleConfig }),
      });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/matches");
    });
  });

  it("shows error message on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 })
    );

    render(<RerunMatchButton config={sampleConfig} />);
    fireEvent.click(screen.getByRole("button", { name: "Re-run Match" }));

    await waitFor(() => {
      expect(screen.getByText("Failed to start match (500)")).toBeDefined();
    });

    // Button should be re-enabled after error
    expect(
      screen.getByRole("button", { name: "Re-run Match" })
    ).not.toBeNull();
  });

  it("disables the button while loading", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(new Promise(() => {}));

    render(<RerunMatchButton config={sampleConfig} />);
    fireEvent.click(screen.getByRole("button", { name: "Re-run Match" }));

    const button = screen.getByRole("button", { name: "Starting..." });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
