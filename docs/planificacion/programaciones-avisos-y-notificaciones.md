# Programaciones, avisos y notificaciones

Plan, 2026-09-29. **Fase 1 implementada el mismo día** (ver docs/gestion-documental.md → "Programaciones y notificaciones"; ahí está lo que cambió respecto a este plan). **La ejecución de scripts queda aplazada** (usuario, 2026-09-29): primero se implementa y prueba todo lo demás, y los scripts se retoman después con calma. Lo marcado **[DECIDIR]** queda pendiente del usuario; lo marcado **[COMPROBAR]** hay que verificarlo en los servidores antes de empezar esa fase.

## Cambios respecto a este plan al implementar la fase 1

- `gd_avisos_pendientes` no existe: el estado del "Hecho" y los recordatorios van en `gd_ejecuciones` (una fila por cada vez que salta), que ya hacía falta para el historial.
- Las horas se guardan en hora de reloj de Madrid, sin zona, no en UTC.
- Mensual: si el mes no tiene el día (31, 30, 29), salta el último día del mes; no hay opción aparte de "último día".
- `canal_panel`/`canal_sistema` no existen todavía: la notificación del panel sale siempre y la del sistema llega en la fase 2.
- La "campanita" es la opción "Notificaciones" del menú, con el número de no leídas (el panel no tiene cabecera).
- `marcar_hecho_gd` también funciona con una API key normal (se apunta el nombre de la key), y no hay `listar_notificaciones_gd`: por MCP se ven los pendientes con `listar_avisos_pendientes_gd`.

## Qué es esto

Poder programar cosas para que pasen en un momento concreto o de forma repetida:

- **Avisar**: "el 15 de octubre a las 9:00 recuérdale a Ana que renueve el seguro", "el día 1 de cada mes avisa de que toca revisar las temperaturas".
- **Ejecutar un script guardado**: "cada lunes a las 7:00 revisa los registros de la semana y crea una incidencia si alguno está fuera de rango".

Cada programación puede ir enlazada a **ninguno, uno o varios documentos**. Los avisos le llegan a **personas concretas** (usuarios del proyecto) por tres vías, combinables: email, la campanita de notificaciones del panel y los avisos del sistema operativo (Windows/Mac/Android, y iPhone si el panel está añadido a la pantalla de inicio).

Además, las caducidades y las incidencias que ya existen pasan a salir también en la campanita, para que haya un solo sitio donde mirar.

## Decisiones ya tomadas (usuario, 2026-09-29)

- Encajarlo todo: avisos, ejecución de scripts, email, notificaciones en el panel y del sistema operativo.
- Los avisos llegan a **usuarios concretos**, no "al proyecto".
- La ejecución de scripts va **con precaución**: frenos en el servidor para que un script mal hecho no pueda destruir nada, e instrucciones para que la IA escriba los scripts con cuidado. **Aplazada**: se retoma cuando lo demás esté probado.
- Avisos con "Hecho" (tareas): sí, y **cuántas veces se repite el recordatorio lo elige el usuario** en cada programación.
- A quién le salen en la campanita las caducidades y las incidencias: **configurable, por defecto a todos los usuarios del proyecto**.

## Quién recibe el aviso

Los usuarios viven en la base de control (`mcpc_usuarios`, con `nombre` y `email`) y los datos de la GD en la base Postgres de cada proyecto, así que el destinatario se guarda por `id_usuario` **sin FK** (mismo criterio que `gd_actividad`) y se resuelven nombre y email al enviar.

- **Desde el panel**: por defecto, quien la crea; puede añadir a otros usuarios del proyecto.
- **Desde la IA (MCP)**: la API key es del proyecto, no de una persona, así que no se sabe quién está detrás. La IA debe preguntar a quién avisar, ofreciendo la lista de usuarios (tool `listar_usuarios_proyecto_gd`). Desde el chat del panel sí se sabe (cabecera `x-gd-id-usuario`, igual que el registro de actividad) y se usa como destinatario por defecto.
- Si un usuario se da de baja, sus avisos se omiten y queda anotado en el historial de la ejecución.

