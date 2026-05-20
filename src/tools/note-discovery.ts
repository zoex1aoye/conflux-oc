import { tool } from "@opencode-ai/plugin"
import type { ResolvedPluginConfig } from "../config.js"
import type { Logger } from "../utils/logger.js"
import { writeParsed, readParsed } from "../utils/parsers.js"
import { determineScope } from "../utils/knowledge-router.js"
import { saveMachineProfile, loadMachineProfile } from "../layers/machine-layer.js"
import { saveUserPreferences, loadUserPreferences } from "../layers/user-layer.js"
import type { DiscoveryNote } from "../utils/knowledge-router.js"
import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { containsSensitiveContent } from "../security/sanitizer.js"

type WriteMode = "upsert" | "append" | "deprecate"

function upsertFileContent(
  existing: string,
  sectionHeader: string,
  newContent: string,
  mode: WriteMode,
): { result: string; action: string } {
  const date = new Date().toISOString().slice(0, 10)
  const headerLine = `## ${sectionHeader}`

  const lines = existing.split("\n")
  let sectionIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === headerLine) {
      sectionIdx = i
      break
    }
  }

  if (mode === "upsert") {
    if (sectionIdx !== -1) {
      let endIdx = lines.length
      for (let i = sectionIdx + 1; i < lines.length; i++) {
        if (lines[i].startsWith("## ") || lines[i].startsWith("# ")) {
          endIdx = i
          break
        }
      }
      const sectionLines = [headerLine, "", newContent]
      const result = [
        ...lines.slice(0, sectionIdx),
        ...sectionLines,
        ...lines.slice(endIdx),
      ].join("\n")
      return { result, action: "updated" }
    }
    return {
      result: `${existing}\n\n${headerLine}\n\n${newContent}\n`,
      action: "appended",
    }
  }

  if (mode === "deprecate") {
    const deprecationLine = `> [Deprecated: ${date}] — ${newContent}`
    if (sectionIdx !== -1) {
      let endIdx = lines.length
      for (let i = sectionIdx + 1; i < lines.length; i++) {
        if (lines[i].startsWith("## ") || lines[i].startsWith("# ")) {
          endIdx = i
          break
        }
      }
      const result = [
        ...lines.slice(0, sectionIdx + 1),
        "",
        deprecationLine,
        "",
        ...lines.slice(sectionIdx + 1, endIdx),
        ...lines.slice(endIdx),
      ].join("\n")
      return { result, action: "deprecated" }
    }
    return {
      result: `${existing}\n\n${headerLine}\n\n${deprecationLine}\n`,
      action: "deprecated_new",
    }
  }

  if (sectionIdx !== -1) {
    let endIdx = lines.length
    for (let i = sectionIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith("## ") || lines[i].startsWith("# ")) {
        endIdx = i
        break
      }
    }
    const sectionLines = [headerLine, "", newContent]
    const result = [
      ...lines.slice(0, sectionIdx),
      ...sectionLines,
      ...lines.slice(endIdx),
    ].join("\n")
    return { result, action: "appended" }
  }

  return {
    result: `${existing}\n\n---\n\n${headerLine}\n\n${newContent}\n`,
    action: "appended",
  }
}

