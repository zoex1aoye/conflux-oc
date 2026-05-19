export interface ChangeInfo {
  isSubstantial: boolean
  oldName: string | null
  newName: string | null
  oldHeadings: string[]
  newHeadings: string[]
  linesAdded: number
  linesRemoved: number
}

function extractFrontmatterName(content: string): string | null {
  const match = content.match(/^---\s*\nname:\s*(\S+)/m)
  return match?.[1]?.trim() || null
}

function extractHeadings(content: string): string[] {
  const matches = content.match(/^##\s+(.+)$/gm)
  return matches ? matches.map((m) => m.replace(/^##\s+/, "").trim()) : []
}

function lineDiff(oldContent: string, newContent: string): { added: number; removed: number } {
  const oldLines = oldContent.split("\n").length
  const newLines = newContent.split("\n").length
  const diff = newLines - oldLines
  return {
    added: diff > 0 ? diff : 0,
    removed: diff < 0 ? -diff : 0,
  }
}

export function analyzeChange(
  oldContent: string | null,
  newContent: string,
  filePath: string,
): ChangeInfo {
  if (!oldContent) {
    return {
      isSubstantial: false,
      oldName: null,
      newName: extractFrontmatterName(newContent),
      oldHeadings: [],
      newHeadings: extractHeadings(newContent),
      linesAdded: 0,
      linesRemoved: 0,
    }
  }

  const oldName = extractFrontmatterName(oldContent)
  const newName = extractFrontmatterName(newContent)
  const nameChanged = oldName !== null && newName !== null && oldName !== newName

  const diff = lineDiff(oldContent, newContent)
  const totalLines = Math.max(oldContent.split("\n").length, 1)
  const diffRatio = (diff.added + diff.removed) / totalLines

  const isSubstantial =
    nameChanged || diff.added + diff.removed > 5 || diffRatio > 0.2

  return {
    isSubstantial,
    oldName,
    newName,
    oldHeadings: extractHeadings(oldContent),
    newHeadings: extractHeadings(newContent),
    linesAdded: diff.added,
    linesRemoved: diff.removed,
  }
}
