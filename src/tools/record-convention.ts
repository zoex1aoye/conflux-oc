import { tool } from "@opencode-ai/plugin"
import type { Logger } from "../utils/logger.js"
import type { ResolvedPluginConfig } from "../config.js"
import { loadUserPreferences, saveUserPreferences } from "../layers/user-layer.js"

export function createRecordConventionTool(logger: Logger, config: ResolvedPluginConfig) {
  return tool({
    description: "Record a workflow habit or coding convention observed from the user. Habits are appended (with separator) to existing habits. Conventions are appended to a list (deduplicated by exact match).",
    args: {
      type: tool.schema.enum(["habit", "convention"]).describe("habit for workflow pattern, convention for coding rule"),
      content: tool.schema.string().describe("the observed habit or convention description"),
    },
    async execute(args) {
      const prefs = loadUserPreferences(config)

      if (args.type === "habit") {
        const trimmed = args.content.trim()
        const existing = prefs.workflow_habits || ""
        if (existing.includes(trimmed)) {
          return `Habit already recorded (content already exists in stored habits)`
        }
        const merged = existing
          ? `${existing}\n---\n${trimmed}`
          : trimmed
        saveUserPreferences(config, { workflow_habits: merged })
        logger.info("Workflow habit recorded", { content: trimmed })
        return `Saved habit: "${trimmed}"`
      }

      const existing = prefs.coding_conventions ?? []
      if (existing.includes(args.content)) {
        return `Convention already recorded: "${args.content}"`
      }
      saveUserPreferences(config, { coding_conventions: [...existing, args.content] })
      logger.info("Coding convention recorded", { content: args.content })
      return `Saved convention: "${args.content}"`
    },
  })
}
