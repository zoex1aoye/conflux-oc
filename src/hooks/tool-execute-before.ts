import type { ResolvedPluginConfig } from "../config.js"
import type { LayerRegistry } from "../layers/registry.js"
import type { Logger } from "../utils/logger.js"
import { getRecordedRequirements } from "../layers/project-layer.js"
import { loadMachineProfile } from "../layers/machine-layer.js"
import { detectToolchain, type ToolchainResult } from "../detection/toolchain.js"
import { shouldBlockRead } from "../security/sanitizer.js"
import { checkFile } from "./large-file-guard.js"
import { execSync, exec } from "node:child_process"
import { promisify } from "node:util"
import { platform } from "node:os"
const asyncExec = promisify(exec)

const BUILD_RUN_PATTERNS: Record<string, string[]> = {
  java: ["mvn ", "gradle ", "gradlew ", "java ", "javac "],
  go: ["go build", "go test", "go run", "go install", "go generate"],
  node: ["npm ", "npx ", "node ", "yarn ", "pnpm "],
  python: ["python ", "python3 ", "pip ", "pip3 ", "pytest"],
  rust: ["cargo "],
  generic: ["make ", "cmake "],
}

function isBuildOrRunCommand(command: string): boolean {
  for (const patterns of Object.values(BUILD_RUN_PATTERNS)) {
    for (const pattern of patterns) {
      if (command.startsWith(pattern)) return true
    }
  }
  return false
}

function detectLanguage(command: string): string | null {
  for (const [lang, patterns] of Object.entries(BUILD_RUN_PATTERNS)) {
    for (const pattern of patterns) {
      if (command.startsWith(pattern)) return lang
    }
  }
  return null
}

function buildJavaSwitching(toolchain: ToolchainResult, requiredVersion?: string): string {
  const java = toolchain.java
  if (!java?.paths?.java) return ""

  const javaPath = java.paths.java
  const javaHome = javaPath.replace(/\/bin\/java$/, "")

  if (requiredVersion && java.versions?.java) {
    if (!java.versions.java.includes(requiredVersion.replace(/^(\d+).*/, "$1"))) {
      const lower = requiredVersion.replace(/^(\d+).*/, "$1")
      const altPath = javaPath.replace(/java-?\d+/, `java-${lower}`)
      return `export JAVA_HOME="${altPath.replace(/\/bin\/java$/, "")}" && export PATH="$JAVA_HOME/bin:$PATH" && `
    }
  }

  return `export JAVA_HOME="${javaHome}" && export PATH="$JAVA_HOME/bin:$PATH" && `
}

function buildGoSwitching(toolchain: ToolchainResult): string {
  const go = toolchain.go
  if (!go?.paths?.go) return ""
  return `export PATH="${go.paths.go.replace(/\/go$/, "")}:$PATH" && `
}

function buildNodeSwitching(toolchain: ToolchainResult, requiredVersion?: string): string {
  const node = toolchain.node
  if (!node?.paths?.node) return ""

  const nvmDir = process.env.NVM_DIR
  if (nvmDir && requiredVersion) {
    const ver = requiredVersion.replace(/^[+>=<~^]/, "")
    return `. "${nvmDir}/nvm.sh" && nvm use ${ver} && `
  }

  const fnmDetect = process.env.FNM_DIR
  if (fnmDetect && requiredVersion) {
    const ver = requiredVersion.replace(/^[+>=<~^]/, "")
    return `fnm use ${ver} && `
  }

  const nodePath = node.paths.node
  const nodeHome = nodePath.replace(/[/\\]bin[/\\]node$/, "")
  return `export PATH="${nodeHome}/bin:$PATH" && `
}

function getRuntimeSwitchingCmd(
  recordedRequirements: Record<string, any> | null,
  lang: string,
): string | null {
  if (!recordedRequirements) return null
  return recordedRequirements[lang]?.switching || null
}

export function createToolExecuteBeforeHandler(
  logger: Logger,
  _client: any,
  config: ResolvedPluginConfig,
  _registry: LayerRegistry,
) {
  return async (input: any, output: any) => {
    if (input.tool === "read" && output.args?.filePath) {
      if (shouldBlockRead(output.args.filePath, config.blockedFilePatterns)) {
        logger.warn("Sensitive file read blocked", { filePath: output.args.filePath, patterns: config.blockedFilePatterns })
        throw new Error(`Cannot read blocked files: ${config.blockedFilePatterns.join(", ")}`)
      }
      const guardRule = config.behavior_rules.find((r) => r.id === "large-file-guard")
      if (guardRule?.enabled) {
        const maxBytes = config.largeFileThreshold
        await checkFile(output.args.filePath, maxBytes).catch((err) => {
          logger.info("Large file read blocked", {
            filePath: output.args.filePath,
            reason: err.message,
          })
          throw err
        })
      }
    }

    if (input.tool !== "bash" || !output.args?.command) return

    const command: string = output.args.command
    if (!isBuildOrRunCommand(command)) return

    const lang = detectLanguage(command)
    if (!lang || lang === "generic") return

    const recorded = getRecordedRequirements(config)

    let switchingCmd = getRuntimeSwitchingCmd(recorded, lang)
    if (switchingCmd) {
      output.args.command = `${switchingCmd} && ${output.args.command}`
      logger.debug("Version switching applied (from runtime-requirements.yaml)", { lang, command: switchingCmd })
      return
    }

    const machine = loadMachineProfile(config)
    if (machine?.domains) {
      const machineDomain = machine.domains[`${lang}_dev`]
      if (machineDomain?.versions) {
        const required = recorded?.[lang]?.version
        for (const [binary, version] of Object.entries(machineDomain.versions)) {
          if (required && !version.includes(required.replace(/[+>=<~^]/, ""))) {
            continue
          }
          const binaryPath = machineDomain.paths?.[binary]
          if (binaryPath && lang === "java") {
            const javaHome = binaryPath.replace(/\/bin\/java$/, "")
            output.args.command = `export JAVA_HOME="${javaHome}" && export PATH="$JAVA_HOME/bin:$PATH" && ${output.args.command}`
            logger.debug("Version switching applied (from machine profile)", { lang, javaHome })
            return
          }
        }
      }
    }

    const toolchain = await detectToolchain()
    switch (lang) {
      case "java":
        switchingCmd = buildJavaSwitching(toolchain, recorded?.["java"]?.version)
        break
      case "go":
        switchingCmd = buildGoSwitching(toolchain)
        break
      case "node":
        switchingCmd = buildNodeSwitching(toolchain, recorded?.["node"]?.version)
        break
    }

    if (switchingCmd) {
      output.args.command = `${switchingCmd}${output.args.command}`
      logger.debug("Version switching applied (live detection fallback)", { lang })
    }
  }
}
