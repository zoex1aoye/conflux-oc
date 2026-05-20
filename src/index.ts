import type { Plugin } from "@opencode-ai/plugin"
import { resolvePluginConfig } from "./config.js"
import { LayerRegistry } from "./layers/registry.js"
import { createLogger } from "./utils/logger.js"
import { createEventHandler } from "./hooks/event-dispatcher.js"
import { createToolExecuteBeforeHandler } from "./hooks/tool-execute-before.js"
import { createSystemTransformHandler } from "./hooks/system-transform.js"
import { createNoteDiscoveryTool } from "./tools/note-discovery.js"
import { createGetMachineContextTool } from "./tools/get-machine-context.js"
import { loadMachineProfile, saveMachineProfile, createMachineProfile } from "./layers/machine-layer.js"
import type { MachineDomain } from "./layers/machine-layer.js"
import { detectToolchain } from "./detection/toolchain.js"

const plugin: Plugin = (async (ctx) => {
  const config = resolvePluginConfig(ctx.directory)
  const registry = new LayerRegistry(config.layers)
  const logger = createLogger(ctx.client)

  logger.info("Plugin initialized", {
    projectRoot: config.projectRoot,
    pluginDataDir: config.pluginDataDir,
    layerCount: config.layers.length,
  })

  let machine = loadMachineProfile(config)
  if (!machine) {
    const toolchain = await detectToolchain()
    const domains: Record<string, MachineDomain> = {}
    for (const [name, t] of Object.entries(toolchain)) {
      if (t) {
        domains[`${name}_dev`] = { paths: t.paths, versions: t.versions }
      }
    }
    machine = createMachineProfile(config, domains)
    saveMachineProfile(config, machine)
    logger.info("Machine profile created at load time", {
      id: machine.machine_id,
      method: machine.id_method,
      hostname: machine.hostname,
      domains: Object.keys(domains),
    })
  } else {
    logger.debug("Machine profile already exists", { id: machine.machine_id })
  }

  return {
    event: createEventHandler(logger, ctx.client, config),
    "tool.execute.before": createToolExecuteBeforeHandler(logger, ctx.client, config, registry),
    "experimental.chat.system.transform": createSystemTransformHandler(logger, config),
    tool: {
      note_discovery: createNoteDiscoveryTool(logger, config),
      get_machine_context: createGetMachineContextTool(logger, config),
    },
  }
}) satisfies Plugin

export default plugin
