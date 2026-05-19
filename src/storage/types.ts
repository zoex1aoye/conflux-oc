export interface StorageAdapter {
  read(path: string): string | null
  write(path: string, content: string): void
  list(dir: string): string[]
  delete(path: string): void
}
