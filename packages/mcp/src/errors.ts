import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { ContentlyError, NetworkError } from "./client.js";

/*
  A failed API call, told to the model as something it can act on: what went
  wrong, and what to do next. Returned as a tool error (`isError: true`)
  rather than thrown, so the model reads it instead of the client showing a
  protocol failure.
*/
export function describeError(error: unknown): string {
  if (error instanceof ContentlyError) {
    const details = error.details.length ? `\n${error.details.map((d) => `- ${d.at}: ${d.message}`).join("\n")}` : "";
    switch (error.status) {
      case 401:
        return `Contently rejected the API key (401: ${error.message}). Check CONTENTLY_API_KEY: make a key in Contently → Settings → API keys, for the organisation you want to work in.`;
      case 404:
        return `Not found (404: ${error.message}). Use ids from list_templates, create_project_from_template or list_media; ids from another organisation are not visible with this key.`;
      case 400:
        return `Contently refused the request (400: ${error.message}).${details}\nFix the listed fields and call again; nothing was changed.`;
      case 409:
        return `Contently could not do that to it now (409: ${error.message}).`;
      case 413:
        return `The file is too large (413: ${error.message}).`;
      case 429:
        return `Rate limited (429: ${error.message}). Wait ${error.retryAfter ?? 60} seconds before the next call.`;
      case 503:
        if (error.code === "no_render_worker") return `No render worker is running, so the render was not queued (503: ${error.message}). Tell the user rendering is unavailable right now; don't retry in a loop.`;
        return `Contently cannot do this right now (503: ${error.message}).`;
      default:
        return `Contently answered ${error.status} (${error.code}): ${error.message}${details}`;
    }
  }
  if (error instanceof NetworkError) return `Could not reach Contently at ${error.baseUrl}: ${error.message}. Check CONTENTLY_API_URL and the network.`;
  return `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
}

export const toolError = (error: unknown): CallToolResult => ({ isError: true, content: [{ type: "text", text: describeError(error) }] });

/* Run a tool body; any failure becomes a tool error the model can read. */
export async function guarded(run: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await run();
  } catch (error) {
    return toolError(error);
  }
}
