import type { ResolvedPluginConfig } from "../config.js"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { execSync } from "node:child_process"

export type KnowledgeScope = "branch" | "cross"
export type KnowledgeLayer = "project" | "machine" | "platform" | "user"

export interface DiscoveryNote {
  domain: string
  content: string
  layer: KnowledgeLayer
  scope?: KnowledgeScope
}

function isGitRepo(projectRoot: string): boolean {
  try {
    const output = execSync("git rev-parse --is-inside-work-tree", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 3000,
    })
    return output.trim() === "true"
  } catch {
    return existsSync(join(projectRoot, ".git"))
  }
}

function isCoreArchitecture(content: string): boolean {
  const keywords = [
    "architecture", "设计决策", "design decision", "interface contract",
    "接口约定", "接口", "interface", "protocol", "权限模型", "permission model",
    "token", "auth", "authentication", "认证", "authorization", "api contract",
  ]
  return keywords.some((kw) => content.toLowerCase().includes(kw.toLowerCase()))
}

export function determineScope(
  note: DiscoveryNote,
  config: ResolvedPluginConfig,
): KnowledgeScope {
  if (note.scope === "cross") return "cross"
  if (note.layer === "project") {
    if (isCoreArchitecture(note.content) && isGitRepo(config.projectRoot)) {
      return "cross"
    }
  }
  return "branch"
}

export function resolvePath(
  note: DiscoveryNote,
  config: ResolvedPluginConfig,
): string {
  const storage = config.resolvedStorages[note.layer]
  if (!storage || storage.type !== "local") return ""

  const scope = determineScope(note, config)

  if (note.layer === "project") {
    if (scope === "cross") return join(storage.basePath, "_shared", `${note.domain}.md`)
    return join(storage.basePath, `${note.domain}.md`)
  }

  return join(storage.basePath, storage.template)
}

export function isToolOutputSource(_source: string): boolean {
  return true
}

export function isUserAssumptionSource(_source: string): boolean {
  return false
}
