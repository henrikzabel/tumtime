import { describe, expect, it } from "vitest";

import { resolveDepartment } from "./departments";

const depts = [
  { id: 1, schoolId: 1, code: "IN", modulePrefixes: ["IN"] },
  { id: 2, schoolId: 1, code: "CIT", modulePrefixes: ["CIT"] },
  { id: 3, schoolId: 2, code: "ASG", modulePrefixes: ["ASG", "LRG", "LR"] },
  { id: 4, schoolId: 3, code: "ME", modulePrefixes: ["ME", "MH"] },
];

describe("resolveDepartment", () => {
  it("matches a simple prefix", () => {
    expect(resolveDepartment("IN0001", depts)?.code).toBe("IN");
  });
  it("prefers the longest prefix", () => {
    expect(resolveDepartment("LRG0123", depts)?.code).toBe("ASG");
    expect(resolveDepartment("LR0001", depts)?.code).toBe("ASG");
  });
  it("requires a digit after the prefix", () => {
    expect(resolveDepartment("MED1234", depts)).toBeUndefined();
    expect(resolveDepartment("CIT5230000", depts)?.code).toBe("CIT");
  });
  it("is case-insensitive", () => {
    expect(resolveDepartment("in2064", depts)?.code).toBe("IN");
  });
});
