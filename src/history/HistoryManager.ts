/**
 * Session undo/redo over opaque snapshot strings (serialized templates).
 * Pure data structure — capturing and restoring snapshots is the caller's job.
 */
export class HistoryManager {
    private undoStack: string[] = [];
    private redoStack: string[] = [];
    private current: string | null = null;

    constructor(private readonly limit = 50) {}

    /** Start a new history (e.g. after loading a template). */
    reset(snapshot: string): void {
        this.undoStack = [];
        this.redoStack = [];
        this.current = snapshot;
    }

    /**
     * Record a new state. Returns false (and records nothing) when the
     * snapshot is identical to the current state.
     */
    commit(snapshot: string): boolean {
        if (snapshot === this.current) return false;
        if (this.current !== null) {
            this.undoStack.push(this.current);
            if (this.undoStack.length > this.limit) this.undoStack.shift();
        }
        this.current = snapshot;
        this.redoStack = [];
        return true;
    }

    get canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    get canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    /** Step back; returns the snapshot to restore, or null if at the start. */
    undo(): string | null {
        if (!this.canUndo || this.current === null) return null;
        this.redoStack.push(this.current);
        this.current = this.undoStack.pop()!;
        return this.current;
    }

    /** Step forward; returns the snapshot to restore, or null if at the end. */
    redo(): string | null {
        if (!this.canRedo || this.current === null) return null;
        this.undoStack.push(this.current);
        this.current = this.redoStack.pop()!;
        return this.current;
    }
}
