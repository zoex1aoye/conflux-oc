import type { ResolvedPluginConfig } from "../config.js"
import type { Logger } from "../utils/logger.js"
import { formatPlatformContext, getPlatformContext } from "../layers/platform-layer.js"
import { loadMachineProfile, saveMachineProfile, createMachineProfile } from "../layers/machine-layer.js"
import type { MachineDomain } from "../layers/machine-layer.js"
import { getProjectRuntime, getRecordedRequirements, diffRuntimeVersions } from "../layers/project-layer.js"
import { loadUserPreferences } from "../layers/user-layer.js"
import { detectToolchain } from "../detection/toolchain.js"
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import { join } from "node:path"

const asyncExec = promisify(exec)

async function getCurrentBranch(projectRoot: string): Promise<string> {
  try {
    const { stdout } = await asyncExec("git branch --show-current", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 3000,
    })
    return stdout.trim()
  } catch {
    return "unknown"
  }
}

function getProjectName(config: ResolvedPluginConfig): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(config.projectRoot, "package.json"), "utf-8"),
    )
    return pkg.name || config.projectRoot.split("/").pop() || "unknown"
  } catch {
    return config.projectRoot.split("/").pop() || "unknown"
  }
}

interface SkillFile {
  path: string
  lines: number
  description: string
}

const SKILL_EXTENSIONS = [".md", ".yaml", ".yml", ".jsonc"]
const MAX_SKILL_FILES = 20

