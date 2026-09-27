"use client";

import { Keyboard } from "lucide-react";

import { Dialog, DialogBody, DialogHeader, DialogIcon } from "@/components/ui/dialog";
import { useEditor } from "@/lib/editor/store";

import { Card } from "../controls";
import { SHORTCUT_AREAS, SHORTCUTS, type Shortcut } from "../useHotkeys";

/*
  The reference sheet for the keyboard model. It reads straight off the table
  the handler runs, so a binding cannot appear here without working — and
  cannot change without this changing with it. Rows that only apply to one kind
  of project (Space plays a video, pans a still) are filtered by the open one.
*/
export function ShortcutsDialog() {
  const open = useEditor((s) => s.dialog === "shortcuts");
  const setDialog = useEditor((s) => s.setDialog);
  const kind = useEditor((s) => s.project.kind);
  const close = () => setDialog(null);

  const groups = SHORTCUT_AREAS.map((area) => ({
    area,
    rows: SHORTCUTS.filter((s) => s.area === area && (!s.kinds || s.kinds.includes(kind))),
  })).filter((g) => g.rows.length);

  return (
    <Dialog open={open} onClose={close} size="lg" className="max-h-[calc(100dvh-96px)]">
      <DialogHeader
        icon={
          <DialogIcon>
            <Keyboard />
          </DialogIcon>
        }
        title="Keyboard shortcuts"
        description="Press ? at any time to open this list."
        onClose={close}
      />
      <DialogBody>
        {/* Two columns of cards, balanced by the browser rather than by hand. */}
        <div className="columns-2 gap-3 [&>*]:mb-3">
          {groups.map((g) => (
            <Card key={g.area} className="break-inside-avoid p-2">
              <div className="px-1.5 pt-1 pb-1.5 text-cap text-ink-secondary">{g.area}</div>
              <div className="flex flex-col">
                {g.rows.map((s) => (
                  <Row key={s.id} shortcut={s} />
                ))}
              </div>
            </Card>
          ))}
        </div>
        <p className="px-1 pt-1 text-cap text-ink-disabled">⌘ is Ctrl on Windows and Linux.</p>
      </DialogBody>
    </Dialog>
  );
}

function Row({ shortcut }: { shortcut: Shortcut }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 rounded-[8px] px-1.5 py-1">
      <span className="min-w-0 text-ui text-ink">{shortcut.label}</span>
      <span className="flex shrink-0 items-center gap-1">
        {shortcut.keys.map((k) => (
          <kbd
            key={k}
            className="flex h-6 min-w-6 items-center justify-center rounded-[6px] bg-raised px-1.5 font-mono text-cap text-ink-secondary"
          >
            {k}
          </kbd>
        ))}
      </span>
    </div>
  );
}
