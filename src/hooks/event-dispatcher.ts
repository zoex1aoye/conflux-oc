import type { Event } from "@opencode-ai/sdk"
import type { ResolvedPluginConfig } from "../config.js"
import type { Logger } from "../utils/logger.js"
import { injectSessionContext } from "./session-created.js"

export function createEventHandler(
  logger: Logger,
  client: any,
  config: ResolvedPluginConfig,
) {
  return async (input: { event: Event }): Promise<void> => {
    const event = input.event

    switch (event.type) {
      case "session.created": {
        const sessionId = event.properties.info.id
        await injectSessionContext(logger, client, config, sessionId)
        break
      }
    }
  }
}
