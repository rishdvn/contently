import { clerkMiddleware } from "@clerk/nextjs/server";

/*
  Next 16 renamed `middleware.ts` to `proxy.ts`; the contents are unchanged.

  Everything is signed-in-only except the auth routes themselves, the health
  check, and Clerk's own frontend-API path. Path matching is done here rather
  than with Clerk's `createRouteMatcher()`, which is deprecated in Core 3 and
  warns at runtime.
*/
const PUBLIC_ROUTES = ["/sign-in", "/sign-up", "/api/health", "/__clerk"];

const isPublic = (pathname: string) =>
  PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

export default clerkMiddleware(
  async (auth, request) => {
    if (!isPublic(request.nextUrl.pathname)) await auth.protect();
  },
  { signInUrl: "/sign-in", signUpUrl: "/sign-up" },
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Always run for Clerk-specific frontend API routes
    "/__clerk/:path*",
  ],
};
