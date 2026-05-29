import { PLUGIN_NAME } from "../constants.js"

export interface Logger {
  info(message: string, extra?: Record<string, unknown>): void
  warn(message: string, extra?: Record<string, unknown>): void
  debug(message: string, extra?: Record<string, unknown>): void
  error(message: string, extra?: Record<string, unknown>): void
}

export function createLogger(client: any): Logger {
  async function log(level: string, message: string, extra?: Record<string, unknown>) {
    try {
      await client.app.log({
        body: {
          service: PLUGIN_NAME,
          level,
          message,
          extra: extra ?? {},
        },
      })
    } catch {
      // Silently drop log failures
    }
  }

  return {
    info: (message, extra) => log("info", message, extra),
    warn: (message, extra) => log("warn", message, extra),
    debug: (message, extra) => log("debug", message, extra),
    error: (message, extra) => log("error", message, extra),
  }
}
