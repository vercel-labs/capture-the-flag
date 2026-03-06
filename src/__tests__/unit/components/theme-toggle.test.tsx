// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "@/components/theme-toggle";

let mockTheme = "dark";
const mockSetTheme = vi.fn((t: string) => {
  mockTheme = t;
});

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: mockTheme, setTheme: mockSetTheme }),
}));

beforeEach(() => {
  mockTheme = "dark";
  mockSetTheme.mockClear();
});

describe("ThemeToggle", () => {
  it("renders with the current theme label", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Theme: dark" })).toBeDefined();
    expect(screen.getByRole("button").textContent).toContain("dark");
  });

  it("cycles from dark to light on click", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("cycles from light to system on click", () => {
    mockTheme = "light";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("system");
  });

  it("cycles from system to dark on click", () => {
    mockTheme = "system";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });
});
