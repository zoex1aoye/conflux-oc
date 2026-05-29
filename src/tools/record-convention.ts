import { tool } from "@opencode-ai/plugin"
import type { Logger } from "../utils/logger.js"
import type { ResolvedPluginConfig } from "../config.js"
import { loadUserPreferences, saveUserPreferences } from "../layers/user-layer.js"

export function createRecordConventionTool(logger: Logger, config: ResolvedPluginConfig) {
  return tool({
    description: "Record a workflow habit or coding convention observed from the user. Habits describe the user's preferred workflow (single string). Conventions are individual coding rules (appended to list, deduplicated by exact match).",
    args: {
      type: tool.schema.enum(["habit", "convention"]).describe("habit for workflow pattern, convention for coding rule"),
      content: tool.schema.string().describe("the observed habit or convention description"),
    },
    async execute(args) {
      const prefs = loadUserPreferences(config)

      if (args.type === "habit") {
        saveUserPreferences(config, { workflow_habits: args.content })
        logger.info("Workflow habit recorded", { content: args.content })
      } else {
        const existing = prefs.coding_conventions ?? []
        if (existing.includes(args.content)) {
          return `Convention already recorded: "${args.content}"`
        }
        saveUserPreferences(config, { coding_conventions: [...existing, args.content] })
        logger.info("Coding convention recorded", { content: args.content })
      }

      return `Saved ${args.type}: "${args.content}"`
    },
  })
}