export function createNoteDiscoveryTool(logger: Logger, config: ResolvedPluginConfig) {
  return tool({
    description:
      "Record discovered knowledge. Core architecture/design decisions → _shared/ (cross-branch). Branch progress → SKILL.md. Only tool outputs go to Machine/Platform layers; user assumptions never enter any layer.",
    args: {
      domain: tool.schema.string().describe("Domain the knowledge belongs to"),
      content: tool.schema.string().describe("Knowledge content to record"),
      layer: tool.schema
        .enum(["project", "machine", "user", "platform"])
        .describe("Target layer"),
      mode: tool.schema
        .enum(["upsert", "append", "deprecate"])
        .optional()
        .default("upsert")
        .describe("Write mode: upsert (replace), append (always add), deprecate (mark outdated)"),
      scope: tool.schema
        .enum(["branch", "cross"])
        .optional()
        .describe("Scope; auto-determined if not specified"),
    },
    async execute(args, _context) {
      const note: DiscoveryNote = {
        domain: args.domain as string,
        content: args.content as string,
        layer: args.layer as DiscoveryNote["layer"],
        scope: args.scope as DiscoveryNote["scope"],
      }
      const mode: WriteMode = (args.mode as WriteMode) || "upsert"

      const sensitive = containsSensitiveContent(note.content)
      if (sensitive.length > 0) {
        logger.warn("Sensitive content blocked from recording", { domain: note.domain, patterns: sensitive })
        return "Content contains sensitive data (private keys, tokens, secrets) and will not be recorded"
      }

      const scope = determineScope(note, config)

      if (note.layer === "project") {
        const storage = config.resolvedStorages.project
        if (storage.type !== "local") {
          return `Project layer storage not configured; cannot record "${note.domain}"`
        }

        mkdirSync(storage.basePath, { recursive: true })

        if (scope === "cross") {
          const targetPath = join(storage.basePath, "_shared", `${note.domain}.md`)
          mkdirSync(dirname(targetPath), { recursive: true })
          const existing = existsSync(targetPath)
            ? readParsed(storage.basePath, targetPath)?.raw || ""
            : ""

          if (!existing) {
            const entry = `# ${note.domain}\n\n## Cross-branch Knowledge\n\n${note.content}\n`
            writeFileSync(targetPath, entry, "utf-8")
            return `Knowledge "${note.domain}" written to _shared/${note.domain}.md (cross-branch)`
          }

          const { result, action } = upsertFileContent(existing, "Cross-branch Knowledge", note.content, mode)
          writeFileSync(targetPath, result, "utf-8")
          return `Knowledge "${note.domain}" ${action} in _shared/${note.domain}.md (cross-branch)`
        }

        const isModule = note.domain.includes("/")
        const skillDir = isModule
          ? join(storage.basePath, note.domain)
          : storage.basePath
        const targetPath = join(skillDir, "SKILL.md")
        mkdirSync(skillDir, { recursive: true })

        const existing = existsSync(targetPath)
          ? readParsed(storage.basePath, targetPath)?.raw || ""
          : ""

        const sectionName = note.domain.split("/").pop() || note.domain

        if (!existing) {
          const name = note.domain.replace("/", "-")
          const desc = note.content.split("\n")[0].slice(0, 100)
          const section = `## ${sectionName}\n\n${note.content}\n`
          writeFileSync(targetPath, `---\nname: ${name}\ndescription: ${desc}\n---\n\n${section}`, "utf-8")
          const label = isModule ? `${note.domain}/SKILL.md` : "SKILL.md"
          return `Knowledge "${note.domain}" written to ${label} (branch)`
        }

        const { result, action } = upsertFileContent(existing, sectionName, note.content, mode)
        writeFileSync(targetPath, result, "utf-8")

        const label = isModule ? `${note.domain}/SKILL.md` : "SKILL.md"
        return `Knowledge "${note.domain}" ${action} in ${label} (branch)`
      }

      if (note.layer === "machine") {
        const storage = config.resolvedStorages.machine
        if (storage.type !== "local") {
          return "Machine layer storage not configured; cannot record knowledge"
        }

        const machine = loadMachineProfile(config)
        if (!machine) {
          return "Machine profile does not exist; waiting for auto-initialization"
        }

        const domainKey = note.domain.endsWith("_dev")
          ? note.domain
          : `${note.domain}_dev`
        if (!machine.domains[domainKey]) {
          machine.domains[domainKey] = {}
        }
        machine.domains[domainKey].knowledge ||= {}
        machine.domains[domainKey].knowledge![note.domain] = note.content

        saveMachineProfile(config, machine)
        return `Machine layer ${domainKey} updated`
      }

      if (note.layer === "user") {
        const storage = config.resolvedStorages.user
        if (storage.type !== "local") {
          return "User layer storage not configured; cannot record knowledge"
        }
        const existing = loadUserPreferences(config)
        saveUserPreferences(config, {
          ...existing,
          [note.domain]: note.content,
        })
        return `Knowledge "${note.domain}" recorded to user layer`
      }

      if (note.layer === "platform") {
        return `Platform layer is transform-only (no persistence). Knowledge "${note.domain}" was noted but not stored. Use 'project' or 'machine' layer for persistent recording.`
      }

      return `Knowledge "${note.domain}" recorded to ${note.layer} layer (${scope})`
    },
  })
}
