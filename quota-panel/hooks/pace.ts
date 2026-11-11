const MIN_MS = 60 * 1000

// Window length in minutes for the windows Claude reports; unknown kinds have no pace.
export const WINDOW_MINS: Record<string, number> = {
  five_hour: 300,
  seven_day: 10080,
  monthly: 43200,
}

export const windowMs = (kind: string): number | null => {
  const mins = WINDOW_MINS[kind]
  return mins === undefined ? null : mins * MIN_MS
}

/**
 * Share of the window that is still ahead, 0 (about to reset) to 100 (just started).
 * It is where the pace tick sits on a "% left" bar: a fill reaching exactly there is on pace.
 * null when the window has no reset time or its length is unknown.
 */
export function paceLinePercent(
  w: { kind: string; resetsAt?: string },
  now: number,
): number | null {
  const duration = windowMs(w.kind)
  const resetAt = w.resetsAt ? Date.parse(w.resetsAt) : Number.NaN
  if (duration === null || !Number.isFinite(resetAt)) return null
  return Math.max(0, Math.min(100, ((resetAt - now) / duration) * 100))
}

/**
 * Splits a bar of `width` cells into text before the tick, the tick cell, and text after,
 * keeping the total width. `left` is the quota remaining (fill grows from the left).
 * The tick replaces one cell; it never adds a column. null marker => no tick.
 */
export function gaugeParts(left: number, width: number, marker: number | null) {
  const filled = Math.max(0, Math.min(width, Math.round((left / 100) * width)))
  const cells = Array.from({ length: width }, (_, i) => (i < filled ? '▓' : '░'))
  if (marker === null || width < 1) return { before: cells.join(''), tick: '', after: '' }
  const at = Math.min(width - 1, Math.max(0, Math.round((marker / 100) * (width - 1))))
  return { before: cells.slice(0, at).join(''), tick: '│', after: cells.slice(at + 1).join('') }
}
