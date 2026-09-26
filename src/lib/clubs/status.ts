export const APPLICATION_STATUSES = ["submitted", "in_review", "accepted", "rejected"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: "Submitted",
  in_review: "In review",
  accepted: "Accepted",
  rejected: "Not selected",
};
