---
name: conflux-oc-architecture
description: Core architecture of the conflux-oc auto-learning plugin for opencode
---

## Core Philosophy

Let opencode learn automatically from its usage across three dimensions:
- **Cross-session** memory of project architecture, tech stack, runtime requirements
- **Cross-branch** preservation of core design intersections
- **Zero cold start** — model has full context from message 1, never asks "what OS/version"

Knowledge needs sedimentation, but also needs to stay fresh.

## Layer Architecture

| Priority | Layer | Content | Scope | Injection |
|----------|-------|---------|-------|-----------|
| P0 | Project | Architecture context, Runtime Requirements, cross-branch knowledge, module sub-skills | Project | `skill()` on-demand |
| P1 | Machine | Dev toolchain version/path list, machine identity | Cross-session same machine | `client.session.prompt({ noReply: true })` silent injection |
| P2 | Platform | 3-line OS/Shell/Arch | Current session | Merged into same injection message |
| P3 | User | Comment style, verbosity (static, no self-learning) | Cross-session | Merged into same injection message |

### Design Principle: Open-Closed Principle (OCP)

The plugin is open for extension, closed for modification. No core code changes needed for adding layers, rules, or storage backends.

1. **Layer stack is configurable** — `conflux-oc.jsonc` layer registry, pluggable
2. **Behavior rules are configurable** — rule registry in config, injected as session context
3. **Storage backends are replaceable** — `StorageAdapter` interface
4. **Knowledge formats are extensible** — parser registry by file extension

## Injection Mechanism

The opencode SDK provides `client.session.prompt({ noReply: true })` to inject a message into the session without triggering an AI reply.

```
session.created
  ↓
Plugin runs silent validation: read pom.xml, which java/go/node, read _shared/
  ↓ Compare versions → decide injection content
  ↓
client.session.prompt({ noReply: true, parts: [compiledContext] })
  ↓
Model sees full context from first user message
```

### Injected Context Sections
- Session Context (Platform + Machine summary + toolchains)
- User Preferences (comment style, language, verbosity, security boundary)
- Project Info (languages, runtime versions, build/test commands, current branch)
- Knowledge Recording Protocol
- Version Mismatch Detected (if any)
- Available Migrations (if any)

## Knowledge Routing Rules

| Knowledge Type | Example | Route Target | Scope |
|---------------|---------|-------------|-------|
| Core architecture / interface contracts / design decisions | "Token refresh uses refresh_token grant flow" | `_shared/` | Cross-branch |
| Current branch progress / implementation details | "Admin CRUD done, next rate limiting" | `SKILL.md` | Current branch |
| Module-level sub-skill | "Auth-module depends on Spring Security 6" | `auth-module/SKILL.md` | Per-branch |
| Version information | "Project requires JDK 11" | `_shared/runtime-requirements.yaml` | Cross-branch |

Source determines routing, not content:
- Only tool output → Machine/Platform layers
- User explicitly states another machine → Machine stub
- Hypothetical/target environment → Never enters any persistent layer

## Privacy Boundaries

### Three Red Lines
1. Never actively read `~/.ssh/`, `~/.gnupg/`, `.env`, `*token*`, `*secret*`, `*credential*`
2. Machine and User layers in `~/.config/opencode/plugins/`, never in git
3. Project layer in `.opencode/skills/`, in git, team-shared

### Sensitive Content Filtering
- File path interception in `tool.execute.before` for sensitive paths
- Content matching in `note_discovery` before write: SSH keys, token exports, base64 secrets
- Matching content → entire discovery is discarded, returns error message

## i18n Design

All user-visible strings managed via lightweight i18n system:
- `src/i18n/en.ts` (default/fallback)
- `src/i18n/zh.ts`
- `t(key, params?)` function
- Locale auto-detected via `Intl.DateTimeFormat().resolvedOptions().locale`

Model-visible strings (session injection, tool descriptions, behavior rules) use English only.

## Three-Layer Keeping Strategy (file.edited)

Each module skill maintains three layers:
```
auth-module/
├── SKILL.md          ← Current truth
├── decisions/        ← Decision log, one file per change
└── _archive/         ← Frozen archive of old variants
```

Automatic maintenance flow:
1. Model edits SKILL.md via `edit` tool
2. `file.edited` hook detects substantial change
3. Auto-creates date-stamped decision log file
4. If variant is superseded, moves to `_archive/` and updates Migration Map

## Hooks Used

| Hook / API | Purpose |
|-----------|---------|
| `event` (generic) | Listen for `session.created`, `file.edited` |
| `client.session.prompt({ noReply: true })` | Silent context injection |
| `tool.execute.before` | Build/run version switching, sensitive file blocking |
| `experimental.chat.system.transform` | Append Knowledge Recording Protocol to system prompt |

## Custom Tools

| Tool | Args | Purpose |
|------|------|---------|
| `note_discovery` | domain, content, layer, scope? | Route knowledge to corresponding storage location |
| `get_machine_context` | domain | Return full toolchain details for a domain |
