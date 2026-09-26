import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import type { Config } from "./config.js";

/*
  The queue, as the worker sees it: four mutations in `convex/render.ts`, called
  over HTTP with the worker secret in place of a session.

  Function references are built from strings rather than imported from
  `convex/_generated/api`, so this service can be built and deployed on its own
  — the Docker image carries the worker, not the repo.
*/

export type RenderFormat = "png" | "carousel-zip" | "mp4";

export type ClaimedJob = {
  jobId: string;
  projectId: string;
  format: RenderFormat;
  scene?: number;
  scale?: number;
  fps?: number;
  token: string;
  timeoutMs: number;
};

const claim = makeFunctionReference<"mutation", { secret: string }, ClaimedJob | null>("render:claim");
const uploadUrl = makeFunctionReference<"mutation", { secret: string }, string>("render:uploadUrl");
const complete = makeFunctionReference<
  "mutation",
  { secret: string; jobId: string; outputs: { storageId: string; name: string }[] },
  null
>("render:complete");
const failJob = makeFunctionReference<
  "mutation",
  { secret: string; jobId: string; error: string; retry?: boolean },
  { requeued: boolean }
>("render:failJob");

export type Output = { storageId: string; name: string };

export class Queue {
  private readonly client: ConvexHttpClient;

  constructor(private readonly cfg: Config) {
    this.client = new ConvexHttpClient(cfg.convexUrl);
  }

  /* The oldest queued job, or null when there is nothing to do. */
  async claim(): Promise<ClaimedJob | null> {
    return await this.client.mutation(claim, { secret: this.cfg.secret });
  }

  /*
    Bytes straight into Convex storage. The upload URL is single-use and short
    lived, so it is minted per file rather than per job — a video that takes
    four minutes to encode would otherwise be uploading to a dead URL.
  */
  async upload(bytes: Uint8Array, contentType: string): Promise<string> {
    const url = await this.client.mutation(uploadUrl, { secret: this.cfg.secret });
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: bytes as unknown as BodyInit,
    });
    if (!response.ok) throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
    const { storageId } = (await response.json()) as { storageId: string };
    return storageId;
  }

  async complete(jobId: string, outputs: Output[]): Promise<void> {
    await this.client.mutation(complete, { secret: this.cfg.secret, jobId, outputs });
  }

  async fail(jobId: string, error: string, retry: boolean): Promise<boolean> {
    const { requeued } = await this.client.mutation(failJob, { secret: this.cfg.secret, jobId, error, retry });
    return requeued;
  }
}

/* Convex sends application errors as structured data; the message inside is the
   one worth putting on the job. */
export function errorMessage(error: unknown): string {
  const data = (error as { data?: unknown })?.data;
  if (typeof data === "object" && data !== null && "message" in data) return String((data as { message: unknown }).message);
  if (typeof data === "string") return data;
  return error instanceof Error ? error.message : String(error);
}
