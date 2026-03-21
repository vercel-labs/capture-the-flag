import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock next/headers before importing the module
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import {
  isMatchCreationAllowed,
  isMatchCreationAllowedFromRequest,
} from "@/lib/match-creation-guard";
import { cookies } from "next/headers";

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("isMatchCreationAllowedFromRequest", () => {
  it("returns true when DISABLE_CREATE_MATCH_ON_WEB is not set", () => {
    delete process.env.DISABLE_CREATE_MATCH_ON_WEB;
    const req = new Request("http://localhost/api/matches", { method: "POST" });
    expect(isMatchCreationAllowedFromRequest(req)).toBe(true);
  });

  it("returns true when DISABLE_CREATE_MATCH_ON_WEB is 'false'", () => {
    process.env.DISABLE_CREATE_MATCH_ON_WEB = "false";
    const req = new Request("http://localhost/api/matches", { method: "POST" });
    expect(isMatchCreationAllowedFromRequest(req)).toBe(true);
  });

  it("returns false when disabled and no override secret is configured", () => {
    process.env.DISABLE_CREATE_MATCH_ON_WEB = "true";
    delete process.env.MATCH_ON_WEB_OVERRIDE;
    const req = new Request("http://localhost/api/matches", { method: "POST" });
    expect(isMatchCreationAllowedFromRequest(req)).toBe(false);
  });

  it("returns false when disabled and cookie is missing", () => {
    process.env.DISABLE_CREATE_MATCH_ON_WEB = "true";
    process.env.MATCH_ON_WEB_OVERRIDE = "my-secret";
    const req = new Request("http://localhost/api/matches", { method: "POST" });
    expect(isMatchCreationAllowedFromRequest(req)).toBe(false);
  });

  it("returns false when disabled and cookie has wrong value", () => {
    process.env.DISABLE_CREATE_MATCH_ON_WEB = "true";
    process.env.MATCH_ON_WEB_OVERRIDE = "my-secret";
    const req = new Request("http://localhost/api/matches", {
      method: "POST",
      headers: { cookie: "match-web-secret=wrong-secret" },
    });
    expect(isMatchCreationAllowedFromRequest(req)).toBe(false);
  });

  it("returns true when disabled but cookie matches override secret", () => {
    process.env.DISABLE_CREATE_MATCH_ON_WEB = "true";
    process.env.MATCH_ON_WEB_OVERRIDE = "my-secret";
    const req = new Request("http://localhost/api/matches", {
      method: "POST",
      headers: { cookie: "match-web-secret=my-secret" },
    });
    expect(isMatchCreationAllowedFromRequest(req)).toBe(true);
  });

  it("returns true when cookie value is URL-encoded", () => {
    process.env.DISABLE_CREATE_MATCH_ON_WEB = "true";
    process.env.MATCH_ON_WEB_OVERRIDE = "secret+with/special=chars";
    const req = new Request("http://localhost/api/matches", {
      method: "POST",
      headers: { cookie: "match-web-secret=secret%2Bwith%2Fspecial%3Dchars" },
    });
    expect(isMatchCreationAllowedFromRequest(req)).toBe(true);
  });

  it("handles cookie among multiple cookies", () => {
    process.env.DISABLE_CREATE_MATCH_ON_WEB = "true";
    process.env.MATCH_ON_WEB_OVERRIDE = "my-secret";
    const req = new Request("http://localhost/api/matches", {
      method: "POST",
      headers: { cookie: "theme=dark; match-web-secret=my-secret; other=val" },
    });
    expect(isMatchCreationAllowedFromRequest(req)).toBe(true);
  });
});

describe("isMatchCreationAllowed", () => {
  it("returns true when DISABLE_CREATE_MATCH_ON_WEB is not set", async () => {
    delete process.env.DISABLE_CREATE_MATCH_ON_WEB;
    expect(await isMatchCreationAllowed()).toBe(true);
  });

  it("returns false when disabled and no override configured", async () => {
    process.env.DISABLE_CREATE_MATCH_ON_WEB = "true";
    delete process.env.MATCH_ON_WEB_OVERRIDE;
    expect(await isMatchCreationAllowed()).toBe(false);
  });

  it("returns false when disabled and cookie is missing", async () => {
    process.env.DISABLE_CREATE_MATCH_ON_WEB = "true";
    process.env.MATCH_ON_WEB_OVERRIDE = "my-secret";
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as never);
    expect(await isMatchCreationAllowed()).toBe(false);
  });

  it("returns true when disabled but cookie matches override", async () => {
    process.env.DISABLE_CREATE_MATCH_ON_WEB = "true";
    process.env.MATCH_ON_WEB_OVERRIDE = "my-secret";
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ name: "match-web-secret", value: "my-secret" }),
    } as never);
    expect(await isMatchCreationAllowed()).toBe(true);
  });

  it("returns true when cookie value is URL-encoded", async () => {
    process.env.DISABLE_CREATE_MATCH_ON_WEB = "true";
    process.env.MATCH_ON_WEB_OVERRIDE = "secret+with/special=chars";
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ name: "match-web-secret", value: "secret%2Bwith%2Fspecial%3Dchars" }),
    } as never);
    expect(await isMatchCreationAllowed()).toBe(true);
  });
});
