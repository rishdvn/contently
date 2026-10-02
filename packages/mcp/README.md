# @contently/mcp

An MCP server for [Contently](https://contently-chi.vercel.app): make on-brand images, carousels and videos from templates, from Claude, Cursor or any MCP client.

```bash
CONTENTLY_API_KEY=ctly_… npx @contently/mcp            # stdio
CONTENTLY_API_KEY=ctly_… npx @contently/mcp --http     # Streamable HTTP on :8787/mcp
```

Make the key in Contently → Settings → API keys. Tools: `list_templates`, `get_template`, `create_project_from_template`, `replace_content`, `list_media`, `upload_media`, `render_project`, `get_render`, `cancel_render`. Resources: template and scene posters, and the on-brand content skill (`skills/on-brand-content.md`), also offered as the `on_brand_variations` prompt.

Full guide: `docs/mcp.md` in the Contently repository.
