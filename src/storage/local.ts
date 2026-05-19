import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import type { StorageAdapter } from "./types.js"

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private basePath: string) {
    if (!existsSync(basePath)) {
      mkdirSync(basePath, { recursive: true })
    }
  }

  read(path: string): string | null {
    const fullPath = join(this.basePath, path)
    try {
      return readFileSync(fullPath, "utf-8")
    } catch {
      return null
    }
  }

  write(path: string, content: string): void {
    const fullPath = join(this.basePath, path)
    const dir = dirname(fullPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(fullPath, content, "utf-8")
  }

  list(dir: string): string[] {
    const fullPath = join(this.basePath, dir)
    try {
      return readdirSync(fullPath, { withFileTypes: true }).map((e) => e.name)
    } catch {
      return []
    }
  }

  delete(path: string): void {
    const fullPath = join(this.basePath, path)
    try {
      unlinkSync(fullPath)
    } catch {
      // ignore
    }
  }
}
