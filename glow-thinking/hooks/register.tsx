import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ModelStat } from '../types'

const stats = atom({ plugin: 'glow-thinking', key: 'stats2' } as const, {} as Record<string, ModelStat>)
// What the borders read: whether a turn runs, and the animation frame.
const live = atom({ plugin: 'glow-thinking', key: 'live' } as const, { isWorking: false, waiting: '' })
// The animation frame lives apart, so its ticks can never race a state change.
const frameAtom = atom({ plugin: 'glow-thinking', key: 'frame' } as const, 0)

const IDLE_COLOR = 'success'
const WAIT_COLOR = 'warning'

// Hue 0-360 to #rrggbb at full saturation, lightness 0.55.
const hsl = (h: number) => {
  const c = (n: number) => {
    const k = (n + h / 30) % 12
    const t = 0.55 - 0.45 * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * t).toString(16).padStart(2, '0')
  }
  return `#${c(0)}${c(8)}${c(4)}`
}

// The colour of cell `i` of a border `total` cells round: one hue per cell
// along the perimeter, the whole ring turning with the frame. Idle is solid.
const cell = (i: number, total: number, frame: number, isWorking: boolean, waiting = '') =>
  isWorking ? hsl((((i / total) * 360 + frame * 22) % 360 + 360) % 360) : waiting ? WAIT_COLOR : IDLE_COLOR

// "MONITOR", "2 TASKS", "SCHEDULE"... what is still in flight once the turn ends.
type InFlight = { type: string }
const waitLabel = (tasks: InFlight[] = [], crons: unknown[] = []) => {
  const monitors = tasks.filter(t => t.type === 'monitor').length
  const others = tasks.length - monitors
  const parts = [
    monitors && (monitors > 1 ? `${monitors} MONITORS` : 'MONITOR'),
    others && (others > 1 ? `${others} TASKS` : 'TASK'),
    crons.length && 'SCHEDULE',
  ].filter(Boolean)
  return parts.join(' + ')
}

