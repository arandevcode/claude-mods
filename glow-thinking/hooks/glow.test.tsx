import { expect, test } from 'claude-code/testing'

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
  on('state.get', () => ({ value: { value: { isWorking: false, frame: 0 }, version: 1 } }))
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
  on('state.get', () => ({ value: { value: { isWorking: true, frame: 3 }, version: 1 } }))
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
  let live: any = { isWorking: false, frame: 0, waiting: '' }
  let version = 1
  on('state.get', () => ({ value: { value: live, version } }))
  on('state.set', (_$, e: any) => {
    live = e.value
    version += 1
    return { value: e.value }
  })
  const isWorking = async () => live.isWorking
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
  on('state.get', () => ({ value: { value: { isWorking: false, frame: 0, waiting: 'MONITOR' }, version: 1 } }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /WAITING · MONITOR/ })).not.toBeNull()
  await ui.unmount()
})
