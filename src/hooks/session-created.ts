import type { ResolvedPluginConfig } from "../config.js"
import type { Logger } from "../utils/logger.js"
import { formatPlatformContext, getPlatformContext } from "../layers/platform-layer.js"
import { loadMachineProfile, saveMachineProfile, createMachineProfile } from "../layers/machine-layer.js"
import type { MachineDomain } from "../layers/machine-layer.js"
import { getProjectRuntime, getRecordedRequirements, diffRuntimeVersions } from "../layers/project-layer.js"
import { loadUserPreferences } from "../layers/user-layer.js"
import { detectToolchain } from "../detection/toolchain.js"
import { readFileSync } from "node:fs"
import { execSync } from "node:child_process"
import { join } from "node:path"
import { parseAllMigrationMaps, formatMigrationHints } from "../audit/migration-map.js"

function getCurrentBranch(projectRoot: string): string {
  try {
    return execSync("git branch --show-current", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 3000,
    }).trim()
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

function domainNames(domains: Record<string, MachineDomain>): string {
  return Object.keys(domains).join(", ") || "none"
}

function buildKnowledgeRecordingProtocol(_config: ResolvedPluginConfig): string {
  return [
    "You MUST actively identify and record project knowledge. Call note_discovery in these scenarios:",
    "",
    "| Scenario | call note_discovery with |",
    "|----------|------------------------|",
    "| User describes architecture decisions, interface contracts, permission models | `{ domain: \"<topic>\", layer: \"project\", scope: \"cross\" }` |",
    "| User describes feature implementation, module progress | `{ domain: \"<module-name>\", layer: \"project\", scope: \"branch\" }` |",
    "| You analyzed code and found key patterns or conventions | `{ domain: \"<topic>\", layer: \"project\", scope: \"branch\" }` |",
    "| You detect toolchain version changes | `{ domain: \"<runtime>\", layer: \"machine\" }` |",
    "| You read existing design docs, architecture docs, or SPEC files | `{ domain: \"<topic>\", layer: \"project\", scope: \"cross\" }` for each key design decision |",
    "",
    "DO NOT record: simple bug fixes, temporary discussions, user assumptions (only tool outputs go to machine/platform layers)",
    "When uncertain → write to SKILL.md and ask the user",
  ].join("\n")
}

export async function injectSessionContext(
  logger: Logger,
  client: any,
  config: ResolvedPluginConfig,
  sessionId: string,
): Promise<void> {
  const platform = getPlatformContext(config)
  logger.debug("Platform detected", { os: platform.os, shell: platform.shell, arch: platform.arch })

  const toolchain = await detectToolchain()
  const domains: Record<string, MachineDomain> = {}
  for (const [name, t] of Object.entries(toolchain)) {
    if (t) {
      domains[`${name}_dev`] = { paths: t.paths, versions: t.versions }
    }
  }
  logger.debug("Toolchain detected", { domains: Object.keys(domains) })

  let machine = loadMachineProfile(config)
  if (!machine) {
    machine = createMachineProfile(config, domains)
    saveMachineProfile(config, machine)
    logger.info("Machine profile created", {
      id: machine.machine_id,
      method: machine.id_method,
      hostname: machine.hostname,
    })
  } else if (Object.keys(domains).length > 0) {
    machine.domains = { ...domains, ...machine.domains }
    saveMachineProfile(config, machine)
    logger.debug("Machine profile updated", { id: machine.machine_id, domains: Object.keys(domains) })
  }

  const runtime = getProjectRuntime(config)
  const recorded = getRecordedRequirements(config)
  const versionWarnings = diffRuntimeVersions(runtime, recorded)
  const branch = getCurrentBranch(config.projectRoot)
  const userPrefs = loadUserPreferences(config)
  const projectName = getProjectName(config)

  const skillsDir = config.resolvedStorages.project?.basePath
  const migrationEntries = skillsDir ? parseAllMigrationMaps(skillsDir) : []

  const contextParts: string[] = []

  contextParts.push("## Session Context")
  contextParts.push("")
  contextParts.push(formatPlatformContext(platform))
  contextParts.push(`Your machine: ${machine.machine_id} (${machine.hostname})`)
  contextParts.push(`Available toolchains: ${domainNames(machine.domains)}`)
  contextParts.push(
    "Call get_machine_context(domain) for detailed toolchain info",
  )
  contextParts.push(
    "To switch tool versions, add a `switching` command in .opencode/skills/_shared/runtime-requirements.yaml",
  )
  contextParts.push("")

  contextParts.push("## User Preferences")
  contextParts.push("")
  const prefs = userPrefs.output_preferences
  contextParts.push(`Comment style: ${prefs.comment_style}`)
  contextParts.push(`Language: ${prefs.language}`)
  contextParts.push("(Replies automatically adapt to the user's language)")
  contextParts.push(`Verbosity: ${prefs.verbosity}`)
  contextParts.push(`Security boundary: ${userPrefs.security_boundaries.sudo}`)
  contextParts.push("")

  if (runtime.languages.length > 0) {
    contextParts.push("## Project Info")
    contextParts.push("")
    contextParts.push(`Current project: ${projectName}`)
    contextParts.push(`Languages: ${runtime.languages.join(", ")}`)
    if (Object.keys(runtime.versions).length > 0) {
      contextParts.push(
        `Runtime versions: ${Object.entries(runtime.versions)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}`,
      )
    }
    if (runtime.build) contextParts.push(`Build command: ${runtime.build}`)
    if (runtime.test) contextParts.push(`Test command: ${runtime.test}`)
    if (branch !== "unknown") {
      contextParts.push(`Current branch: ${branch}`)
    }
    contextParts.push("")
  }

  contextParts.push("## Knowledge Recording Protocol")
  contextParts.push("")
  contextParts.push(buildKnowledgeRecordingProtocol(config))
  contextParts.push("")

  if (migrationEntries.length > 0) {
    contextParts.push(formatMigrationHints(migrationEntries))
  }

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
      migrationEntries: migrationEntries.length,
    })
  } catch {
    logger.warn("Context injection failed", { sessionId })
  }
}
