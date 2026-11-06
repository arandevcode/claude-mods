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
