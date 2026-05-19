import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import type { ResolvedPluginConfig } from "../config.js"
import { hostname } from "node:os"
import { identifyMachine, sanitizeId } from "../detection/machine-id.js"

export interface MachineDomain {
  paths?: Record<string, string>
  versions?: Record<string, string>
  version?: string
  versions_list?: string[]
  nvm_dir?: string
  gopath?: string
}

export interface MachineProfile {
  machine_id: string
  id_method: "dmi" | "machine-id" | "hostname-mac"
  hostname: string
  last_updated: string
  domains: Record<string, MachineDomain>
}

function resolveMachineId(): { id: string; method: "dmi" | "machine-id" | "hostname-mac" } {
  try {
    const identity = identifyMachine()
    const id = sanitizeId(identity.id)
    return { id, method: identity.method }
  } catch {
    return {
      id: sanitizeId(`fallback-${hostname()}`),
      method: "hostname-mac",
    }
  }
}

let _cachedId: { id: string; method: "dmi" | "machine-id" | "hostname-mac" } | null = null

function getMachineId(): { id: string; method: "dmi" | "machine-id" | "hostname-mac" } {
  if (!_cachedId) {
    _cachedId = resolveMachineId()
  }
  return _cachedId
}

export function machineProfilePath(config: ResolvedPluginConfig): string {
  const storage = config.resolvedStorages.machine
  if (storage.type !== "local") return ""
  const { id } = getMachineId()
  return join(storage.basePath, storage.template.replace("{id}", id))
}

export function loadMachineProfile(config: ResolvedPluginConfig): MachineProfile | null {
  const path = machineProfilePath(config)
  if (!path) return null
  try {
    if (!existsSync(path)) return null
    const raw = readFileSync(path, "utf-8")
    return JSON.parse(raw) as MachineProfile
  } catch {
    return null
  }
}

export function saveMachineProfile(config: ResolvedPluginConfig, profile: MachineProfile): void {
  const path = machineProfilePath(config)
  if (!path) return
  mkdirSync(dirname(path), { recursive: true })
  profile.last_updated = new Date().toISOString().split("T")[0]
  writeFileSync(path, JSON.stringify(profile, null, 2), "utf-8")
}

export function createMachineProfile(config: ResolvedPluginConfig, domains: Record<string, MachineDomain>): MachineProfile {
  const { id, method } = getMachineId()
  return {
    machine_id: id,
    id_method: method,
    hostname: hostname(),
    last_updated: new Date().toISOString().split("T")[0],
    domains,
  }
}
