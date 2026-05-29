# Conflux-OC

Auto-learning plugin for [opencode](https://opencode.ai) — cross-session user preference memory. Learns and persists your coding habits, conventions, and language preferences across sessions.

## Installation

```bash
opencode plugin @x1aoye/conflux-oc@latest --global
```

Or add to your `opencode.json`:

```json
{ "plugin": ["@x1aoye/conflux-oc"] }
```

## What It Does

### Session Context Injection (noReply)
On every new session, Conflux silently injects:

- **Language preference**: Detects system language (via `LANG`/`LC_ALL`/`Intl`) and injects a directive like `Technical explanations in Chinese, keep command output as-is`
- **Workflow habits**: Previously recorded habits (e.g. "always run tests before committing")
- **Coding conventions**: Previously recorded rules (e.g. "no magic numbers", "functions must have doc comments")

### Convention & Habit Management
Three tools let the model learn your preferences over time:

| Tool | Description |
|------|-------------|
| `record_convention` | Capture a coding convention (`type: "convention"`) or workflow habit (`type: "habit"`) |
| `compact_preferences` | Merge, deduplicate, or clear accumulated conventions |
| `update_session_title` | Update the session title mid-conversation |

### Auto Session Title
The plugin automatically sets a descriptive session title from the first user message (≥30 characters triggers instant title update).

### System Prompt Rules
Injects structured instructions into the system prompt so the model knows:
- When and how to use `record_convention` / `compact_preferences`
- How to handle multilingual conventions (store in English regardless of user's language)
- Session title management rules

## Configuration

Conflux stores data in `~/.config/opencode/plugins/conflux-oc/` with no configuration required. A placeholder config file is available at `.opencode/conflux-oc.jsonc` for future options.

## Data Storage

| Data | Location |
|------|----------|
| User preferences (habits, conventions, language) | `~/.config/opencode/plugins/conflux-oc/users/$USER.json` |

## License

MIT
