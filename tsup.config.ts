import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "es2022",
  outDir: "dist",
  splitting: false,
  sourcemap: false,
  minify: false,
  external: [],
  noExternal: ["jsonc-parser", "@opencode-ai/plugin"],
})
