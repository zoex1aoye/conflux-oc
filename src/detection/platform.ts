import { platform, release, arch, type } from "node:os"
import { env } from "node:process"

export interface PlatformInfo {
  os: string
  shell: string
  arch: string
}

function detectOS(): string {
  const name = type()
  const releaseStr = release()

  switch (platform()) {
    case "darwin":
      return `macOS (${osxReleaseName(releaseStr)})`
    case "linux":
      return `Linux${releaseStr ? ` (${releaseStr})` : ""}`
    case "win32":
      return `Windows${releaseStr ? ` (${releaseStr})` : ""}`
    default:
      return `${name} ${releaseStr}`
  }
}

function osxReleaseName(release: string): string {
  const major = Number.parseInt(release.split(".")[0])
  const names: Record<number, string> = {
    20: "Big Sur", 21: "Monterey", 22: "Ventura",
    23: "Sonoma", 24: "Sequoia", 25: "Sequoia",
  }
  return names[major] ? `${names[major]} ${release}` : release
}

function detectShell(): string {
  const shellPath = env.SHELL || env.ComSpec || "unknown"
  const name = shellPath.split("/").pop()?.split("\\").pop() || shellPath
  return `${name} (${shellPath})`
}

function detectArch(): string {
  const archMap: Record<string, string> = {
    x64: "x86_64",
    arm64: "aarch64",
    ia32: "x86",
  }
  return archMap[arch()] || arch()
}

export function detectPlatform(): PlatformInfo {
  return {
    os: detectOS(),
    shell: detectShell(),
    arch: detectArch(),
  }
}
