import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import type { ResolvedPluginConfig } from "../config.js"

export interface UserPreferences {
  user: string
  last_updated: string
  workflow_habits?: string
  coding_conventions?: string[]
  language: string
}

function defaultPreferences(): UserPreferences {
  return {
    user: process.env.USER || process.env.USERNAME || "unknown",
    last_updated: new Date().toISOString().split("T")[0],
    language: "en",
  }
}

export function userProfilePath(config: ResolvedPluginConfig): string {
  const user = process.env.USER || process.env.USERNAME || "unknown"
  return join(config.pluginDataDir, "users", `${user}.json`)
}

export function loadUserPreferences(config: ResolvedPluginConfig): UserPreferences {
  const defaults = defaultPreferences()
  const path = userProfilePath(config)
  if (!path) return defaults

  try {
    const raw = readFileSync(path, "utf-8")
    return { ...defaults, ...JSON.parse(raw) }
  } catch {
    return defaults
  }
}

export function saveUserPreferences(config: ResolvedPluginConfig, prefs: Partial<UserPreferences>): void {
  const path = userProfilePath(config)
  if (!path) return
  const existing = loadUserPreferences(config) as unknown as Record<string, unknown>
  const merged = {
    ...existing,
    ...prefs,
    last_updated: new Date().toISOString().split("T")[0],
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(merged, null, 2), "utf-8")
}
