/**
 * Tracks vault paths the plugin itself just wrote to, so a "modify" event handler can ignore its
 * own echoes and never re-enter its own write path (the loop Task 40's checkbox sync must avoid).
 *
 * `endSuppress` keeps the path suppressed for a short grace period rather than clearing it
 * immediately: Obsidian's "modify" event ordering relative to an awaited `vault.modify()` call
 * isn't a contract this plugin can rely on, so a brief window trades "a genuine edit landing in
 * the same file within milliseconds of our own write is briefly ignored" (rare, and the next
 * edit still fires normally) for "never spin into a self-triggered write loop" (always required).
 */
export class WriteSuppressionTracker {
    private readonly counts = new Map<string, number>();
    private readonly clearTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly graceMs: number;
    private readonly scheduleClear: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
    private readonly cancelClear: (handle: ReturnType<typeof setTimeout>) => void;

    constructor(
        graceMs = 500,
        scheduleClear: (fn: () => void, ms: number) => ReturnType<typeof setTimeout> = setTimeout,
        cancelClear: (handle: ReturnType<typeof setTimeout>) => void = clearTimeout,
    ) {
        this.graceMs = graceMs;
        this.scheduleClear = scheduleClear;
        this.cancelClear = cancelClear;
    }

    beginSuppress(path: string): void {
        const pending = this.clearTimers.get(path);
        if (pending) {
            this.cancelClear(pending);
            this.clearTimers.delete(path);
        }
        this.counts.set(path, (this.counts.get(path) ?? 0) + 1);
    }

    endSuppress(path: string): void {
        const count = this.counts.get(path) ?? 0;
        if (count <= 1) {
            this.counts.delete(path);
            const handle = this.scheduleClear(() => this.clearTimers.delete(path), this.graceMs);
            this.clearTimers.set(path, handle);
        } else {
            this.counts.set(path, count - 1);
        }
    }

    isSuppressed(path: string): boolean {
        return (this.counts.get(path) ?? 0) > 0 || this.clearTimers.has(path);
    }
}
