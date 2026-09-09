import type { Metadata } from "next";

import { BrandView } from "./brand-view";

export const metadata: Metadata = { title: "Brand · Contently" };

export default function BrandPage() {
  return <BrandView />;
}
