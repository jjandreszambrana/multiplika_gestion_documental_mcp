# Buzón de sugerencias al desarrollador

Estado: EN BACKLOG (2026-10-02), sin código. Retomar más adelante.

**Decisión del usuario (2026-10-02): opción B, Chatwoot.** Comprobado ese día:
mcp-d tiene 3,8 GB de RAM con solo ~1,2 GB libres y sin Docker → Chatwoot NO
cabe ahí; hará falta un servidor pequeño aparte (~4 GB RAM).

Alternativa que el usuario estaba valorando al aparcarlo: en vez del buzón
propio de abajo, instalar **Chatwoot** (open source, autoalojado, p.ej. en
mcp-d o en un servidor pequeño aparte) con la burbuja de chat en el panel de
los 5 servidores, identificando al usuario (nombre, empresa, proyecto) desde la
GD, y una tool MCP que cree conversaciones por su API. Pendiente antes de
decidir: comprobar memoria libre en mcp-d (Chatwoot pide unos 4 GB, sin
verificar), dominio propio (p.ej. soporte.multiplika.net) y cuenta de correo
para avisos. Objetivo del usuario: centralizar todo para que no le desborde y
no tener que ir servidor por servidor.

## Qué es

Que cualquier usuario de una GD (en cualquiera de los 5 servidores) pueda mandar
una sugerencia, un fallo o una duda al desarrollador, y que el desarrollador las
reciba todas juntas en un solo sitio, pueda contestar y la respuesta vuelva al
cliente.

## Cómo se envían

Dos caminos, el mismo resultado:

1. **Desde el panel**: botón "Sugerencias" fijo en la barra lateral. Abre una
   ventana con:
   - Tipo: Sugerencia / Algo no funciona / Duda.
   - Texto libre.
   - Se adjunta solo (sin que el usuario haga nada): quién la envía, el
     proyecto, el servidor, la pantalla en la que estaba y la fecha.
2. **Hablando con la IA** (Claude, el chat del panel...): tool nueva
   `enviar_sugerencia_gd(tipo, texto)`. La IA redacta la sugerencia, se la
   enseña al usuario y solo la manda cuando el usuario dice que sí.

Ejemplo: Marta, de Labosur, escribe en el chat "estaría bien que al archivar un
documento me pidiera el motivo". La IA contesta: "¿Envío esta sugerencia al
desarrollador? → *Pedir un motivo al archivar un documento*". Marta dice sí.

Cada sugerencia se guarda primero en la propia GD (tabla `gd_sugerencias`), así
no se pierde aunque falle la conexión. Un proceso que corre cada minuto la
reenvía al buzón central y la marca como entregada; si falla, lo reintenta.

En el panel del cliente hay una pantalla "Mis sugerencias" con lo que ha
mandado ese proyecto, su estado y la respuesta del desarrollador.

## Cómo se reciben

- **Buzón central** en el panel de administración de `mcp-d.multiplika.net`
  (el servidor del desarrollador): pantalla "Sugerencias" con todas las de los
  5 servidores en una sola lista.
  Columnas: fecha, servidor, cliente, quién, tipo, texto, estado.
  Filtros por estado, tipo y cliente.
- **Estados**: Nueva → Vista → En curso → Hecha / Descartada.
- **Aviso al llegar una nueva**: correo al desarrollador (y contador de
  "nuevas" en el panel de administración).
- **Respuesta**: el desarrollador escribe una respuesta y/o cambia el estado.
  Eso vuelve a la GD del cliente: aparece en "Mis sugerencias" y salta en la
  campanita de notificaciones a quien la envió.

Ejemplo: en el buzón aparece
`02/10 · adimelsl · Adimel p2 · Marta · Sugerencia · "Pedir un motivo al archivar"`.
El desarrollador la pasa a "En curso" y responde "Lo meto la semana que viene".
A Marta le salta la campanita con esa respuesta.

## Piezas técnicas

- GD: tabla `gd_sugerencias` (id, tipo, texto, id_usuario/nombre_api_key,
  pantalla, estado, respuesta, entregada, fechas). Sin FKs.
- GD: tool MCP `enviar_sugerencia_gd` + `listar_sugerencias_gd`; añadirlas a
  `ACCIONES_MCP`. Endpoints del panel en `ACCIONES_PANEL`.
- GD: cron cada minuto que entrega las pendientes y recoge respuestas
  (o se aprovecha el cron de programaciones).
- Núcleo (mcp-d): tabla de buzón + endpoint para recibir (protegido con una
  clave por servidor) + pantalla "Sugerencias" en el panel de administración.
- Invitados: no pueden enviar (como en actividad).

## Por decidir

- ¿El correo de aviso va a cada sugerencia o un resumen diario?
- ¿Pueden enviar los invitados?
- ¿El cliente ve solo las suyas o las de todo su proyecto?
