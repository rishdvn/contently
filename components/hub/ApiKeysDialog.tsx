"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Copy, KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogHeader, DialogIcon } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useActiveOrg } from "@/lib/auth/useActiveOrg";

/*
  Settings → API keys: make a key for the public API (`docs/api.md`), copy it
  once, revoke it. A key belongs to the organisation that is active here and
  acts as the person who made it; the server keeps only its hash, so the key
  is shown once, at creation, and never again.
*/

/* The API's base URL: the deployment's HTTP actions origin, which is its
   client URL with `.site` for `.cloud` unless the environment says otherwise. */
const apiBase = () => (process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? (process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(/\.convex\.cloud\/?$/, ".convex.site")).replace(/\/+$/, "") + "/v1";

const when = (ts: number) => new Date(ts).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

type Created = { id: Id<"apiKeys">; key: string; label: string };

export function ApiKeysDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { orgId } = useActiveOrg();
  const keys = useQuery(api.apiKeys.list, open && orgId ? { orgId } : "skip");
  const create = useAction(api.apiKeys.create);
  const revoke = useMutation(api.apiKeys.revoke);

  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<Id<"apiKeys"> | null>(null);

  const close = () => {
    setCreated(null);
    setCopied(false);
    setConfirming(null);
    setError(null);
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgId || !label.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const made = await create({ orgId, label: label.trim() });
      setCreated({ id: made.id, key: made.key, label: made.label });
      setCopied(false);
      setLabel("");
    } catch (err) {
      setError((err as { data?: { message?: string } }).data?.message ?? "Could not make a key. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.key).catch(() => {});
    setCopied(true);
  };

  return (
    <Dialog open={open} onClose={close} size="lg">
      <DialogHeader
        icon={
          <DialogIcon>
            <KeyRound />
          </DialogIcon>
        }
        title="API keys"
        description="Keys let a script or an AI assistant use Contently's API for this organisation: read templates, make projects, replace content, render."
        onClose={close}
      />
      <DialogBody className="flex flex-col gap-5">
        {!orgId ? (
          <p className="text-default text-ink-secondary">Switch to an organisation to manage its API keys.</p>
        ) : (
          <>
            {/* Until the list says it was revoked. */}
            {created && (keys === undefined || keys.some((k) => k.id === created.id)) ? (
              <div className="flex flex-col gap-2 rounded-control bg-card p-3" data-testid="new-api-key">
                <div className="text-default text-ink">
                  <span className="font-medium">{created.label}</span> is ready. Copy it now: it won&apos;t be shown again.
                </div>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-control bg-field px-3 py-2 font-mono text-cap text-ink select-all">{created.key}</code>
                  <Button variant="primary" size="sm" onClick={copy} aria-label="Copy key">
                    {copied ? <Check /> : <Copy />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            ) : null}

            <form onSubmit={submit} className="flex items-end gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-cap text-ink-secondary">New key</span>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What it's for, e.g. Claude, Zapier" maxLength={60} aria-label="Key name" />
              </label>
              <Button type="submit" variant="secondary" disabled={!label.trim() || busy}>
                {busy ? "Making…" : "Create key"}
              </Button>
            </form>
            {error ? <p className="text-cap text-critical">{error}</p> : null}

            <div className="flex flex-col gap-1">
              <div className="text-cap text-ink-disabled">{keys === undefined ? "Loading…" : keys.length ? `${keys.length} active ${keys.length === 1 ? "key" : "keys"}` : "No keys yet"}</div>
              {keys?.map((k) => (
                <div key={k.id} className="flex items-center gap-3 rounded-control px-2 py-2 hover:bg-[var(--state-hover)]" data-testid="api-key-row">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2 text-default text-ink">
                      <span className="truncate">{k.label}</span>
                      <code className="font-mono text-cap text-ink-disabled">{k.start}…</code>
                    </div>
                    <div className="truncate text-cap text-ink-secondary">
                      Created {when(k.createdAt)}
                      {k.createdBy ? ` by ${k.createdBy}` : ""} · {k.lastUsedAt ? `Last used ${when(k.lastUsedAt)}` : "Never used"}
                    </div>
                  </div>
                  {confirming === k.id ? (
                    <div className="flex items-center gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                        Keep
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={async () => {
                          await revoke({ orgId, id: k.id });
                          setConfirming(null);
                        }}
                      >
                        Revoke now
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setConfirming(k.id)} aria-label={`Revoke ${k.label}`}>
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <p className="text-cap text-ink-secondary">
              Send the key as <code className="font-mono text-ink">Authorization: Bearer ctly_…</code> to <code className="font-mono text-ink">{apiBase()}</code>. Revoking stops a key at once. The API reference is at{" "}
              <a className="text-ink underline" href={`${apiBase()}/openapi.json`} target="_blank" rel="noreferrer">
                /v1/openapi.json
              </a>
              .
            </p>
          </>
        )}
      </DialogBody>
    </Dialog>
  );
}
