import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "node:fs"
import { join, dirname } from "node:path"
import type { ChangeInfo } from "./change-detector.js"
import { t } from "../i18n/index.js"

function moduleDir(filePath: string): string {
  const segments = filePath.split("/")
  const skillsIdx = segments.lastIndexOf(".opencode")
  if (skillsIdx === -1) return dirname(filePath)

  const skillsDir = join(segments.slice(0, skillsIdx + 2).join("/"))
  const relative = filePath.replace(skillsDir + "/", "")
  const parts = relative.split("/")
  return parts.length > 1 ? join(skillsDir, parts[0]) : skillsDir
}

export function createDecisionLog(
  filePath: string,
  change: ChangeInfo,
): string | null {
  const dir = moduleDir(filePath)
  const decisionsDir = join(dir, "decisions")
  mkdirSync(decisionsDir, { recursive: true })

  const date = new Date().toISOString().split("T")[0]
  const topic = change.oldName || change.newName || "skill"
  const logPath = join(decisionsDir, `${date}-${topic}.md`)

  const lines: string[] = []
  lines.push(t("decision.title", { date }))
  lines.push("")
  lines.push(t("decision.affected_file", { path: filePath }))
  lines.push("")
  if (change.oldName && change.newName && change.oldName !== change.newName) {
    lines.push(t("decision.name_change", { old: change.oldName, new: change.newName }))
    lines.push("")
  }
  lines.push(t("decision.stats_title"))
  lines.push("")
  lines.push(t("decision.lines_added", { count: change.linesAdded }))
  lines.push(t("decision.lines_removed", { count: change.linesRemoved }))
  lines.push("")
  if (change.oldHeadings.length > 0 || change.newHeadings.length > 0) {
    lines.push(t("decision.structure_title"))
    lines.push("")
    const removed = change.oldHeadings.filter((h) => !change.newHeadings.includes(h))
    const added = change.newHeadings.filter((h) => !change.oldHeadings.includes(h))
    if (removed.length > 0) {
      lines.push(t("decision.section_removed", { sections: removed.join(", ") }))
    }
    if (added.length > 0) {
      lines.push(t("decision.section_added", { sections: added.join(", ") }))
    }
    lines.push("")
  }
  lines.push(t("decision.reason_title"))
  lines.push("")
  lines.push(t("decision.reason_placeholder"))
  lines.push("")

  writeFileSync(logPath, lines.join("\n"), "utf-8")
  return logPath
}

export function archiveOldVariant(
  filePath: string,
  change: ChangeInfo,
): string | null {
  if (!change.oldName || !change.newName || change.oldName === change.newName) {
    return null
  }

  const dir = moduleDir(filePath)
  const archiveDir = join(dir, "_archive", change.oldName)
  mkdirSync(archiveDir, { recursive: true })

  const archivePath = join(archiveDir, "SKILL.md")
  if (existsSync(filePath)) {
    try {
      renameSync(filePath, archivePath)
    } catch {
      const content = readFileSync(filePath, "utf-8")
      writeFileSync(archivePath, content, "utf-8")
    }
  }

  return archivePath
}

export function updateMigrationMap(
  filePath: string,
  oldName: string,
  newName: string,
): void {
  try {
    const content = readFileSync(filePath, "utf-8")
    const lines = content.split("\n")
    let migrationIdx = lines.findIndex((l) => l.startsWith("### Migration Map"))
    const entry = t("migration.entry", { old: oldName, new: newName })

    if (migrationIdx === -1) {
      lines.push("")
      lines.push("### Migration Map")
      lines.push(entry)
    } else {
      let insertIdx = migrationIdx + 2
      while (
        insertIdx < lines.length &&
        (lines[insertIdx].trim() === "" || lines[insertIdx].startsWith("-"))
      ) {
        insertIdx++
      }
      lines.splice(insertIdx, 0, entry)
    }

    writeFileSync(filePath, lines.join("\n"), "utf-8")
  } catch {
    // can't update migration map, skip
  }
}
