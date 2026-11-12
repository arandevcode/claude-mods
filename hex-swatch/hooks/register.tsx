import type { Register } from 'claude-code'

// The square drawn before each code: the `glyph` option, set when the module loads.
let glyph = '██'
// What a highlighted code block with a color becomes: `squares` redraws it as plain rows with the squares, `keep` leaves it as it is.
let isCodeRedrawn = true

// #rgb (needs an a-f letter, so issue refs like #123 are skipped), #rrggbb, #rrggbbaa.
// Group 1 is the character before '#': a word char or '&' means it is not a color.
const HEX = /(^|[^\w&#])(#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))(?![0-9a-zA-Z])/g

const isColor = (hex: string) => hex.length !== 4 || /[a-fA-F]/.test(hex)

const hasColor = (s: string): boolean => {
  HEX.lastIndex = 0
  for (let m = HEX.exec(s); m; m = HEX.exec(s)) {
    if (isColor(m[2] ?? '')) return true
  }
  return false
}

// A color the terminal draws: #rgb stays, #rrggbbaa drops its alpha.
const solid = (hex: string) => (hex.length === 9 ? hex.slice(0, 7) : hex)

// A node of a render tree, as plain data.
type Node = string | { type: string; props?: Record<string, unknown>; children?: Node[] }

const swatch = (hex: string): Node => ({ type: 'Text', props: { color: solid(hex) }, children: [glyph] })

// "see #ff0000 now" becomes ['see ', ■, ' #ff0000 now']: the square sits right before its code.
const pieces = (s: string): Node[] => {
  const out: Node[] = []
  let from = 0
  HEX.lastIndex = 0
  for (let m = HEX.exec(s); m; m = HEX.exec(s)) {
    const hex = m[2] ?? ''
    if (!isColor(hex)) continue
    const start = m.index + (m[1] ?? '').length
    out.push(s.slice(from, start), swatch(hex), ' ')
    from = start
  }
  out.push(s.slice(from))
  return out.filter(p => p !== '')
}

// Columns a node gains from the squares: the square and its space before each code, over the widest line.
const gain = (n: Node): number => {
  if (typeof n === 'string') return countColors(n) * (glyph.length + 1)
  const parts = (n.children ?? []).map(gain)
  return n.type === 'Box' && n.props?.flexDirection === 'column' ? Math.max(0, ...parts) : parts.reduce((a, w) => a + w, 0)
}

type Element = Exclude<Node, string>
const isElement = (n: Node): n is Element => typeof n !== 'string'

// A table another mod drew: a Box of rows, each row a Box of cells with a width of their own.
const isCell = (n: Node) => isElement(n) && n.type === 'Box' && typeof n.props?.width === 'number'
const isRow = (n: Node) => isElement(n) && n.type === 'Box' && (n.children?.length ?? 0) > 0 && (n.children ?? []).every(isCell)

// The cells size themselves to the text they had, so a square would cut the code short: widen each column
// by what its widest cell gains, in every row alike so the columns stay aligned.
const widenColumns = (box: Element, original: Node[], marked: Node[]): Node[] => {
  const columns: number[] = []
  for (const row of original.filter(isRow)) {
    ;(row as Element).children?.forEach((cell, i) => (columns[i] = Math.max(columns[i] ?? 0, gain(cell))))
  }
  if (columns.every(w => w === 0)) return marked
  return marked.map(child => {
    if (!isRow(child)) return child
    const row = child as Element
    return {
      ...row,
      children: (row.children ?? []).map((cell, i): Node => {
        const c = cell as Element
        const extra = columns[i] ?? 0
        const props = c.props ?? {}
        if (extra === 0) return cell
        // A fixed column grows by the gain; a fluid one (width 0) takes a larger share of the row.
        return (props.width as number) > 0
          ? { ...c, props: { ...props, width: (props.width as number) + extra } }
          : { ...c, props: { ...props, flexGrow: Number(props.flexGrow ?? 0) + extra } }
      }),
    }
  })
}

// Walks a tree another mod (or the engine) drew and puts a square before every hex code in its text.
// Anything it does not know (Button, Markdown with links, ...) is left as it is.
const mark = (node: Node, isInText: boolean): Node => {
  if (typeof node === 'string') return node
  // Markdown leaves (a fence, a paragraph) hold their text in a prop: redraw the ones with a color, but not
  // those whose links another mod answers (`press`), which would lose their handler.
  if (node.type === 'Markdown' && !('press' in node) && typeof node.props?.text === 'string' && hasColor(node.props.text)) {
    return own(node.props.text)
  }
  // The same for a code block, which loses its highlighting.
  if (node.type === 'Code' && isCodeRedrawn && node.props?.format !== 'diff' && typeof node.props?.source === 'string' && hasColor(node.props.source)) {
    return codeRows(node.props.source)
  }
  if ((node.type !== 'Box' && node.type !== 'Text') || node.children === undefined) return node
  const inText = node.type === 'Text'
  const children: Node[] = []
  for (const child of node.children) {
    if (typeof child === 'string') {
      if (!hasColor(child)) children.push(child)
      else if (inText) children.push(...pieces(child))
      else children.push({ type: 'Text', children: pieces(child) })
    } else {
      children.push(mark(child, inText || isInText))
    }
  }
  return { ...node, children: node.type === 'Box' && node.children.some(isRow) ? widenColumns(node, node.children, children) : children }
}

// Markup a line drawn as plain rows no longer has: bold, inline code and links keep their text.
const strip = (s: string) =>
  s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

const countColors = (s: string): number => {
  let n = 0
  HEX.lastIndex = 0
  for (let m = HEX.exec(s); m; m = HEX.exec(s)) if (isColor(m[2] ?? '')) n += 1
  return n
}

// Columns a line takes once drawn: its text plus the square and space before each code.
const visible = (s: string) => strip(s).length + countColors(s) * (glyph.length + 1)

// One line's inline markup as nodes: **bold** stays bold, `code` and [links](url) keep their text.
const inline = (s: string): Node[] => {
  const out: Node[] = []
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\([^)]+\)/g
  let from = 0
  for (let m = re.exec(s); m; m = re.exec(s)) {
    out.push(...pieces(s.slice(from, m.index)))
    if (m[1] !== undefined) out.push({ type: 'Text', props: { bold: true }, children: pieces(m[1]) })
    else out.push(...pieces(m[2] ?? m[3] ?? ''))
    from = m.index + m[0].length
  }
  out.push(...pieces(s.slice(from)))
  return out
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l)
const isTableRule = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l)

