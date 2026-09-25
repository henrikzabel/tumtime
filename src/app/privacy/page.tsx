import type { Metadata } from "next";

import { ProsePage } from "@/components/prose-page";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy policy">
      {/* TODO(owner): replace with the final privacy policy (GDPR Art. 13). */}
      <p>Placeholder — the full privacy policy will be published here.</p>
      <p>
        TUM Time only publishes aggregated exam statistics. We never ask for or store TUMonline credentials, and
        uploaded pages are reduced to the aggregated numbers before anything is saved.
      </p>
    </ProsePage>
  );
}
