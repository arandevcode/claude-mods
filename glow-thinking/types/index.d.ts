export type ModelStat = { steps: number; thinkingMs: number }

declare module 'claude-code' {
  interface PluginState {
    'glow-thinking': { stats2: Record<string, ModelStat>; live: { isWorking: boolean; frame: number } }
  }
}
