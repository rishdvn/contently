"use client";

import { useOrganization } from "@clerk/nextjs";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useActiveOrg } from "@/lib/auth/useActiveOrg";
import { clearLegacyProjects, declineLegacyProjects, useLegacyProjects, useProjectActions } from "@/lib/editor/persistence";

/*
  The bridge out of localStorage.

  Before Convex the studio kept projects in the browser. Anyone who used it
  then still has them, and they belong to an organisation now — but which one
  is a question only the person can answer, so the hub offers rather than
  migrates. Taking the offer copies the documents into the org that is active
  and drops the local copies; declining keeps them, in case the answer was
  "not this org", and stops asking.

  Once a browser has neither local projects nor the offer outstanding, this
  renders nothing and never appears again.
*/
export function ImportLocalProjects() {
  const { orgId } = useActiveOrg();
  const { organization } = useOrganization();
  const projects = useLegacyProjects();
  const { importLocalProjects } = useProjectActions();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (!orgId || projects.length === 0) return null;

  const count = `${projects.length} local project${projects.length > 1 ? "s" : ""}`;

  const run = async () => {
    setBusy(true);
    try {
      const imported = await importLocalProjects(projects);
      clearLegacyProjects();
      toast({ title: `Imported ${imported} project${imported === 1 ? "" : "s"}`, description: `They are in ${organization?.name ?? "this organisation"} now.` });
    } catch (error) {
      console.error(error);
      /* Nothing was cleared, so the offer is still on the table. */
      toast({ title: "Import failed", description: "Your local projects are untouched. Try again in a moment." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Alert
      className="mt-6"
      title={`Import ${count} into ${organization?.name ?? "this organisation"}?`}
      action={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" disabled={busy} onClick={declineLegacyProjects}>
            Not now
          </Button>
          <Button size="sm" variant="primary" disabled={busy} onClick={() => void run()}>
            {busy ? "Importing…" : "Import"}
          </Button>
        </div>
      }
    >
      They were saved in this browser before projects moved to your workspace. Importing copies them in and clears the local ones.
    </Alert>
  );
}
