# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

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
