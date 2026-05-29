import { tool } from "@opencode-ai/plugin"
import type { Logger } from "../utils/logger.js"
import type { ResolvedPluginConfig } from "../config.js"
import { loadUserPreferences, saveUserPreferences } from "../layers/user-layer.js"

export function createCompactPreferencesTool(logger: Logger, config: ResolvedPluginConfig) {
  return tool({
    description: "Compact and merge coding conventions and workflow habits. "
      + "Pass only the fields you want to update; omit unchanged fields. "
      + "Empty array/string explicitly clears that field.",
    args: {
      conventions: tool.schema.array(tool.schema.string()).optional()
        .describe("Replacement conventions list (already merged/deduplicated by you). Pass [] to clear."),
      habit: tool.schema.string().optional()
        .describe("Refined workflow habit. Pass \"\" to clear."),
    },
    async execute(args) {
      const prefs = loadUserPreferences(config)
      const changes: string[] = []

      /**
       * Sanitize and update coding conventions.
       * - Trims each entry
       * - Filters out empty/whitespace-only entries
       * - undefined means "keep existing"
       * - Explicit empty array clears the list
       */
      if (args.conventions !== undefined) {
        const cleaned = args.conventions
          .map(c => c.trim())
          .filter(c => c.length > 0)
        const oldCount = prefs.coding_conventions?.length ?? 0
        saveUserPreferences(config, { coding_conventions: cleaned })
        changes.push(`conventions: ${oldCount} → ${cleaned.length}`)
        logger.info("Coding conventions compacted", { before: oldCount, after: cleaned.length })
      }

      /**
       * Sanitize and update workflow habit.
       * - Trims the string
       * - Empty/whitespace-only result clears the habit
       * - undefined means "keep existing"
       */
      if (args.habit !== undefined) {
        const cleaned = args.habit.trim()
        saveUserPreferences(config, { workflow_habits: cleaned || "" })
        changes.push(cleaned ? "habit updated" : "habit cleared")
        logger.info("Workflow habit compacted", { cleared: !cleaned })
      }

      return changes.length > 0
        ? changes.join(", ")
        : "Nothing to update — both fields were omitted"
    },
  })
}
