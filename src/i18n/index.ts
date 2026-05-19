import en from "./en.js"
import zh from "./zh.js"

const LOCALES: Record<string, Record<string, string>> = { en, zh }
const DEFAULT_LOCALE = "en"

function detectLocale(): string {
  try {
    const lang = Intl.DateTimeFormat().resolvedOptions().locale.split("-")[0].toLowerCase()
    if (LOCALES[lang]) return lang
  } catch {
    // fall through
  }
  return DEFAULT_LOCALE
}

const activeLocale = detectLocale()

export function t(key: string, params?: Record<string, string | number>): string {
  const locale = LOCALES[activeLocale] ?? LOCALES[DEFAULT_LOCALE]
  let msg = locale[key] ?? LOCALES[DEFAULT_LOCALE][key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replace(`{${k}}`, String(v))
    }
  }
  return msg
}
