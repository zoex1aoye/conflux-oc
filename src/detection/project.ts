import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { parse as parseYaml } from "yaml"

export interface RuntimeRequirement {
  version: string
  source?: string
  switching?: string
}

export interface ProjectRuntime {
  languages: string[]
  versions: Record<string, string>
  build: string
  test: string
}

const DETECTORS: Record<
  string,
  {
    file: string
    parse: (content: string) => ProjectRuntime | null
  }
> = {
  java_maven: {
    file: "pom.xml",
    parse: (content: string) => {
      const javaMatch = content.match(/<java\.version>([^<]+)<\/java\.version>/)
        || content.match(/<maven\.compiler\.source>([^<]+)<\/maven\.compiler\.source>/)
      if (!javaMatch) return null
      return {
        languages: ["java"],
        versions: { java: javaMatch[1] },
        build: "mvn clean compile",
        test: "mvn test",
      }
    },
  },
  java_gradle: {
    file: "build.gradle",
    parse: (content: string) => {
      const match = content.match(/sourceCompatibility\s*=\s*['"]?(\d+\.?\d*)['"]?/)
      if (!match) return null
      return {
        languages: ["java"],
        versions: { java: match[1] },
        build: "gradle build",
        test: "gradle test",
      }
    },
  },
  java_gradle_kts: {
    file: "build.gradle.kts",
    parse: (content: string) => {
      const match = content.match(/JavaVersion\.VERSION_(\d+\.?\d*)/)
        || content.match(/java\.toolchain\.languageVersion\.set\(JavaLanguageVersion\.of\((\d+\.?\d*)\)\)/)
      if (!match) return null
      return {
        languages: ["java"],
        versions: { java: match[1] },
        build: "gradle build",
        test: "gradle test",
      }
    },
  },
  node: {
    file: "package.json",
    parse: (content: string) => {
      const pkg = JSON.parse(content)
      const scripts = pkg.scripts || {}
      const nodeVer = pkg.engines?.node || "unknown"
      return {
        languages: ["javascript", "typescript"],
        versions: { node: nodeVer },
        build: scripts.build || "npm run build",
        test: scripts.test || "npm test",
      }
    },
  },
  go: {
    file: "go.mod",
    parse: (content: string) => {
      const match = content.match(/^go (\d+\.\d+\.?\d*)/m)
      return {
        languages: ["go"],
        versions: { go: match?.[1] || "unknown" },
        build: "go build ./...",
        test: "go test ./...",
      }
    },
  },
  rust: {
    file: "Cargo.toml",
    parse: () => ({
      languages: ["rust"],
      versions: { rust: "unknown" },
      build: "cargo build",
      test: "cargo test",
    }),
  },
}

export function runtimeRequirementsPath(projectRoot: string): string {
  return join(projectRoot, ".opencode", "skills", "_shared", "runtime-requirements.yaml")
}

export function readRuntimeRequirements(projectRoot: string): Record<string, RuntimeRequirement> | null {
  const path = runtimeRequirementsPath(projectRoot)
  try {
    if (!existsSync(path)) return null
    const raw = readFileSync(path, "utf-8")
    return parseYaml(raw) as Record<string, RuntimeRequirement>
  } catch {
    return null
  }
}

export function detectProjectRuntime(projectRoot: string): ProjectRuntime {
  const result: ProjectRuntime = {
    languages: [],
    versions: {},
    build: "",
    test: "",
  }

  for (const [, detector] of Object.entries(DETECTORS)) {
    const filePath = join(projectRoot, detector.file)
    if (!existsSync(filePath)) continue

    try {
      const content = readFileSync(filePath, "utf-8")
      const parsed = detector.parse(content)
      if (parsed) {
        result.languages.push(...parsed.languages)
        Object.assign(result.versions, parsed.versions)
        result.build = parsed.build || result.build
        result.test = parsed.test || result.test
      }
    } catch {
      continue
    }
  }

  result.languages = [...new Set(result.languages)]

  return result
}
