import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

export interface MigrationEntry {
  oldPath: string
  newApi: string
  sourceFile: string
}

function parseMigrationMap(content: string, sourceFile: string): MigrationEntry[] {
  const entries: MigrationEntry[] = []

  const mapSection = content.match(/### Migration Map\n([\s\S]*?)(?=\n###|\n##|\n#|$)/)
  if (!mapSection) return entries

  const lines = mapSection[1].split("\n")
  for (const line of lines) {
    const match = line.match(
      /-\s*`([^`]+)`\s*(?:→|is replaced by)\s*(?:已有\s*)?`?([^`\n]+?)`?\s*$/,
    )
    if (match) {
      entries.push({
        oldPath: match[1].trim(),
        newApi: match[2].trim(),
        sourceFile,
      })
    }
  }

  return entries
}

function findSkillFiles(skillsDir: string): string[] {
  const results: string[] = []

  function walk(dir: string) {
    if (!existsSync(dir)) return
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (!entry.name.startsWith("_archive") && !entry.name.startsWith("decisions")) {
            walk(fullPath)
          }
        } else if (entry.name.endsWith("SKILL.md") || entry.name.endsWith("skill.md")) {
          results.push(fullPath)
        }
      }
    } catch { /* skip */ }
  }

  walk(skillsDir)
  return results
}

export function parseAllMigrationMaps(skillsDir: string): MigrationEntry[] {
  const results: MigrationEntry[] = []
  const files = findSkillFiles(skillsDir)

  for (const file of files) {
    try {
      const raw = readFileSync(file, "utf-8")
      const entries = parseMigrationMap(raw, file)
      results.push(...entries)
    } catch { /* skip */ }
  }

  return results
}

export function findMigrationMatch(
  filePath: string,
  entries: MigrationEntry[],
): MigrationEntry | null {
  for (const entry of entries) {
    const norm = entry.oldPath.replace(/\/$/, "").toLowerCase()
    const target = filePath.toLowerCase()
    if (target.includes(norm) || norm.includes(target)) {
      return entry
    }
    const oldBase = norm.split("/").pop() || ""
    const targetBase = target.split("/").pop() || ""
    if (oldBase && oldBase === targetBase) {
      return entry
    }
  }
  return null
}

export function formatMigrationHints(entries: MigrationEntry[]): string {
  if (entries.length === 0) return ""
  const lines: string[] = []
  lines.push("## Available Migrations")
  lines.push("")
  lines.push("When modifying these files, consider upgrading:")
  lines.push("")
  for (const entry of entries) {
    lines.push(`- \`${entry.oldPath}\` is replaced by \`${entry.newApi}\``)
  }
  lines.push("")
  return lines.join("\n")
}
