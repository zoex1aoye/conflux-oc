import { tool } from "@opencode-ai/plugin"
import type { ResolvedPluginConfig } from "../config.js"
import type { Logger } from "../utils/logger.js"
import { loadMachineProfile } from "../layers/machine-layer.js"
import { detectToolchain } from "../detection/toolchain.js"

export function createGetMachineContextTool(logger: Logger, config: ResolvedPluginConfig) {
  return tool({
    description:
      "Get full details of a dev toolchain domain, including executable paths and versions",
    args: {
      domain: tool.schema
        .string()
        .describe("Toolchain domain, e.g. java_dev, go_dev, node_dev, python_dev"),
    },
    async execute(args, _context) {
      const domain = args.domain as string

      const machine = loadMachineProfile(config)
      if (machine?.domains?.[domain]) {
        logger.debug("Machine context served from profile", { domain })
        const d = machine.domains[domain]
        const paths = d.paths
          ? Object.entries(d.paths)
              .map(([k, v]) => `  ${k}: ${v}`)
              .join("\n")
          : ""
        const versions = d.versions
          ? Object.entries(d.versions)
              .map(([k, v]) => `  ${k}: ${v}`)
              .join("\n")
          : ""

        return [
          `Machine domain: ${domain}`,
          paths ? `Executable paths:\n${paths}` : "",
          versions ? `Versions:\n${versions}` : "",
          d.nvm_dir ? `NVM: ${d.nvm_dir}` : "",
          d.gopath ? `GOPATH: ${d.gopath}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      }

      const toolchain = await detectToolchain()
      const result = toolchain[domain?.replace("_dev", "") as keyof typeof toolchain]
      logger.debug("Machine context live detection fallback", { domain, found: !!result })

      if (!result) {
        return `No toolchain found for ${domain}; ensure the relevant dev tools are installed and on PATH`
      }

      const paths = Object.entries(result.paths)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join("\n")
      const versions = Object.entries(result.versions)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join("\n")

      return [
        `Machine domain: ${domain} (live detection)`,
        `Executable paths:\n${paths}`,
        `Versions:\n${versions}`,
      ].join("\n")
    },
  })
}
