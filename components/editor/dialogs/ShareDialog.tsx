"use client";

import { Check, Globe, Link2, Lock } from "lucide-react";
import { useState } from "react";

import { Switch } from "@/components/ui/switch";
import { useEditor } from "@/lib/editor/store";

import { Card } from "../controls";
import { Flyout, PrimaryButton } from "./Flyout";

/*
  Link sharing and invites. Projects live in this browser, so the link is a
  bookmark to the editor; the collaborator list is a local stub of the
  reference's shape.
*/
export function ShareDialog() {
  const id = useEditor((s) => s.project.id);
  const [publicLink, setPublicLink] = useState(true);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [invited, setInvited] = useState<string[]>([]);

  const url = typeof window !== "undefined" ? `${window.location.origin}/editor/${id}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* Clipboard can be unavailable in insecure contexts; the field is selectable. */
    }
  };

  const invite = () => {
    const e = email.trim();
    if (!e || !/^\S+@\S+\.\S+$/.test(e)) return;
    setInvited((l) => (l.includes(e) ? l : [...l, e]));
    setEmail("");
  };

  return (
    <Flyout id="share" title="Share">
      <Card className="flex items-center gap-2.5 px-2.5 py-2">
        <span className="flex size-8 items-center justify-center rounded-[8px] bg-raised text-ink-secondary">{publicLink ? <Globe className="size-4" /> : <Lock className="size-4" />}</span>
        <div className="min-w-0 flex-1">
          <div className="text-ui text-ink">{publicLink ? "Anyone with the link" : "Only invited people"}</div>
          <div className="text-cap text-ink-secondary">{publicLink ? "Can view this project" : "Link is private"}</div>
        </div>
        <Switch checked={publicLink} onCheckedChange={setPublicLink} />
      </Card>

      <div className="flex items-center gap-1.5">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="h-8 min-w-0 flex-1 rounded-[8px] bg-raised px-2 text-cap text-ink-secondary outline-none" aria-label="Project link" />
        <button type="button" className="flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] bg-raised px-2.5 text-ui text-ink hover:bg-line-strong" onClick={copy}>
          {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="flex flex-col gap-1.5 pt-1">
        <span className="px-0.5 text-cap text-ink-secondary">Invite teammates</span>
        <div className="flex items-center gap-1.5">
          <input
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && invite()}
            className="h-8 min-w-0 flex-1 rounded-[8px] bg-raised px-2 text-ui text-ink outline-none placeholder:text-ink-disabled focus:ring-1 focus:ring-line-strong"
          />
          <PrimaryButton className="h-8 w-auto px-3" onClick={invite} disabled={!email.trim()}>
            Invite
          </PrimaryButton>
        </div>
        {invited.length ? (
          <ul className="flex flex-col gap-1 pt-1">
            {invited.map((e) => (
              <li key={e} className="flex items-center gap-2 px-0.5 text-cap text-ink-secondary">
                <span className="flex size-5 items-center justify-center rounded-full bg-raised text-[9px] uppercase text-ink">{e[0]}</span>
                <span className="truncate">{e}</span>
                <span className="ml-auto text-ink-disabled">Invited</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Flyout>
  );
}
