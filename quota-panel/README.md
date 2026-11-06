<p align="center">
  <img src="https://raw.githubusercontent.com/arandevcode/claude-mods/main/quota-panel/images/quota-panel.png" alt="Quota side panel" width="460">
  <br>
  <sub><em>Quota side panel (made-up data)</em></sub>
</p>

# quota-panel

Side panel with your Claude rate-limit windows (5h / weekly): bars, % left, reset time and pace, plus session cost and toasts at 80/90/95%.

Claude Code mod, mirror of [`opencode-quota-extended`](https://github.com/arandevcode/opencode-plugins/tree/main/opencode-quota-extended) for OpenCode. Runs locally, no telemetry, no network.

> 🇪🇸 También disponible en [Español](README-es.md)

> 🔁 Want this on OpenCode? See [opencode-quota-extended](https://github.com/arandevcode/opencode-plugins/tree/main/opencode-quota-extended).

## Install

```
/plugin install quota-panel --marketplace arandevcode/claude-mods
```

From a shell: `claude plugin install quota-panel --marketplace arandevcode/claude-mods`.

## Notes

- Needs a Claude subscription: the 5h and weekly windows come from Claude Code's own rate-limit data. Without one the panel only shows the session cost.
- Open it with `/quota`; it also opens when a session starts.
