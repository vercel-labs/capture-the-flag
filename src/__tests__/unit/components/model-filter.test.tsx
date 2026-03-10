// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModelFilter } from "@/components/model-filter";

const models = [
  "anthropic/claude-sonnet-4",
  "openai/gpt-4.1",
  "google/gemini-2.5-pro",
];

describe("ModelFilter", () => {
  it("renders a button for each model", () => {
    render(
      <ModelFilter models={models} selected={new Set()} onToggle={() => {}} />
    );
    expect(screen.getByText("claude-sonnet-4")).toBeDefined();
    expect(screen.getByText("gpt-4.1")).toBeDefined();
    expect(screen.getByText("gemini-2.5-pro")).toBeDefined();
  });

  it("renders nothing when models list is empty", () => {
    const { container } = render(
      <ModelFilter models={[]} selected={new Set()} onToggle={() => {}} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("calls onToggle with the correct modelId when clicked", () => {
    const onToggle = vi.fn();
    render(
      <ModelFilter models={models} selected={new Set()} onToggle={onToggle} />
    );

    fireEvent.click(screen.getByText("gpt-4.1"));
    expect(onToggle).toHaveBeenCalledWith("openai/gpt-4.1");
  });

  it("applies selected styling to selected models", () => {
    render(
      <ModelFilter
        models={models}
        selected={new Set(["openai/gpt-4.1"])}
        onToggle={() => {}}
      />
    );

    const selectedButton = screen.getByText("gpt-4.1").closest("button")!;
    expect(selectedButton.className).toContain("border-accent");

    const unselectedButton = screen
      .getByText("claude-sonnet-4")
      .closest("button")!;
    expect(unselectedButton.className).toContain("opacity-60");
  });

  it("supports multiple selected models", () => {
    render(
      <ModelFilter
        models={models}
        selected={new Set(["openai/gpt-4.1", "google/gemini-2.5-pro"])}
        onToggle={() => {}}
      />
    );

    const gptButton = screen.getByText("gpt-4.1").closest("button")!;
    const geminiButton = screen
      .getByText("gemini-2.5-pro")
      .closest("button")!;
    expect(gptButton.className).toContain("border-accent");
    expect(geminiButton.className).toContain("border-accent");
  });
});
