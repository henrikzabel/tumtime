import type { Metadata } from "next";

import { ProsePage } from "@/components/prose-page";

export const metadata: Metadata = { title: "Contribute" };

export default function ContributePage() {
  return (
    <ProsePage title="Contribute statistics">
      <p>
        Coming soon: upload the “exam statistics” page from TUMonline and we&apos;ll extract the aggregated numbers.
        Every upload is reviewed before it goes live.
      </p>
      <p>
        We will never ask for your TUMonline login, and we don&apos;t store the uploaded page — only the aggregated grade
        counts.
      </p>
    </ProsePage>
  );
}
