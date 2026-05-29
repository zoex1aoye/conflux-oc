import type { Plugin } from "@opencode-ai/plugin"
import { resolvePluginConfig } from "./config.js"
import { createLogger } from "./utils/logger.js"
import { createEventHandler } from "./hooks/event-handler.js"
import { createSystemTransformHook } from "./hooks/system-transform.js"
import { createRecordConventionTool } from "./tools/record-convention.js"
import { createCompactPreferencesTool } from "./tools/compact-preferences.js"
import { createUpdateSessionTitleTool } from "./tools/update-session-title.js"
import { loadUserPreferences } from "./layers/user-layer.js"

const plugin: Plugin = (async (ctx) => {
  const config = resolvePluginConfig(ctx.directory)
  const logger = createLogger(ctx.client)

  logger.info("Plugin initialized", {
    projectRoot: config.projectRoot,
    pluginDataDir: config.pluginDataDir,
  })

  const userPrefs = loadUserPreferences(config)
  logger.debug("User preferences loaded", {
    user: userPrefs.user,
    hasHabits: !!userPrefs.workflow_habits,
    conventionCount: userPrefs.coding_conventions?.length ?? 0,
  })

  return {
    event: createEventHandler(logger, ctx.client, config),
    tool: {
      record_convention: createRecordConventionTool(logger, config),
      compact_preferences: createCompactPreferencesTool(logger, config),
      update_session_title: createUpdateSessionTitleTool(ctx.client),
    },
    "experimental.chat.system.transform": createSystemTransformHook(),
  }
}) satisfies Plugin

export default plugin
