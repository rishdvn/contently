/*
  The studio's autosave, without React or Convex, so it can be tested alone.

  Every change is recorded; a write goes out a beat after the last one. There is
  only ever one write in flight: changes that arrive during it are written when
  it answers, and only the latest document is sent. That is last-write-wins
  without the out-of-order writes a burst of parallel saves could produce.

  A write that fails is retried with backoff. Convex itself queues mutations
  while the socket is down and resends them on reconnect, so going offline
  shows up here as a write that never answers rather than one that throws; the
  owner reports connectivity with `setOnline`, and a write that has been out
  longer than `stall` is reported as not saved even if the socket looks fine.
*/

export type SaveStatus =
  /* Nothing has been written since the studio opened. */
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; at: number }
  /* `retryAt` is when the next automatic attempt goes out, or null while it
     waits on the connection instead. */
  | { state: "failed"; offline: boolean; retryAt: number | null };

export type AutosaveOptions<T> = {
  write: (doc: T) => Promise<void>;
  debounce?: number;
  stall?: number;
  backoff?: readonly number[];
  now?: () => number;
};

const BACKOFF = [1000, 2000, 4000, 8000, 15000, 30000];

type Timer = ReturnType<typeof setTimeout>;

export class Autosaver<T> {
  status: SaveStatus = { state: "idle" };
  /* The last write's error, for "Copy error details". */
  lastError: unknown = null;

  private readonly opts: Required<AutosaveOptions<T>>;
  private doc: T | null = null;
  /* Bumped on every change; `saved` is the newest version a write confirmed. */
  private version = 0;
  private saved = 0;
  private writing = false;
  private failed = false;
  private stalled = false;
  private online = true;
  private closed = false;
  private attempt = 0;
  private savedAt: number | null = null;
  private retryAt: number | null = null;
  private debounceTimer: Timer | null = null;
  private retryTimer: Timer | null = null;
  private stallTimer: Timer | null = null;
  private readonly listeners = new Set<(s: SaveStatus) => void>();
  private waiters: ((clean: boolean) => void)[] = [];

  constructor(opts: AutosaveOptions<T>) {
    this.opts = {
      write: opts.write,
      debounce: opts.debounce ?? 500,
      stall: opts.stall ?? 10_000,
      backoff: opts.backoff ?? BACKOFF,
      now: opts.now ?? (() => Date.now()),
    };
  }

  /* Unsaved changes, including any in the debounce window or in flight. */
  get dirty() {
    return this.saved < this.version;
  }

  subscribe(listener: (s: SaveStatus) => void) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  change(doc: T) {
    this.doc = doc;
    this.version++;
    /* While failing, the backoff decides when to try again; typing should not
       turn every keystroke into another attempt. */
    if (!this.failed) {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.write(), this.opts.debounce);
    }
    this.update();
  }

  /* Write now. Resolves true once everything recorded is saved, false if a
     write fails first. */
  flush(): Promise<boolean> {
    if (!this.dirty) return Promise.resolve(true);
    const settled = new Promise<boolean>((resolve) => this.waiters.push(resolve));
    this.write();
    return settled;
  }

  /* The manual "Retry": skip the rest of the backoff. */
  retry() {
    if (this.failed) this.write();
  }

  setOnline(online: boolean) {
    if (online === this.online) return;
    this.online = online;
    /* Coming back is the best moment to try again. */
    if (online && this.failed) this.write();
    this.update();
  }

  /* The studio is going away: send what is pending and stop retrying. */
  close() {
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.dirty) this.write();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = this.retryTimer = null;
  }

  private write() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.debounceTimer = this.retryTimer = null;
    this.retryAt = null;
    /* The write in flight picks up anything newer when it answers. */
    if (this.writing || !this.dirty || this.doc === null) return;

    const version = this.version;
    this.writing = true;
    this.stallTimer = setTimeout(() => {
      this.stalled = true;
      this.update();
    }, this.opts.stall);
    this.update();

    this.opts.write(this.doc).then(
      () => {
        this.saved = Math.max(this.saved, version);
        this.savedAt = this.opts.now();
        this.failed = false;
        this.attempt = 0;
        this.lastError = null;
      },
      (error: unknown) => {
        this.failed = true;
        this.lastError = error;
        const wait = this.opts.backoff[Math.min(this.attempt, this.opts.backoff.length - 1)];
        this.attempt++;
        if (!this.closed) {
          this.retryAt = this.opts.now() + wait;
          this.retryTimer = setTimeout(() => this.write(), wait);
        }
      },
    ).finally(() => {
      this.writing = false;
      this.stalled = false;
      if (this.stallTimer) clearTimeout(this.stallTimer);
      this.stallTimer = null;
      /* Changes arrived while this write was out and their debounce has
         already passed: send the latest now. */
      if (!this.failed && this.dirty && !this.debounceTimer) this.write();
      if (!this.dirty || this.failed) {
        const waiters = this.waiters;
        this.waiters = [];
        waiters.forEach((resolve) => resolve(!this.dirty));
      }
      this.update();
    });
  }

  private update() {
    const next: SaveStatus =
      this.failed || (this.dirty && (!this.online || this.stalled))
        ? { state: "failed", offline: !this.online, retryAt: this.retryAt }
        : this.dirty
          ? { state: "saving" }
          : this.savedAt !== null
            ? { state: "saved", at: this.savedAt }
            : { state: "idle" };
    if (JSON.stringify(next) === JSON.stringify(this.status)) return;
    this.status = next;
    this.listeners.forEach((l) => l(next));
  }
}
