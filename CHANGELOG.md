# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### glow-thinking (0.2.1)

- Fix: `WAITING` never showed when the Stop event arrived before the turn was
  marked finished (the label was dropped while the band still counted the turn as
  running). It is now kept whatever the order; WORKING still wins over WAITING.
- Fix: a live Monitor tool or background shell reports as a `shell` task, so it
  reads `WAITING · TASK`; `MONITOR` is reserved for MCP monitors. Documented.
- Harden: the animation frame lives in its own value so its ticks cannot race a
  state change, state writes retry, and the stats write can no longer block the band.

### quota-panel (0.2.0)

- New: "read Xm ago" under the title; amber `⚠` after 10 minutes without a new
  reading, and a note when a window reset since the reading. A 30 s timer keeps the
  counter moving while nothing else redraws.

### glow-thinking (0.2.0)

- Fix: the band stayed IDLE while subagents were still running after the main
  turn ended. WORKING now covers the main turn and every subagent loop.
- New: `WAITING · MONITOR` / `WAITING · 2 TASKS` / `SCHEDULE` (amber) when the
  turn is over but background tasks, monitors or scheduled wakeups are in flight.
- Docs: new States table, update instructions, and refreshed image and GIF.

## [0.1.1] - 2026-11-08

### quota-panel

- Show a clear "waiting for the first rate-limit reading" message instead of an
  empty panel before the first response of the session reports the 5h and weekly
  windows.

## [0.1.0] - 2026-11-06

### glow-thinking

- First release: IDLE / WORKING band above the prompt and a gradient border
  around every side panel (green at rest, rotating rainbow while Claude works).
- `/thinking` shows working time per model, kept across sessions.

### quota-panel

- First release: side panel with the 5h and weekly rate-limit windows (bars,
  % left, reset time and pace), session cost, and toasts at 80/90/95%.
- `/quota` opens the panel; it also opens when a session starts.

[0.1.1]: https://github.com/arandevcode/claude-mods/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/arandevcode/claude-mods/releases/tag/v0.1.0
