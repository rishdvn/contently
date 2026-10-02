# MCP server

`packages/mcp` (`@contently/mcp`) lets an AI in Claude, Cursor or any MCP
client make on-brand images, carousels and videos from Contently templates.
It is a thin layer over the public API (`docs/api.md`): the tools call the
REST endpoints with an organisation's API key, and everything that matters —
roles, validation, rendering — is decided by the server.

| | |
|---|---|
| `packages/mcp/src/server.ts` | Tools, resources and the prompt |
| `packages/mcp/src/client.ts` | The REST client |
| `packages/mcp/src/errors.ts` | API failures → tool errors the model can act on |
| `packages/mcp/src/index.ts` | CLI: stdio, or Streamable HTTP with `--http` |
| `packages/mcp/skills/on-brand-content.md` | The skill: how to use the tools well |
| `packages/mcp/test/` | `npm test`: a real MCP client against a scripted API |

## Connect it

Make an API key in Contently → **Settings → API keys** (for the organisation
the content is for).

**Claude Code**

```bash
claude mcp add contently --env CONTENTLY_API_KEY=ctly_… -- npx -y @contently/mcp
```

**Cursor / Claude Desktop** (`mcp.json` / `claude_desktop_config.json`)

```json
{ "mcpServers": { "contently": { "command": "npx", "args": ["-y", "@contently/mcp"], "env": { "CONTENTLY_API_KEY": "ctly_…" } } } }
```

Until the package is published to npm, point `command` at a checkout:
`"command": "node", "args": ["/path/to/contently/packages/mcp/dist/index.js"]`
after `npm --prefix packages/mcp install && npm --prefix packages/mcp run build`.

**Streamable HTTP** (one server for several organisations: each request
brings its own `Authorization: Bearer ctly_…`, falling back to
`CONTENTLY_API_KEY`):

```bash
npx @contently/mcp --http --port 8787        # → http://127.0.0.1:8787/mcp
```

`CONTENTLY_API_URL` points it at another deployment (default: production).

## What it offers

**Tools**

| Tool | Does |
|---|---|
| `list_templates(kind?, category?, q?)` | Templates with their role counts and posters |
| `get_template(id, include_posters?)` | Scenes → blocks: ids, roles, current text and `textConstraints`, media slots, catalog blocks' schema and fields; scene posters as links, or inline images |
| `create_project_from_template(templateId, name?, scenes?)` | A project; block ids stay the template's |
| `replace_content(projectId, replacements[])` | Fill by `role` or `blockId` (+ `field`); `text`, `mediaId`, `mediaUrl` or `props`. All or nothing |
| `list_media(kind?, q?, source?, limit?)` | The organisation's media, or stock |
| `upload_media(url \| base64, name, mimeType?, tags?)` | Add a file to the organisation's library |
| `render_project(projectId, format, scene?)` | Queue `mp4` / `png` / `carousel-zip` |
| `get_render(jobId, waitSeconds?)` | Waits (default 50 s) and answers the download URLs |
| `cancel_render(jobId)` | Takes back a render that is still queued |

Arguments are checked against their schemas before any request (and the
"exactly one target, exactly one value" rule of a replacement). API failures
come back as tool errors that say what to do: a 401 points at the key and
where to make one, a 404 at using ids from the tools, a 400 lists each bad
field, a 429 says how long to wait, a 503 `no_render_worker` says rendering is
unavailable right now rather than inviting a retry loop.

**Resources**

- `contently://templates/{id}/poster` and
  `contently://templates/{id}/scenes/{n}/poster` — PNGs, so the model can see
  the visual hierarchy, not only read roles.
- `contently://skills/on-brand-content` — the skill.

**Prompt** `on_brand_variations(brand, template?, count?)` — the skill plus
"make N rendered variations for this brand".

## The skill

`packages/mcp/skills/on-brand-content.md` is how a model should use the
tools: read the template first; write for each role (a `hook` vs a `heading`
vs a `benefit`; a `cta` is 1–4 words, verb first; a `price` keeps its currency
format); stay inside `textConstraints`; prefer the organisation's own media
over stock for `image:product`; make variations by changing the hook and the
benefit that leads while holding the brand slots; always render and return
the URLs; fall back to `blockId` when a slot has no role. It is served as a
resource and inside the prompt, and ships with the package, so it stays in
step with the tools it describes.

## Develop

```bash
cd packages/mcp
npm install
npm test          # the server through a real MCP client, against a fake API
npm run check     # typecheck
npm run build     # → dist/
CONTENTLY_API_KEY=ctly_… npx @modelcontextprotocol/inspector node dist/index.js   # poke it by hand
```

The package has its own compiler settings and is left out of the app's
`tsc`/eslint, like `workers/render`.

Publishing: `npm publish --access public` from `packages/mcp` once the
`@contently` npm scope exists (`prepublishOnly` checks, tests and builds).
