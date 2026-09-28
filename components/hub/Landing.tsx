import { SignInButton, SignUpButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";

import { KIND_ART } from "./kindArt";

/*
  `/` for someone who is not signed in: what Contently is, and the two ways in.
  The same canvas, wordmark and cards as the hub, so signing in changes what is
  on the page rather than where you are.
*/
export function Landing() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <header className="flex items-center justify-between px-8 py-6">
        <span className="text-titles text-ink italic">Contently</span>
        <SignInButton>
          <Button variant="ghost">Sign in</Button>
        </SignInButton>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-8 pb-24 text-center">
        <div aria-hidden className="flex items-end gap-4">
          {(
            [
              ["image", "Image", "aspect-[4/5] w-[120px]"],
              ["video", "Video", "aspect-[9/16] w-[132px]"],
              ["carousel", "Carousel", "aspect-[4/5] w-[120px]"],
            ] as const
          ).map(([kind, label, size]) => (
            <div key={kind} className={`relative flex flex-col justify-end overflow-hidden rounded-[16px] p-3 text-left shadow-overlay ${size}`} style={{ backgroundImage: KIND_ART[kind] }}>
              <div className="absolute inset-0 bg-[var(--gradient-scrim)] opacity-80" />
              <span className="relative text-default text-white">{label}</span>
            </div>
          ))}
        </div>

        <h1 className="mt-12 max-w-[620px] text-hero text-ink">Posts, carousels and short videos, built from blocks</h1>
        <p className="mt-4 max-w-[500px] text-body text-ink-secondary">
          Start from a template, drop in your words and media, and export something ready to post. Your team&rsquo;s projects, media and templates live in one place.
        </p>
        <div className="mt-8 flex gap-3">
          <SignUpButton>
            <Button variant="primary" size="lg">
              Create an account
            </Button>
          </SignUpButton>
          <SignInButton>
            <Button variant="secondary" size="lg">
              Sign in
            </Button>
          </SignInButton>
        </div>
      </main>
    </div>
  );
}
