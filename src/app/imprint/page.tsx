import type { Metadata } from "next";

import { ProsePage } from "@/components/prose-page";

export const metadata: Metadata = { title: "Imprint" };

export default function ImprintPage() {
  return (
    <ProsePage title="Imprint (Impressum)">
      {/* TODO(owner): fill in the legally required information (§ 5 DDG). */}
      <p>Placeholder — the operator&apos;s name, address and contact details will be added here.</p>
    </ProsePage>
  );
}
