import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { galleryUrl, parseGalleryPage, slugify } from "./gallery";

const html = readFileSync(path.join(__dirname, "../__fixtures__/clubs/tum-club-gallery.page1.html"), "utf8");

describe("parseGalleryPage", () => {
  const page = parseGalleryPage(html);

  it("reads all club cards of the page", () => {
    expect(page.clubs).toHaveLength(48);
    expect(page.clubs[0]).toEqual({
      name: "100 Voices – One Planet",
      description: expect.stringMatching(/^The international and interdisciplinary team collects personal testimonies/),
      focusAreas: ["Sustainability & Health"],
      website: "https://100vop.org/",
      imageUrl: expect.stringMatching(/^https:\/\/www\.tum\.de\/fileadmin\/.*\.webp$/),
    });
  });

  it("keeps several focus areas per club", () => {
    const ac = page.clubs.find((c) => c.name === "Academy Consult");
    expect(ac?.focusAreas).toEqual(["Networking & Career", "Business & Entrepreneurship"]);
  });

  it("finds pagination and campus filters", () => {
    expect(page.lastPage).toBe(5);
    expect(page.locations).toEqual(["Freising", "Garching", "Heilbronn", "München", "Straubing", "TUMorrow Hub"]);
  });
});

describe("galleryUrl", () => {
  it("builds page and filter URLs", () => {
    expect(galleryUrl(1)).toBe("https://www.tum.de/en/community/campus-life/student-clubs-gallery");
    expect(galleryUrl(2, "München")).toContain("tx_solr%5Bfilter%5D%5B0%5D=location%3AM%C3%BCnchen");
    expect(galleryUrl(2, "München")).toContain("tx_solr%5Bpage%5D=2");
  });
});

describe("slugify", () => {
  it.each([
    ["180 Degrees Consulting Munich", "180-degrees-consulting-munich"],
    ["AcTUM – the four-stroke drama", "actum-the-four-stroke-drama"],
    ["Akademischer Gesangverein München", "akademischer-gesangverein-muenchen"],
  ])("%s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
