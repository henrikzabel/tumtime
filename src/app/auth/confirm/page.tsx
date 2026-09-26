import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { ConfirmForm } from "./confirm-form";

export const metadata: Metadata = { title: "Confirm sign in", robots: { index: false } };

export default async function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  const { token } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Confirm sign in</CardTitle>
          <CardDescription>Click the button to finish signing in to TUM Time.</CardDescription>
        </CardHeader>
        <CardContent>
          <ConfirmForm token={Array.isArray(token) ? token[0] : (token ?? "")} />
        </CardContent>
      </Card>
    </div>
  );
}
