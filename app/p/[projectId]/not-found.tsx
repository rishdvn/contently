"use client";

import { Show, SignInButton } from "@clerk/nextjs";
import Link from "next/link";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";

/*
  A share link that does not resolve. Signed out, the likeliest story is a
  teammate's link to a members-only project, so the way forward is signing in —
  Clerk brings the visitor back here afterwards. Signed in, it really is gone.
*/
export default function SharedProjectNotFound() {
  return (
    <AuthLayout>
      <div className="flex w-full max-w-[360px] flex-col items-center gap-2 text-center">
        <h1 className="text-panels text-ink">This link isn&rsquo;t available</h1>
        <Show
          when="signed-in"
          fallback={
            <>
              <p className="text-default text-ink-secondary">It may have been turned off. If the project belongs to your team, sign in to view it.</p>
              <SignInButton>
                <Button variant="primary" className="mt-4">
                  Sign in
                </Button>
              </SignInButton>
            </>
          }
        >
          <p className="text-default text-ink-secondary">It may have been turned off, or the project was deleted.</p>
          <Link href="/" className="mt-4">
            <Button variant="secondary">Go to your projects</Button>
          </Link>
        </Show>
      </div>
    </AuthLayout>
  );
}