## Repeticiones

Opciones sencillas, pensadas para elegirse en un formulario y no escribiendo fórmulas:

- Una sola vez (fecha y hora).
- Cada N días.
- Semanal: qué días de la semana (p. ej. lunes y jueves).
- Mensual: qué día del mes (1–31; "último día del mes" como opción aparte, para que el 31 no se salte meses cortos).
- Anual: día y mes.

Todas con hora, fecha de inicio y fecha de fin opcional. Zona horaria `Europe/Madrid` (se guarda en UTC; el cambio de hora de marzo/octubre lo resuelve la zona, no hay que tocar nada).

Se guarda la regla en JSON (`regla_repeticion`) y, precalculada, la `proxima_ejecucion`. Tras cada ejecución se calcula la siguiente; si no la hay (una sola vez, o pasada la fecha de fin) la programación queda **terminada**.

**Si el servidor estuvo parado** y se perdieron varias ejecuciones, se hace **solo una** al volver, no todas las atrasadas (un aviso diario tras 3 días caído no manda 3 correos), y se anota en el historial.

## Modelo de datos

Todas las tablas en la base Postgres de cada proyecto.

### `gd_programaciones`

| Campo | Tipo | Para qué |
|---|---|---|
| `id` | INT autonumérico | |
| `titulo` | VARCHAR(255) | "Renovar seguro de la furgoneta" |
| `descripcion` | TEXT, opcional | Texto del aviso o para qué sirve |
| `regla_repeticion` | TEXT (JSON) | Ver "Repeticiones" |
| `fecha_inicio`, `fecha_fin` | TIMESTAMP | Fin opcional |
| `proxima_ejecucion` | TIMESTAMP, índice | Lo que mira el proceso cada minuto |
| `estado` | ENUM `activa`/`pausada`/`terminada` | |
| `canal_email`, `canal_panel`, `canal_sistema` | BOOLEAN | Por qué vías avisar (panel siempre recomendado) |
| `requiere_confirmacion` | BOOLEAN | Ver "Tareas con 'Hecho'" |
| `max_recordatorios` | INT, opcional | Cuántas veces se recuerda como máximo mientras nadie pulse "Hecho" (lo elige el usuario; NULL = hasta que se pulse) |
| `cada_dias_recordatorio` | INT, por defecto 1 | Cada cuántos días se recuerda |
| `creado_por`, `id_usuario_creador` | | Copia del nombre (como en actividad) + id si vino de una persona |
| `fecha_alta` | TIMESTAMP | |

### `gd_programaciones_documentos`

Muchos a muchos, mismo patrón que `gd_documentos_scripts`: `id_programacion`, `id_documento`, ambas FK con `ON DELETE CASCADE` (si se borra el documento, la programación sigue pero pierde el enlace).

### `gd_programaciones_destinatarios`

`id_programacion` (FK, cascade), `id_usuario` (sin FK, base de control).

### `gd_avisos_pendientes`

Una fila por cada vez que salta un aviso con `requiere_confirmacion`: `id_programacion`, `fecha_aviso`, `recordatorios_enviados`, `proximo_recordatorio`, `hecho_por`, `fecha_hecho`. Si la programación se repite (p. ej. cada lunes), cada lunes crea su propia fila: marcar "Hecho" el de esta semana no cierra el de la siguiente.

### `gd_ejecuciones`

Historial de cada vez que salta una programación: `id_programacion`, `inicio`, `fin`, `estado` (`ok`/`fallo`/`cortado`/`omitido`), `resumen` (texto legible: "Creadas 2 notas, 1 aviso"), `cambios` (JSON con lo que hizo), `error`, `es_ensayo` (BOOLEAN).

### `gd_notificaciones`

Lo que ve cada usuario en la campanita: `id_usuario`, `titulo`, `texto`, `enlace` (ruta del panel a la que lleva al pulsar), `origen` (`programacion`/`caducidad`/`incidencia`/`propuesta`/`script`), `id_origen`, `leida`, `fecha`, `estado_email` y `estado_sistema` (enviado/fallido/no aplica, con motivo).

