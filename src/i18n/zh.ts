const zh: Record<string, string> = {
  // 用户偏好默认值
  "prefs.comment_style": "保持现有代码注释风格",
  "prefs.sudo": "列出命令让用户手动执行",

  // 决策日志
  "decision.title": "# 决策日志 — {date}",
  "decision.affected_file": "**影响文件**: {path}",
  "decision.name_change": "**名称变更**: `{old}` → `{new}`",
  "decision.stats_title": "## 变更统计",
  "decision.lines_added": "- 新增行: {count}",
  "decision.lines_removed": "- 删除行: {count}",
  "decision.structure_title": "## 结构变更",
  "decision.section_removed": "**移除章节**: {sections}",
  "decision.section_added": "**新增章节**: {sections}",
  "decision.reason_title": "## 变更原因",
  "decision.reason_placeholder": "_（请在此补充变更原因）_",

  // 迁移映射
  "migration.entry": "- `{old}/` → 已有 `{new}`",
}

export default zh
