import { detectPlatform, type PlatformInfo } from "../detection/platform.js"
import type { ResolvedPluginConfig } from "../config.js"

export function getPlatformContext(_config: ResolvedPluginConfig): PlatformInfo {
  return detectPlatform()
}

export function formatPlatformContext(platform: PlatformInfo): string {
  return `OS: ${platform.os}\nShell: ${platform.shell}\nArch: ${platform.arch}`
}
