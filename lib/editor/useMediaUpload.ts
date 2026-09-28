"use client";

import { useMutation } from "convex/react";
import { useState } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MediaItem } from "@/convex/media";
import { useActiveOrg } from "@/lib/auth/useActiveOrg";

import { uid } from "./factory";
import { primeMedia } from "./media";
import { mediaKindOf, probeFile, uploadToStorage } from "./upload";

/* One file on its way up. Kept until it lands (the row then arrives in
   `media.list`) or fails, which is the only state worth staying on screen,
   unless it landed with a `warning` the uploader should read first. */
export type UploadJob = { id: string; name: string; progress: number; error?: string; warning?: string };

/*
  An iPhone records HEVC, which plays for its uploader on a Mac but shows black
  for teammates on Linux and many Windows machines, and never renders in the
  cloud. The render worker re-encodes such clips to H.264 in the background
  (same media id); until then this is the only place anyone would find out.
*/
const HEVC_WARNING = "This clip is HEVC. It may not play for everyone or export in the cloud until we've converted it.";

/*
  The upload flow (T-013) as a hook, for anywhere files can be dropped: probe
  the file for its size, length and poster, send the bytes and the poster
  straight to storage, then write the `media` row. Files go one at a time — two
  large clips racing make both progress bars meaningless and neither finishes
  sooner. Anything that is not an image or a video is skipped.
*/
export function useMediaUpload() {
  const { orgId } = useActiveOrg();
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const createMedia = useMutation(api.media.create);
  const [jobs, setJobs] = useState<UploadJob[]>([]);

  const ingest = async (files: FileList | File[]): Promise<MediaItem[]> => {
    if (!orgId) return [];
    const created: MediaItem[] = [];
    for (const file of Array.from(files)) {
      if (!mediaKindOf(file)) continue;
      const jobId = uid();
      const progress = (fraction: number) => setJobs((j) => j.map((x) => (x.id === jobId ? { ...x, progress: fraction } : x)));
      setJobs((j) => [...j, { id: jobId, name: file.name, progress: 0 }]);
      try {
        const probe = await probeFile(file);
        const storageId = await uploadToStorage(await generateUploadUrl({ orgId }), file, progress);
        const posterStorageId = probe.poster ? await uploadToStorage(await generateUploadUrl({ orgId }), probe.poster) : undefined;
        const row = await createMedia({
          orgId,
          kind: probe.kind,
          /* Storage ids are opaque strings to the browser; Convex validates them. */
          storageId: storageId as Id<"_storage">,
          posterStorageId: posterStorageId as Id<"_storage"> | undefined,
          width: probe.width,
          height: probe.height,
          duration: probe.duration,
          codec: probe.codec,
          name: file.name,
        });
        primeMedia([row]);
        created.push(row);
        if (probe.codec === "hevc") setJobs((j) => j.map((x) => (x.id === jobId ? { ...x, progress: 1, warning: HEVC_WARNING } : x)));
        else setJobs((j) => j.filter((x) => x.id !== jobId));
      } catch (error) {
        setJobs((j) => j.map((x) => (x.id === jobId ? { ...x, error: error instanceof Error ? error.message : "Upload failed" } : x)));
      }
    }
    return created;
  };

  const dismiss = (id: string) => setJobs((j) => j.filter((x) => x.id !== id));

  return { ingest, jobs, dismiss, canUpload: Boolean(orgId) };
}
