export type Window = { kind: string; percentUsed: number; resetsAt?: string }
export type Snapshot = { windows: Window[]; usd: number | null }

declare module 'claude-code' {
  interface PluginState {
    'quota-panel': { snapshot: Snapshot | null; isHidden: boolean }
  }
}
