"use client";

import { OrganizationSwitcher, Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { orgSwitcherAppearance, userButtonAppearance } from "@/lib/auth/appearance";

/*
  Bottom-left of the hub nav: the organisation you are working in, and you.
  Signed out this is the landing state — the nav is reachable before Clerk has
  a session only in that window, and the two buttons are the way out of it.
*/
export function AuthFooter() {
  return (
    <div className="mt-auto flex min-h-[44px] items-center gap-1.5">
      <Show
        when="signed-in"
        fallback={
          <div className="flex flex-1 items-center gap-2">
            <SignInButton>
              <Button variant="secondary" size="sm" className="flex-1">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton>
              <Button variant="primary" size="sm" className="flex-1">
                Sign up
              </Button>
            </SignUpButton>
          </div>
        }
      >
        <OrganizationSwitcher hidePersonal={false} appearance={orgSwitcherAppearance} />
        <UserButton appearance={userButtonAppearance} />
      </Show>
    </div>
  );
}
