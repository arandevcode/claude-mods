import { expect, test } from 'claude-code/testing'


// A keyed state store, one value per key (the engine does the compare-and-set).
function store(on: any, initial: Record<string, unknown> = {}) {
  const data: Record<string, { value: unknown; version: number }> = {}
  const get = (k: string) => (data[k] ??= { value: initial[k] ?? (k === 'live' ? { isWorking: false, waiting: '' } : k === 'frame' ? 0 : {}), version: 1 })
  on('state.get', (_$: any, e: any) => ({ value: { value: get(e.key).value, version: get(e.key).version } }))
  on('state.set', (_$: any, e: any) => {
    const cur = get(e.key)
    data[e.key] = { value: e.value, version: cur.version + 1 }
    return { value: e.value }
  })
  return { live: () => get('live').value as any }
}

const BAND = {
  plugin: 'glow-thinking',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 40,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

test('the band says IDLE at rest', async ($, on) => {
  store(on, { live: { isWorking: false, waiting: '' }, frame: 0 })
  // The engine's own drawing, beneath the mod: the band keeps it.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /IDLE/ })).not.toBeNull()
  await ui.unmount()
})

test('the band says WORKING while a turn runs', async ($, on) => {
  store(on, { live: { isWorking: true, waiting: '' }, frame: 3 })
  // The engine's own drawing, beneath the mod: the band keeps it.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /WORKING/ })).not.toBeNull()
  await ui.unmount()
})

test('WORKING stays on while a subagent runs after the main turn ends', async ($, on) => {
  const st = store(on)
  const isWorking = async () => st.live().isWorking
  on('clock.now', () => ({ value: 1000 }))
  on('clock.every', () => ({ value: { id: 'c1' } }))
  on('turn.start', (_$, e) => e)
  on('turn.complete', (_$, e) => ({ ...e, text: '' }))
  await $.turn.start({ text: 'x', turnId: 'm' })
  await $.turn.start({ text: 'y', turnId: 'a', agentId: 'sub1' })
  await $.turn.complete({ turnId: 'm', answer: '' } as any)
  expect(await isWorking()).toBe(true)
  await $.turn.complete({ turnId: 'a', agentId: 'sub1', answer: '' } as any)
  expect(await isWorking()).toBe(false)
})

test('the band says WAITING for a monitor once the turn ends', async ($, on) => {
  store(on, { live: { isWorking: false, waiting: 'MONITOR' }, frame: 0 })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /WAITING · MONITOR/ })).not.toBeNull()
  await ui.unmount()
})

test('WAITING survives Stop landing before turn.complete (a live Monitor shows as a shell task)', async ($, on) => {
  const st = store(on)
  on('clock.now', () => ({ value: 1000 }))
  on('clock.every', () => ({ value: { id: 'c1' } }))
  on('turn.start', (_$, e) => e)
  on('turn.complete', (_$, e) => ({ ...e, text: '' }))
  on('classic.Stop', () => ({}))
  await $.turn.start({ text: 'x', turnId: 'm' })
  expect(st.live().isWorking).toBe(true)
  // Stop first, while the band still counts the turn as running.
  await ($ as any).classic.Stop({
    stop_hook_active: false,
    background_tasks: [{ id: 'mon', type: 'shell', status: 'running', description: 'watch repo' }],
    session_crons: [],
  })
  expect(st.live().waiting).toBe('TASK')
  await $.turn.complete({ turnId: 'm', answer: '' } as any)
  expect(st.live().isWorking).toBe(false)
  expect(st.live().waiting).toBe('TASK')
})

test('a wake-up turn that ends without Stop keeps WAITING', async ($, on) => {
  const st = store(on)
  on('clock.now', () => ({ value: 1000 }))
  on('clock.every', () => ({ value: { id: 'c1' } }))
  on('turn.start', (_$, e) => e)
  on('turn.complete', (_$, e) => ({ ...e, text: '' }))
  on('classic.Stop', () => ({}))
  await $.turn.start({ text: 'x', turnId: 'm' })
  await ($ as any).classic.Stop({ background_tasks: [{ id: 'mon', type: 'shell', status: 'running', description: 'w' }], session_crons: [] })
  await $.turn.complete({ turnId: 'm', answer: '' } as any)
  await $.turn.start({ text: 'notification', turnId: 'n' })
  await $.turn.complete({ turnId: 'n', answer: '' } as any)
  expect(st.live().waiting).toBe('TASK')
})
