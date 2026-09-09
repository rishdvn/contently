/* Every surface page opens the same way: a server page.tsx that renders a client demo. */
export function surfaceMetadata(title: string) {
  return { title: `${title} · Contently design` };
}
