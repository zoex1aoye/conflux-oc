const SENSITIVE_FILE_PATTERNS = [
  /\.env(\..*)?$/,
  /\/\.ssh\//,
  /\/\.gnupg\//,
  /secret/i,
  /token/i,
  /credential/i,
  /password/i,
  /api[_-]?key/i,
  /id_rsa/,
  /\.pem$/,
  /\.key$/,
]

const SENSITIVE_CONTENT_PATTERNS = [
  /-----BEGIN\s+(RSA|DSA|EC|OPENSSH)?\s*PRIVATE\s+KEY-----/,
  /(?:export|set)\s+\w*TOKEN\w*\s*=\s*\S+/i,
  /(?:export|set)\s+\w*SECRET\w*\s*=\s*\S+/i,
  /(?:export|set)\s+\w*KEY\w*\s*=\s*\S+/i,
  /(?:export|set)\s+\w*PASSWORD\w*\s*=\s*\S+/i,
  // Long base64-like tokens (≥40 chars, at least one digit, ending with == or =)
  /[\w/-]{40,}=\s*$/m,
]

export function isSensitiveFilePath(filePath: string): boolean {
  return SENSITIVE_FILE_PATTERNS.some((p) => p.test(filePath))
}

export function containsSensitiveContent(content: string): string[] {
  const found: string[] = []
  for (const pattern of SENSITIVE_CONTENT_PATTERNS) {
    if (pattern.test(content)) {
      found.push(pattern.source)
    }
  }
  return found
}

export function redactSensitive(content: string): string {
  let redacted = content
  for (const pattern of SENSITIVE_CONTENT_PATTERNS) {
    redacted = redacted.replace(new RegExp(pattern.source, "gi"), "[REDACTED]")
  }
  return redacted
}

function patternToRegex(pattern: string): RegExp {
  let src = ""
  for (const ch of pattern) {
    if (ch === "*") {
      src += ".*"
    } else if (/[.+^${}()|[\]\\]/.test(ch)) {
      src += `\\${ch}`
    } else {
      src += ch
    }
  }
  return new RegExp(src, "i")
}

export function shouldBlockRead(filePath: string, patterns: string[] = [".env*", ".ssh/", ".gnupg/"]): boolean {
  for (const p of patterns) {
    if (patternToRegex(p).test(filePath)) return true
  }
  return false
}
