# Seguimiento

Plan, 2026-10-01. **Implementado el mismo día** (ver docs/gestion-documental.md → "Seguimiento"); probado contra un Postgres temporal y en el panel con Playwright, sin desplegar todavía.

## Qué es

Un estado para hacer el seguimiento de lo que hay que hacer y no andar perdido: se pone en notas del bloc, en documentos y en las notas de un documento (comentarios, anotaciones, observaciones, incidencias). Cada día se recorre lo pendiente y se manda una notificación con todo.

## Decisiones del usuario (2026-10-01)

- **Estados**: Sin estado, Pendiente, En curso, Realizado y Aplazado.
- **Aplazado** crea un recordatorio que avisa el día elegido.
- **Por defecto, sin estado**: solo entra en el seguimiento lo que alguien marque. Lo que ya existe queda sin estado.
- **A cada uno lo suyo**: cada elemento tiene un responsable (usuario del proyecto). A cada persona le llega lo suyo; lo que no tiene responsable, a todos.
- **Campanita + email, a las 8:00** (hora de Madrid), solo si hay algo.

## Decisiones tomadas al planificar (cambiables)

- **Al acabar el aplazamiento vuelve a pendiente** solo, y entra en el resumen del día siguiente.
- **El aviso del aplazado** le llega al responsable; si no hay, a quien lo aplazó; si no se sabe quién es (API key de todos, soporte), a todos los que pueden escribir.
- **En el resumen** entran pendiente y en curso; aplazado y realizado no.
- **Invitados**: no pueden ser responsables ni cambiar estados, y no reciben lo que no tiene responsable (no podrían hacer nada con ello).
- **Archivados** (notas del bloc y documentos): fuera del resumen y de la lista salvo que se pida.
- **Responsable del seguimiento ≠ responsable de una nota de documento**: las notas de documento ya tenían un "responsable" de texto libre (con email opcional, para el aviso de incidencias, que puede ser alguien de fuera). Se deja como está; el del seguimiento es un usuario del proyecto.
- **Sin cron nuevo**: el resumen sale del cron de cada minuto de las programaciones.

## Modelo de datos (base Postgres de cada proyecto)

`gd_seguimiento`: id, id_nota_bloc / id_documento / id_nota (una de las tres; únicas, FK con CASCADE), estado, id_usuario_responsable (sin FK), aplazado_hasta, id_programacion (FK SET NULL), fecha_cambio, cambiado_por.

`gd_seguimiento_resumenes`: fecha (única), fecha_envio, resumen — un resumen por día.

## Herramientas MCP

`cambiar_seguimiento_gd(tipo, id, estado, id_responsable, quitar_responsable, aplazar_hasta)` y `listar_seguimiento_gd(estados, tipo, id_responsable, solo_mios, sin_responsable, incluir_archivados)`.

## Panel

Menú "Seguimiento" (todo junto, con filtros); etiqueta de estado que se pulsa para cambiarlo en la ficha de la nota del bloc, en la cabecera del documento y en cada nota del documento; estado en la lista del bloc; el resumen en Notificaciones lleva a Seguimiento.

## Despliegue

Las 2 tablas nuevas en las 6 bases (ManagerDB registrando también gd_documentos, gd_notas, gd_bloc_notas y gd_programaciones por las FK), código GD y dist del panel a los 5 servidores. El cron de programaciones ya existe: no hay que tocarlo.