### Tablas para cuando se retomen los scripts (no en las fases 1–3)

Columnas `tipo` (`aviso`/`script`), `id_script` (FK a `gd_scripts`, `ON DELETE RESTRICT`) y `aprobado_por`/`fecha_aprobacion`/`hash_codigo_aprobado` en `gd_programaciones`, más la tabla `gd_propuestas`. Se añaden entonces, no antes.

### `gd_propuestas` (aplazada)

Acciones que un script pidió hacer pero que no hace solo (ver "Frenos"): `id_ejecucion`, `accion` (`archivar_documento`, `enviar_documento`…), `parametros` (JSON), `descripcion` legible, `estado` (`pendiente`/`aceptada`/`rechazada`/`caducada`), `decidido_por`, `fecha_decision`.

### `gd_suscripciones_push`

Un registro por navegador donde un usuario activó los avisos del sistema: `id_usuario`, `endpoint`, `clave_p256dh`, `clave_auth`, `navegador` (texto para que el usuario lo reconozca), `fecha_alta`, `ultimo_error`. Si el navegador responde que la suscripción ya no existe (410), se borra sola.

## Cómo se ejecuta

Un script nuevo `scripts/procesar_programaciones.py`, **cron cada minuto**, mismo patrón autocontenido que `procesar_envios.py`/`avisar_caducidades.py` (recorre los proyectos GD activos de la base de control).

- Coge las programaciones activas con `proxima_ejecucion <= ahora` con `SELECT … FOR UPDATE SKIP LOCKED`, y adelanta `proxima_ejecucion` **antes** de ejecutar: si una pasada tarda más de un minuto, la siguiente no repite lo mismo.
- Un fallo en un proyecto o en una programación no para a los demás (`try/except` por cada uno, como en los scripts de aviso).
- Cada ejecución deja su fila en `gd_ejecuciones`.
- **Email**: desde la cuenta de correo del proyecto (`gd_configuracion.email_cuenta_*`, `mandar_correo` de `_mod_envios.py`) al email de cada usuario. Sin cuenta configurada, el aviso sale solo por panel y sistema, y queda anotado como "email no enviado: el proyecto no tiene cuenta de correo".
- **Sistema operativo**: Web Push (ver fase 2).

## Frenos para los scripts (aplazado)

Todo este apartado se queda escrito para cuando se retome; no entra en las fases 1–3.


Hoy los scripts de `gd_scripts` solo se guardan: los ejecuta la IA cuando alguien se lo pide, con una persona delante. Que corran solos de madrugada es nuevo, así que la seguridad **no depende de que la IA escriba bien el script**, sino de lo que el servidor le deja hacer:

1. **Encerrado, sin acceso directo a nada.** Se ejecuta en un proceso aparte, con un usuario del sistema sin privilegios, sin variables de entorno (no ve contraseñas ni `env.json`), sin red, sin poder leer ni escribir fuera de una carpeta temporal vacía. Solo Python. El script no se conecta a la base de datos: pide cosas al proceso principal por su entrada/salida estándar (una línea JSON por petición) y es el proceso principal quien las hace, comprobando cada una. **[COMPROBAR]** qué herramienta de aislamiento hay en los 5 servidores (`bubblewrap`, `unshare` o `systemd-run` con `PrivateNetwork`/`ProtectSystem`); si ninguna, instalar `bubblewrap`.
2. **Solo unas pocas acciones permitidas**, en una lista cerrada:
   - Leer: buscar documentos, leer un documento, listar notas, listar registros, leer los documentos enlazados a la programación.
   - Escribir (reversible): crear una nota o incidencia, crear un registro, crear una notificación para los destinatarios.
   - Proponer: cualquier cosa irreversible o que salga hacia fuera (archivar, borrar, enviar un documento a una entidad, compartir por enlace) **no se hace**: se crea una `gd_propuestas` y una notificación con los botones "Aceptar" / "Rechazar". Solo al aceptar lo hace el servidor, apuntándolo en el registro de actividad a nombre de quien aceptó. Las propuestas sin respuesta caducan a los 30 días **[DECIDIR plazo]**.
   - Nunca: tocar credenciales, certificados, reglas, configuración, usuarios, otros scripts ni otras programaciones.