function extractDescription(filePath: string): string {
  try {
    const content = readFileSync(filePath, "utf-8")
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (fmMatch) {
      const desc = fmMatch[1].match(/description:\s*(.+)/)
      if (desc) return desc[1].trim()
    }
    const heading = content.match(/^##\s+(.+)/m)
    if (heading) return heading[1].trim()
    const firstLine = content.split("\n").find((l) => l.trim().length > 0)
    if (firstLine) return firstLine.trim().slice(0, 80)
  } catch { /* silent */ }
  return "(no description)"
}

function countLines(filePath: string): number {
  try {
    const content = readFileSync(filePath, "utf-8")
    const n = content.split("\n").length
    return n
  } catch { return 0 }
}

function getSkillInventory(config: ResolvedPluginConfig): string[] {
  const lines: string[] = []
  const skillsDir = config.resolvedStorages.project?.basePath

  lines.push("## Available Knowledge")
  lines.push("")

  if (!skillsDir || !existsSync(skillsDir)) {
    lines.push("(No skills or experience documents yet in this project.)")
    lines.push("")
    lines.push("This is normal for a new project — knowledge accumulates one session at a time.")
    lines.push("After completing the first meaningful task, use `note_discovery()` to record what you learned.")
    lines.push("")
    return lines
  }

  const files: SkillFile[] = []
  let totalCount = 0

  function walk(dir: string, prefix: string) {
    if (files.length >= MAX_SKILL_FILES) return
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch { return }
    for (const entry of entries) {
      if (files.length >= MAX_SKILL_FILES) break
      const fullPath = join(dir, entry)
      try {
        const s = statSync(fullPath)
        if (s.isDirectory()) {
          walk(fullPath, `${prefix}${entry}/`)
        } else if (SKILL_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
          totalCount++
          const description = extractDescription(fullPath)
          const fileLines = countLines(fullPath)
          files.push({ path: `${prefix}${entry}`, lines: fileLines, description })
        }
      } catch { continue }
    }
  }

  walk(skillsDir, "")

  if (files.length === 0) {
    lines.push("Project skill directory exists but is empty.")
    lines.push("After completing the first meaningful task, use `note_discovery()` to record what you learned.")
    lines.push("")
    return lines
  }

  files.sort((a, b) => a.path.localeCompare(b.path))

  const label = totalCount > MAX_SKILL_FILES
    ? `Showing ${files.length} of ${totalCount} skill files:`
    : "Skills and experience documents in this project:"
  lines.push(label)
  lines.push("")

  for (const f of files) {
    const sizeLabel = f.lines > 0 ? `${f.lines} lines` : "empty"
    lines.push(`- \`${f.path}\` (${sizeLabel}) — ${f.description}`)
  }
  if (totalCount > MAX_SKILL_FILES) {
    lines.push(`- *and ${totalCount - MAX_SKILL_FILES} more files not shown*`)
  }
  lines.push("")
  lines.push("Read relevant skills when starting or switching tasks.")
  lines.push("Use `note_discovery()` at sub-task boundaries to record new knowledge.")
  lines.push("")

  return lines
}

function domainNames(domains: Record<string, MachineDomain>): string {
  return Object.keys(domains).join(", ") || "none"
}

export async function injectSessionContext(
  logger: Logger,
  client: any,
  config: ResolvedPluginConfig,
  sessionId: string,
): Promise<void> {
  const platform = getPlatformContext(config)
  logger.debug("Platform detected", { os: platform.os, shell: platform.shell, arch: platform.arch })

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
    logger.info("Machine profile created", {
      id: machine.machine_id,
      method: machine.id_method,
      hostname: machine.hostname,
    })
  } else if (Object.keys(machine.domains).length === 0) {
    const toolchain = await detectToolchain()
    const domains: Record<string, MachineDomain> = {}
    for (const [name, t] of Object.entries(toolchain)) {
      if (t) {
        domains[`${name}_dev`] = { paths: t.paths, versions: t.versions }
      }
    }
    machine.domains = domains
    saveMachineProfile(config, machine)
    logger.debug("Machine profile populated", { id: machine.machine_id, domains: Object.keys(domains) })
  } else {
    logger.debug("Machine profile reused", { id: machine.machine_id, domains: Object.keys(machine.domains) })
  }

  const runtime = getProjectRuntime(config)
  const recorded = getRecordedRequirements(config)
  const versionWarnings = diffRuntimeVersions(runtime, recorded)
  const [branch, userPrefs] = await Promise.all([
    getCurrentBranch(config.projectRoot),
    Promise.resolve(loadUserPreferences(config)),
  ])
  const projectName = getProjectName(config)

  function injectLevel(layerName: string): "always" | "summary-only" | "on-demand" {
    const layer = config.layers.find((l) => l.name === layerName)
    return layer?.inject || "always"
  }

  const contextParts: string[] = []

  contextParts.push("## Session Context")
  contextParts.push("")
  contextParts.push(formatPlatformContext(platform))

  const machineLevel = injectLevel("machine")
  if (machineLevel === "always") {
    contextParts.push(`Your machine: ${machine.machine_id} (${machine.hostname})`)
    contextParts.push(`Available toolchains: ${domainNames(machine.domains)}`)
    contextParts.push("Call get_machine_context(domain) for detailed toolchain info")
    contextParts.push("To switch tool versions, add a `switching` command in .opencode/skills/_shared/runtime-requirements.yaml")
  } else if (machineLevel === "summary-only") {
    contextParts.push(`Machine: ${machine.machine_id} | Toolchains: ${domainNames(machine.domains)}`)
  }
  contextParts.push("")

  const userLevel = injectLevel("user")
  if (userLevel === "always") {
    contextParts.push("## User Preferences")
    contextParts.push("")
    const prefs = userPrefs.output_preferences
    contextParts.push(`Comment style: ${prefs.comment_style}`)
    contextParts.push(`Language: ${prefs.language}`)
    contextParts.push("(Replies automatically adapt to the user's language)")
    contextParts.push(`Verbosity: ${prefs.verbosity}`)
    contextParts.push(`Security boundary: ${userPrefs.security_boundaries.sudo}`)
    contextParts.push("")
  } else if (userLevel === "summary-only") {
    contextParts.push(`User: ${userPrefs.user} | Lang: ${userPrefs.output_preferences.language}`)
    contextParts.push("")
  }

  const projectLevel = injectLevel("project")
  if (projectLevel === "always" || projectLevel === "summary-only") {
    if (runtime.languages.length > 0) {
      contextParts.push("## Project Info")
      contextParts.push("")
      contextParts.push(`Current project: ${projectName}`)
      contextParts.push(`Languages: ${runtime.languages.join(", ")}`)
      if (projectLevel === "always") {
        if (Object.keys(runtime.versions).length > 0) {
          contextParts.push(
            `Runtime versions: ${Object.entries(runtime.versions)
              .map(([k, v]) => `${k}=${v}`)
              .join(", ")}`,
          )
        }
        if (runtime.build) contextParts.push(`Build command: ${runtime.build}`)
        if (runtime.test) contextParts.push(`Test command: ${runtime.test}`)
      }
      if (branch !== "unknown") {
        contextParts.push(`Current branch: ${branch}`)
      }
      contextParts.push("")
    }
  } else {
    contextParts.push("## Project Info")
    contextParts.push("")
    contextParts.push(`Current project: ${projectName}`)
    if (branch !== "unknown") {
      contextParts.push(`Current branch: ${branch}`)
    }
    contextParts.push("(Use get_machine_context or note_discovery tools for detailed project knowledge)")
    contextParts.push("")
  }

  const skillInventory = getSkillInventory(config)
  contextParts.push(...skillInventory)

  if (versionWarnings.length > 0) {
    contextParts.push("## Version Mismatch Detected")
    contextParts.push("")
    for (const w of versionWarnings) {
      contextParts.push(`- ${w}`)
    }
    contextParts.push("If the upgrade is intentional, update runtime-requirements.yaml")
    contextParts.push("")
  }

  const compiledContext = contextParts.join("\n")

  try {
    await client.session.prompt({
      path: { id: sessionId },
      body: {
        noReply: true,
        parts: [{ type: "text", text: compiledContext }],
      },
    })
    logger.info("Context injected", {
      sessionId,
      chars: compiledContext.length,
      versionWarnings: versionWarnings.length,
    })
  } catch {
    logger.warn("Context injection failed", { sessionId })
  }
}
