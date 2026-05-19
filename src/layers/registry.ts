import type { LayerConfig } from "../config.js"

export class LayerRegistry {
  private layers: LayerConfig[]

  constructor(layers: LayerConfig[]) {
    this.layers = [...layers].sort((a, b) => a.priority - b.priority)
  }

  getByPriority(): LayerConfig[] {
    return this.layers
  }

  getByName(name: string): LayerConfig | undefined {
    return this.layers.find((l) => l.name === name)
  }

  add(layer: LayerConfig): void {
    this.layers.push(layer)
    this.layers.sort((a, b) => a.priority - b.priority)
  }
}
