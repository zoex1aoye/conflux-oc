const LANGUAGE_MAP: Record<string, string> = {
  zh: "技术解释用中文，命令输出保留原文",
  ja: "技術説明は日本語、コマンド出力は原文のまま",
  ko: "기술 설명은 한국어, 명령어 출력은 원문 유지",
  de: "Technische Erklärungen auf Deutsch, Befehlsausgabe im Original",
  fr: "Explications techniques en français, sortie des commandes en original",
  es: "Explicaciones técnicas en español, salida de comandos en original",
}

const FALLBACK = "Technical explanations in English, keep command output as-is"

export function detectSystemLanguage(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    return locale.split("-")[0].toLowerCase()
  } catch {
    return "en"
  }
}

export function languageInstruction(lang?: string): string {
  const code = lang || detectSystemLanguage()
  return LANGUAGE_MAP[code] ?? FALLBACK
}
