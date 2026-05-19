import { tool } from "@opencode-ai/plugin"
import type { ResolvedPluginConfig } from "../config.js"
import { writeParsed, readParsed } from "../utils/parsers.js"
import { determineScope, resolvePath } from "../utils/knowledge-router.js"
import { saveMachineProfile, loadMachineProfile } from "../layers/machine-layer.js"
import type { DiscoveryNote } from "../utils/knowledge-router.js"
import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { containsSensitiveContent } from "../security/sanitizer.js"

export function createNoteDiscoveryTool(config: ResolvedPluginConfig) {
  return tool({
    description:
      "Record discovered knowledge. Core architecture/design decisions → _shared/ (cross-branch). Branch progress → SKILL.md. Only tool outputs go to Machine/Platform layers; user assumptions never enter any layer.",
    args: {
      domain: tool.schema.string().describe("Domain the knowledge belongs to"),
      content: tool.schema.string().describe("Knowledge content to record"),
      layer: tool.schema
        .enum(["project", "machine", "user"])
        .describe("Target layer"),
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

      const sensitive = containsSensitiveContent(note.content)
      if (sensitive.length > 0) {
        return "Content contains sensitive data (private keys, tokens, secrets) and will not be recorded"
      }

      const scope = determineScope(note, config)

      if (note.layer === "project") {
        const storage = config.resolvedStorages.project
        if (storage.type !== "local") {
          return `Project layer storage not configured; cannot record "${note.domain}"`
        }

        let targetPath: string
        if (scope === "cross") {
          targetPath = join(storage.basePath, "_shared", `${note.domain}.md`)
        } else {
          targetPath = join(storage.basePath, `${note.domain}.md`)
        }

        mkdirSync(dirname(targetPath), { recursive: true })

        const existing = existsSync(targetPath)
          ? readParsed(storage.basePath, targetPath)?.raw || ""
          : ""

        const marker =
          scope === "cross" ? "## Cross-branch Knowledge\n\n" : "## Branch Knowledge\n\n"
        const entry = existing
          ? `${existing}\n\n---\n\n${marker}${note.content}`
          : `# ${note.domain}\n\n${marker}${note.content}`

        writeFileSync(targetPath, entry, "utf-8")
        return scope === "cross"
          ? `Knowledge "${note.domain}" written to _shared/${note.domain}.md (cross-branch)`
          : `Knowledge "${note.domain}" written to SKILL.md (${note.domain}.md) (branch)`
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
        machine.domains[domainKey].versions ||= {}
        machine.domains[domainKey].versions![note.domain] = note.content

        saveMachineProfile(config, machine)
        return `Machine layer ${domainKey} updated`
      }

      return `Knowledge "${note.domain}" recorded to ${note.layer} layer (${scope})`
    },
  })
}
