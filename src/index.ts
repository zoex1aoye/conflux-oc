import type { Plugin } from "@opencode-ai/plugin"
import { resolvePluginConfig } from "./config.js"
import { LayerRegistry } from "./layers/registry.js"
import { createSessionCreatedHandler } from "./hooks/session-created.js"
import { createFileEditedHandler } from "./hooks/file-edited.js"
import { createToolExecuteBeforeHandler } from "./hooks/tool-execute-before.js"
import { createNoteDiscoveryTool } from "./tools/note-discovery.js"
import { createGetMachineContextTool } from "./tools/get-machine-context.js"

const plugin: Plugin = (async (ctx) => {
  const config = resolvePluginConfig(ctx.directory)
  const registry = new LayerRegistry(config.layers)

  return {
    "session.created": createSessionCreatedHandler(ctx.client, config, registry),
    "file.edited": createFileEditedHandler(config, registry),
    "tool.execute.before": createToolExecuteBeforeHandler(config, registry),
    tool: {
      note_discovery: createNoteDiscoveryTool(config),
      get_machine_context: createGetMachineContextTool(config),
    },
  }
}) satisfies Plugin

export default plugin