// A markdown table as aligned rows, so the codes in its cells can carry a square.
const table = (lines: string[]): Node => {
  const rows = lines.filter(l => !isTableRule(l)).map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()))
  const widths: number[] = []
  for (const r of rows) r.forEach((c, i) => (widths[i] = Math.max(widths[i] ?? 0, visible(c))))
  const total = widths.reduce((a, w) => a + w, 0) + 3 * Math.max(0, widths.length - 1)
  const out: Node[] = rows.map((r, ri): Node => ({
    type: 'Text',
    props: ri === 0 ? { bold: true } : {},
    children: r.flatMap((c, i): Node[] => [
      ...inline(c),
      ...(i < r.length - 1 ? [' '.repeat(Math.max(0, (widths[i] ?? 0) - visible(c))) + ' │ '] : []),
    ]),
  }))
  if (out.length > 1) out.splice(1, 0, { type: 'Text', props: { dimColor: true }, children: ['─'.repeat(total)] })
  return { type: 'Box', props: { flexDirection: 'column' }, children: out }
}

// Source code as plain rows, one per line, with the squares.
const codeRows = (source: string): Node => ({
  type: 'Box',
  props: { flexDirection: 'column' },
  children: source.replace(/\n$/, '').split('\n').map((l): Node => ({ type: 'Text', children: l === '' ? [' '] : pieces(l) })),
})

