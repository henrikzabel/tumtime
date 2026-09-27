import type { Metadata } from "next";

import { ProsePage } from "@/components/prose-page";

export const metadata: Metadata = { title: "Privacy policy" };

// DRAFT — the operator must review and complete this text (controller details, legal bases,
// processors' DPAs) before going live.
export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy policy">
      <p className="rounded-md bg-muted p-3 text-sm">
        Draft — to be reviewed and completed by the operator before publication.
      </p>

      <h2 className="pt-2 text-lg font-semibold text-foreground">Controller</h2>
      <p>[Name, address and e-mail of the operator — see Imprint.]</p>

      <h2 className="pt-2 text-lg font-semibold text-foreground">Using the site without an account</h2>
      <p>
        Exam statistics, the course catalog and the club directory work without an account. We only publish
        aggregated exam statistics; distributions of very small exams are hidden. We never ask
        for or store TUMonline credentials; uploaded TUMonline pages are reduced to aggregated numbers before anything
        is saved.
      </p>

      <h2 className="pt-2 text-lg font-semibold text-foreground">Accounts (sign in with your TUM e-mail)</h2>
      <p>
        To apply to clubs or manage a club you sign in with a one-time link sent to your TUM e-mail address. We store
        your e-mail address, the name you enter when applying, the time of your last login and a session cookie
        (<code>tumtime_session</code>, strictly necessary, 30 days). Login links expire after 15 minutes.
      </p>

      <h2 className="pt-2 text-lg font-semibold text-foreground">Schedules, degree plans and bookmarks</h2>
      <p>
        The scheduler, the degree planner and bookmarks require an account. We store the modules, tutorial groups and
        plans you create so that you can use them on all your devices (Art. 6(1)(b) GDPR). They are kept until you
        delete them or your account. If you turn on a share link, anyone with that link can view that one schedule or
        plan (without your name or e-mail address); you can turn the link off at any time.
      </p>

      <h2 className="pt-2 text-lg font-semibold text-foreground">Club applications</h2>
      <p>
        When you apply, your name, e-mail address and answers are stored and shared with the club you apply to (its
        managers and its contact address), based on your consent (Art. 6(1)(a) GDPR). Applications are deleted
        automatically six months after submission. You can withdraw an application at any time, download all your
        data as JSON and delete your account (including all applications) in your account settings.
      </p>

      <h2 className="pt-2 text-lg font-semibold text-foreground">Club managers</h2>
      <p>
        If you request to manage a club, we store your role in the club and your message to verify the request.
        Decided requests are deleted after six months.
      </p>

      <h2 className="pt-2 text-lg font-semibold text-foreground">Processors</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Hosting: Vercel Inc. [region / DPA to be completed]</li>
        <li>Database: Supabase (EU region, Frankfurt) [DPA to be completed]</li>
        <li>E-mail delivery: Resend [region / DPA to be completed]</li>
        <li>Optional analytics: Plausible (cookieless, no personal data) — only if enabled</li>
      </ul>

      <h2 className="pt-2 text-lg font-semibold text-foreground">Your rights</h2>
      <p>
        You have the right to access, rectification, erasure, restriction, data portability and to withdraw consent,
        and to lodge a complaint with a supervisory authority (e.g. the Bavarian Data Protection Authority). Most of
        these you can exercise directly in your account; otherwise contact us.
      </p>
    </ProsePage>
  );
}
