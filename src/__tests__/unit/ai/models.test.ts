import { describe, it, expect, vi, beforeEach } from "vitest";
import { CTF_ELIGIBLE_MODELS, getAvailableCtfModels, getCtfModelOptions } from "@/lib/ai/models";

vi.mock("@/lib/ai/gateway", () => ({
  gateway: {
    getAvailableModels: vi.fn(),
  },
}));

import { gateway } from "@/lib/ai/gateway";

const mockGetAvailableModels = vi.mocked(gateway.getAvailableModels);

describe("CTF_ELIGIBLE_MODELS", () => {
  it("has at least 2 entries", () => {
    expect(CTF_ELIGIBLE_MODELS.length).toBeGreaterThanOrEqual(2);
  });

  it("has unique IDs", () => {
    const ids = CTF_ELIGIBLE_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all IDs follow provider/model format", () => {
    for (const model of CTF_ELIGIBLE_MODELS) {
      expect(model.id).toMatch(/^[a-z]+\/[a-z0-9._-]+$/i);
    }
  });

  it("all entries have non-empty label and description", () => {
    for (const model of CTF_ELIGIBLE_MODELS) {
      expect(model.label.length).toBeGreaterThan(0);
      expect(model.description.length).toBeGreaterThan(0);
    }
  });
});

describe("getAvailableCtfModels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only gateway-available models from the eligible list", async () => {
    mockGetAvailableModels.mockResolvedValue({
      models: [
        { id: CTF_ELIGIBLE_MODELS[0].id, name: "A", specification: {} as never },
        { id: CTF_ELIGIBLE_MODELS[1].id, name: "B", specification: {} as never },
        { id: "some/unknown-model", name: "Unknown", specification: {} as never },
      ],
    });

    const result = await getAvailableCtfModels();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(CTF_ELIGIBLE_MODELS[0].id);
    expect(result[1].id).toBe(CTF_ELIGIBLE_MODELS[1].id);
  });

  it("returns CtfEligibleModel objects (not SelectOptionElement)", async () => {
    mockGetAvailableModels.mockResolvedValue({
      models: CTF_ELIGIBLE_MODELS.slice(0, 3).map((m) => ({
        id: m.id,
        name: m.label,
        specification: {} as never,
      })),
    });

    const result = await getAvailableCtfModels();

    for (const model of result) {
      expect(model).toHaveProperty("id");
      expect(model).toHaveProperty("label");
      expect(model).toHaveProperty("description");
    }
  });

  it("excludes non-language models", async () => {
    mockGetAvailableModels.mockResolvedValue({
      models: [
        { id: CTF_ELIGIBLE_MODELS[0].id, name: "A", modelType: "language", specification: {} as never },
        { id: CTF_ELIGIBLE_MODELS[1].id, name: "B", modelType: "language", specification: {} as never },
        { id: CTF_ELIGIBLE_MODELS[2].id, name: "C", modelType: "embedding", specification: {} as never },
      ],
    });

    const result = await getAvailableCtfModels();

    expect(result).toHaveLength(2);
  });

  it("falls back to full list on gateway error", async () => {
    mockGetAvailableModels.mockRejectedValue(new Error("Network error"));

    const result = await getAvailableCtfModels();

    expect(result).toHaveLength(CTF_ELIGIBLE_MODELS.length);
    expect(result).toEqual(CTF_ELIGIBLE_MODELS);
  });

  it("falls back to full list when gateway returns empty", async () => {
    mockGetAvailableModels.mockResolvedValue({ models: [] });

    const result = await getAvailableCtfModels();

    expect(result).toEqual(CTF_ELIGIBLE_MODELS);
  });

  it("falls back when fewer than 2 models match", async () => {
    mockGetAvailableModels.mockResolvedValue({
      models: [
        { id: CTF_ELIGIBLE_MODELS[0].id, name: "A", specification: {} as never },
      ],
    });

    const result = await getAvailableCtfModels();

    expect(result).toEqual(CTF_ELIGIBLE_MODELS);
  });

  it("falls back on gateway timeout", async () => {
    mockGetAvailableModels.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 5000))
    );

    const result = await getAvailableCtfModels();

    expect(result).toEqual(CTF_ELIGIBLE_MODELS);
  }, 10000);
});

