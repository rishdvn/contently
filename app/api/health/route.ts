/* Public, unauthenticated liveness check — the one route the proxy lets through un-gated. */
export function GET() {
  return Response.json({ status: "ok" });
}
