/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as api_errors from "../api/errors.js";
import type * as api_media from "../api/media.js";
import type * as api_openapi from "../api/openapi.js";
import type * as api_projects from "../api/projects.js";
import type * as api_render from "../api/render.js";
import type * as api_router from "../api/router.js";
import type * as api_templates from "../api/templates.js";
import type * as apiKeys from "../apiKeys.js";
import type * as audio_cc0 from "../audio/cc0.js";
import type * as audio_cc0Manifest from "../audio/cc0Manifest.js";
import type * as audio_index from "../audio/index.js";
import type * as audio_library from "../audio/library.js";
import type * as audio_recent from "../audio/recent.js";
import type * as audio_soundstripe from "../audio/soundstripe.js";
import type * as blocks from "../blocks.js";
import type * as clerk_backfill from "../clerk/backfill.js";
import type * as clerk_mirror from "../clerk/mirror.js";
import type * as clerk_payloads from "../clerk/payloads.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_blockCatalog from "../lib/blockCatalog.js";
import type * as lib_documentMedia from "../lib/documentMedia.js";
import type * as media from "../media.js";
import type * as orgs from "../orgs.js";
import type * as projects from "../projects.js";
import type * as render from "../render.js";
import type * as stock_dupe from "../stock/dupe.js";
import type * as stock_import from "../stock/import.js";
import type * as stock_provider from "../stock/provider.js";
import type * as templates from "../templates.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "api/errors": typeof api_errors;
  "api/media": typeof api_media;
  "api/openapi": typeof api_openapi;
  "api/projects": typeof api_projects;
  "api/render": typeof api_render;
  "api/router": typeof api_router;
  "api/templates": typeof api_templates;
  apiKeys: typeof apiKeys;
  "audio/cc0": typeof audio_cc0;
  "audio/cc0Manifest": typeof audio_cc0Manifest;
  "audio/index": typeof audio_index;
  "audio/library": typeof audio_library;
  "audio/recent": typeof audio_recent;
  "audio/soundstripe": typeof audio_soundstripe;
  blocks: typeof blocks;
  "clerk/backfill": typeof clerk_backfill;
  "clerk/mirror": typeof clerk_mirror;
  "clerk/payloads": typeof clerk_payloads;
  crons: typeof crons;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/blockCatalog": typeof lib_blockCatalog;
  "lib/documentMedia": typeof lib_documentMedia;
  media: typeof media;
  orgs: typeof orgs;
  projects: typeof projects;
  render: typeof render;
  "stock/dupe": typeof stock_dupe;
  "stock/import": typeof stock_import;
  "stock/provider": typeof stock_provider;
  templates: typeof templates;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
