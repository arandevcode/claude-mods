import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Snapshot } from '../types'
import { gaugeParts, paceLinePercent } from './pace'

const PANE = 'quota'
const snapshot = atom({ plugin: 'quota-panel', key: 'snapshot' } as const, null)
// Bumped every half minute so the "read Xm ago" line keeps counting while nothing else redraws.
const tick = atom({ plugin: 'quota-panel', key: 'tick' } as const, 0)

// Minutes after which a reading is flagged as stale: the limits only refresh when a response reports them.
const STALE_MIN = 10

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

// How long ago the last rate-limit reading was taken.
const ago = (mins: number) => (mins < 1 ? 'just now' : `${dur(mins)} ago`)

export const register: Register = on => {
  const announced: Record<string, number> = {}

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'quota', description: 'Open the quota side panel' })
    void $.ui.open({ id: PANE, title: 'Quota' })
    $.ui.status(undefined)
    $.clock.every(30000, () => {
      void update($, tick, n => n + 1).catch(() => {})
    })
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
      readAt: await $.clock.now(),
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
    await read($, tick)
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
          {snap && snap.readAt !== undefined ? (() => {
            const age = (now - snap.readAt) / 60000
            const stale = age >= STALE_MIN
            return (
              <Text color={stale ? 'warning' : 'inactive'}>
                {stale ? `⚠ read ${ago(age)} · send a message to refresh` : `read ${ago(age)}`}
              </Text>
            )
          })() : null}
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
            // The bar shows quota LEFT, so the tick (time left) goes straight, no inversion.
            const bar = gaugeParts(left, width, paceLinePercent(w, now))

            let pace = ''
            let paceColor = 'inactive'
            if (span && remain !== null) {
              const elapsed = ((span.mins - remain) / span.mins) * 100
              const exact = elapsed - w.percentUsed
              const diff = Math.round(exact)
              // The time shown is the gap to the pace line (the same share of the window,
              // expressed as time), not the time left until the window resets.
              const gap = dur((Math.abs(exact) / 100) * span.mins)
              if (Math.abs(diff) < 2) pace = 'on pace'
              else if (diff > 0) {
                pace = `margin +${diff}% · ${gap}`
                paceColor = 'success'
              } else {
                pace = `ahead ${diff}% · ${gap}`
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
                <Box>
                  {bar.before ? <Text color={c}>{bar.before}</Text> : null}
                  {bar.tick ? <Text color="text">{bar.tick}</Text> : null}
                  {bar.after ? <Text color={c}>{bar.after}</Text> : null}
                </Box>
                <Row l={`${left}% left`} r={`${used}% used`} lc={c} />
                {pace ? <Row l="" r={pace} rc={paceColor} /> : null}
                {remain !== null && remain < 0 ? (
                  <Text color="warning">window reset since this reading · refreshes on your next message</Text>
                ) : null}
              </Box>
            )
          })}
        </Box>
      </Box>
    )
  })
}
