import { readFileSync } from "node:fs"
import { execSync } from "node:child_process"
import { hostname, platform } from "node:os"

export interface MachineIdentity {
  id: string
  method: "dmi" | "machine-id" | "hostname-mac"
}

function tryDMISerial(): string | null {
  try {
    const paths = [
      "/sys/devices/virtual/dmi/id/product_name",
      "/sys/devices/virtual/dmi/id/product_serial",
    ]
    for (const p of paths) {
      try {
        const content = readFileSync(p, "utf-8").trim()
        if (content && content !== "Not Specified" && content !== "System Product Name") {
          return content
        }
      } catch { continue }
    }
  } catch { /* macOS / Windows */ }
  return null
}

function tryMachineID(): string | null {
  try {
    return readFileSync("/etc/machine-id", "utf-8").trim().slice(0, 8) || null
  } catch { return null }
}

function tryHostnameMAC(): string {
  const hn = hostname()
  try {
    const isWin = platform() === "win32"
    const cmd = isWin
      ? 'powershell -Command "Get-NetAdapter | Select-Object -ExpandProperty MacAddress"'
      : "ifconfig 2>/dev/null || ip link 2>/dev/null"
    const output = execSync(cmd, { encoding: "utf-8", timeout: 5000 })
    const macs = output.match(/([0-9A-Fa-f]{2}([:-][0-9A-Fa-f]{2}){5})/g)
    if (macs && macs.length > 0) {
      return `${hn}-${macs[0].replace(/[:-]/g, "").slice(0, 6)}`
    }
    return hn
  } catch {
    return hn
  }
}

function tryWindowsMachineId(): string | null {
  try {
    const output = execSync(
      'powershell -Command "Get-CimInstance -Class Win32_ComputerSystemProduct | Select-Object -ExpandProperty UUID"',
      { encoding: "utf-8", timeout: 5000 },
    )
    const trimmed = output.trim()
    return trimmed && trimmed !== "00000000-0000-0000-0000-000000000000" ? trimmed : null
  } catch {
    return null
  }
}

export function identifyMachine(): MachineIdentity {
  const isWin = platform() === "win32"

  if (!isWin) {
    const dmi = tryDMISerial()
    if (dmi) return { id: dmi, method: "dmi" }

    const machineId = tryMachineID()
    if (machineId) return { id: machineId, method: "machine-id" }
  }

  if (isWin) {
    const winId = tryWindowsMachineId()
    if (winId) return { id: winId, method: "hostname-mac" }
  }

  return { id: tryHostnameMAC(), method: "hostname-mac" }
}

export function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 64)
}
