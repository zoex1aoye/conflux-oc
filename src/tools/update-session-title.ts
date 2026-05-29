import { tool } from "@opencode-ai/plugin"
import { TOOL_TITLE_MAX_LENGTH } from "../constants.js"

export function createUpdateSessionTitleTool(client: any) {
  return tool({
    description:
      "Update the current session's title to better reflect the conversation purpose. " +
      "Call this after you understand the user's core request to set a concise, descriptive title. " +
      "Also call this when the main topic or goal clearly shifts during the conversation.",
    args: {
      title: tool.schema
        .string()
        .describe(
          "A concise, descriptive title for this session (max 60 characters). " +
          "Should capture the core task or goal.",
        ),
    },
    async execute(args, ctx) {
      const trimmed = args.title.trim().slice(0, TOOL_TITLE_MAX_LENGTH)
      await client.session.update({ path: { id: ctx.sessionID }, body: { title: trimmed } })
      return `Session title updated to: "${trimmed}"`
    },
  })
}
