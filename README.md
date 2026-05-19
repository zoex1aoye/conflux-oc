# Conflux-OC

Auto-learning plugin for [opencode](https://opencode.ai) — cross-session project/machine/user context memory. From message 1, the model knows your OS, toolchain versions, project structure, and knowledge routing rules.

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

- **Platform**: OS, shell, CPU architecture
- **Machine**: Available dev toolchains (java/go/node/python) with versions and paths
- **Project**: Languages, runtime versions, build/test commands, git branch
- **User**: Output preferences (language, verbosity, comment style)
- **Knowledge Rules**: How to record and route discovered knowledge

### Version Switching
Automatically prepends `export JAVA_HOME=...` before build/run commands based on `runtime-requirements.yaml`.

### Knowledge Management
- **`note_discovery`** tool: Model records architecture decisions, branch progress, toolchain info
- **`get_machine_context`** tool: Query specific toolchain domain details
- **Knowledge routing**: Core architecture → `_shared/` (cross-branch); branch progress → `SKILL.md`
- **Decision logging**: Automatically creates timestamped decision logs on substantive SKILL.md changes
- **Archive management**: Old skill variants preserved in `_archive/`

### Migration Tracking
- Scans `Migration Map` sections in skill files
- Injects migration hints into session context
- Alerts when editing files with known migration paths

## Configuration

Conflux searches for config in this order (each level overrides the previous):

1. **Project**: `.opencode/conflux-oc.jsonc`
2. **Custom**: `$OPENCODE_CONFIG_DIR/conflux-oc.jsonc`
3. **Global**: `~/.config/opencode/conflux-oc.jsonc`
4. **Built-in defaults** (always available as fallback)

```jsonc
// .opencode/conflux-oc.jsonc
{
  "layers": [
    { "name": "platform", "priority": 0, "storage": "transform-only", "inject": "always" },
    { "name": "machine", "priority": 1, "storage": { "type": "local", "path": "machines/{id}.json" }, "inject": "summary-only" },
    { "name": "user", "priority": 2, "storage": { "type": "local", "path": "users/{name}.json" }, "inject": "always" },
    { "name": "project", "priority": 3, "storage": { "type": "local", "path": ".opencode/skills/" }, "inject": "on-demand" }
  ]
}
```

## Privacy

- Machine and User profiles stored in `~/.config/opencode/plugins/conflux-oc/` (never in git)
- Blocks read access to `.env`, `.ssh/`, `.gnupg/`, and sensitive files
- Filters sensitive content (private keys, tokens, secrets) from knowledge recording
- Project skills stored in `.opencode/skills/` (in git, team-shareable)

## License

MIT
