---
name: conflux-oc
description: Auto-learning plugin for opencode — cross-session project/machine/user context memory
---

## prototype/alpha

This branch implements the core context injection pipeline and knowledge persistence for the conflux-oc plugin.

### Phase 1 — Core Context (Complete)
- Layer registry + config loading (`conflux-oc.jsonc`)
- Silent validation on session start (read pom.xml/package.json, which java/go/node, Machine profile)
- `client.session.prompt({ noReply: true })` context injection
- `tool.execute.before` version switching (runtime-requirements.yaml → Machine profile → live detection fallback)
- `note_discovery` + `get_machine_context` custom tools

### Phase 2 — Knowledge Persistence (Complete)
- Machine dev toolchain auto-detection on first load
- Machine ID fallback chain (DMI → /etc/machine-id → hostname+MAC)
- `file.edited` → decisions/ + _archive/ three-layer keeping
- Migration Map detection and injection
- i18n (en/zh) system
- Storage adapter interface + LocalStorageAdapter
- Security: file path blocking + content filtering

### Phase 3 — Hardening (In Progress)
- [x] Project-level `conflux-oc.jsonc` example config (`.opencode/conflux-oc.jsonc`)
- [x] Node version extraction from `engines.node` in package.json
- [x] Dogfood: architecture.md, SKILL.md, runtime-requirements.yaml established
- [ ] npm publish + first-run experience
- [ ] Tune Context Plugin compatibility test

### Recent Changes
- 2026-05-20: Created `.opencode/conflux-oc.jsonc` as project-level config example (full layer registry + behavior_rules)
- 2026-05-20: Fixed node version detection in `detection/project.ts` to read `pkg.engines?.node`
- 2026-05-20: Established `.opencode/skills/` skeleton for conflux-oc's own knowledge management (dogfood)
- 2026-05-20: Migrated architecture content from `LEARNING-PLUGIN-DESIGN.md` → `_shared/architecture.md`