describe("getCtfModelOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters to gateway-available models", async () => {
    mockGetAvailableModels.mockResolvedValue({
      models: [
        { id: CTF_ELIGIBLE_MODELS[0].id, name: "Model A", specification: {} as never },
        { id: CTF_ELIGIBLE_MODELS[1].id, name: "Model B", specification: {} as never },
        { id: "some/unknown-model", name: "Unknown", specification: {} as never },
      ],
    });

    const options = await getCtfModelOptions();

    expect(options).toHaveLength(2);
    expect(options[0].value).toBe(CTF_ELIGIBLE_MODELS[0].id);
    expect(options[1].value).toBe(CTF_ELIGIBLE_MODELS[1].id);
  });

  it("excludes non-language models from gateway results", async () => {
    mockGetAvailableModels.mockResolvedValue({
      models: [
        { id: CTF_ELIGIBLE_MODELS[0].id, name: "A", modelType: "language", specification: {} as never },
        { id: CTF_ELIGIBLE_MODELS[1].id, name: "B", modelType: "language", specification: {} as never },
        { id: CTF_ELIGIBLE_MODELS[2].id, name: "C", modelType: "embedding", specification: {} as never },
        { id: CTF_ELIGIBLE_MODELS[3].id, name: "D", modelType: "image", specification: {} as never },
      ],
    });

    const options = await getCtfModelOptions();

    expect(options).toHaveLength(2);
    expect(options[0].value).toBe(CTF_ELIGIBLE_MODELS[0].id);
    expect(options[1].value).toBe(CTF_ELIGIBLE_MODELS[1].id);
  });

  it("treats null modelType as language", async () => {
    mockGetAvailableModels.mockResolvedValue({
      models: [
        { id: CTF_ELIGIBLE_MODELS[0].id, name: "A", modelType: null, specification: {} as never },
      ],
    });

    const options = await getCtfModelOptions();

    expect(options).toHaveLength(CTF_ELIGIBLE_MODELS.length); // Falls back — only 1 available < 2
  });

  it("falls back to full list on gateway error", async () => {
    mockGetAvailableModels.mockRejectedValue(new Error("Network error"));

    const options = await getCtfModelOptions();

    expect(options).toHaveLength(CTF_ELIGIBLE_MODELS.length);
  });

  it("falls back to full list when gateway returns empty", async () => {
    mockGetAvailableModels.mockResolvedValue({ models: [] });

    const options = await getCtfModelOptions();

    expect(options).toHaveLength(CTF_ELIGIBLE_MODELS.length);
  });

  it("falls back when fewer than 2 models match", async () => {
    mockGetAvailableModels.mockResolvedValue({
      models: [
        { id: CTF_ELIGIBLE_MODELS[0].id, name: "A", specification: {} as never },
      ],
    });

    const options = await getCtfModelOptions();

    expect(options).toHaveLength(CTF_ELIGIBLE_MODELS.length);
  });

  it("returns SelectOptionElement-compatible objects", async () => {
    mockGetAvailableModels.mockResolvedValue({
      models: CTF_ELIGIBLE_MODELS.map((m) => ({
        id: m.id,
        name: m.label,
        specification: {} as never,
      })),
    });

    const options = await getCtfModelOptions();

    for (const opt of options) {
      expect(opt).toHaveProperty("label");
      expect(opt).toHaveProperty("value");
      expect(typeof opt.label).toBe("string");
      expect(typeof opt.value).toBe("string");
    }
  });

  it("falls back on gateway timeout", async () => {
    mockGetAvailableModels.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 5000))
    );

    const options = await getCtfModelOptions();

    expect(options).toHaveLength(CTF_ELIGIBLE_MODELS.length);
  }, 10000);
});
