import { expect, test } from 'claude-code/testing'
import { gaugeParts, paceLinePercent } from './pace'

const NOW = Date.parse('2026-11-06T12:00:00Z')
const in_ = (mins: number) => new Date(NOW + mins * 60000).toISOString()

test('5h with 2h left is 40%', async () => {
  expect(paceLinePercent({ kind: 'five_hour', resetsAt: in_(120) }, NOW)).toBe(40)
})
test('weekly with 4d 8h left is ~62%', async () => {
  const p = paceLinePercent({ kind: 'seven_day', resetsAt: in_(4 * 1440 + 480) }, NOW)!
  expect(Math.round(p)).toBe(62)
})
test('clamps to 0 and 100', async () => {
  expect(paceLinePercent({ kind: 'five_hour', resetsAt: in_(-30) }, NOW)).toBe(0)
  expect(paceLinePercent({ kind: 'five_hour', resetsAt: in_(900) }, NOW)).toBe(100)
})
test('null without reset or with unknown duration', async () => {
  expect(paceLinePercent({ kind: 'five_hour' }, NOW)).toBeNull()
  expect(paceLinePercent({ kind: 'mystery', resetsAt: in_(60) }, NOW)).toBeNull()
})
test('the tick replaces one cell and keeps the width', async () => {
  for (const m of [0, 40, 100]) {
    const g = gaugeParts(82, 38, m)
    expect(g.before.length + g.tick.length + g.after.length).toBe(38)
    expect(g.tick).toBe('│')
  }
  expect(gaugeParts(82, 38, 0).before).toBe('')
  expect(gaugeParts(82, 38, 100).after).toBe('')
  expect(gaugeParts(50, 10, null).tick).toBe('')
})
