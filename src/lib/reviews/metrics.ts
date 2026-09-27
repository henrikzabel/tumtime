/** Rating questions, shared by the review form (client) and the aggregation (server). */
export const RATING_METRICS = [
  { key: "usefulness", label: "Usefulness", low: "Not useful", high: "Very useful" },
  { key: "difficulty", label: "Difficulty", low: "Very easy", high: "Very hard" },
  { key: "workload", label: "Workload", low: "Very light", high: "Very heavy" },
] as const;
export type RatingKey = (typeof RATING_METRICS)[number]["key"];

export const COMMENT_MAX = 2000;
