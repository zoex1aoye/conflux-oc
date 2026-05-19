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
  /export\s+\w*TOKEN\w*\s*=\s*\S+/i,
  /export\s+\w*SECRET\w*\s*=\s*\S+/i,
  /export\s+\w*KEY\w*\s*=\s*\S+/i,
  /export\s+\w*PASSWORD\w*\s*=\s*\S+/i,
  /[\w-]{20,}={2,}$/,
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

export function shouldBlockRead(filePath: string): boolean {
  if (filePath.includes(".env")) return true
  const sshMatch = /\/\.ssh\//
  if (sshMatch.test(filePath)) return true
  const gnupgMatch = /\/\.gnupg\//
  if (gnupgMatch.test(filePath)) return true
  return false
}
