> **Content migrated to `.opencode/skills/` for dogfood maintenance.**
>
> This project (conflux-oc) manages its own knowledge through the plugin it provides.
> Changes to the design should be recorded via `note_discovery` during development.

| Previous location | New location |
|---|----|
| Architecture, design decisions, privacy, i18n, injection mechanism | [`.opencode/skills/_shared/architecture.md`](.opencode/skills/_shared/architecture.md) |
| Runtime requirements (Node version, build, test) | [`.opencode/skills/_shared/runtime-requirements.yaml`](.opencode/skills/_shared/runtime-requirements.yaml) |
| Current branch progress, implementation status, recent changes | [`.opencode/skills/SKILL.md`](.opencode/skills/SKILL.md) |
| Implementation phase breakdown, detailed project context | Embedded in `SKILL.md` — kept current by editing SKILL.md |

**For new design decisions and architecture changes:** Use `note_discovery` with `layer: "project"`, `scope: "cross"`. The content will be automatically routed to `_shared/`.

**For branch-specific progress updates:** Use `note_discovery` with `layer: "project"`, `scope: "branch"`, or edit `SKILL.md` directly.
