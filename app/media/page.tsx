import { WorkspaceShell } from "@/components/hub/WorkspaceShell";

export const metadata = {
  title: "Media · Contently",
};

export default function MediaPage() {
  return (
    <WorkspaceShell title="Media">
      <div className="flex h-40 items-center justify-center rounded-card bg-panel px-6 text-center text-default text-ink-secondary">
        Your uploads and our stock library will live here. For now, add media from the studio&rsquo;s Uploads and Stock panels.
      </div>
    </WorkspaceShell>
  );
}
