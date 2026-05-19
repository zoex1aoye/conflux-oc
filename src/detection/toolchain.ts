import { exec } from "node:child_process"
import { promisify } from "node:util"
import { platform } from "node:os"

const execAsync = promisify(exec)

export interface ToolchainEntry {
  path: string
  version: string
}

export interface ToolchainDomain {
  paths: Record<string, string>
  versions: Record<string, string>
  extras?: Record<string, string>
}

export interface ToolchainResult {
  java: ToolchainDomain | null
  go: ToolchainDomain | null
  node: ToolchainDomain | null
  python: ToolchainDomain | null
}

const TOOL_DETECTORS: Record<string, {
  binary: string
  versionFlag: string
  versionRegex: RegExp
  extraPath?: string[]
}> = {
  java: {
    binary: "java",
    versionFlag: "-version 2>&1",
    versionRegex: /version\s+"?([\d._]+)"?/,
    extraPath: ["javac", "mvn"],
  },
  go: {
    binary: "go",
    versionFlag: "version",
    versionRegex: /go(\d+\.\d+\.\d+)/,
    extraPath: ["gofmt"],
  },
  node: {
    binary: "node",
    versionFlag: "--version",
    versionRegex: /v(\d+\.\d+\.\d+)/,
    extraPath: ["npm", "npx"],
  },
  python: {
    binary: "python3",
    versionFlag: "--version 2>&1",
    versionRegex: /Python (\d+\.\d+\.\d+)/,
    extraPath: ["pip3"],
  },
}

async function detectCommand(cmd: string): Promise<string | null> {
  try {
    const isWin = platform() === "win32"
    const shellCmd = isWin ? `where ${cmd} 2>nul` : `command -v ${cmd}`
    const { stdout } = await execAsync(shellCmd, { timeout: 5000 })
    return stdout.trim().split("\n")[0] || null
  } catch {
    return null
  }
}

async function detectVersion(cmd: string, flag: string): Promise<string | null> {
  try {
    const { stdout, stderr } = await execAsync(`${cmd} ${flag}`, { timeout: 10000 })
    const output = stdout + stderr
    return output.trim() || null
  } catch {
    return null
  }
}

export async function detectToolchain(): Promise<ToolchainResult> {
  const result: ToolchainResult = {
    java: null,
    go: null,
    node: null,
    python: null,
  }

  for (const [domain, detector] of Object.entries(TOOL_DETECTORS)) {
    const binaryPath = await detectCommand(detector.binary)
    if (!binaryPath) continue

    const versionOutput = await detectVersion(detector.binary, detector.versionFlag)
    const versionMatch = versionOutput?.match(detector.versionRegex)
    const version = versionMatch?.[1] || "unknown"

    const paths: Record<string, string> = {}
    const versions: Record<string, string> = {}

    paths[detector.binary] = binaryPath
    versions[detector.binary] = version

    if (detector.extraPath) {
      for (const extra of detector.extraPath) {
        const p = await detectCommand(extra)
        if (p) paths[extra] = p
        const v = await detectVersion(extra, "--version 2>&1")
        if (v) versions[extra] = v.trim()
      }
    }

    result[domain as keyof ToolchainResult] = { paths, versions }
  }

  return result
}
