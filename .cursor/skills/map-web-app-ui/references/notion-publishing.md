# Publishing assets and pages to Notion via MCP

Mechanics for getting many local screenshots and videos into a single Notion page. Two gotchas here each cost a wasted round trip if you do not know about them.

## Upload flow

Two steps per file. `notion-create-file-upload` returns a short-lived signed slot; you then POST the bytes to it yourself.

```jsonc
// 1. Create the slot
notion-create-file-upload { "filename": "01_landing_page.png" }
// → { file_upload_id, upload_url, upload_headers: { authorization }, upload_form_field: "file" }
```

```bash
# 2. POST the bytes
curl -sS -X POST "$UPLOAD_URL" \
  -H "authorization: Bearer $TOKEN" \
  -F "file=@01_landing_page.png;type=image/png"
# → { "status": "uploaded", "markdown_source": "file-upload://<id>" }
```

Reference the returned `markdown_source` in page content.

## Doing this for dozens of files

The MCP call cannot be batched server-side, but you can issue many in a single assistant turn, then perform all the HTTP POSTs in one shell loop. Write the tuples to a file and iterate:

```bash
cat > /tmp/up.txt <<'EOF'
01_landing_page.png <file_upload_id> <bearer_token>
02_login.png        <file_upload_id> <bearer_token>
EOF

while read -r fn id tok; do
  [ -z "$fn" ] && continue
  r=$(curl -sS -X POST "https://api.notion.com/v1/mcp/file_uploads/$id/send" \
        -H "authorization: Bearer $tok" -F "file=@$fn;type=image/png")
  echo "$fn -> $(echo "$r" | grep -o '"status":"[^"]*"')"
done < /tmp/up.txt
```

Batches of ~14 keep each turn manageable. All 43 uploads for a full app map take about four turns.

## Gotcha 1 — the content type must match the slot exactly

`.mp4` is inferred as `application/mp4`, and posting it as `video/mp4` is rejected:

```
"Current file content type of `video/mp4` does not match the original content type
of `application/mp4`. Use the original content type determined during File Upload
creation, or try again with a new File Upload."
```

Pass `content_type` explicitly when creating the slot so the stored type is right and Notion renders it as a video rather than a generic file:

```jsonc
notion-create-file-upload { "filename": "walkthrough.mp4", "content_type": "video/mp4" }
```

PNGs infer correctly and need nothing.

## Gotcha 2 — unattached uploads expire after one hour

An uploaded file that has not been placed on a page is temporary and is deleted when it expires. With a large asset set this is a real deadline, not a theoretical one.

Sequence the work to respect it:

1. Upload all the small assets (screenshots).
2. **Create the page immediately**, so those uploads are attached.
3. Handle slow work — video compression, review, redaction — afterwards, and attach the results with `notion-update-page`.

Creating the page in two steps is strictly safer than holding 40+ uploads open while transcoding video.

## Size limit and video compression

Single-part uploads cap at **20 MiB**. Screen recordings exceed this easily, so downscale and re-encode:

```bash
ffmpeg -y -i raw.mp4 -vf "scale=1280:-2" -c:v libx264 -crf 32 -preset veryfast \
  -an -movflags +faststart small.mp4
```

This reliably takes a ~60 MB capture to under 7 MB while staying legible for documentation. Confirm the duration survived — a truncated file is worse than a large one:

```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 small.mp4
```

## Page content syntax

Read `notion://docs/enhanced-markdown-spec` via the MCP resource interface before writing content. Do not guess the syntax. The pieces used most here:

| Element | Syntax |
| --- | --- |
| Image | `![Caption](file-upload://<id>)` |
| Video | `<video src="file-upload://<id>">Caption</video>` |
| File attachment | `<file src="file-upload://<id>">Caption</file>` |
| Callout | `<callout icon="🔒" color="yellow_bg">` with tab-indented children |
| Toggle | `<details><summary>Title</summary>` with tab-indented children |
| Table of contents | `<table_of_contents/>` |

Notes that bite:

- Indent with **tabs**. Children of callouts, toggles and columns must be indented or they escape the block.
- Outside code blocks, these characters need backslash-escaping: backslash, asterisk, tilde, backtick, dollar, square brackets, angle brackets, curly braces, pipe, caret.
- Tables accept rich text only — no headings, images or lists inside cells.
- Do not put the page title in `content`; it goes in `properties.title`.

## Placement

Use `creation_mode: "draft"` when the user has not named a destination. It creates a workspace-level private page. Afterwards, tell them it is private and offer to move it — do not move or share it unprompted.

When they do name a destination, `notion-move-pages` takes the page ID and a `new_parent`. Search the workspace first for related existing pages; the right parent is usually beside content on the same subject, and finding it is a better answer than dropping the page at the top level.

For large pages set `allow_async: false` when the next step needs the page immediately (you almost always need the ID to attach videos afterwards).

## Verify before reporting success

Fetch the page back and check that every reference resolved. Notion silently leaves an unresolved `file-upload://` string in place rather than erroring, so a page can look created while being full of broken assets.

```bash
# Zero unresolved references
grep -o 'file-upload://[^")>]*' "$fetched" | wc -l

# Distinct screenshots present — must equal what you uploaded
grep -o '[0-9][0-9]_[a-z_]*\.png' "$fetched" | sort -u | wc -l

# Videos and attachments present
grep -c '<video' "$fetched"; grep -c '<file' "$fetched"
```

Resolved assets appear as `prod-files-secure.s3.*.amazonaws.com` URLs with signed query strings. Seeing those is the confirmation that the upload actually landed.
