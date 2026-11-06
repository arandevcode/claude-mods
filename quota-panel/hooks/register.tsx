import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Snapshot } from '../types'

const PANE = 'quota'
const snapshot = atom({ plugin: 'quota-panel', key: 'snapshot' } as const, null)

const THRESHOLDS = [80, 90, 95]
// Window length in minutes, to work out the pace like the opencode2 sidebar.
const SPAN: Record<string, { label: string; mins: number }> = {
  five_hour: { label: '5h', mins: 300 },
  seven_day: { label: 'Weekly', mins: 10080 },
}

// Same rule as the opencode2 sidebar: colour by what is LEFT.
const light = (left: number) => (left >= 50 ? 'success' : left >= 25 ? 'warning' : 'error')

const dur = (mins: number) => {
  const m = Math.max(0, Math.round(mins))
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  const r = m % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${String(r).padStart(2, '0')}m`
  return `${r}m`
}

const when = (iso: string) => {
  const d = new Date(iso)
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const sameDay = d.toDateString() === new Date().toDateString()
  const month = d.toLocaleString('en', { month: 'short' })
  return sameDay ? hm : `${d.getDate()} ${month} ${hm}`
}

export const register: Register = on => {
  const announced: Record<string, number> = {}

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'quota', description: 'Open the quota side panel' })
    void $.ui.open({ id: PANE, title: 'Quota' })
    $.ui.status(undefined)
    return next(e)
  })

  on('command.run', { command: 'quota' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Quota' })
    return { text: 'Quota panel opened.' }
  })

  on('session.measure', async ($, e, next) => {
    const snap: Snapshot = {
      windows: e.rateLimits.map(w => ({
        kind: w.kind,
        percentUsed: w.percentUsed,
        resetsAt: w.resetsAt,
      })),
      usd: e.cost ? e.cost.usd : null,
    }
    await update($, snapshot, () => snap)
    $.ui.status(undefined)

    for (const w of snap.windows) {
      const crossed = THRESHOLDS.filter(t => w.percentUsed >= t).pop() ?? 0
      if (crossed > (announced[w.kind] ?? 0)) {
        $.ui.toast(`${SPAN[w.kind]?.label ?? w.kind} quota at ${Math.floor(w.percentUsed)}%`)
      }
      announced[w.kind] = crossed
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const snap = await read($, snapshot)
    const width = Math.max(20, e.props.bodyColumns - 2)
    const now = await $.clock.now()
    const wins = snap ? snap.windows : []

    const Row = (p: { l: string; r?: string; lc?: string; rc?: string; bold?: boolean }) => (
      <Box justifyContent="space-between" width={width}>
        <Text color={p.lc ?? 'text'} bold={p.bold}>{p.l}</Text>
        <Text color={p.rc ?? 'inactive'}>{p.r ?? ''}</Text>
      </Box>
    )

    return (
      <Box flexDirection="column">
        <Text bold>Quota ({wins.length > 0 ? 1 : 0}/1)</Text>
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text bold>Claude</Text>
            {snap && snap.usd !== null ? (
              <Text color="suggestion"> ${snap.usd.toFixed(2)} this session</Text>
            ) : null}
          </Box>
          {wins.length === 0 ? (
            <Text color="inactive">Waiting for the first rate-limit reading (needs a Claude subscription).</Text>
          ) : null}
          {wins.map(w => {
            const used = Math.round(w.percentUsed)
            const left = 100 - used
            const c = light(left)
            const span = SPAN[w.kind]
            const label = span?.label ?? w.kind
            const remain = w.resetsAt ? (Date.parse(w.resetsAt) - now) / 60000 : null
            const filled = Math.max(0, Math.min(width, Math.round((left / 100) * width)))

            let pace = ''
            let paceColor = 'inactive'
            if (span && remain !== null) {
              const elapsed = ((span.mins - remain) / span.mins) * 100
              const diff = Math.round(elapsed - w.percentUsed)
              if (Math.abs(diff) < 2) pace = 'on pace'
              else if (diff > 0) {
                pace = `margin +${diff}% · ${dur(remain)}`
                paceColor = 'success'
              } else {
                pace = `ahead ${diff}% · ${dur(remain)}`
                paceColor = 'error'
              }
            }

            return (
              <Box key={w.kind} flexDirection="column" marginTop={1}>
                <Row
                  l={label}
                  r={remain !== null && w.resetsAt ? `in ${dur(remain)} (${when(w.resetsAt)})` : '—'}
                  rc={c === 'error' ? 'error' : 'inactive'}
                />
                <Text color={c}>{'▓'.repeat(filled)}{'░'.repeat(width - filled)}</Text>
                <Row l={`${left}% left`} r={`${used}% used`} lc={c} />
                {pace ? <Row l="" r={pace} rc={paceColor} /> : null}
              </Box>
            )
          })}
        </Box>
      </Box>
    )
  })
}
