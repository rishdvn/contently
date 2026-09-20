import type { ReactNode } from "react";

/* The canvas the sign-in and sign-up cards sit on: wordmark above, card centred. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-7 bg-canvas px-6 py-12">
      <span className="text-titles text-ink italic">Contently</span>
      {children}
    </main>
  );
}
