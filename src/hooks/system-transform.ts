import type { Logger } from "../utils/logger.js"
import type { ResolvedPluginConfig } from "../config.js"
import { buildLargeFileSystemRule } from "./large-file-guard.js"

function buildSkillEditRule(): string {
  return [
    "## Skill Management",
    "",
    "After editing SKILL.md, evaluate if the change is substantial.",
    "If so, call note_discovery() to record the knowledge.",
    "Choose the appropriate layer (project/machine/user), scope (branch/cross),",
    "and mode (upsert/append/deprecate) for the knowledge.",
  ].join("\n")
}

export function createSystemTransformHandler(
  logger: Logger,
  config: ResolvedPluginConfig,
) {
  const largeFileRule = buildLargeFileSystemRule(config.largeFileThreshold)
  const skillEditRule = buildSkillEditRule()
  const combined = `${largeFileRule}\n\n${skillEditRule}`
  return async (_input: any, output: any) => {
    if (!output.system) {
      output.system = combined
    } else if (typeof output.system === "string") {
      output.system = `${output.system}\n\n${combined}`
    }
    logger.debug("System rules appended to system prompt")
  }
}
