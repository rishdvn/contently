"use client";

import { useMutation, useQuery } from "convex/react";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader, DialogIcon } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api } from "@/convex/_generated/api";
import { useActiveOrg } from "@/lib/auth/useActiveOrg";

/*
  Deleting a template, from the Templates page's preview and the studio's
  Templates flyout. Only the active organisation's admins may, and only its own
  templates (`templates.deleteTemplate`); `useDeletableTemplates` is which ones
  those are, so the action is offered only where it will work.
*/

/* Ids of the templates the caller may delete in the active organisation; empty for a member. */
export function useDeletableTemplates() {
  const { orgId } = useActiveOrg();
  const ids = useQuery(api.templates.deletable, orgId ? { orgId } : "skip");
  return useMemo(() => new Set<string>(ids ?? []), [ids]);
}

export type DeletableTemplate = { id: string; name: string; published: boolean };

/*
  "Delete this template?" Confirming deletes it and its posters and closes; the
  lists it was in drop it as their queries update. `onDeleted` runs first, so
  a view showing the template can leave before it disappears from under it.
*/
export function DeleteTemplateDialog({ template, onClose, onDeleted }: { template: DeletableTemplate | null; onClose: () => void; onDeleted?: () => void }) {
  const { orgId } = useActiveOrg();
  const toast = useToast();
  const remove = useMutation(api.templates.deleteTemplate);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!template || !orgId || busy) return;
    setBusy(true);
    try {
      onDeleted?.();
      await remove({ orgId, id: template.id });
      toast({ title: `Deleted “${template.name}”` });
    } catch (error) {
      console.error(error);
      toast({ title: "Couldn't delete that template", description: "It may already be gone, or you may no longer be an admin here." });
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <Dialog open={template !== null} onClose={onClose} size="sm">
      <DialogHeader
        icon={
          <DialogIcon tone="critical">
            <Trash2 />
          </DialogIcon>
        }
        title="Delete this template?"
        description={
          template?.published
            ? `“${template.name}” is published: deleting it takes it off every organisation's Templates. Projects made from it are kept. This can't be undone.`
            : `“${template?.name ?? ""}” goes from your organisation's Templates. Projects made from it are kept. This can't be undone.`
        }
        onClose={onClose}
      />
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" disabled={busy} onClick={confirm}>
          Delete
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
