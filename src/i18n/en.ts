const en: Record<string, string> = {
  // User preferences defaults
  "prefs.comment_style": "follow existing code comment style",
  "prefs.sudo": "list commands for user to run manually",

  // Decision log
  "decision.title": "# Decision Log — {date}",
  "decision.affected_file": "**Affected file**: {path}",
  "decision.name_change": "**Name change**: `{old}` → `{new}`",
  "decision.stats_title": "## Change Statistics",
  "decision.lines_added": "- Lines added: {count}",
  "decision.lines_removed": "- Lines removed: {count}",
  "decision.structure_title": "## Structure Changes",
  "decision.section_removed": "**Removed sections**: {sections}",
  "decision.section_added": "**Added sections**: {sections}",
  "decision.reason_title": "## Reason for Change",
  "decision.reason_placeholder": "_(Please document the reason for this change here)_",

  // Migration map
  "migration.entry": "- `{old}/` is replaced by `{new}`",
}

export default en
