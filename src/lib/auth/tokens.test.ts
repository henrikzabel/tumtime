import { describe, expect, it } from "vitest";

import { adminEmails, allowedDomains, generateToken, hashToken, isAllowedEmail, safeRedirect } from "./tokens";

describe("isAllowedEmail", () => {
  const domains = allowedDomains(undefined);
  it.each([
    ["ge12abc@mytum.de", true],
    ["Max.Mustermann@TUM.de", true],
    ["someone@in.tum.de", true],
    ["someone@cit.tum.de", true],
    ["someone@gmail.com", false],
    ["someone@nottum.de", false],
    ["someone@tum.de.evil.com", false],
    ["not-an-email", false],
  ])("%s → %s", (email, ok) => {
    expect(isAllowedEmail(email, domains)).toBe(ok);
  });
});

describe("tokens", () => {
  it("are random, URL-safe and hashed deterministically", () => {
    const a = generateToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(generateToken());
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).toHaveLength(64);
  });
});

describe("adminEmails", () => {
  it("parses a comma-separated list", () => {
    expect([...adminEmails(" A@tum.de, b@mytum.de ,")]).toEqual(["a@tum.de", "b@mytum.de"]);
  });
});

describe("safeRedirect", () => {
  it.each([
    ["/clubs/x", "/clubs/x"],
    ["https://evil.com", "/me"],
    ["//evil.com", "/me"],
    ["/\\evil.com", "/me"],
    [null, "/me"],
  ])("%s → %s", (input, expected) => {
    expect(safeRedirect(input)).toBe(expected);
  });
});
