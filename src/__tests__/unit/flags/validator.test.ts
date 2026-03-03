import { describe, it, expect } from "vitest";
import { isValidFlagFormat } from "@/lib/flags/generator";

describe("isValidFlagFormat (validator integration)", () => {
  it("validates correct flags", () => {
    expect(isValidFlagFormat("CTF{a3f2_07_e9c1b4d82f6a0753}")).toBe(true);
    expect(isValidFlagFormat("CTF{dead_01_0000000000000000}")).toBe(true);
    expect(isValidFlagFormat("CTF{abcd_99_ffffffffffffffff}")).toBe(true);
  });

  it("rejects malformed flags", () => {
    expect(isValidFlagFormat("")).toBe(false);
    expect(isValidFlagFormat("not a flag")).toBe(false);
    expect(isValidFlagFormat("CTF{}")).toBe(false);
    expect(isValidFlagFormat("CTF{short}")).toBe(false);
    expect(isValidFlagFormat("ctf{a3f2_07_e9c1b4d82f6a0753}")).toBe(false);
  });
});
