/**
 * All user-facing UI strings live here. The site is English-only for now;
 * keeping copy in one place makes adding a German locale later a mechanical
 * change (swap this module for a message catalogue).
 */
export const copy = {
  siteName: "TUM Time",
  tagline: "Exam statistics for TUM students, by students.",
  unofficialBanner:
    "Unofficial student project — not affiliated with or endorsed by the Technical University of Munich.",
  nav: {
    search: "Search",
    browse: "Browse",
    compare: "Compare",
    planner: "Planner",
    clubs: "Clubs",
    contribute: "Contribute",
  },
  footer: {
    disclaimer:
      "TUM Time is an unofficial, independent student project. It is not affiliated with, endorsed by, or connected to the Technical University of Munich (TUM). All statistics are aggregated; no personal data is shown.",
    imprint: "Imprint",
    privacy: "Privacy policy",
  },
  home: {
    heading: "How hard is that exam, really?",
    subheading:
      "Browse grade distributions, averages and failure rates of TUM exams across semesters — and compare modules side by side.",
    searchPlaceholder: "Search by module number or name, e.g. IN0001 or Analysis",
  },
} as const;
