import { expect, test } from 'claude-code/testing'

const NOW = Date.parse('2026-11-06T12:00:00Z')

const PANE = {
  plugin: 'quota-panel',
  component: 'Pane',
  requestId: 'quota',
  props: {
    title: 'Quota',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const snapshot = {
  windows: [
    { kind: 'five_hour', percentUsed: 18, resetsAt: '2026-11-06T15:12:00Z' },
    { kind: 'seven_day', percentUsed: 59, resetsAt: '2026-11-10T18:00:00Z' },
  ],
  usd: 0.76,
}

test('the panel draws one card per window, coloured by what is left', async ($, on) => {
  on('state.get', () => ({ value: { value: snapshot, version: 1 } }))
  on('clock.now', () => ({ value: NOW }))
  on('ui.render', () => null as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /Quota \(1\/1\)/ }))?.text).toBe('Quota (1/1)')
  expect(await ui.find({ type: 'Text', text: /82% left/ })).not.toBeNull()
  expect(await ui.find({ type: 'Text', text: /41% left/ })).not.toBeNull()
  await ui.unmount()
})

test('before the first rate-limit reading the panel says it is waiting', async ($, on) => {
  on('state.get', () => ({ value: { value: { windows: [], usd: 1.5 }, version: 1 } }))
  on('clock.now', () => ({ value: NOW }))
  on('ui.render', () => null as never)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /Waiting for the first rate-limit reading/ })).not.toBeNull()
  await ui.unmount()
})

const at = (minsAgo: number, extra: object = {}) => ({ ...snapshot, readAt: NOW - minsAgo * 60000, ...extra })

async function draw(value: unknown, $: any, on: any) {
  on('state.get', () => ({ value: { value, version: 1 } }))
  on('clock.now', () => ({ value: NOW }))
  on('ui.render', () => null as never)
  return $.ui.mount({ ...PANE, surface: 'terminal' })
}

test('a recent reading says how long ago it was taken', async ($, on) => {
  const ui = await draw(at(2), $, on)
  expect(await ui.find({ type: 'Text', text: /read 2m ago/ })).not.toBeNull()
  expect((await ui.find({ type: 'Text', text: /⚠/ })) ?? null).toBeNull()
  await ui.unmount()
})

test('a reading older than ten minutes is flagged as stale', async ($, on) => {
  const ui = await draw(at(15), $, on)
  expect(await ui.find({ type: 'Text', text: /⚠ read 15m ago/ })).not.toBeNull()
  await ui.unmount()
})

test('a window that reset after the reading is called out', async ($, on) => {
  const old = at(400, { windows: [{ kind: 'five_hour', percentUsed: 90, resetsAt: '2026-11-06T11:00:00Z' }] })
  const ui = await draw(old, $, on)
  expect(await ui.find({ type: 'Text', text: /window reset since this reading/ })).not.toBeNull()
  await ui.unmount()
})

test('the bar keeps its width and draws one amber pace tick', async ($, on) => {
  const ui = await draw(snapshot, $, on)
  // 5h window: 3h12m left of 5h = 64% of the time, over a 38-cell bar (width 40 - 2).
  const tick = await ui.find({ type: 'Text', text: '│' })
  expect(tick).not.toBeNull()
  await ui.unmount()
})

test('a window without reset draws no tick', async ($, on) => {
  const ui = await draw({ windows: [{ kind: 'five_hour', percentUsed: 10 }], usd: null }, $, on)
  expect((await ui.find({ type: 'Text', text: '│' })) ?? null).toBeNull()
  await ui.unmount()
})
