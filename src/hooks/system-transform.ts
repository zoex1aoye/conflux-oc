import type { Logger } from "../utils/logger.js"
import type { ResolvedPluginConfig } from "../config.js"

const PROTOCOL = [
  "## Knowledge Recording Protocol",
  "",
  "You MUST actively identify and record project knowledge. Call note_discovery in these scenarios:",
  "",
  "- User describes architecture decisions, interface contracts, permission models",
  "  → { domain: \"<topic>\", layer: \"project\", scope: \"cross\" }",
  "- User describes feature implementation, module progress",
  "  → { domain: \"<module-name>\", layer: \"project\", scope: \"branch\" }",
  "- You analyzed code and found key patterns or conventions",
  "  → { domain: \"<topic>\", layer: \"project\", scope: \"branch\" }",
  "- You detect toolchain version changes",
  "  → { domain: \"<runtime>\", layer: \"machine\" }",
  "",
  "DO NOT record: simple bug fixes, temporary discussions, user assumptions",
  "When uncertain → write to SKILL.md and ask the user",
].join("\n")

export function createSystemTransformHandler(
  logger: Logger,
  _config: ResolvedPluginConfig,
) {
  return async (_input: any, output: any) => {
    if (!output.system) {
      output.system = PROTOCOL
    } else if (typeof output.system === "string") {
      output.system = `${output.system}\n\n${PROTOCOL}`
    }
    logger.debug("Knowledge Recording Protocol appended to system prompt")
  }
}
