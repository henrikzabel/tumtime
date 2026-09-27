import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";

import { UploadForm } from "./upload-form";

export const metadata: Metadata = {
  title: "Contribute statistics",
  description: "Upload the exam statistics page from TUMonline to add grade distributions to TUM Time.",
};

const steps = [
  <>
    In TUMonline, open <strong>My exams</strong> (Meine Prüfungen), pick a graded exam and open its{" "}
    <strong>statistics</strong>.
  </>,
  <>Wait until the grade chart is visible.</>,
  <>
    Save the page with <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>S</kbd> as “Webpage, complete”. If your browser saves an
    empty page, paste the page&apos;s HTML instead (instructions below the upload field).
  </>,
  <>Choose the saved <code>.html</code> file below, check the numbers and send them.</>,
];

export default async function ContributePage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Contribute statistics</h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        Upload the “exam statistics” page from TUMonline and we&apos;ll extract the aggregated numbers. Every upload is
        reviewed before it goes live.
      </p>

      <ol className="mt-6 space-y-2 text-sm leading-relaxed">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-8 rounded-lg bg-card p-4 ring-1 ring-foreground/10 md:p-6">
        {user ? (
          <UploadForm />
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              Sign in with your TUM e-mail address to upload. This keeps spam out; your upload is not linked to you once
              it has been reviewed.
            </p>
            <Link href="/login?next=%2Fcontribute" className={buttonVariants()}>
              Sign in to contribute
            </Link>
          </div>
        )}
      </div>

      <div className="mt-8 space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Privacy</h2>
        <p>
          We will never ask for your TUMonline login, and we don&apos;t store the uploaded page — only the aggregated
          grade counts. Your browser cuts the statistics block out of the file before anything is sent, so your name in
          the TUMonline header never leaves your computer.
        </p>
        <p>
          While your upload waits for review it is linked to your account, so you can see and withdraw it on{" "}
          <Link href="/me" className="text-primary hover:underline">
            your account page
          </Link>
          . Once reviewed, that link is removed. See the{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
