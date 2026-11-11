<p align="center">
  <img src="https://raw.githubusercontent.com/arandevcode/claude-mods/main/quota-panel/images/quota-panel.gif" alt="Panel lateral de cuota" width="460">
  <br>
  <sub><em>Lectura reciente, marcada como caducada a los 10 minutos y refrescada después (datos inventados)</em></sub>
</p>

# quota-panel

Panel lateral con tus ventanas de límite de Claude (5h / semanal): barras, % restante, hora de reinicio y ritmo, más el coste de la sesión y avisos al 80/90/95 %.

Mod de Claude Code, espejo de [`opencode-quota-extended`](https://github.com/arandevcode/opencode-plugins/tree/main/opencode-quota-extended) para OpenCode. Funciona en local, sin telemetría y sin red.

> 🇬🇧 Also available in [English](README.md)

> 🔁 ¿Quieres esto en OpenCode? Mira [opencode-quota-extended](https://github.com/arandevcode/opencode-plugins/tree/main/opencode-quota-extended).

## Instalar

```
/plugin install quota-panel --marketplace arandevcode/claude-mods
```

Desde una shell: `claude plugin install quota-panel --marketplace arandevcode/claude-mods`.

## Notas

- Necesita una suscripción de Claude: las ventanas de 5h y semanal salen de los datos de límite de Claude Code. Sin ella el panel solo muestra el coste de la sesión.
- Se abre con `/quota`; también se abre al iniciar la sesión.
- Bajo el título indica hace cuánto se leyeron los datos (`read 3m ago`). Los límites solo se refrescan cuando una respuesta los trae, así que a los 10 minutos se pone ámbar (`⚠ read 14m ago · send a message to refresh`), y una ventana que se reseteó desde la lectura se marca en vez de mostrarse como vigente.
- Cada barra lleva un tick ámbar de una celda `│` que marca la parte de la ventana que queda (tiempo restante). Relleno a la izquierda del tick = vas con margen; a la derecha = gastas más rápido que el reloj. Las ventanas sin hora de reinicio no muestran tick.
