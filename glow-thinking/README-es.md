<p align="center">
  <img src="https://raw.githubusercontent.com/arandevcode/claude-mods/main/glow-thinking/images/glow-thinking.gif" alt="Bandas WORKING, WAITING e IDLE con borde en degradado" width="460">
  <br>
  <sub><em>WORKING → WAITING → IDLE en una sesión real (todo lo que no es el plugin está desenfocado)</em></sub>
</p>

# glow-thinking

Una banda de estado sobre el prompt y un borde en degradado alrededor de cada panel lateral que te dicen de un vistazo si Claude está ocupado, esperando trabajo en background o libre. `/thinking` muestra el tiempo por modelo.

Mod de Claude Code, espejo de [`opencode-thinking`](https://github.com/arandevcode/opencode-plugins/tree/main/opencode-thinking) para OpenCode. Funciona en local, sin telemetría y sin red.

> 🇬🇧 Also available in [English](README.md)

> 🔁 ¿Quieres esto en OpenCode? Mira [opencode-thinking](https://github.com/arandevcode/opencode-plugins/tree/main/opencode-thinking).

## Estados

| Banda | Borde | Significado |
| --- | --- | --- |
| `WORKING` | arcoíris giratorio | El turno principal **o cualquier subagente** está en marcha. |
| `WAITING · MONITOR` / `TASK` / `SCHEDULE` | ámbar | El turno terminó pero sigue vivo un monitor, una tarea en background o un despertar programado (con recuento, p. ej. `WAITING · 2 TASKS`). |
| `IDLE` | verde | No hay nada en marcha ni pendiente. |

Un shell en background, incluida la herramienta Monitor, aparece como `TASK`; `MONITOR` es para monitores MCP. Cuando una tarea en background termina, despierta la sesión con un turno nuevo: la banda vuelve a `WORKING` y luego a `IDLE`.

<p align="center">
  <img src="https://raw.githubusercontent.com/arandevcode/claude-mods/main/glow-thinking/images/glow-thinking-states.png" alt="Los tres estados juntos" width="460">
</p>

## Instalar

```
/plugin install glow-thinking --marketplace arandevcode/claude-mods
```

Desde una shell: `claude plugin install glow-thinking --marketplace arandevcode/claude-mods`.

## Actualizar

Ejecuta `/plugin update glow-thinking` y **reinicia la sesión**: un mod ya cargado no se sustituye en una sesión en marcha (`/reload-plugins` no basta). Si el plugin está instalado en más de un ámbito, actualiza cada uno, p. ej. `claude plugin update glow-thinking@arandevcode-mods --scope user`.

## Notas

- El nombre del mod ordena antes que `quota-panel` a propósito: su borde envuelve cada panel, y un panel dibujado por un mod que cargue antes se lo ocultaría.
- `/thinking` lista el tiempo de trabajo por modelo, guardado entre sesiones.
