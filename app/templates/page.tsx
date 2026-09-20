import { WorkspaceShell } from "@/components/hub/WorkspaceShell";

export const metadata = {
  title: "Templates · Contently",
};

export default function TemplatesPage() {
  return (
    <WorkspaceShell title="Templates">
      <div className="flex h-40 items-center justify-center rounded-card bg-panel px-6 text-center text-default text-ink-secondary">
        The template library will live here. For now, the studio&rsquo;s Templates panel applies a layout to the scene you are on.
      </div>
    </WorkspaceShell>
  );
}
