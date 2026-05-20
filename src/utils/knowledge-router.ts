import type { ResolvedPluginConfig } from "../config.js"
import { join } from "node:path"

export type KnowledgeScope = "branch" | "cross"
export type KnowledgeLayer = "project" | "machine" | "platform" | "user"

export interface DiscoveryNote {
  domain: string
  content: string
  layer: KnowledgeLayer
  scope?: KnowledgeScope
}

export function determineScope(
  note: DiscoveryNote,
  _config: ResolvedPluginConfig,
): KnowledgeScope {
  if (note.scope === "cross") return "cross"
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
    if (note.domain.includes("/")) return join(storage.basePath, note.domain, "SKILL.md")
    return join(storage.basePath, "SKILL.md")
  }

  return join(storage.basePath, storage.template)
}

export function isToolOutputSource(source: string): boolean {
  return source === "tool_output" || source === "analysis" || source === "detection"
}

export function isUserAssumptionSource(source: string): boolean {
  return source === "user_assumption" || source === "user_claim"
}

export function buildKnowledgeRecordingProtocol(): string {
  return [
    "## Knowledge Recording Protocol",
    "",
    "Knowledge is what you make of it — it's a reference you pull when needed, not a burden.",
    "",
    "### When to record",
    "Record after each meaningful sub-task boundary using `note_discovery()`:",
    "- A feature or module was completed",
    "- An architecture decision was made (and why)",
    "- A non-trivial solution pattern was discovered",
    "- Project-specific conventions were established",
    "",
    "| Condition | call note_discovery with |",
    "|----------|------------------------|",
    "| Architecture decisions, interfaces, conventions that should survive across branches | `scope:\"cross\"` + `layer:\"project\"` |",
    "| Current branch progress, implementation details | `layer:\"project\"` (defaults to branch scope) |",
    "| Machine/toolchain knowledge discovered via tools | `layer:\"machine\"` |",
    "| User preferences across projects | `layer:\"user\"` |",
    "",
    "### First session / new project",
    "No knowledge exists yet — this is the normal starting state.",
    "After completing the first meaningful task, create initial skill files via `note_discovery()`.",
    "Knowledge accumulates one session at a time.",
    "",
    "### What to record",
    "- Architecture decisions and the reasoning behind them",
    "- Project conventions (naming, structure, patterns)",
    "- Interface contracts between modules",
    "- Solutions to non-trivial problems",
    "- Build/deploy/test commands and their quirks",
    "",
    "### Storage guide",
    "| `layer:\"project\"` + `scope:\"cross\"` | → `.opencode/skills/_shared/{domain}.md` |",
    "| `layer:\"project\"` (branch) | → `.opencode/skills/{module}/SKILL.md` or `.opencode/skills/SKILL.md` |",
    "| `layer:\"machine\"` | → machine profile (toolchain knowledge) |",
    "| `layer:\"user\"` | → user preferences (persistent across projects) |",
    "| `layer:\"platform\"` | → read-only, cannot persist |",
    "",
    "### Behavior",
    "- Do NOT announce recording in responses (no 'I have recorded this')",
  ].join("\n")
}

export function buildContextInjectionDecision(
  config: ResolvedPluginConfig,
  layerName: string,
): "always" | "summary-only" | "on-demand" {
  const layer = config.layers.find((l) => l.name === layerName)
  return layer?.inject || "always"
}
