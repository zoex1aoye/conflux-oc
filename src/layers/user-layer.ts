import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import type { ResolvedPluginConfig } from "../config.js"
import { detectSystemLanguage, languageInstruction } from "../detection/language.js"
import { t } from "../i18n/index.js"

export interface UserPreferences {
  user: string
  last_updated: string
  output_preferences: {
    comment_style: string
    language: string
    verbosity: string
  }
  security_boundaries: {
    sudo: string
  }
  [key: string]: unknown
}

function defaultPreferences(): UserPreferences {
  return {
    user: process.env.USER || process.env.USERNAME || "unknown",
    last_updated: new Date().toISOString().split("T")[0],
    output_preferences: {
      comment_style: t("prefs.comment_style"),
      language: languageInstruction(detectSystemLanguage()),
      verbosity: "concise",
    },
    security_boundaries: {
      sudo: t("prefs.sudo"),
    },
  }
}

export function userProfilePath(config: ResolvedPluginConfig): string {
  const storage = config.resolvedStorages.user
  if (storage.type !== "local") return ""
  const user = process.env.USER || process.env.USERNAME || "unknown"
  return join(storage.basePath, storage.template.replace("{name}", user))
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

export function saveUserPreferences(config: ResolvedPluginConfig, prefs: Record<string, unknown>): void {
  const path = userProfilePath(config)
  if (!path) return
  const existing = loadUserPreferences(config) as unknown as Record<string, unknown>
  const merged = { ...existing, ...prefs, last_updated: new Date().toISOString().split("T")[0] }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(merged, null, 2), "utf-8")
}
