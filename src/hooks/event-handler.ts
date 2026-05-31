import type { Logger } from "../utils/logger.js"
import type { ResolvedPluginConfig } from "../config.js"
import { loadUserPreferences, saveUserPreferences } from "../layers/user-layer.js"
import type { UserPreferences } from "../layers/user-layer.js"
import { LANG_ENV_VARS, LANG_REGEX, LANG_CODE_REGEX, MIN_TITLE_LENGTH, AUTO_TITLE_MAX_LENGTH } from "../constants.js"

function detectLanguage(prefs?: UserPreferences): string {
  for (const env of LANG_ENV_VARS) {
    const val = process.env[env]
    if (val) {
      const match = val.match(LANG_REGEX)
      if (match) return match[1].toLowerCase()
    }
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.split("-")[0].toLowerCase()
  } catch {}
  if (prefs?.language?.match(LANG_CODE_REGEX)) {
    return prefs.language
  }
  return "en"
}

function languageInstruction(lang: string): string {
  try {
    const name = new Intl.DisplayNames(["en"], { type: "language" }).of(lang)
    return `Technical explanations in ${name ?? lang}, keep command output as-is`
  } catch {
    return "Technical explanations in English, keep command output as-is"
  }
}

function buildContext(config: ResolvedPluginConfig): string {
  const userPrefs = loadUserPreferences(config)
  const langCode = detectLanguage(userPrefs)
  const directive = languageInstruction(langCode)

  if (userPrefs.language !== langCode) {
    saveUserPreferences(config, { language: langCode })
  }

  const sections: string[] = []

  sections.push(
    "## User Preferences",
    "",
    `System language: ${langCode}`,
    `IMPORTANT: ${directive}`,
  )

  if (userPrefs.workflow_habits) {
    sections.push(
      "",
      "## Your Workflow Habits",
      "",
      "Apply these patterns. Update via record_convention if overridden:",
      "",
      userPrefs.workflow_habits,
    )
  }

  if (userPrefs.coding_conventions && userPrefs.coding_conventions.length > 0) {
    sections.push(
      "",
      "## Known Coding Conventions",
      "",
      "Follow these in this session. Cite when relevant. Update if overridden:",
      "",
    )
    for (const c of userPrefs.coding_conventions) {
      sections.push(`- ${c}`)
    }
  }

  return sections.join("\n")
}

/**
 * Tracks accumulated text of the first user message per session for Phase 1 instant title.
 */
interface SessionTitleState {
  /** Message ID of the first user message being tracked. */
  userMessageId: string
  /** Accumulated text from text parts of that user message. */
  text: string
}

export function createEventHandler(
  logger: Logger,
  client: any,
  config: ResolvedPluginConfig,
) {
  /**
   * Per-session state for Phase 1 instant title generation.
   * Populated when first user message.updated arrives, consumed when
   * enough text is accumulated or the assistant starts responding.
   */
  const pendingTitles = new Map<string, SessionTitleState>()

  return async (input: { event: any }) => {
    const { event } = input
    const info = event.properties?.info

    switch (event.type) {
      case "session.created": {
        const sessionId: string = info.id
        const context = buildContext(config)

        try {
          await client.session.prompt({
            path: { id: sessionId },
            body: {
              noReply: true,
              parts: [{ type: "text" as const, text: context }],
            },
          })
          logger.debug("Context injected via noReply prompt", { sessionId })
        } catch (err) {
          logger.error("Failed to inject context via noReply prompt", { sessionId, error: String(err) })
        }
        break
      }

      case "message.updated": {
        const sessionId: string = info.sessionID
        if (!sessionId) break

        if (info.role === "user") {
          if (!pendingTitles.has(sessionId)) {
            pendingTitles.set(sessionId, { userMessageId: info.id, text: "" })
          }
        } else if (info.role === "assistant") {
          const state = pendingTitles.get(sessionId)
          if (state && state.text.length > 0) {
            const title = state.text.slice(0, AUTO_TITLE_MAX_LENGTH) + (state.text.length > AUTO_TITLE_MAX_LENGTH ? "…" : "")
            try {
              await client.session.update({ path: { id: sessionId }, body: { title } })
            } catch (err) {
              logger.warn("Failed to set fallback session title", { sessionId, error: String(err) })
            }
            pendingTitles.delete(sessionId)
          }
        }
        break
      }

      case "message.part.updated": {
        const part = event.properties.part
        if (!part || part.type !== "text" || !part.text) break

        const state = pendingTitles.get(part.sessionID)
        if (!state || state.userMessageId !== part.messageID) break

        state.text += part.text

        if (state.text.length >= MIN_TITLE_LENGTH) {
          const title = state.text.slice(0, AUTO_TITLE_MAX_LENGTH) + (state.text.length > AUTO_TITLE_MAX_LENGTH ? "…" : "")
          try {
            await client.session.update({ path: { id: part.sessionID }, body: { title } })
          } catch (err) {
            logger.warn("Failed to set session title from text", { sessionId: part.sessionID, error: String(err) })
          }
          pendingTitles.delete(part.sessionID)
        }
        break
      }

      case "session.deleted": {
        pendingTitles.delete(event.properties.info.id)
        break
      }
    }
  }
}
