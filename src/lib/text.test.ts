import { describe, expect, it } from "vitest";

import { decodeHtmlEntities } from "./text";

describe("decodeHtmlEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeHtmlEntities("Exercises &amp; Laboratory")).toBe("Exercises & Laboratory");
    expect(decodeHtmlEntities("&#252;ber &#x2013; &quot;x&quot;")).toBe('über – "x"');
  });
  it("leaves unknown entities and plain text alone", () => {
    expect(decodeHtmlEntities("a &foo; b & c")).toBe("a &foo; b & c");
  });
});
