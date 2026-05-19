import type { ResolvedPluginConfig } from "../config.js"
import { detectProjectRuntime, readRuntimeRequirements, type ProjectRuntime } from "../detection/project.js"

export function getProjectRuntime(config: ResolvedPluginConfig): ProjectRuntime {
  return detectProjectRuntime(config.projectRoot)
}

export function getRecordedRequirements(config: ResolvedPluginConfig) {
  return readRuntimeRequirements(config.projectRoot)
}

export function diffRuntimeVersions(
  current: ProjectRuntime,
  recorded: Record<string, { version: string }> | null,
): string[] {
  const warnings: string[] = []
  if (!recorded) return warnings

  for (const [lang, currentVersion] of Object.entries(current.versions)) {
    const recordedVersion = recorded[lang]?.version
    if (recordedVersion && !currentVersion.includes(recordedVersion)) {
      warnings.push(
        `Project ${lang} version is ${currentVersion}, but recorded Runtime Requirements require ${recordedVersion}.`,
      )
    }
  }

  return warnings
}