3. **Límites por ejecución**: 2 minutos, 256 MB de memoria, 50 escrituras, 20 notificaciones **[DECIDIR valores]**. Si se pasa, se corta (`estado='cortado'`), lo hecho hasta ese momento queda anotado en el historial y se avisa a los destinatarios.
4. **Aprobación de una persona antes de programarlo.** Desde el panel, un usuario que no sea invitado pulsa "Ensayar": el script corre con las mismas reglas pero **sin guardar nada** (las escrituras se apuntan, no se hacen), y ve "leería 12 documentos, crearía 3 notas, propondría archivar 1". Solo después puede pulsar "Aprobar". Se guarda la huella (`hash`) del código aprobado: si la IA cambia el código, la huella ya no coincide, la programación **no se ejecuta** y avisa de que hace falta aprobarla otra vez. **La IA no puede aprobar** (no hay tool para eso a propósito); sí puede ensayar.
5. **Historial**: cada ejecución y cada ensayo en `gd_ejecuciones`, visible en la ficha de la programación.
6. **Tres fallos seguidos pausan la programación** y avisan a los destinatarios, en vez de fallar cada día en silencio.

### Instrucciones para la IA al escribir un script programable

Se añaden a la ayuda (`database/ayuda_gd.py`, parte nueva) y a la descripción de las tools, para que la IA las lea antes de escribir uno:

- Usar solo las acciones del objeto `gd` que le da el entorno; ni `import` de red, ni ficheros, ni `subprocess` (tampoco funcionarían).
- Hacer lo mínimo, y que sea **repetible**: si se ejecuta dos veces, no debe duplicar notas (comprobar antes si ya existe).
- Lo irreversible, siempre como propuesta.
- Escribir en `descripcion` qué hace, qué toca y por qué, en lenguaje llano: es lo que lee quien lo aprueba.
- Tras crearlo o cambiarlo, ensayarlo y enseñar el resultado al usuario, recordándole que tiene que aprobarlo en el panel.

## Tareas con "Hecho"

Decidido (usuario, 2026-09-29). Una casilla `requiere_confirmacion` en cada aviso. Si está marcada, la notificación lleva un botón "Hecho" y, mientras nadie lo pulse, se vuelve a recordar cada `cada_dias_recordatorio` días (1 por defecto) hasta `max_recordatorios` veces, **número que elige el usuario** al crear o editar la programación (con opción "hasta que alguien pulse Hecho"). Basta con que lo pulse uno de los destinatarios; queda anotado quién y cuándo, y las notificaciones de los demás se marcan como resueltas. Sin marcar la casilla, es un aviso normal que se envía una vez.

## Tools MCP

En `mcp_server/herramientas/_herr_programaciones.py`; todas las que cambian datos, añadidas a `ACCIONES_MCP` del registro de actividad; las de lectura, marcadas en `SOLO_LECTURA`. Invitados: solo leer.

- `crear_programacion_gd`, `actualizar_programacion_gd`, `pausar_programacion_gd`, `reanudar_programacion_gd`, `eliminar_programacion_gd`
- `listar_programaciones_gd` (filtros: documento, estado, entre fechas), `obtener_programacion_gd` (con documentos, destinatarios y últimas ejecuciones)
- `enlazar_documentos_programacion_gd` / `desenlazar_documentos_programacion_gd`
- `listar_usuarios_proyecto_gd` (nombre e id, sin emails, para elegir destinatarios)
- `listar_ejecuciones_gd`, `listar_notificaciones_gd` (las del usuario, solo desde el chat del panel), `listar_avisos_pendientes_gd` (los que esperan "Hecho")
- `marcar_hecho_gd` (solo desde el chat del panel, donde se sabe quién es; con una API key suelta no hay persona a quien anotárselo)
- Cuando se retomen los scripts: `ensayar_programacion_gd` y `listar_propuestas_gd`, y **sin** tool de aprobar un script ni de aceptar propuestas.

