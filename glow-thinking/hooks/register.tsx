import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ModelStat } from '../types'

const stats = atom({ plugin: 'glow-thinking', key: 'stats2' } as const, {} as Record<string, ModelStat>)
// What the borders read: whether a turn runs, and the animation frame.
const live = atom({ plugin: 'glow-thinking', key: 'live' } as const, { isWorking: false, frame: 0 })

const IDLE_COLOR = 'success'

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
const cell = (i: number, total: number, frame: number, isWorking: boolean) =>
  isWorking ? hsl((((i / total) * 360 + frame * 22) % 360 + 360) % 360) : IDLE_COLOR

const fmt = (ms: number) => {
  const s = Math.round(ms / 1000)
  return s >= 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`
}

export const register: Register = on => {
  let model = 'unknown'
  let startedAt = 0
  let timer: { cancel: () => void } | null = null
  const pending: Record<string, ModelStat> = {}
  const bump = (m: string): ModelStat => (pending[m] ??= { steps: 0, thinkingMs: 0 })

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'thinking',
      description: 'Show working time per model',
    })
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      startedAt = await $.clock.now()
      await update($, live, s => ({ ...s, isWorking: true }))
      timer?.cancel()
      timer = $.clock.every(180, () => {
        void update($, live, s => ({ ...s, frame: s.frame + 1 }))
      })
    }
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    model = e.model
    bump(model).steps += 1
    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      timer?.cancel()
      timer = null
      bump(model).thinkingMs += (await $.clock.now()) - startedAt
      await update($, live, () => ({ isWorking: false, frame: 0 }))

      const add = { ...pending }
      for (const k of Object.keys(pending)) delete pending[k]
      await update($, stats, all => {
        const out = { ...all }
        for (const [m, s] of Object.entries(add)) {
          const prev = out[m] ?? { steps: 0, thinkingMs: 0 }
          out[m] = { steps: prev.steps + s.steps, thinkingMs: prev.thinkingMs + s.thinkingMs }
        }
        return out
      })
    }
    return next(e)
  })

  // The status band over the prompt: green IDLE, rainbow WORKING.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const { isWorking, frame } = await read($, live)

    // Keep what other mods draw here (the HUD) and put the band beneath it.
    const rest = await next(e)

    // A 3-row frame drawn cell by cell: W wide, H = 3 tall.
    const W = Math.max(12, e.props.bodyColumns)
    const H = 3
    const total = 2 * W + 2 * (H - 2)
    const top = [...'╭' + '─'.repeat(W - 2) + '╮']
    const bottom = [...'╰' + '─'.repeat(W - 2) + '╯']
    const label = isWorking ? 'WORKING' : 'IDLE'
    const pad = ' '.repeat(Math.max(0, W - 4 - label.length))
    const at = (i: number) => cell(i, total, frame, isWorking)

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
    const { isWorking, frame } = await read($, live)

    // The frame drawn cell by cell, one column per side and no padding, so the
    // pane's own tree gets the width less two.
    const W = Math.max(8, e.props.bodyColumns)
    const H = Math.max(3, e.props.scroll.bodyRows)
    const total = 2 * W + 2 * (H - 2)
    const at = (i: number) => cell(i, total, frame, isWorking)
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
