import * as cheerio from "cheerio";

/**
 * Parser for the TUM Student Club Gallery
 * (https://www.tum.de/en/community/campus-life/student-clubs-gallery). The page is paginated
 * (48 clubs per page); campuses are only available as a filter, so the importer loads each
 * campus filter separately and merges the locations by club name.
 */
export const GALLERY_URL = "https://www.tum.de/en/community/campus-life/student-clubs-gallery";

export type GalleryClub = {
  name: string;
  description: string;
  focusAreas: string[];
  website: string | null;
  imageUrl: string | null;
};

export type GalleryPage = {
  clubs: GalleryClub[];
  /** Highest page number linked from the pagination. */
  lastPage: number;
  /** Campus filter values offered on the page, e.g. "Garching". */
  locations: string[];
};

const clean = (s: string) => s.replace(/­/g, "").replace(/\s+/g, " ").trim();

function absolute(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url, "https://www.tum.de").toString();
  } catch {
    return null;
  }
}

export function parseGalleryPage(html: string): GalleryPage {
  const $ = cheerio.load(html);
  const clubs: GalleryClub[] = [];
  $(".c-club").each((_, el) => {
    const card = $(el);
    const name = clean(card.find(".c-club__content h4, .c-club__content h3").first().text());
    if (!name) return;
    const focusAreas = [
      ...new Set(
        card
          .find(".c-club__category a")
          .toArray()
          .map((a) => clean($(a).text()))
          .filter(Boolean),
      ),
    ];
    const website = card.find(".c-club__link a").attr("href");
    clubs.push({
      name,
      description: clean(card.find(".c-club__content p").first().text()),
      focusAreas,
      website: website && /^https?:/i.test(website) ? website : null,
      imageUrl: absolute(card.find(".c-club__image img").attr("src")),
    });
  });

  const pages = [...html.matchAll(/tx_solr%5Bpage%5D=(\d+)/g)].map((m) => Number(m[1]));
  const locations = [
    ...new Set(
      [...html.matchAll(/filter%5D%5B0%5D=location%3A([^"#&]+)/g)].map((m) =>
        decodeURIComponent(m[1].replace(/\+/g, " ")),
      ),
    ),
  ];
  return { clubs, lastPage: Math.max(1, ...pages), locations };
}

export function galleryUrl(page: number, location?: string): string {
  const params = new URLSearchParams();
  if (location) params.set("tx_solr[filter][0]", `location:${location}`);
  if (page > 1) params.set("tx_solr[page]", String(page));
  const qs = params.toString();
  return qs ? `${GALLERY_URL}?${qs}` : GALLERY_URL;
}

/** URL-friendly slug: "180 Degrees Consulting Munich" → "180-degrees-consulting-munich". */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "club"
  );
}