## Panel

- **Pantalla "Programaciones"**: lista con estado y próxima ejecución, y vista de **calendario mensual** que junta programaciones, caducidades de documentos y certificados, y envíos programados.
- **Ficha de programación**: formulario de repetición, destinatarios, documentos enlazados, canales, "requiere Hecho" con número de recordatorios y cada cuántos días, historial.
- **Pestaña "Programaciones"** en la ficha de cada documento (ver y crear las enlazadas a él).
- **Campanita** en la cabecera con el número de no leídas (se consulta cada 60 s), desplegable con las últimas y enlace a la pantalla **"Notificaciones"** (todas, marcar leídas, "Hecho").
- **"Activar avisos en este ordenador"**: en la pantalla de notificaciones; pide permiso al navegador y guarda la suscripción. Lista de navegadores activados, con opción de quitarlos.
- Endpoints nuevos que cambian datos, añadidos a `ACCIONES_PANEL`.

## Fases

Cada fase se puede usar por sí sola y se despliega en los 5 servidores antes de empezar la siguiente.

**Fase 1 — Avisos programados y tareas con "Hecho".** Tablas `gd_programaciones`, `_documentos`, `_destinatarios`, `gd_avisos_pendientes`, `gd_ejecuciones`, `gd_notificaciones`; cálculo de repeticiones con pruebas (fin de mes, cambio de hora, servidor parado); cron `procesar_programaciones.py` (avisos y recordatorios); email; campanita y pantalla de notificaciones con "Hecho"; pantalla y ficha de programaciones; pestaña en el documento; tools MCP; parte nueva de la ayuda.

**Fase 2 — Avisos del sistema operativo.** Web Push con claves VAPID (un par por servidor, guardado en `env.json`), `pywebpush` (dependencia Python nueva: añadirla a `requirements.txt` y al servidor, ver gotcha #4 de despliegue), *service worker* en el frontend con alcance `/gd/`, tabla `gd_suscripciones_push`, botón de activar. **[COMPROBAR]** en iPhone con el panel en la pantalla de inicio.

**Fase 3 — Calendario y avisos existentes a la campanita.** Vista de calendario; `avisar_caducidades.py` y `avisar_incidencias.py` crean además notificaciones en el panel (siguen mandando el correo como ahora). A quién le salen es **configurable** en `gd_configuracion`, por separado para caducidades y para incidencias: todos los usuarios del proyecto (**por defecto**), solo administradores, o usuarios elegidos. Se gestiona desde la pantalla "Avisos" del panel, junto al `email_avisos` que ya existe.

**Fase 4 — Ejecución de scripts. Aplazada** hasta que las fases 1–3 estén probadas. Aislamiento, lista de acciones permitidas, límites, ensayo, aprobación con huella, `gd_propuestas` con aceptar/rechazar, pausa tras 3 fallos, instrucciones para la IA. Antes de desplegar: pruebas que intenten saltarse cada freno (abrir una conexión, leer `env.json`, bucle infinito, 1000 notas, cambiar el código tras aprobar) y comprobar que todas fallan.

## Limpieza

Notificaciones leídas y ejecuciones de más de 6 meses se borran con un cron mensual, mismo patrón que `limpiar_conversaciones_chat.py` / `limpiar_actividad.py` (plazo propuesto, sin confirmar). Las programaciones terminadas no se borran solas.

## Reversible

Sí: tablas nuevas que no cambian ninguna existente, y un cron que basta quitar para desactivar todo lo automático. La fase 4 se puede apagar sola (sin tocar los avisos) con un interruptor en `env.json`, `GD_EJECUTAR_SCRIPTS=false`.
