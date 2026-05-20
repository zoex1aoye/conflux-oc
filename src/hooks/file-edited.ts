import { readFileSync } from "node:fs"
import { execSync } from "node:child_process"
import { relative } from "node:path"
import type { ResolvedPluginConfig } from "../config.js"
import type { Logger } from "../utils/logger.js"
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

export async function handleFileEdited(
  logger: Logger,
  config: ResolvedPluginConfig,
  filePath: string,
): Promise<void> {
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

  if (!change.isSubstantial) {
    logger.debug("SKILL.md non-substantial change skipped", { filePath })
    return
  }

  const logPath = createDecisionLog(filePath, change)
  logger.info("Decision log created", {
    filePath,
    logPath,
    linesAdded: change.linesAdded,
    linesRemoved: change.linesRemoved,
  })

  if (change.oldName && change.newName && change.oldName !== change.newName) {
    archiveOldVariant(filePath, change)
    updateMigrationMap(filePath, change.oldName, change.newName)
    logger.info("Variant archived and migration map updated", {
      oldName: change.oldName,
      newName: change.newName,
    })
  }
}
