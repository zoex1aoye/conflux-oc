import { existsSync, readFileSync } from "node:fs"
import { execSync } from "node:child_process"
import { relative } from "node:path"
import type { ResolvedPluginConfig } from "../config.js"
import type { LayerRegistry } from "../layers/registry.js"
import { analyzeChange } from "../audit/change-detector.js"
import { createDecisionLog, archiveOldVariant, updateMigrationMap } from "../audit/archive-manager.js"

function getOldContent(filePath: string, projectRoot: string): string | null {
  try {
    const relPath = relative(projectRoot, filePath)
    return execSync(`git show HEAD:"${relPath}"`, {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 3000,
    }).toString()
  } catch {
    return null
  }
}

export function createFileEditedHandler(config: ResolvedPluginConfig, _registry: LayerRegistry) {
  return async (input: any, _output: any) => {
    const filePath: string = input.filePath || input.path || ""
    if (!filePath) return

    const skillsDir = config.resolvedStorages.project?.basePath
    if (!skillsDir || !filePath.startsWith(skillsDir)) return

    const isSkillFile =
      filePath.endsWith("SKILL.md") || filePath.endsWith("skill.md")
    if (!isSkillFile) return

    let newContent: string
    try {
      newContent = readFileSync(filePath, "utf-8")
    } catch {
      return
    }

    const oldContent = getOldContent(filePath, config.projectRoot)
    const change = analyzeChange(oldContent, newContent, filePath)

    if (!change.isSubstantial) return

    createDecisionLog(filePath, change)

    if (change.oldName && change.newName && change.oldName !== change.newName) {
      archiveOldVariant(filePath, change)
      updateMigrationMap(filePath, change.oldName, change.newName)
    }
  }
}