const fmt = (ms: number) => {
  const s = Math.round(ms / 1000)
  return s >= 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`
}

type Run = { main: boolean; agents: Set<string>; timer: { cancel: () => void } | null }

// Write `live`, retrying if the write is beaten: the band must never be left stale
// because one write lost a race.
async function patchLive($: any, fn: (s: { isWorking: boolean; waiting: string }) => { isWorking: boolean; waiting: string }) {
  for (let i = 0; i < 8; i++) {
    try {
      await update($, live, fn)
      return
    } catch { /* write beaten, try again */ }
  }
}

// WORKING while the main turn or any subagent/teammate loop runs.
async function sync($: any, run: Run) {
  const busy = run.main || run.agents.size > 0
  if (busy && !run.timer) {
    run.timer = $.clock.every(180, () => {
      void update($, frameAtom, n => n + 1).catch(() => {})
    })
  } else if (!busy && run.timer) {
    run.timer.cancel()
    run.timer = null
  }
  await patchLive($, s => ({ isWorking: busy, waiting: busy && !s.isWorking ? '' : s.waiting }))
}

export const register: Register = on => {
  let model = 'unknown'
  let startedAt = 0
  const pending: Record<string, ModelStat> = {}
  const bump = (m: string): ModelStat => (pending[m] ??= { steps: 0, thinkingMs: 0 })

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'thinking',
      description: 'Show working time per model',
    })
    return next(e)
  })

  // WORKING while the main turn or any subagent/teammate loop runs.
  const run: Run = { main: false, agents: new Set<string>(), timer: null }

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      startedAt = await $.clock.now()
      run.main = true
    } else run.agents.add(e.agentId)
    await sync($, run)
    return next(e)
  })

  // When a turn ends, the engine says what is still running in the background.
  on('classic.Stop', async ($, e, next) => {
    // Keep the label whatever the order: Stop can land before turn.complete,
    // and WORKING wins over WAITING on screen anyway.
    const waiting = waitLabel(e.background_tasks, e.session_crons)
    await patchLive($, s => ({ ...s, waiting }))
    return next(e)
  })
  on('classic.SubagentStop', async ($, e, next) => {
    const waiting = waitLabel(e.background_tasks, e.session_crons)
    await patchLive($, s => ({ ...s, waiting }))
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    model = e.model
    bump(model).steps += 1
    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      run.main = false
      bump(model).thinkingMs += (await $.clock.now()) - startedAt
    } else run.agents.delete(e.agentId)
    // The band first: it must follow the turn even if the stats write fails.
    await sync($, run)

    if (e.agentId === undefined) {
      const add = { ...pending }
      for (const k of Object.keys(pending)) delete pending[k]
      try {
        await update($, stats, all => {
          const out = { ...all }
          for (const [m, s] of Object.entries(add)) {
            const prev = out[m] ?? { steps: 0, thinkingMs: 0 }
            out[m] = { steps: prev.steps + s.steps, thinkingMs: prev.thinkingMs + s.thinkingMs }
          }
          return out
        })
      } catch { /* stats are best effort */ }
    }
    return next(e)
  })

  // The status band over the prompt: green IDLE, rainbow WORKING.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const { isWorking, waiting } = await read($, live)
    const frame = await read($, frameAtom)

    // Keep what other mods draw here (the HUD) and put the band beneath it.
    const rest = await next(e)

    // A 3-row frame drawn cell by cell: W wide, H = 3 tall.
    const W = Math.max(12, e.props.bodyColumns)
    const H = 3
    const total = 2 * W + 2 * (H - 2)
    const top = [...'╭' + '─'.repeat(W - 2) + '╮']
    const bottom = [...'╰' + '─'.repeat(W - 2) + '╯']
    const label = isWorking ? 'WORKING' : waiting ? `WAITING · ${waiting}` : 'IDLE'
    const pad = ' '.repeat(Math.max(0, W - 4 - label.length))
    const at = (i: number) => cell(i, total, frame, isWorking, waiting)

    return (
      <Box flexDirection="column">
        {rest}
        <Text>{top.map((ch, c) => <Text key={`c${c}`} color={at(c)}>{ch}</Text>)}</Text>
        <Text>
          <Text color={at(2 * W + 1)}>│</Text>
          <Text bold color={at(Math.floor(W / 2))}> {label}{pad} </Text>
          <Text color={at(W)}>│</Text>
        </Text>
        <Text>{bottom.map((ch, c) => <Text key={`c${c}`} color={at(W + H - 2 + (W - 1 - c))}>{ch}</Text>)}</Text>
      </Box>
    )
  })

  // The same border around every side pane.
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    const inner = await next(e)
    const { Box, Text } = $.ui.resolve(e)
    const { isWorking, waiting } = await read($, live)
    const frame = await read($, frameAtom)

    // The frame drawn cell by cell, one column per side and no padding, so the
    // pane's own tree gets the width less two.
    const W = Math.max(8, e.props.bodyColumns)
    const H = Math.max(3, e.props.scroll.bodyRows)
    const total = 2 * W + 2 * (H - 2)
    const at = (i: number) => cell(i, total, frame, isWorking, waiting)
    const top = [...'╭' + '─'.repeat(W - 2) + '╮']
    const bottom = [...'╰' + '─'.repeat(W - 2) + '╯']
    const rows = Array.from({ length: H - 2 }, (_, r) => r)

    return (
      <Box flexDirection="column" minHeight={H}>
        <Text>{top.map((ch, c) => <Text key={`c${c}`} color={at(c)}>{ch}</Text>)}</Text>
        <Box flexGrow={1}>
          <Box flexDirection="column" width={1}>
            {rows.map(r => <Text key={`r${r}`} color={at(2 * W + (H - 2) + (H - 3 - r))}>│</Text>)}
          </Box>
          <Box flexDirection="column" flexGrow={1}>{inner}</Box>
          <Box flexDirection="column" width={1}>
            {rows.map(r => <Text key={`r${r}`} color={at(W + r)}>│</Text>)}
          </Box>
        </Box>
        <Text>{bottom.map((ch, c) => <Text key={`c${c}`} color={at(W + H - 2 + (W - 1 - c))}>{ch}</Text>)}</Text>
      </Box>
    )
  })

  on('command.run', { command: 'thinking' }, async $ => {
    const all = await read($, stats)
    const rows = Object.entries(all).sort((a, b) => b[1].thinkingMs - a[1].thinkingMs)
    if (rows.length === 0) return { text: 'Nothing recorded yet.' }
    return {
      text: rows.map(([m, s]) => `${m}: ${fmt(s.thinkingMs)} working over ${s.steps} steps`).join('\n'),
    }
  })
}
