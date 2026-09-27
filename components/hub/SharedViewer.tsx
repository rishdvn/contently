"use client";

import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

import type { api } from "@/convex/_generated/api";
import { googleFontsHref } from "@/lib/editor/fonts";
import type { Project } from "@/lib/editor/types";

import { PreviewModal, type PreviewDownload } from "./PreviewModal";
import { relativeTime } from "./ProjectPreview";

export type SharedProject = NonNullable<FunctionReturnType<typeof api.projects.getShared>>;

const FORMAT_LABEL: Record<SharedProject["downloads"][number]["format"], string> = {
  mp4: "MP4",
  "carousel-zip": "slides (ZIP)",
  png: "PNG",
};

/*
  `/p/<id>`: the hub's enlarged preview on its own, for whoever the link was
  sent to. The document arrives from the server with its media already turned
  into URLs, so nothing here needs a Convex session — which a signed-out
  visitor does not have, and the app's provider would wait on forever.
*/
export function SharedViewer({ shared, shareUrl }: { shared: SharedProject; shareUrl: string }) {
  const router = useRouter();
  const project = shared.project.document as Project;
  /* Client-only: the server's clock and the visitor's would disagree at the
     edge of a minute and fail hydration over "Just now". */
  const relative = useSyncExternalStore(
    noSubscription,
    () => relativeTime(project.updatedAt),
    () => "",
  );

  /* One button per file. Several files only happen for PNGs, one per scene,
     and the worker names those after the scene. */
  const downloads: PreviewDownload[] = shared.downloads.flatMap((d) =>
    d.files.map((file) => ({
      url: file.url,
      label: d.files.length > 1 ? `Download ${file.name}` : `Download ${FORMAT_LABEL[d.format]}`,
    })),
  );

  return (
    <div className="min-h-dvh bg-canvas">
      <link rel="stylesheet" href={googleFontsHref()} crossOrigin="anonymous" />
      <PreviewModal
        project={project}
        relative={relative}
        shareUrl={shareUrl}
        downloads={downloads}
        /* The studio is only somewhere to go for a member of the org. */
        onOpen={shared.access === "member" ? (id) => router.push(`/editor/${id}`) : undefined}
      />
    </div>
  );
}

const noSubscription = () => () => {};
