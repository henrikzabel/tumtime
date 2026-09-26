/** Labels students can put on planned modules (GradTrak-style). */
export const LABELS: Record<string, { text: string; className: string }> = {
  done: { text: "Completed", className: "bg-primary/12 text-primary" },
  retake: { text: "Retake", className: "bg-destructive/10 text-destructive" },
  maybe: { text: "Maybe", className: "bg-muted text-muted-foreground" },
  abroad: { text: "Abroad", className: "bg-[#d55181]/12 text-[#b03a66] dark:text-[#e98bb0]" },
};
