// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NewMatchForm } from "@/components/new-match-form";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const sampleModels = [
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4", description: "Balanced" },
  { id: "openai/gpt-4.1", label: "GPT-4.1", description: "Strong" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Google" },
];

beforeEach(() => {
  vi.restoreAllMocks();
  mockPush.mockClear();
});

describe("NewMatchForm", () => {
  it("renders the toggle button initially", () => {
    render(<NewMatchForm />);
    expect(screen.getByRole("button", { name: "+ New Match" })).toBeDefined();
  });

  it("expands to show the form when clicked", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(sampleModels))
    );

    render(<NewMatchForm />);
    fireEvent.click(screen.getByRole("button", { name: "+ New Match" }));

    expect(screen.getByText("New Match")).toBeDefined();
    expect(screen.getByText("Cancel")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("Claude Sonnet 4")).toBeDefined();
      expect(screen.getByText("GPT-4.1")).toBeDefined();
    });
  });

  it("requires at least 2 models to submit", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(sampleModels))
    );

    render(<NewMatchForm />);
    fireEvent.click(screen.getByRole("button", { name: "+ New Match" }));

    await waitFor(() => {
      expect(screen.getByText("Claude Sonnet 4")).toBeDefined();
    });

    // Submit button should be disabled with 0 models selected
    const submitButton = screen.getByRole("button", { name: "Start Match" });
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    // Select 1 model
    fireEvent.click(screen.getByText("Claude Sonnet 4"));
    expect(screen.getByText(/Select 1 more/)).toBeDefined();

    // Select 2nd model — button should now be enabled
    fireEvent.click(screen.getByText("GPT-4.1"));
    expect((submitButton as HTMLButtonElement).disabled).toBe(false);
  });

  it("submits config and redirects on success", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(sampleModels)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ runId: "run-1" }), { status: 201 }));

    render(<NewMatchForm />);
    fireEvent.click(screen.getByRole("button", { name: "+ New Match" }));

    await waitFor(() => {
      expect(screen.getByText("Claude Sonnet 4")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Claude Sonnet 4"));
    fireEvent.click(screen.getByText("GPT-4.1"));
    fireEvent.click(screen.getByRole("button", { name: "Start Match" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/matches", expect.objectContaining({
        method: "POST",
      }));
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/matches");
    });
  });

  it("shows error on failed submission", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(sampleModels)))
      .mockResolvedValueOnce(new Response("Server Error", { status: 500 }));

    render(<NewMatchForm />);
    fireEvent.click(screen.getByRole("button", { name: "+ New Match" }));

    await waitFor(() => {
      expect(screen.getByText("Claude Sonnet 4")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Claude Sonnet 4"));
    fireEvent.click(screen.getByText("GPT-4.1"));
    fireEvent.click(screen.getByRole("button", { name: "Start Match" }));

    await waitFor(() => {
      expect(screen.getByText("Failed to start match (500)")).toBeDefined();
    });
  });

  it("collapses back when Cancel is clicked", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(sampleModels))
    );

    render(<NewMatchForm />);
    fireEvent.click(screen.getByRole("button", { name: "+ New Match" }));

    expect(screen.getByText("New Match")).toBeDefined();

    fireEvent.click(screen.getByText("Cancel"));

    expect(screen.getByRole("button", { name: "+ New Match" })).toBeDefined();
  });

  it("shows validation error if submitting with fewer than 2 models", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(sampleModels))
    );

    render(<NewMatchForm />);
    fireEvent.click(screen.getByRole("button", { name: "+ New Match" }));

    await waitFor(() => {
      expect(screen.getByText("Claude Sonnet 4")).toBeDefined();
    });

    // Select just 1 model then try to toggle the disabled button via form submission
    fireEvent.click(screen.getByText("Claude Sonnet 4"));

    // The submit button is disabled so the form won't submit via click,
    // but verify the helper text is shown
    expect(screen.getByText(/Select 1 more/)).toBeDefined();
  });
});
