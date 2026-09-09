"use client";

import { ArrowLeft, FileQuestion } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DocView } from "@/components/patterns/documents";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { brandTypes } from "@/lib/documents/registry";
import { useStore } from "@/lib/documents/store";

/* Stage 3: one document, full width, rail on the right. */
export function DocumentPage({ id }: { id: string }) {
  const store = useStore();
  const router = useRouter();
  const doc = store.doc(id);

  if (!store.hydrated) {
    return (
      <div className="flex flex-col gap-4 px-8 py-8">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-6 h-64 w-full max-w-[720px]" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <EmptyState
          icon={<FileQuestion />}
          title="No such document"
          description="It may have been part of a demo session that was reset."
          action={
            <Button onClick={() => router.push("/documents")}>
              <ArrowLeft /> Back to Documents
            </Button>
          }
        />
      </div>
    );
  }

  const back = brandTypes.includes(doc.type) ? { href: "/brand", label: "Brand" } : { href: "/documents", label: "Documents" };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-8 py-2 text-cap text-ink-secondary">
        <Link href={back.href} className="inline-flex items-center gap-1 hover:text-ink">
          <ArrowLeft className="size-3.5" /> {back.label}
        </Link>
        <span className="text-ink-disabled">/</span>
        <span className="truncate text-ink">{doc.title}</span>
      </div>
      <DocView doc={doc} />
    </div>
  );
}
