import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeRedirect } from "@/lib/auth/tokens";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sign in to TUM Time</CardTitle>
          <CardDescription>
            We&apos;ll e-mail you a one-time login link. Only TUM addresses work — no password, and we never ask for
            your TUMonline credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={safeRedirect(Array.isArray(next) ? next[0] : next)} />
        </CardContent>
      </Card>
    </div>
  );
}
