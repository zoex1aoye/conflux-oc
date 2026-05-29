import { homedir } from "node:os"
import { join } from "node:path"
import { PLUGIN_NAME } from "./constants.js"

export interface ResolvedPluginConfig {
  pluginDataDir: string
  projectRoot: string
}

function resolvePluginDataDir(): string {
  const configDir = process.env.OPENCODE_CONFIG_DIR
  if (configDir) {
    return join(configDir, "plugins", PLUGIN_NAME)
  }
  return join(homedir(), ".config", "opencode", "plugins", PLUGIN_NAME)
}

export function resolvePluginConfig(projectRoot?: string): ResolvedPluginConfig {
  const base = projectRoot || process.cwd()
  return {
    pluginDataDir: resolvePluginDataDir(),
    projectRoot: base,
  }
}
