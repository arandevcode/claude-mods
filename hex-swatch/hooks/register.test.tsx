import { expect, test } from 'claude-code/testing'

const MSG = (text: string) =>
  ({
    plugin: 'hex-swatch',
    surface: 'terminal',
    component: 'AssistantMessage',
    props: { text, isFirstOfReply: true },
  }) as const

test('a tree another mod drew gets a square before each hex code', async ($, on) => {
  // Stands for the mod above: it draws the reply itself, the hex code in its own Text.
  on('ui.render', ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text color="cyan">#ffc800</Text>
        <Text> and #123 and #0af</Text>
      </Box>
    )
  })
  const ui = await $.ui.mount({ ...MSG('a #ffc800 b #123 c #0af'), requestId: 'm1' })

  expect((await ui.find({ type: 'Text', text: /██ #ffc800/ }))?.text).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /██ #0af/ }))?.text).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /██ #123/ })).toBeUndefined()
  await ui.unmount()
})

test('a reply with no color is left to the engine', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>plain</Text>
  })
  const ui = await $.ui.mount({ ...MSG('no colors here, issue #123'), requestId: 'm2' })

  expect((await ui.find({ type: 'Text', text: /plain/ }))?.text).toBe('plain')
  await ui.unmount()
})

// Nothing above or beneath draws the reply: the mod draws it, so structure must survive.
test('with nothing else drawing it, a table keeps its columns and every code gets a square', async ($, on) => {
  const text = '## Colors\n\n| Token | Value |\n| --- | --- |\n| --brand | **#ff7f2a** |\n| --ink | `#8a1067` |'
  const ui = await $.ui.mount({ ...MSG(text), requestId: 'f1' })

  expect((await ui.find({ type: 'Text', text: /--brand.*│.*██ #ff7f2a/ }))?.text).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /--ink.*│.*██ #8a1067/ }))?.text).toBeDefined()
  // The markdown marks are gone, the rule under the header is there.
  expect(await ui.find({ type: 'Text', text: /\*\*|`|\|/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^─+$/ })).toBeDefined()
  await ui.unmount()
})

test('lists and quotes keep their shape; a block with no color stays markdown', async ($, on) => {
  const text = '- base #ff7f2a\n- other\n\nPlain paragraph with no color.\n\n> note #0af'
  const ui = await $.ui.mount({ ...MSG(text), requestId: 'f2' })

  expect((await ui.find({ type: 'Text', text: /^• base ██ #ff7f2a/ }))?.text).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /^▎ note ██ #0af/ }))?.text).toBeDefined()
  await ui.unmount()
})

test('the glyph option changes the square', { options: { glyph: '●' } }, async ($, on) => {
  const ui = await $.ui.mount({ ...MSG('a #ffc800'), requestId: 'f3' })

  expect((await ui.find({ type: 'Text', text: /● #ffc800/ }))?.text).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /██/ })).toBeUndefined()
  await ui.unmount()
})

test('a table another mod sized to its text is widened by the square, in every row alike', async ($, on) => {
  // Stands for a skin: fixed-width cells, as wide as the text they hold.
  on('ui.render', ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Box key="h0" width={9} flexShrink={0}><Text>Hue</Text></Box>
          <Box key="h1" width={9} flexShrink={0}><Text>Base</Text></Box>
        </Box>
        <Box flexDirection="row">
          <Box key="c0" width={9} flexShrink={0}><Text>Red</Text></Box>
          <Box key="c1" width={9} flexShrink={0}><Text>#ff3b30</Text></Box>
        </Box>
      </Box>
    )
  })
  const ui = await $.ui.mount({ ...MSG('| Hue | Base |\n| Red | #ff3b30 |'), requestId: 't1' })

  // The glyph is two cells and a space: every cell of the second column gains three, the first none.
  expect((await ui.find({ key: 'c1' }))?.props.width).toBe(12)
  expect((await ui.find({ key: 'h1' }))?.props.width).toBe(12)
  expect((await ui.find({ key: 'c0' }))?.props.width).toBe(9)
  await ui.unmount()
})

test('a fence or paragraph another mod drew as markdown gets its squares', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Box, Markdown } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Markdown text={'```\n    #f62828   #28f6f6\n```'} />
        <Markdown text="#ffffff → #dfdfdf" />
        <Markdown text="no color here" />
      </Box>
    )
  })
  const ui = await $.ui.mount({ ...MSG('x #f62828 #ffffff'), requestId: 'k1' })

  expect((await ui.find({ type: 'Text', text: /██ #f62828/ }))?.text).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /██ #dfdfdf/ }))?.text).toBeDefined()
  // A leaf with no color is untouched.
  expect(await ui.find({ type: 'Markdown', text: /no color here/ })).toBeDefined()
  await ui.unmount()
})

test('a highlighted code block with a color is redrawn, unless codeBlocks is keep', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Code } = $.ui.resolve(e)
    return <Code source={'a {\n  color: #ff7f2a;\n}'} language="css" />
  })
  const ui = await $.ui.mount({ ...MSG('x #ff7f2a'), requestId: 'k2' })

  expect((await ui.find({ type: 'Text', text: /color: ██ #ff7f2a/ }))?.text).toBeDefined()
  expect(await ui.find({ type: 'Code' })).toBeUndefined()
  await ui.unmount()
})

test('codeBlocks keep leaves the highlighted block as it is', { options: { codeBlocks: 'keep' } }, async ($, on) => {
  on('ui.render', ($, e) => {
    const { Code } = $.ui.resolve(e)
    return <Code source="a { color: #ff7f2a }" language="css" />
  })
  const ui = await $.ui.mount({ ...MSG('x #ff7f2a'), requestId: 'k3' })

  expect(await ui.find({ type: 'Code' })).toBeDefined()
  await ui.unmount()
})