// A block that holds a color, as rows: headings, lists, quotes and tables keep their shape.
const rowsOf = (lines: string[]): Node[] => {
  const out: Node[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i] ?? ''
    if (isTableRow(l)) {
      const run: string[] = []
      while (i < lines.length && isTableRow(lines[i] ?? '')) run.push(lines[i++] ?? '')
      i -= 1
      out.push(table(run))
      continue
    }
    const heading = /^#{1,6}\s+(.*)$/.exec(l)
    const item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(l)
    const quote = /^>\s?(.*)$/.exec(l)
    if (heading) out.push({ type: 'Text', props: { bold: true }, children: inline(heading[1] ?? '') })
    else if (item) {
      const mark = /^\d/.test(item[2] ?? '') ? `${item[2]} ` : '• '
      out.push({ type: 'Text', children: [(item[1] ?? '') + mark, ...inline(item[3] ?? '')] })
    } else if (quote) out.push({ type: 'Text', props: { dimColor: true }, children: ['▎ ', ...inline(quote[1] ?? '')] })
    else out.push({ type: 'Text', children: inline(l) })
  }
  return out
}

const isMarker = (line: string) => /^\s*(```|~~~)/.test(line)

type Block = { text: string; hasColor: boolean; isFence: boolean }

// Blank lines outside a fence split the reply into blocks; a fence is one block.
const blocks = (text: string): Block[] => {
  const out: Block[] = []
  let cur: string[] = []
  let isFence = false
  const flush = () => {
    if (cur.length > 0) {
      const t = cur.join('\n')
      out.push({ text: t, hasColor: hasColor(t), isFence: isMarker(cur[0] ?? '') })
    }
    cur = []
  }
  for (const line of text.split('\n')) {
    const isMark = isMarker(line)
    if (!isFence && isMark) flush()
    if (!isFence && !isMark && line.trim() === '') {
      flush()
      continue
    }
    cur.push(line)
    if (isMark) {
      if (isFence) flush()
      isFence = !isFence
    }
  }
  flush()
  return out
}

// The reply drawn by this mod alone: used where nothing above drew it (the engine's own markdown can't be
// edited), so blocks with a color become plain rows with squares and the others stay markdown.
const own = (text: string): Node => ({
  type: 'Box',
  props: { flexDirection: 'column', gap: 1 },
  children: blocks(text).map((b): Node => {
    if (!b.hasColor) return { type: 'Markdown', props: { text: b.text } }
    const lines = b.text.split('\n').filter(l => !(b.isFence && isMarker(l)))
    if (b.isFence) {
      return {
        type: 'Box',
        props: { flexDirection: 'column' },
        children: lines.map((l): Node => ({ type: 'Text', props: { dimColor: true }, children: pieces(l) })),
      }
    }
    return { type: 'Box', props: { flexDirection: 'column' }, children: rowsOf(lines) }
  }),
})

export const register: Register = (on, options) => {
  if (typeof options.glyph === 'string' && options.glyph !== '') glyph = options.glyph
  isCodeRedrawn = options.codeBlocks !== 'keep'

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const { text, isFirstOfReply, isSummary } = e.props
    if (isSummary || !hasColor(text)) return next(e)

    const drawn = (await next(e)) as unknown as Node
    // Another mod drew it as plain data: keep its look and add the squares.
    if (typeof drawn !== 'string' && drawn.type !== 'engine') {
      return mark(drawn, false) as never
    }

    // The engine's own drawing: redraw it here, with its bullet.
    return {
      type: 'Box',
      props: { flexDirection: 'row' },
      children: [{ type: 'Text', children: [isFirstOfReply ? '● ' : '  '] }, own(text)],
    } as never
  })
}
