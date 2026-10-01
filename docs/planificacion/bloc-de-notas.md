# Bloc de notas

Plan, 2026-10-01. **Implementado el mismo día** (ver docs/gestion-documental.md → "Bloc de notas"); probado contra un Postgres temporal y en el panel con Playwright, sin desplegar todavía.

## Qué es

Notas sueltas de los usuarios del proyecto: lo que se apunta en una reunión, una llamada, una idea, un acuerdo con un proveedor. A diferencia de las **notas de seguimiento** (`gd_notas`: comentarios, observaciones e incidencias que siempre cuelgan de un documento), una nota del bloc no pertenece a nada: existe por sí misma y luego se **enlaza** con otras notas, con documentos y con registros de datos, tantos como haga falta.

Las notas de seguimiento siguen como están (decisión del usuario): tienen responsables y avisos de incidencias que no pintan nada aquí.

## Decisiones del usuario (2026-10-01)

- Campos típicos: fecha y hora, título, descripción, contenido.
- Enlaces nota↔nota, nota→documento y nota→registro de datos.
- **Visibilidad la elige el autor**: privada, compartida con personas concretas o con todos.
- **Extras**: etiquetas, que la IA las lea, recordatorio desde una nota, fijar y archivar.
- **Distintivo de color** (añadido el mismo día): uno de 8 colores fijos, opcional; se ve como franja en la lista y punto junto al título, y se puede filtrar por él.
- **Claves MCP ligadas a una persona** (opcional): una clave puede ser "de todos" (lo de siempre, por defecto) o de un usuario concreto. Con una clave de todos, la IA solo ve las notas compartidas con todos, y lo que crea es para todos. Con una clave de una persona, la IA ve lo mismo que esa persona en el panel.

## Decisiones tomadas al planificar (cambiables)

- **Quién edita**: cualquiera que vea la nota (salvo invitados). Cambiar la visibilidad, archivar y borrar solo el autor; si la nota no tiene autor (la creó una clave de todos), cualquiera que la vea.
- **Por defecto**, una nota nueva es "de todos" desde cualquier sitio; privarla es un clic.
- **Fijar** es de la nota, no de cada persona: una nota fijada sale arriba para todos los que la ven.
- **Soporte (superadmin)** ve solo las notas de todos: no es un usuario del proyecto.
- **Búsqueda de la IA por texto**, no semántica: las notas son cortas y así no cuesta llamadas de embeddings. Busca en título, descripción, contenido y etiquetas.
- **Registro de actividad**: se apunta crear/cambiar/borrar, pero de una nota que no es de todos solo se dice "la nota del bloc n.º 12", sin título ni contenido, porque el registro lo ve todo el proyecto.
- **Recordatorio**: es un aviso programado normal (`gd_programaciones`) con la nota enlazada. Si se borra la nota, sus recordatorios se borran con ella. Al abrir el aviso hay un enlace a la nota (si la puedes ver).

## Modelo de datos (base Postgres de cada proyecto)

`gd_bloc_notas`: id, fecha (la de la nota, editable, por defecto ahora), titulo, descripcion, contenido (markdown), visibilidad (`privada` | `personas` | `todos`), color (opcional), fijada, archivada, creado_por (nombre, copia), id_usuario_autor (sin FK, NULL si la creó una clave de todos o soporte), fecha_alta, fecha_modificacion, modificado_por.

Relaciones, todas con FK y `ON DELETE CASCADE`:

- `gd_bloc_notas_personas` (id_nota, id_usuario sin FK): con quién se comparte si visibilidad = `personas`.
- `gd_bloc_notas_etiquetas` (id_nota, etiqueta): única por nota sin distinguir mayúsculas.
- `gd_bloc_notas_relaciones` (id_nota_a, id_nota_b, a < b): enlace entre dos notas, sin dirección.
- `gd_bloc_notas_documentos` (id_nota, id_documento).
- `gd_bloc_notas_registros` (id_nota, id_registro).
- `gd_programaciones.id_nota_bloc` (nueva columna, FK con CASCADE).

Un enlace a una nota que el usuario no puede ver no se enseña (ni título ni que existe).

## Núcleo (multiplika_mcp)

- `mcpc_api_keys.id_usuario` (INT NULL, FK a `mcpc_usuarios` con `SET NULL`): NULL = clave de todos.
- `resolver_proyecto_por_api_key` devuelve también `id_usuario_api_key`.
- Al emitir una clave (los dos paneles) se elige "De todos" o una persona del proyecto. No se puede cambiar después: para eso se emite otra.

En la GD, quién es "yo" en una llamada MCP: el usuario del chat del panel (cabecera interna, como ya hace el registro de actividad), si no el de la clave, y si no nadie (modo "todos").

## Herramientas MCP

`buscar_notas_bloc_gd` (texto, etiqueta, fechas, enlazadas a un documento/registro/nota, archivadas), `obtener_nota_bloc_gd`, `crear_nota_bloc_gd`, `actualizar_nota_bloc_gd`, `listar_etiquetas_bloc_gd`, `enlazar_nota_bloc_gd` / `desenlazar_nota_bloc_gd` (con nota, documento o registro), `eliminar_nota_bloc_gd`; archivar va con `actualizar_nota_bloc_gd(archivada=True)`, y `crear_programacion_gd(id_nota_bloc=...)` para el recordatorio. Invitados: solo las de lectura. GD enlazadas: ninguna.

## Panel

- Menú "Bloc de notas": lista con fijadas arriba, filtros por texto, etiqueta y archivadas, y botón "Nueva nota".
- Ficha de la nota: fecha, título, descripción, contenido con el mismo editor markdown que los documentos, etiquetas, visibilidad, enlaces (notas, documentos, registros) y "Recordatorio".
- En la ficha de un documento, pestaña "Bloc de notas" con las notas enlazadas que puedes ver y "Nueva nota" ya enlazada. Los registros no tienen ficha propia: cada fila lleva un botón que abre lo mismo en una ventana.
- Al emitir una API key, desplegable "De quién es".

## Despliegue

Las 6 tablas nuevas + la columna de `gd_programaciones` en las 6 bases; la columna de `mcpc_api_keys` en la base de control; núcleo y GD a los 5 servidores.
