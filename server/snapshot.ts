import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { WorldStore } from "./worlds.js";

const SNAPSHOT_VERSION = 1;

/**
 * Debounced, atomic persistence for world strokes. The snapshot lives at
 * `.data/worlds.json` by default and is written through a temp file + rename.
 */
export class SnapshotStore {
  private timer: NodeJS.Timeout | null = null;
  private active: Promise<void> | null = null;
  private dirty = false;

  constructor(
    private readonly store: WorldStore,
    private readonly filePath: string,
    private readonly delayMs = 2_000,
  ) {}

  async load(): Promise<number> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      const count = this.store.restore(parsed);
      console.log(`[snapshot] restored ${count} world(s) from ${this.filePath}`);
      return count;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        const detail = error instanceof Error ? error.message : String(error);
        console.warn(`[snapshot] could not load ${this.filePath}: ${detail}`);
      }
      return 0;
    }
  }

  schedule(): void {
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush().catch((error) => {
        console.error("[snapshot] save failed", error);
      });
    }, this.delayMs);
    this.timer.unref?.();
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.active) await this.active;
    if (!this.dirty) return;

    this.dirty = false;
    this.active = this.writeAtomic();
    try {
      await this.active;
    } catch (error) {
      this.dirty = true;
      throw error;
    } finally {
      this.active = null;
    }
  }

  private async writeAtomic(): Promise<void> {
    const payload = JSON.stringify({
      version: SNAPSHOT_VERSION,
      savedAt: Date.now(),
      ...this.store.snapshot(),
    });

    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, payload, "utf8");

    try {
      await rename(tempPath, this.filePath);
    } catch {
      // Windows can refuse rename over an existing file; replace explicitly.
      await rm(this.filePath, { force: true });
      await rename(tempPath, this.filePath);
    }
  }
}
