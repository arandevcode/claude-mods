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
