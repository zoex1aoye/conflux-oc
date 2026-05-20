import { stat, open as fsOpen } from "node:fs/promises"

const SAMPLE_BYTES = 4096
const MAX_TEXT_FILE_BYTES = 1024 * 1024

export interface FileMetadata {
  size: number
  mtime: string
  isBinary: boolean
}

function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

async function detectBinary(filePath: string): Promise<boolean> {
  let fileHandle
  try {
    fileHandle = await fsOpen(filePath, "r")
    const buffer = Buffer.alloc(SAMPLE_BYTES)
    const { bytesRead } = await fileHandle.read(buffer, 0, SAMPLE_BYTES, 0)
    const bytes = buffer.subarray(0, bytesRead)

    if (bytes.length === 0) return false

    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) return true
    }

    let nonPrintableCount = 0
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] < 9 || (bytes[i] > 13 && bytes[i] < 32)) {
        nonPrintableCount++
      }
    }

    return nonPrintableCount / bytes.length > 0.3
  } finally {
    await fileHandle?.close()
  }
}

function formatFileType(isBinary: boolean): string {
  return isBinary ? "二进制文件" : "文本文件"
}

function buildErrorMessage(filePath: string, meta: FileMetadata): string {
  const fileType = formatFileType(meta.isBinary)
  const sizeStr = humanSize(meta.size)

  if (meta.isBinary) {
    return [
      `此文件 (${sizeStr}) 为 ${fileType}，无法直接读取。`,
      ``,
      `路径: ${filePath}`,
      `大小: ${sizeStr}`,
      `类型: ${fileType}`,
      `修改时间: ${meta.mtime}`,
    ].join("\n")
  }

  return [
    `此文件 (${sizeStr}) 超出直接读取限制。`,
    ``,
    `路径: ${filePath}`,
    `大小: ${sizeStr}`,
    `类型: ${fileType}`,
    `修改时间: ${meta.mtime}`,
  ].join("\n")
}

export async function checkFile(filePath: string, maxBytes?: number): Promise<never> {
  const threshold = maxBytes ?? MAX_TEXT_FILE_BYTES
  const s = await stat(filePath)

  const isBinary = await detectBinary(filePath)

  if (!isBinary && s.size <= threshold) {
    return undefined as never
  }

  const meta: FileMetadata = {
    size: s.size,
    mtime: s.mtime.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, ""),
    isBinary,
  }

  throw new Error(buildErrorMessage(filePath, meta))
}

export function buildLargeFileSystemRule(maxBytes?: number): string {
  const threshold = maxBytes ?? MAX_TEXT_FILE_BYTES
  const sizeStr = humanSize(threshold)
  return [
    `- 文件 > ${sizeStr} 或为二进制格式时，不要用 read() 全文读取。`,
    `  先用 bash 命令 (head / wc -l / grep / file / strings 等) 探索文件结构，`,
    `  只在提取到关键区域后，再用 read(offset=N, limit=M) 精确定位读取。`,
  ].join("\n")
}
