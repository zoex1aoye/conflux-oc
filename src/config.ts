import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { execSync } from "node:child_process"
import { parse } from "jsonc-parser"

export interface LayerConfig {
  name: string
  priority: number
  storage: string | { type: string; path: string }
  inject: "always" | "summary-only" | "on-demand"
}

export interface BehaviorRule {
  id: string
  trigger: string
  rule: string
  condition?: string
  enabled: boolean
}

export interface PluginConfig {
  layers: LayerConfig[]
  behavior_rules: BehaviorRule[]
  blockedFilePatterns?: string[]
}

export interface ResolvedStorage {
  type: "none" | "local"
  basePath: string
  template: string
}

export interface ResolvedPluginConfig {
  layers: LayerConfig[]
  behavior_rules: BehaviorRule[]
  pluginDataDir: string
  projectRoot: string
  resolvedStorages: Record<string, ResolvedStorage>
  largeFileThreshold?: number
  blockedFilePatterns: string[]
}

const BUILTIN_DEFAULTS: PluginConfig = {
  layers: [
    { name: "platform", priority: 0, storage: "transform-only", inject: "always" },
    { name: "machine", priority: 1, storage: { type: "local", path: "machines/{id}.json" }, inject: "summary-only" },
    { name: "user", priority: 2, storage: { type: "local", path: "users/{name}.json" }, inject: "always" },
    { name: "project", priority: 3, storage: { type: "local", path: ".opencode/skills/" }, inject: "summary-only" },
  ],
  blockedFilePatterns: [".env*", ".ssh/", ".gnupg/"],
  behavior_rules: [
    {
      id: "precheck-runtime",
      trigger: "before:build_run_test",
      rule: "Before build/run/test: read Project Runtime Requirements first, then check Machine toolchain paths, auto-prepend version switching commands",
      enabled: true,
    },
    {
      id: "knowledge-routing-cross-branch",
      trigger: "on:note_discovery",
      rule: "Core architecture/interface contracts/design decisions → _shared/; current branch progress/implementation details → SKILL.md",
      condition: "is_git_project",
      enabled: true,
    },
    {
      id: "knowledge-source-routing",
      trigger: "on:note_discovery",
      rule: "Only tool output results go to Machine/Platform layers; user assumptions never enter any layer",
      enabled: true,
    },
    {
      id: "large-file-guard",
      trigger: "before:file_read",
      rule: "Files > 1MB or binary: block direct read(), return file metadata, let model decide approach",
      enabled: true,
    },
  ],
}

const CONFIG_FILE_NAME = "conflux-oc.jsonc"

function configSearchPaths(projectRoot: string): string[] {
  const paths: string[] = []

  paths.push(join(projectRoot, ".opencode", CONFIG_FILE_NAME))

  const customDir = process.env.OPENCODE_CONFIG_DIR
  if (customDir) {
    paths.push(join(customDir, CONFIG_FILE_NAME))
  }

  paths.push(join(homedir(), ".config", "opencode", CONFIG_FILE_NAME))

  return paths
}

export function resolvePluginDataDir(): string {
  const configDir = process.env.OPENCODE_CONFIG_DIR
  if (configDir) {
    return join(configDir, "plugins", "conflux-oc")
  }
  return join(homedir(), ".config", "opencode", "plugins", "conflux-oc")
}

export function loadPluginConfig(projectRoot?: string): PluginConfig {
  const base = projectRoot || process.cwd()

  for (const p of configSearchPaths(base)) {
    try {
      const raw = readFileSync(p, "utf-8")
      const parsed = parse(raw) as PluginConfig
      if (parsed?.layers && parsed?.behavior_rules) {
        return parsed
      }
    } catch {
      continue
    }
  }

  return { ...BUILTIN_DEFAULTS, layers: BUILTIN_DEFAULTS.layers.map((l) => ({ ...l })) }
}

function resolveLayerStorage(
  layer: LayerConfig,
  pluginDataDir: string,
  projectRoot: string,
): ResolvedStorage {
  if (typeof layer.storage === "string") {
    return { type: "none", basePath: "", template: "" }
  }

  if (layer.storage.type === "local") {
    const isProjectScope = layer.storage.path.startsWith(".opencode")
    const basePath = isProjectScope ? projectRoot : pluginDataDir
    return {
      type: "local",
      basePath,
      template: layer.storage.path,
    }
  }

  return { type: "none", basePath: "", template: "" }
}

export function resolvePluginConfig(
  projectRoot?: string,
): ResolvedPluginConfig {
  const base = projectRoot || process.cwd()
  const config = loadPluginConfig(base)
  const pluginDataDir = resolvePluginDataDir()
  const resolvedStorages: Record<string, ResolvedStorage> = {}

  for (const layer of config.layers) {
    resolvedStorages[layer.name] = resolveLayerStorage(layer, pluginDataDir, base)
  }

  return {
    layers: config.layers,
    behavior_rules: config.behavior_rules,
    pluginDataDir,
    projectRoot: base,
    resolvedStorages,
    largeFileThreshold: (config as any).largeFileThreshold ?? undefined,
    blockedFilePatterns: (config as any).blockedFilePatterns ?? BUILTIN_DEFAULTS.blockedFilePatterns ?? [".env*", ".ssh/", ".gnupg/"],
  }
}

export function getEnabledRules(config: PluginConfig): BehaviorRule[] {
  return config.behavior_rules.filter((r) => r.enabled)
}

export interface RuleContext {
  trigger: string
  projectRoot?: string
  domain?: string
  layer?: string
}

function checkCondition(condition: string | undefined, ctx: RuleContext): boolean {
  if (!condition) return true
  if (condition === "is_git_project") {
    try {
      execSync("git rev-parse --is-inside-work-tree", { cwd: ctx.projectRoot, encoding: "utf-8", timeout: 2000 })
      return true
    } catch {
      return false
    }
  }
  return true
}

export function evaluateBehaviorRules(config: PluginConfig, ctx: RuleContext): BehaviorRule[] {
  return config.behavior_rules.filter((r) => {
    if (!r.enabled) return false
    if (r.trigger !== ctx.trigger && !r.trigger.startsWith(`${ctx.trigger}:`)) return false
    return checkCondition(r.condition, ctx)
  })
}
