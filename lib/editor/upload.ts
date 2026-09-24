"use client";

/*
  The browser half of an upload. Convex stores bytes and rows; everything that
  needs a decoder — how big the image is, how long the video runs, what its first
  frame looks like — has to happen here, because a Convex function has no codecs
  and putting a render worker between choosing a file and seeing it in the panel
  would be felt on every upload.
*/

export type ProbedFile = {
  kind: "image" | "video";
  width: number;
  height: number;
  duration?: number;
  /* Videos only: the first frame, uploaded as a second file. */
  poster?: Blob;
};

export const mediaKindOf = (file: File): "image" | "video" | null =>
  file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : null;

async function probeImage(file: File): Promise<ProbedFile> {
  const bitmap = await createImageBitmap(file);
  try {
    return { kind: "image", width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

/*
  Seek a little way in rather than to 0: the very first frame of a phone
  recording is often black or half-exposed, and the poster is what the panel and
  the hub show for the whole clip.
*/
const POSTER_TIME = 0.1;

async function probeVideo(file: File): Promise<ProbedFile> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.src = url;

  try {
    await once(video, "loadedmetadata");
    const width = video.videoWidth;
    const height = video.videoHeight;
    const duration = Number.isFinite(video.duration) ? video.duration : undefined;

    video.currentTime = Math.min(POSTER_TIME, (duration ?? 1) / 2);
    await once(video, "seeked");

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
    const poster = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));

    return { kind: "video", width, height, duration, poster: poster ?? undefined };
  } finally {
    video.src = "";
    URL.revokeObjectURL(url);
  }
}

function once(el: HTMLVideoElement, event: string, timeoutMs = 15_000) {
  return new Promise<void>((resolve, reject) => {
    const done = (fn: () => void) => () => {
      clearTimeout(timer);
      el.removeEventListener(event, ok);
      el.removeEventListener("error", fail);
      fn();
    };
    const ok = done(resolve);
    const fail = done(() => reject(new Error(`Could not read this video (${event})`)));
    const timer = setTimeout(fail, timeoutMs);
    el.addEventListener(event, ok);
    el.addEventListener("error", fail);
  });
}

export async function probeFile(file: File): Promise<ProbedFile> {
  const kind = mediaKindOf(file);
  if (!kind) throw new Error("Only images and videos can be uploaded");
  return kind === "video" ? probeVideo(file) : probeImage(file);
}

/*
  POST straight to the URL Convex handed us, which answers with the storage id.
  XHR rather than fetch: `fetch` cannot report how much of the body has gone, and
  a 200 MB clip with no progress bar looks broken.
*/
export function uploadToStorage(uploadUrl: string, body: Blob, onProgress?: (fraction: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", uploadUrl);
    request.setRequestHeader("Content-Type", body.type || "application/octet-stream");
    request.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) return reject(new Error(`Upload failed (${request.status})`));
      try {
        const { storageId } = JSON.parse(request.responseText) as { storageId: string };
        if (!storageId) throw new Error("no storage id");
        resolve(storageId);
      } catch {
        reject(new Error("Upload returned an unexpected response"));
      }
    };
    request.onerror = () => reject(new Error("Upload failed"));
    request.onabort = () => reject(new Error("Upload cancelled"));
    request.send(body);
  });
}
