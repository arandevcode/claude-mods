<p align="center">
  <img src="https://raw.githubusercontent.com/arandevcode/claude-mods/main/glow-thinking/images/glow-thinking.png" alt="IDLE and WORKING bands, gradient border" width="460">
  <br>
  <sub><em>IDLE and WORKING bands, gradient border (made-up data)</em></sub>
</p>

# glow-thinking

IDLE / WORKING band above the prompt and a gradient border around every side panel: green at rest, rotating rainbow while Claude works. /thinking shows time per model.

Claude Code mod, mirror of [`opencode-thinking`](https://github.com/arandevcode/opencode-plugins/tree/main/opencode-thinking) for OpenCode. Runs locally, no telemetry, no network.

> 🇪🇸 También disponible en [Español](README-es.md)

> 🔁 Want this on OpenCode? See [opencode-thinking](https://github.com/arandevcode/opencode-plugins/tree/main/opencode-thinking).

## Install

```
/plugin install glow-thinking --marketplace arandevcode/claude-mods
```

From a shell: `claude plugin install glow-thinking --marketplace arandevcode/claude-mods`.

## Notes

- The mod's name sorts before `quota-panel` on purpose: its border wraps every panel, and a panel drawn by a mod that loads earlier would hide it from the border.
- `/thinking` lists working time per model, kept across sessions.
