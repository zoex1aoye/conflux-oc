import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"

export interface ParsedContent {
  raw: string
  parsed: Record<string, unknown> | null
}

export type ParserFn = (content: string) => Record<string, unknown>

const parserRegistry = new Map<string, ParserFn>()

export function registerParser(ext: string, parser: ParserFn): void {
  parserRegistry.set(ext, parser)
}

export function readParsed(basePath: string, relPath: string): ParsedContent | null {
  const fullPath = join(basePath, relPath)
  try {
    if (!existsSync(fullPath)) return null
    const raw = readFileSync(fullPath, "utf-8")
    const ext = relPath.split(".").pop() || ""
    const parser = parserRegistry.get(ext)
    return { raw, parsed: parser ? parser(raw) : null }
  } catch {
    return null
  }
}

export function writeParsed(basePath: string, relPath: string, content: string): void {
  const fullPath = join(basePath, relPath)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, content, "utf-8")
}

function defaultYamlParser(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = content.split("\n")
  let currentKey = ""
  for (const line of lines) {
    const match = line.match(/^(\w[\w.-]*):\s*(.*)/)
    if (match) {
      currentKey = match[1]
      result[currentKey] = match[2] || ""
    } else if (currentKey) {
      result[currentKey] = (result[currentKey] as string) + "\n" + line
    }
  }
  return result
}

registerParser("yaml", defaultYamlParser)
registerParser("yml", defaultYamlParser)
registerParser("json", (c) => JSON.parse(c))
registerParser("md", (c) => ({ raw: c }))
