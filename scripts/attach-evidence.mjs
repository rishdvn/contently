#!/usr/bin/env node
/*
  Attach a screenshot or recording to a Linear issue.

      node scripts/attach-evidence.mjs CRE-51 .evidence/video-123.webm "Shortcuts sheet opening"

  Review happens on the issue, so that is where evidence belongs. GitHub's CLI
  can attach media too, but its upload endpoint rejects app and CI tokens, so it
  would need a personal access token sitting in the sandbox; Linear's upload
  works with the API key the workspace already has.

  Linear's upload is three steps and each one is easy to get wrong:
    1. fileUpload           — asks for a signed URL
    2. PUT the raw bytes    — every signed header verbatim, including casing,
                              and the URL dies after 60 seconds
    3. attachmentCreate     — links the uploaded asset to the issue

  Hence this script rather than a note telling each agent to work it out.
*/

import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";

const API = "https://api.linear.app/graphql";

const TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".zip": "application/zip",
  ".pdf": "application/pdf",
};

const key = process.env.LINEAR_API_KEY;
const [issue, path, ...titleParts] = process.argv.slice(2);

function die(message) {
  console.error(`attach-evidence: ${message}`);
  process.exit(1);
}

if (!key) die("LINEAR_API_KEY is not set — add it to the workspace environment");
if (!issue || !path) die("usage: attach-evidence.mjs <CRE-id> <file> [title]");

async function graphql(query, variables) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: key },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors) die(body.errors.map((e) => e.message).join("; "));
  return body.data;
}

const contentType = TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";
const filename = basename(path);
const size = (await stat(path).catch(() => die(`no such file: ${path}`))).size;
if (size === 0) die(`${path} is empty — the recorder writes nothing until the browser context closes`);

/* Identifier ("CRE-51") is accepted here as well as a uuid. */
const { issue: found } = await graphql(`query($id: String!) { issue(id: $id) { id identifier title } }`, { id: issue });
if (!found) die(`issue ${issue} not found`);

const { fileUpload } = await graphql(
  `mutation($contentType: String!, $filename: String!, $size: Int!) {
     fileUpload(contentType: $contentType, filename: $filename, size: $size) {
       success
       uploadFile { assetUrl uploadUrl headers { key value } }
     }
   }`,
  { contentType, filename, size },
);
if (!fileUpload?.success) die("Linear declined the upload request");

const { assetUrl, uploadUrl, headers } = fileUpload.uploadFile;

/* Verbatim, casing included: these are part of the signature. */
const signed = Object.fromEntries(headers.map((h) => [h.key, h.value]));
if (!signed["content-type"] && !signed["Content-Type"]) signed["content-type"] = contentType;

const put = await fetch(uploadUrl, { method: "PUT", headers: signed, body: await readFile(path) });
if (!put.ok) {
  die(
    put.status === 403
      ? "403 from storage — a signed header was altered or the 60-second URL expired. Re-run; don't prepare several uploads up front."
      : `upload failed: HTTP ${put.status}`,
  );
}

const title = titleParts.join(" ") || filename;
const { attachmentCreate } = await graphql(
  `mutation($issueId: String!, $url: String!, $title: String!) {
     attachmentCreate(input: { issueId: $issueId, url: $url, title: $title }) {
       success
       attachment { id }
     }
   }`,
  { issueId: found.id, url: assetUrl, title },
);
if (!attachmentCreate?.success) die("uploaded, but linking the attachment failed");

console.log(`attached ${filename} (${(size / 1024).toFixed(0)} KB) to ${found.identifier} — ${found.title}`);
