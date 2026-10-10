# Gestión documental (producto sobre Multiplika MCP)

## Idea
No es un almacén de documentos. Es un pipeline donde la IA lee cualquier documento de un cliente (PDF, foto, Word, etc.), lo interpreta y lo convierte a markdown estructurado, y ese markdown se indexa como base de conocimiento digitalizada de la empresa cliente — para que el cliente IA (Claude Desktop/Code conectado al MCP del proyecto) pueda consultarla y montar respuestas a las preguntas del usuario.

Objetivo: producto replicable — se monta este proyecto de gestión documental por separado a cada cliente que lo pida.

Sin interfaz propia: todo el flujo (subir documentos, corregirlos, consultarlos) pasa por conversación con el cliente IA vía tools MCP — no hay panel/formulario de gestión documental.

## Decisiones de arquitectura

### Multi-proyecto en un único servidor (2026-09-06)
Un único servidor/proceso MCP multi-proyecto, NO una instancia independiente por cliente. Se evita duplicar código en múltiples carpetas/despliegues.

- El aislamiento entre clientes se apoya en el mecanismo que ya tiene el Multiplika MCP: autenticación y contexto por proyecto (`obtener_contexto_proyecto` / `actualizar_contexto_proyecto` ya devuelven/actualizan datos scoped al proyecto autenticado).

### Almacenamiento: Postgres + pgvector, 1 BD por cliente (2026-09-06, revisado)
- Una base de datos Postgres independiente por cliente (no un esquema compartido con `project_id`), por aislamiento fuerte y portabilidad (dar de baja/exportar un cliente de forma autocontenida).
- **`pgvector` se instala siempre** en la base de cada cliente (la extensión), da igual el modo de búsqueda que tenga activo — no tiene coste tenerla instalada sin usar.
- Se pasó de MariaDB a Postgres por la portabilidad que exige el esquema de 1 BD por cliente.
- Librería de acceso a datos: el usuario ya usa `mtpk-mariadb` (ORM propio en PyPI) en otros proyectos. Decisión: no tocar `mtpk-mariadb`; construir un paquete nuevo y separado, **`mtpk-postgres`**, con la misma interfaz/filosofía pero sobre `psycopg`. Repo local: `/home/jjandres/desarrollos/python3/mtpk_postgres`.
  - **Estado: publicado en PyPI como `mtpk-postgres` v0.1.1.** El bug que impedía crear/migrar tablas con índice ya está corregido y verificado — ver [[mtpk-postgres-adaptacion]].

### Modo de búsqueda por cliente: fulltext o semántico (2026-09-06)
- Cada cliente tiene un modo de búsqueda configurable, guardado en su propia base (`gd_configuracion`): `fulltext` (búsqueda por palabras, nativa de Postgres, sin coste ni modelo de IA) o `semantico` (búsqueda por significado, vía embeddings + `pgvector`).
- **Cambiable en cualquier momento**, no fijo al alta. Por eso el esquema (índice de texto + tabla de embeddings) existe siempre en todos los clientes desde el principio — lo único condicionado por el modo activo es si el pipeline de ingesta genera o no el embedding de cada documento nuevo (eso sí tiene coste real: llamada a la API). Si un cliente pasa de `fulltext` a `semantico` más adelante, hace falta un proceso de "backfill" que genere a posteriori los embeddings de los documentos ya ingeridos (pendiente de detallar cuando toque implementarlo).
- Un futuro modo "híbrido" (combinar las dos búsquedas) queda como posible mejora, no bloquea nada: con este diseño, añadirlo no exige tocar el esquema, solo lógica de consulta nueva.
- **Proveedor de embedding**: OpenAI `text-embedding-3-small` (1536 dimensiones) como estándar de la plataforma. La dimensión se guarda como parámetro por cliente en `gd_configuracion`, así que un cliente concreto podría usar otro proveedor en el futuro sin rediseñar el esquema.
- **Chunking**: por encabezados markdown (cada sección, con tope de tamaño), no por documento completo — necesario para que el embedding de un documento largo sea preciso.

### Esquema de datos (2026-09-06)
Por cada base de datos de cliente:

```
gd_configuracion (1 fila)
  - modo_busqueda        TEXT ('fulltext' | 'semantico')
  - proveedor_embedding  TEXT (p.ej. 'openai:text-embedding-3-small')
  - dimension_embedding  INT  (1536 por defecto)

gd_documentos
  - id
  - nombre / referencia
  - tipo_documento       VARCHAR(50), texto libre (ver "Tipos de documento" más abajo)
  - todas_versiones_buscables  BOOLEAN DEFAULT FALSE
  - fecha_alta

gd_tipos_documento (catálogo abierto de sugerencias, no una lista cerrada — ver más abajo)
  - id
  - nombre               VARCHAR(50) UNIQUE
  - formato_requerido    TEXT  -- opcional, ver "Cumplimiento de formato/normativa"
  - normativa_aplicable  TEXT  -- opcional, ídem
  - fecha_alta

gd_versiones
  - id
  - id_documento          FK
  - vigente               BOOLEAN   -- true solo en la última
  - borrador              BOOLEAN DEFAULT FALSE  -- ver "Borrador" más abajo
  - markdown_original     TEXT      -- lo que generó la IA
  - markdown_actual       TEXT      -- vigente (= original o corregido a mano)
  - tmp                   TEXT      -- borrador de edición del panel sin confirmar, ver "Edición desde el panel"
  - tmp_id_usuario        INT       -- quién dejó ese borrador (→ mcpc_usuarios.id, sin FK real)
  - tmp_fecha             TIMESTAMP -- cuándo se escribió tmp por última vez
  - revisado_manualmente  BOOLEAN DEFAULT FALSE
  - incumplimientos       TEXT  -- opcional, ver "Cumplimiento de formato/normativa"
  - tsvector_actual       (GENERATED ALWAYS AS to_tsvector(markdown_actual) STORED + índice GIN)
  - fecha_documento       -- la del propio documento, no la de subida
  - fecha_subida

gd_historial_ediciones (ver "Edición desde el panel")
  - id
  - id_version         FK
  - id_usuario         INT (→ mcpc_usuarios.id, sin FK real)
  - markdown_anterior  TEXT      -- snapshot completo de markdown_actual justo antes de esta confirmación
  - fecha

gd_chunks (solo si el modo es/fue semántico, y solo de versiones buscables)
  - id
  - id_version    FK
  - orden
  - texto
  - embedding     VECTOR(dimension_embedding) + índice HNSW
```

Búsqueda (full-text o semántica): siempre filtra por `vigente = true`, salvo que `gd_documentos.todas_versiones_buscables = true` (entonces entran todas las versiones de ese documento).

**Correcciones — dos escenarios contemplados:**
- **A) Nueva versión del documento** (el cliente sube una versión corregida/actualizada): nueva fila en `gd_versiones`, la anterior deja de ser `vigente`. Se guarda todo el histórico, sin límite de tiempo ni purga (decisión: el espacio que ocupa es marginal — texto y vectores pequeños; no se almacena el binario original).
- **B) Corrección del markdown mal generado por la IA** (sin que haya documento nuevo del cliente): se edita `markdown_actual` de la versión existente, conservando `markdown_original` como lo que generó la IA la primera vez, y marcando `revisado_manualmente=true`. Mecanismo (decidido 2026-09-08): siempre vía tool MCP (`corregir_documento_gd`), a petición del propio cliente a su IA — sin revisión de nadie del equipo, porque no hay capacidad para tenerla. El riesgo asumido es que una corrección mal hecha por la IA del cliente quede guardada sin que nadie la verifique; se acepta porque `markdown_original` nunca se pierde.

### Borrador (2026-09-13)
Problema: a veces llega un documento incompleto (le faltan páginas, el cliente aún lo está revisando) y las idas y vueltas hasta cerrarlo no deberían ensuciar el histórico de `gd_versiones` con una versión por cada corrección intermedia.

Solución: `gd_versiones.borrador` (BOOLEAN, default false). Mientras la versión vigente de un documento sea un borrador, `guardar_documento_gd(id_documento_existente=..., ...)` **sobrescribe esa misma fila** (incluido `markdown_original` — única excepción a "nunca se sobrescribe", justificada porque mientras es borrador no es un documento real todavía) en vez de crear una versión nueva. El cliente lo da por bueno de dos formas: llamando otra vez a `guardar_documento_gd` con `borrador=false` (guarda el contenido final y lo cierra en el mismo paso), o con `confirmar_documento_gd` si el contenido no cambia y solo hace falta la confirmación. A partir de ahí, `borrador=false` para siempre en esa versión: cualquier guardado posterior sobre ese documento vuelve a crear una versión nueva, como con cualquier documento normal — el flujo A de arriba no cambia.

Por defecto `borrador=false`: un documento que llega completo se guarda igual que siempre, sin que el cliente tenga que saber que existe este mecanismo.

### Edición desde el panel (2026-09-13)
Hasta ahora el panel del cliente era de solo lectura: guardar o corregir un documento era siempre por conversación con la IA. Se añade edición directa del texto desde el panel, con un control de cambios (quién y cuándo) y la posibilidad de revertir.

**Rol nuevo: invitado.** El catálogo de roles (`mcpc_roles` del core) gana un cuarto rol, `invitado` (id=4): acceso de solo lectura, no puede editar nada. `admin_tenant` y `operador` sí pueden editar. `lib/roles_proyecto.puede_editar_proyecto()` es la comprobación (cualquier rol salvo invitado); un superadmin NO puede editar documentos por este camino — el historial de ediciones referencia `mcpc_usuarios`, no `mcpc_superadmins`, así que para dar soporte editando algo hay que entrar con un usuario real de ese tenant.

**Guardado sin ensuciar el historial: `gd_versiones.tmp`.** Mientras se edita, cada "guardar" del panel escribe en `tmp` (+ `tmp_id_usuario`, `tmp_fecha`) sin tocar `markdown_actual` ni generar ningún registro — exactamente igual que guardar un archivo no es un commit en git. Solo una acción explícita, "confirmar", cierra la edición: el `markdown_actual` de antes pasa a `gd_historial_ediciones` y `tmp` pasa a ser el nuevo `markdown_actual` (y se vacía). Si el editor se reabre con `tmp` todavía con contenido, es que quedó una edición sin confirmar (de quien sea, no hay bloqueo entre usuarios) — se carga ese texto en vez del confirmado, con un aviso visible de quién lo dejó y cuándo, para que quien lo retome sepa lo que está haciendo.

**Historial: snapshot completo, no solo el diff.** `gd_historial_ediciones` guarda, en cada confirmación, el texto completo de `markdown_actual` de justo antes (columna `markdown_anterior`), no un diff — el coste en espacio es marginal (mismo razonamiento que ya justifica no purgar nunca `gd_versiones`). El diff que ve el cliente se calcula al vuelo (`difflib.unified_diff`, formato tipo `git diff`) comparando dos snapshots consecutivos, solo cuando alguien lo pide. Guardar el snapshot completo (y no solo el diff) es lo que hace trivial revertir: copiar `markdown_anterior` de vuelta a `markdown_actual` — y ese propio revertir queda registrado como una confirmación más, nunca se pierde el rastro de qué pasó.

Esto es independiente del mecanismo de "Borrador" de más arriba (que evita versiones nuevas mientras un documento entero está sin cerrar, vía chat): la edición desde el panel corrige el texto de la versión vigente, sea o no un borrador.

### Alta manual desde el panel (2026-09-24)
Hasta ahora el panel solo dejaba editar un documento ya existente (ver arriba) o encolar un fichero crudo en `gd_documentos_pendientes` a la espera de que la IA lo procesara en conversación — no había forma de dar de alta un documento nuevo sin pasar por la IA. Se añade `POST /v1/proyectos/{id}/documentos`: el propio usuario pega o escribe el markdown ya convertido (mismos metadatos que pide `guardar_documento_gd`: nombre, tipo, fecha, ámbito, caducidad, histórico buscable) y el panel llama directamente a `guardar_documento()` — mismo camino de guardado que usa la tool MCP, sin duplicar lógica de negocio.

Decisión de alcance (2026-09-24): sin OCR/conversión automática en el panel — convertir un PDF o una foto a markdown lo sigue haciendo solo la IA en conversación (es su punto fuerte, y montar un pipeline de extracción propio en el panel sería peor calidad y mucho más código). Lo que sí se añade es poder **adjuntar el PDF original tal cual** al crear a mano (`gd_versiones.archivo_original` + `_nombre` + `_tipo_mime`, BLOB opcional): queda guardado solo como referencia descargable junto al documento — `markdown_actual` sigue siendo lo único que se busca y lo que manda. Mismo permiso que editar (`puede_editar_documento_actual`, ver "Edición desde el panel"); si el modo de búsqueda del proyecto es semántico, se reindexa igual que si lo hubiera guardado la IA.

### Pipeline de ingesta (2026-09-06)
Sin interfaz: el cliente le dice a su Claude "guárdame esta factura" (la pega o adjunta) y es el propio cliente IA quien gestiona todo el proceso vía tools MCP.

La IA **siempre pregunta** al usuario antes de guardar (no infiere del contenido), como mínimo:
1. Tipo de documento — consultando antes `listar_tipos_documento_gd()` para sugerir uno ya existente (ver "Tipos de documento" más abajo).
2. Nombre/referencia corta para identificarlo después.
3. Si es una versión nueva de un documento ya guardado o uno distinto — si dice que es nueva versión, la IA debe confirmar cuál usando `buscar_documentos()`, no adivinar.
4. Fecha del propio documento (no la de subida).
5. Si ese documento necesita que todo su histórico quede buscable, o solo la última versión (por defecto: solo la última).

### Tools MCP (2026-09-06)
Tres herramientas cubren todo el ciclo de consulta (la de ingesta/guardado queda para cuando se aborde la implementación, junto con el mecanismo de corrección del punto B de arriba):

1. **`consultar_documentos(pregunta, limite=5)`** — la principal, para responder preguntas del cliente. Resuelve sola el modo de búsqueda del proyecto (fulltext o semántico) y devuelve los fragmentos más relevantes con su documento, tipo, fecha e identificadores, para que la IA cite la fuente y pueda pedir el documento completo si hace falta.
2. **`obtener_documento_completo(id_documento, version=None)`** — devuelve el markdown completo de la versión vigente (o la indicada), para cuando un fragmento no basta.
3. **`buscar_documentos(referencia)`** — búsqueda por metadatos (nombre, tipo, fecha), no por contenido; sirve tanto para consulta exploratoria como para evitar duplicados al ingerir.

**`obtener_estado_proyecto_gd()`** (añadida 2026-09-09): total de documentos guardados y fecha de la última alta (documento o versión nueva) — es el dato de estado por proyecto planteado en `docs/decisiones.md` del repo core, apartado "Contexto compartido: separar negocio de preferencias" (paso 3). No refleja correcciones hechas con `corregir_documento_gd`, solo altas — para no necesitar tocar el esquema. Vive aquí porque es específico de este producto, no de la plataforma core.

**`archivar_documento_gd(id_documento)` / `desarchivar_documento_gd(id_documento)`** (añadidas 2026-09-09): un documento que ya no aplica (anulado, subido por error) se marca `archivado` en vez de borrarse — desaparece de `buscar_documentos_gd` (salvo `incluir_archivados=True`) y de `consultar_documentos_gd` (fulltext y semántico), pero sigue accesible por id y se puede recuperar sin perder nada del histórico.

**`eliminar_documento_gd(id_documento)`** y `DELETE /v1/proyectos/{id}/documentos/{id_documento}` en el panel (añadidas 2026-09-28): borrado definitivo, sin vuelta atrás. Condiciones (decisión del usuario): el documento tiene que estar archivado antes (nadie borra de un paso un documento en uso) y no puede tener ningún envío en estado `enviado` (queda archivado como constancia de lo enviado). Versiones, archivo original, chunks, notas, envíos no hechos y relaciones con entidades/grupos/scripts caen por `ON DELETE CASCADE`; `gd_registros_documentos` se borra y `gd_aprendizajes.id_documento_creado` se pone a NULL en la misma sentencia (no tienen FK). Invitados no pueden borrar.

**`confirmar_documento_gd(id_documento, id_version=None)`** (añadida 2026-09-13): cierra un borrador (ver "Borrador" más arriba) sin cambiar su contenido.

**`listar_credenciales_gd()`** (añadida 2026-09-09): nombre, descripción y usuario (si lo lleva) de cada credencial del proyecto — nunca la contraseña/API key. Ver "Credenciales" más abajo.

**`listar_estilos_informe_gd()` / `obtener_estilo_informe_gd(nombre_tipo)`** (añadidas 2026-09-09): tipos de informe disponibles, e instrucciones + imágenes fijas de uno en concreto (las imágenes llegan como contenido nativo de imagen de la propia respuesta, no como URL). Ver "Tabla de estilos" más abajo.

### Tipos de documento: catálogo abierto, no lista cerrada (2026-09-10)
`tipo_documento` empezó siendo una lista cerrada de 5 valores fija en el esquema (factura/certificado/contrato/informe/otro). El cliente pidió que fuera "amplia, incluso configurable por el propio cliente" — se sustituyó por texto libre (`VARCHAR(50)`) más una tabla de sugerencias, `gd_tipos_documento`, que NO restringe qué se puede guardar: es solo una lista de "ya usados" para que la IA reutilice uno existente en vez de crear variaciones del mismo tipo (p.ej. "Factura" vs "facturas").

- **`listar_tipos_documento_gd()`** (tool MCP): devuelve el catálogo. La IA la consulta antes de preguntar el tipo al guardar un documento, y sugiere uno de los ya existentes si encaja.
- **`guardar_documento_gd`**: si el tipo indicado no está en el catálogo (y es un documento nuevo, no una versión nueva de uno existente), se añade solo — sin que el cliente tenga que darlo de alta antes en el panel.
- **Gestión desde el panel**: `GET/POST /v1/proyectos/{id}/tipos-documento` (cualquier usuario del proyecto) y `PUT`/`DELETE /v1/proyectos/{id}/tipos-documento/{id_tipo}` (solo admin) — un cliente puede curar su propio catálogo (añadir tipos por adelantado, borrar uno mal escrito, definir formato/normativa — ver "Cumplimiento de formato/normativa") sin depender de nosotros. Borrar una entrada del catálogo no afecta a los documentos que ya usan ese texto como `tipo_documento` — son independientes, el catálogo es solo una ayuda de sugerencia.
- Al aplicar el esquema (`update_db.py`) se siembran los 5 tipos por defecto **solo si la tabla está vacía** — así un cliente que ya haya editado su catálogo no los ve reaparecer en cada migración futura.

**Gotcha de migración encontrado al probarlo (2026-09-10):** el proyecto ya provisionado (`desarrollo_interno_gestion_documental_dev`) tenía, además del tipo de columna, una restricción `CHECK` residual (`gd_documentos_tipo_documento_check`, `tipo_documento IN ('factura', ...)`) de una versión anterior del esquema. `ManagerDB.crear_todo()` de `mtpk_postgres` no la detectó ni la quitó (ni siquiera con `--permitir-drop`, que solo cubre índices/FKs huérfanos) — guardar un tipo nuevo fallaba con un error de Postgres hasta borrar la restricción a mano (`ALTER TABLE gd_documentos DROP CONSTRAINT gd_documentos_tipo_documento_check`). Si en el futuro hay más clientes con Postgres ya provisionados antes de este cambio, hay que revisar si tienen la misma restricción residual antes de darlos por migrados.

### Cumplimiento de formato/normativa (2026-09-13)
Un tipo de documento puede llevar, opcionalmente, `formato_requerido` (cómo debe estar estructurado, p.ej. qué campos lleva una factura) y/o `normativa_aplicable` (qué reglamento debe cumplir). Es texto libre en ambos casos, no una validación estructurada — sigue sin haber lista cerrada ni esquema por tipo, esto es una guía para que la IA la lea y la aplique con criterio, no una regla mecánica.

- **Gestión**: `PUT /v1/proyectos/{id}/tipos-documento/{id_tipo}` (solo admin, página "Tipos de documento" del panel) para definir o borrar estos dos campos de un tipo. No afecta a documentos ya guardados.
- **Al guardar**: antes de `guardar_documento_gd`, la IA consulta `listar_tipos_documento_gd()` — si el tipo del documento tiene requisitos, compara el contenido contra ellos y describe en `incumplimientos` (parámetro de `guardar_documento_gd`) lo que no cumpla, en sus propias palabras. Si cumple, o el tipo no tiene requisitos, lo deja vacío.
- **Dónde queda**: `gd_versiones.incumplimientos` — por versión, no por documento (una versión corregida puede dejar de incumplir mientras otras versiones antiguas siguieran sin cumplir, aunque en la práctica solo importa la vigente). El panel lo muestra como aviso en rojo en la ficha del documento.
- **Resolución**: no se limpia solo. Cuando el documento se corrige (`corregir_documento_gd`, `guardar_documento_gd` con una versión nueva, o edición desde el panel) y la IA valora que ya cumple, llama a la tool nueva `actualizar_incumplimientos_gd(id_documento, incumplimientos=None)` para vaciarlo. Si sigue sin cumplir pero por otro motivo, actualiza el texto en vez de vaciarlo.

### Credenciales (2026-09-09, ampliada 2026-09-10)
Gestor genérico de credenciales del cliente para conectar con servicios externos — sin un servicio concreto todavía, así que se diseñó abierto: un nombre, para qué sirve, un usuario opcional y la contraseña/API key/token, cifrada.

Primera versión (2026-09-09) metía usuario+contraseña como JSON dentro de un único campo `valor_cifrado` — se corrigió el mismo día siguiente porque escribir JSON a mano no es razonable para alguien no técnico: ahora `usuario` es su propia columna, sin cifrar (no es secreto) y visible para la IA; solo la contraseña/token va cifrada.

```
gd_credenciales
  - id
  - nombre              VARCHAR(100) UNIQUE  -- p.ej. "erp_contabilidad"
  - descripcion         MEDIUMTEXT           -- para qué sirve (esto sí lo ve la IA)
  - usuario             VARCHAR(150)         -- opcional, sin cifrar, la IA sí lo ve
  - valor_cifrado        VARCHAR(500)         -- la contraseña/API key/token — Fernet, lib.cifrado del repo core
  - fecha_actualizacion TIMESTAMP
```

Decisión clave: **se gestiona solo desde el panel, nunca por conversación con la IA** — mismo motivo por el que la clave de Mistral/OpenAI ya se gestiona así hoy (Fase 3): si el cliente se la dictara a su IA por chat, quedaría escrita en el historial de esa conversación. La herramienta MCP `listar_credenciales_gd()` es de solo lectura de metadatos — nombre, descripción y usuario, nunca la contraseña. La primera herramienta que *usa* una credencial para conectarse a algo es el correo por IMAP (2026-09-28, ver "Correo por IMAP" al final). `CredencialesCRUD.valor_descifrado()` existe para cuando llegue ese caso (uso interno del backend, nunca expuesto tal cual por una API ni una tool).

Endpoints del panel (`admin_gestion_documental_actual`, igual que las API keys — es la única información realmente sensible de este panel):
```
GET/POST   /v1/proyectos/{id}/credenciales
PUT/DELETE /v1/proyectos/{id}/credenciales/{id_credencial}
```

### Tabla de estilos (2026-09-09)
Por cada tipo de informe que la IA pueda construir (p.ej. "informe_mensual", "memoria_anual"): instrucciones de cómo montarlo, más sus imágenes fijas (logo, plantilla...), subidas una vez desde el panel — un estilo puede tener varias imágenes.

```
gd_estilos
  - id
  - nombre_tipo          VARCHAR(100) UNIQUE   -- "informe_mensual"
  - instrucciones        MEDIUMTEXT            -- estructura, tono, apartados
  - fecha_actualizacion  TIMESTAMP

gd_estilos_imagenes
  - id
  - id_estilo         FK -> gd_estilos.id, ON DELETE CASCADE
  - nombre            VARCHAR(150)   -- "logo_cabecera"
  - descripcion_uso   MEDIUMTEXT     -- cuándo/cómo usarla
  - imagen            BLOB (BYTEA en Postgres) -- el binario, directo en la fila
  - tipo_mime         VARCHAR(50)    -- "image/png"
  - fecha_alta        TIMESTAMP
```

**La imagen se guarda como `BYTEA` directo en la fila** — no hay almacén de ficheros en este proyecto y montar uno (S3, disco) solo para unos pocos logos/plantillas habría sido sobredimensionado.

**Cómo le llegan las imágenes a la IA** (decisión 2026-09-09, con el usuario): el servidor MCP y el panel son dos backends con autenticación distinta (`x-api-key` la IA, JWT el panel), así que una URL del panel no le sirve a la IA sin más. Se descartó montar un endpoint público sin login. En su lugar, `obtener_estilo_informe_gd(nombre_tipo)` devuelve las imágenes **dentro de la propia respuesta de la tool**, como contenido de imagen nativo del protocolo MCP (`fastmcp.utilities.types.Image`) — sin URLs, sin permisos nuevos que gestionar. Cada imagen va precedida de un bloque de texto con su nombre y su `descripcion_uso`, para que la IA sepa cuál es cuál. Probado de punta a punta: la respuesta trae 3 bloques (instrucciones, texto identificador + imagen), cada imagen con su `mime_type` correcto.

Endpoints del panel: lectura (`GET`) abierta a cualquiera con acceso al proyecto — no es información sensible, es contenido de plantilla. Alta/edición/borrado (incluida la subida de imágenes): cualquiera salvo el rol invitado (`escritor_gestion_documental_actual`, 2026-09-21; antes era solo admin, como las API keys). Regla dada por el usuario: todos los usuarios escriben en todo salvo invitado, que solo lee. Las tools MCP se rigen por el rol de la clave de API, no por una persona (2026-09-21): cada key es operador (lee y escribe) o invitado (solo lee), se elige al emitirla en el panel. Las tools que solo leen llevan `@mcp_app.tool(annotations=SOLO_LECTURA)` (`mcp_server/herramientas/_anotaciones.py`); una tool nueva sin marcar se bloquea para claves invitadas — si solo lee, márcala. Ver `docs/decisiones.md` del core → "Rol de la key".
```
GET/POST   /v1/proyectos/{id}/estilos
PUT/DELETE /v1/proyectos/{id}/estilos/{id_estilo}
GET        /v1/proyectos/{id}/estilos/{id_estilo}/imagenes                    (metadatos, sin el binario)
POST       /v1/proyectos/{id}/estilos/{id_estilo}/imagenes                    (multipart)
GET        /v1/proyectos/{id}/estilos/{id_estilo}/imagenes/{id_imagen}/contenido  (sirve el binario, con sesión)
DELETE     /v1/proyectos/{id}/estilos/{id_estilo}/imagenes/{id_imagen}
```
El frontend nunca pone el binario en un `<img src="...">` con el token en la URL (quedaría en logs del servidor) — lo trae con `fetch()` (cabecera `Authorization`) y lo muestra con un `object URL` (ver `ImagenEstilo` en `EstiloDetalle.jsx`).

**Escritura desde la IA y documentos guía (2026-09-21)**: a petición del usuario, la IA también puede dar de alta y editar estilos, y vincular documentos a ellos:
- `crear_estilo_informe_gd(nombre_tipo, instrucciones)` y `actualizar_estilo_informe_gd(nombre_tipo, instrucciones)` (esta reemplaza las instrucciones completas). No hay tool para borrar un estilo (arrastraría sus imágenes) ni una imagen — eso sigue siendo solo del panel.
- `subir_imagen_estilo_gd(nombre_tipo, nombre, descripcion_uso, imagen_base64 | url)` (2026-09-21): la imagen llega por `imagen_base64` (solo viable si la IA tiene el archivo al alcance, p.ej. Claude Code — una imagen adjunta al chat no la puede leer como bytes) o por `url` pública directa. Se valida por los primeros bytes (PNG/JPEG/GIF/WEBP, máx. 5 MB), no por el tipo que declare quien la envía. La descarga por URL rechaza direcciones no públicas y no sigue redirecciones (para que no sirva de sonda contra servicios internos del servidor). Si ya existe una imagen con ese `nombre` en el estilo, se reemplaza.
- `gd_documentos.id_estilo` (INT, opcional, FK → `gd_estilos.id`, `ON DELETE SET NULL`): un documento que explica cómo elaborar un tipo de informe se vincula a su estilo con `asignar_estilo_documento_gd(id_documento, nombre_tipo)` (sin `nombre_tipo` quita el vínculo). Un documento va a un solo estilo; un estilo puede tener varios documentos guía. Se guarda el `id`, no el nombre, para que renombrar un estilo no rompa el vínculo (ver regla "id, nunca slug").
- `obtener_estilo_informe_gd` añade, tras las instrucciones, la lista de documentos guía no archivados (`id` + nombre) para que la IA los lea con `obtener_documento_completo_gd` antes de redactar; este último devuelve ahora `estilo_informe` (nombre del estilo vinculado o `null`).
- Esquema desplegado en los 5 servidores activos (2026-09-22, incluye `codemartia.multiplika.net`, dado de alta después del punto anterior — no lo tenía).
- **Exportar a PDF (2026-09-22)**: tanto el botón "PDF..." del panel (abre un modal con la opción de incluir metadatos en el pie de página, preferencia recordada en `localStorage`) como `generar_informe_pdf_gd` incrustan ahora las imágenes fijas (logo...) del estilo — el panel usa automáticamente `documento.id_estilo`, sin que haga falta indicarlo a mano. Lógica compartida en `imagenes_estilo_html()` (`database/modelos/_mod_pdf.py`). Las instrucciones de texto del estilo siguen sin aplicarse al render (solo las usa la IA para redactar el markdown de antemano).
- **Ya no pendiente**: el panel sí muestra y permite cambiar el vínculo documento-estilo (selector "Estilo de informe" en la edición de `DocumentoDetalle.jsx`, endpoint `PUT /documentos/{id}/estilo`).

### Certificados de entidades (2026-09-22)
Tabla `gd_certificados` para certificados digitales (.p12/.pfx con contraseña, o .cer/.pem sin ella), calcada del patrón de `gd_credenciales` (cifrado Fernet vía `lib.cifrado` del núcleo). Esquema en `database/dependencias/_dep_certificados.py`, CRUD y extracción en `database/modelos/_mod_certificados.py`:
- Columnas: `nombre`, `descripcion`, `id_entidad` (FK nullable a `gd_entidades`, **N:1** — un certificado cuelga de como mucho una entidad, vínculo opcional, a diferencia de documentos↔entidades que es N:M), datos extraídos en claro del propio certificado (`titular`, `nif_titular`, `emisor`, `numero_serie`, `fecha_emision`, `fecha_caducidad`), y dos campos cifrados: `archivo_cifrado` (el fichero original, cifrado siempre — también para .cer aunque solo tenga la parte pública, por coherencia de código) y `contrasena_cifrada` (nullable, solo si es .p12/.pfx). Cifrado como texto (`cifrar()`/`descifrar()` de `lib/cifrado.py` operan sobre `str`, no bytes — el archivo binario va en base64 antes de cifrar).
- Extracción automática al subir (`_parsear_certificado()`): prueba primero como PKCS12 (con la contraseña dada, que puede ser None) y si falla como X.509 plano (PEM o DER) — de ahí saca `subject` (CN + `NameOID.SERIAL_NUMBER`, que en certificados españoles suele llevar el NIF), `issuer` CN, número de serie y fechas de validez. Si no se puede leer con ninguno de los dos métodos, `ValueError` → 400, no se guarda nada a medias. Probado con un certificado autofirmado real (PEM y PKCS12, contraseña correcta/incorrecta/archivo basura) antes de desplegar.
- `cryptography` añadida a `requirements.txt` de este proyecto (antes solo llegaba transitiva vía `fastmcp`→`authlib`).
- Aviso de caducidad: mismo mecanismo que documentos (`fecha_caducidad` + `aviso_caducidad_enviado`), `scripts/avisar_caducidades.py` manda ahora un único correo combinado con las dos secciones ("Documentos por caducar" / "Certificados por caducar") cuando hay algo de cualquiera de los dos tipos.
- Renovar un certificado caducado = subir uno nuevo (fila nueva), no se sobrescribe el archivo de uno existente — igual que credenciales tampoco permite cambiar el secreto ya guardado, mantiene histórico. Solo se puede editar `nombre`/`descripcion`/`id_entidad` (`PUT .../certificados/{id}`).
- Sin tools MCP (como credenciales, la IA nunca ve el secreto) — todo desde el panel: pantalla `Certificados.jsx` (listar, subir con archivo + contraseña opcional + entidad opcional, descargar original, ver el log de uso, eliminar). Endpoints en `panel_cliente/servidor.py`, todos restringidos a admin_tenant (`admin_gestion_documental_actual`, igual que credenciales).

**Trazabilidad de uso**: cada descarga del archivo queda registrada en `gd_certificados_log` (`id_certificado`, `certificado_nombre` denormalizado, `id_usuario`, `accion`, `detalle`, `fecha`). FK `id_certificado` en `ON DELETE SET NULL` (no CASCADE) — el registro de auditoría sobrevive aunque se borre el certificado, gracias al nombre denormalizado. Log de solo escritura: sin endpoint de editar ni borrar filas. `CertificadosLogCRUD.registrar()` se llama desde `GET .../certificados/{id}/archivo` (la única "uso" que existe hoy) con `accion="descarga"`; queda genérica para que cualquier operación futura pase por el mismo sitio. Requiere un usuario real del tenant, no un superadmin (`admin_certificados_actual` en `panel_cliente/dependencias.py`, mismo motivo que `puede_editar_documento_actual` con `gd_historial_ediciones`: el `id_usuario` referencia `mcpc_usuarios`). El panel muestra el log en un modal ("Ver uso") por certificado.

### Estructura del repo: igual que cualquier proyecto de cliente de Multiplika MCP (2026-09-06)
Este proyecto no inventa una estructura propia — sigue exactamente la misma que ya usa cualquier proyecto de cliente sobre Multiplika MCP, documentada en `guia_nuevo_proyecto.md` del repo core:

```
multiplika_gestion_documental_mcp/
├── database/
│   ├── dependencias/    # esquema (gd_configuracion, gd_documentos, gd_versiones, gd_chunks,
│   │                    #          gd_credenciales, gd_estilos, gd_estilos_imagenes)
│   ├── modelos/         # CRUD y lógica de negocio
│   └── update_db.py     # migración de esta base (vía mtpk-postgres, no mtpk-mariadb)
├── mcp_server/
│   └── herramientas/    # las tools MCP (consultar_documentos_gd, buscar_documentos_gd,
│                        #  archivar/desarchivar, listar_credenciales_gd,
│                        #  listar_estilos_informe_gd/obtener_estilo_informe_gd...)
└── panel_cliente/       # panel web del cliente — ver "Panel del cliente" en el plan de fases
    ├── servidor.py       # backend FastAPI: documentos, API keys, credenciales, estilos
    └── frontend/         # React — se despliega ya compilado (dist/), sin Node en el servidor
```

Repo propio e independiente del core (`multiplika_mcp`), igual que cualquier otro proyecto de cliente — se junta con la plataforma solo en el servidor, vía `sync.py`. La única diferencia respecto a un proyecto de cliente normal es el motor de base de datos (`mtpk-postgres` en vez de `mtpk-mariadb`), ya contemplado en `guia_nuevo_proyecto.md`.

### Aprovisionamiento y catálogo de clientes/servidores
Esto **no es de este proyecto** — es una capacidad del core de Multiplika MCP (detección/instalación del motor de BD + saber qué clientes hay y en qué servidor), que gestión documental usa pero no posee. Ver doc [[multiplika-mcp-catalogo-clientes]].

## Plan de implementación (fases, 2026-09-06)

Requisito previo, no es una fase de este proyecto: `mtpk-postgres` (librería independiente, repo propio) tiene que estar disponible sin el bug de índices — ya lo está, v0.1.1 en PyPI (ver [[mtpk-postgres-adaptacion]]).

**Fase 1 — Esqueleto del repo + esquema**
- Crear el repo `multiplika_gestion_documental_mcp` con la estructura estándar (`database/dependencias`, `database/modelos`, `mcp_server/herramientas`), siguiendo `guia_nuevo_proyecto.md` de `multiplika_mcp`.
- Definir `_dep_configuracion.py`, `_dep_documentos.py`, `_dep_versiones.py`, `_dep_chunks.py` con `mtpk-postgres`.
- Aplicar el esquema contra una Postgres de pruebas (`update_db.py`), incluyendo `CREATE EXTENSION vector`.

**Fase 2 — Ingesta y consulta básicas (modo fulltext, sin depender aún de OpenAI)** — hecho (2026-09-07)
- Modelos CRUD (`_mod_documentos.py`, `_mod_versiones.py`).
- Tool `guardar_documento_gd` (documento nuevo vs. nueva versión, con las preguntas mínimas ya definidas arriba, en una única transacción).
- Tool `buscar_documentos_gd`.
- Tool `consultar_documentos_gd` en modo `fulltext` únicamente, con una configuración de búsqueda en español que ignora acentos (`spanish_unaccent`, creada al aprovisionar la base — ver `scripts/aprovisionar_proyecto.py` del repo core).
- Probado de punta a punta contra una base Postgres real (proyecto de desarrollo interno, sin cliente todavía) y contra una réplica del árbol que produce `sync.py` del repo core.
- Con esto hay ya un piloto funcional mínimo, sin coste de IA externa.

**Fase 3 — Modo semántico** — hecho (2026-09-08)
- Proveedor de embeddings: **Mistral Embed** (`mistral-embed`, **1024 dimensiones — confirmado con una llamada real a la API**, no es el dato de catálogo de 1536 que traía OpenAI). La clave de API **la paga y gestiona la empresa (tenant) dueña del proyecto** (decidido 2026-09-08 — cada una la suya, no una clave global de la plataforma), desde el panel de administración del repo core (empresa → "Configuración IA"), cifrada en `mcpc_tenants`, nunca en un archivo del repo.
- Chunking por encabezados (`_mod_embeddings.py::chunkear_por_encabezados`) + generación de `gd_chunks` (`_mod_chunks.py`).
- `consultar_documentos_gd` ampliada para modo `semantico` (búsqueda por similitud de coseno con pgvector, operador `<=>`).
- Tool `activar_busqueda_semantica_gd` de backfill: cambia el modo y genera embeddings de todo lo ya guardado que sea buscable.
- `guardar_documento_gd` y `corregir_documento_gd` reindexan solos cuando el modo es semántico (ver `_reindexar_si_semantico` en `_herr_documentos.py`); las versiones que dejan de ser buscables (superadas por una nueva, sin histórico completo) se limpian solas.
- Probado de punta a punta contra Mistral real y Postgres real: activar, guardar (autoindexado), preguntar por dos aspectos distintos del mismo documento (cada uno prioriza el fragmento correcto), corregir (reindexa) y volver a preguntar (ya no aparece el dato viejo).
- **OpenAI disponible como alternativa** (2026-09-08, por si algún cliente lo prefiere — hoy todos usan Mistral por defecto): `gd_configuracion.proveedor_embedding` decide el proveedor real usado, elegible por cliente con `update_db.py --proveedor-embedding` al dar de alta su base (la dimensión del vector va fija en la columna, no se puede cambiar después sin migrar a mano). `_mod_embeddings.py` enruta a Mistral u OpenAI según ese valor; la clave de OpenAI se gestiona igual que la de Mistral, por empresa. Probado de verdad: la llamada llega a la API real de OpenAI (confirmado con un 401 de credenciales al usar una clave inválida — no es un fallo de código), y Mistral se comprobó que sigue funcionando igual tras el cambio.
- **Clave de API por empresa, no global** (2026-09-08): `database.config_db.get_mistral_api_key(alias_proyecto)` / `get_openai_api_key(alias_proyecto)` resuelven el proyecto → su tenant → la clave de ESE tenant. Probado de punta a punta contra el servidor real: guardar la clave desde "Configuración IA" de una empresa en el panel, y confirmar que `guardar_documento_gd`/`consultar_documentos_gd` la recogen sin ningún paso manual.

**Fase 4 — Corrección de markdown + documento completo**
- Tool `obtener_documento_completo_gd` — hecho (2026-09-07), probada de punta a punta (versión vigente, versión concreta, y los dos casos de error).
- Mecanismo de corrección (escenario B): **decidido 2026-09-08 — siempre el cliente, con su propia IA, sin revisión de nadie del equipo** (no hay capacidad para que alguien del equipo esté pendiente de corregir). Tool `corregir_documento_gd` — hecho, probada de punta a punta (corrige `markdown_actual`, conserva `markdown_original` intacto, marca `revisado_manualmente=true`, rechaza versiones inexistentes o de otro documento).

**Panel del cliente (`panel_cliente/`) — hecho (2026-09-08)**
- Decisión original: visualmente solo listado y búsqueda (solo lectura); guardar y corregir documentos sigue siendo exclusivamente por conversación con la IA — se valoró y se descartó subir archivos sin IA (markitdown vale para PDF digital, pero no para fotos/escaneados, que es justo el caso que peor resuelve un OCR sin IA). **Esto se quedó corto con el tiempo** — el panel ya tiene bastante más que lectura: archivar documentos, credenciales, estilos (con subida de imágenes) y usuarios, todo añadido después (ver más abajo). Lo que sigue intacto es el mecanismo de ingesta/corrección de documentos en sí: eso sigue siendo solo por conversación con la IA, nunca desde el panel.
- Reutiliza el login del panel de administración del repo core (mismo JWT, mismo usuario/contraseña de la empresa) y su sistema de roles por proyecto — no hay una segunda base de usuarios ni una segunda pantalla de login que mantener.
- Un tenant con varios proyectos de gestión documental ve un selector; con uno solo, entra directo — se resuelve por `mcpc_proyectos.tipo_producto = "gestion_documental"` (repo core), no hace falta que el cliente sepa nada del identificador del proyecto.
- Desplegado en `https://mcp-d.multiplika.net/gd`, servicio systemd propio (`multiplika_gd_panel`, puerto 8112) — primer proyecto de cliente con panel propio; `sync.py` del repo core ahora sabe sincronizar una carpeta `panel_cliente/` opcional (su frontend compilado no viaja por git, se copia aparte porque el servidor no tiene Node).
- Probado de punta a punta en producción real: login, selección de proyecto, listado, búsqueda por contenido, ver un documento completo creado de verdad a través del MCP, y que no se puede ver el proyecto de otra empresa ni sin tener rol asignado.

**Cómo compilar el frontend para producción (gotcha real, 2026-09-11):** `panel_cliente/frontend/vite.config.js` y `src/api.js` leen tres variables de entorno en build time — sin ellas, `npm run build` genera un `dist/` que solo funciona en local, no detrás del proxy de Apache:
```bash
cd panel_cliente/frontend
VITE_BASE=/gd/ VITE_API_ADMIN=/panel/v1 VITE_API_CLIENTE=/gd/v1 npm run build
```
Sin `VITE_BASE`, Vite genera rutas de assets absolutas desde la raíz (`/assets/...`) en vez de con el prefijo `/gd/` bajo el que vive el panel — el navegador pide `/assets/index-xxx.js` a un dominio que solo tiene `/gd/assets/index-xxx.js`, Apache lo devuelve 404 (no hay `ProxyPass "/assets"`, solo `/mcp`, `/panel` y `/gd`) y la página sale en blanco. Sin `VITE_API_ADMIN`/`VITE_API_CLIENTE`, `api.js` usa sus valores por defecto de desarrollo (`http://127.0.0.1:8001` y `:8002`) — localhost del navegador de quien entra al panel, no del servidor, así que cualquier llamada a la API falla con "Failed to fetch" aunque la página cargue bien. Al subir el `dist/` compilado siempre hay que borrar lo anterior (`rsync --delete`) — los ficheros llevan hash de contenido en el nombre, así que un `dist/` a medio actualizar puede dejar un `index.html` apuntando a un asset ya borrado.

**Archivar/desarchivar desde el panel — hecho (2026-09-09)**
Primera acción de escritura real del panel del cliente sobre documentos (hasta entonces solo lectura). Botón Archivar/Desarchivar en el detalle del documento, y una etiqueta gris "🗄 Archivado" tanto en el detalle como en el listado (que a partir de aquí incluye también los archivados, antes se excluían). Permiso: **para cualquiera con acceso al proyecto, no solo admins** — decidido así explícitamente: archivar es parte del día a día con los documentos, no una acción de administración como gestionar API keys. Probado de punta a punta contra `mcp-d.multiplika.net`.

**Credenciales y tabla de estilos — hecho (2026-09-09)**
- `gd_credenciales`: credenciales del cliente para servicios externos, cifradas, gestionadas solo desde el panel — ver "Credenciales" arriba. Tool `listar_credenciales_gd()`.
- `gd_estilos` / `gd_estilos_imagenes`: instrucciones e imágenes fijas por tipo de informe — ver "Tabla de estilos" arriba. Tools `listar_estilos_informe_gd()` / `obtener_estilo_informe_gd()` (más crear/actualizar/asignar a documento — ver "Escritura desde la IA y documentos guía").
- Primera vez que el panel del cliente permite escribir más allá de archivar: crear/editar estilos y credenciales, y subir imágenes (`multipart/form-data`, `python-multipart` añadido a `requirements.txt`).
- Probado de punta a punta contra `mcp-d.multiplika.net`: creación de una credencial y un estilo desde el panel (navegador real), subida de una imagen con miniatura visible, y verificación desde un cliente MCP real de que `listar_credenciales_gd()` nunca devuelve el valor y de que `obtener_estilo_informe_gd()` trae las instrucciones más la imagen como contenido nativo (bloque `image`, `mime_type` correcto). Datos de prueba limpiados al terminar.

**Migración del panel del cliente a Mantine — hecho (2026-09-10)**
Todas las pantallas (`Login`, `ElegirProyecto`, `Documentos`, `DocumentoDetalle`, `ApiKeys`, `Credenciales`, `Estilos`, `EstiloDetalle`) pasan de CSS a mano a componentes de `@mantine/core` — motivo: dos fallos visuales seguidos (una clase CSS usada sin existir, botones sin separación) por mantener estilos propios. `index.css` queda reducido al fondo de página. Mismo cambio hecho en el panel de administración del repo core (ver `docs/decisiones.md` de ese repo). Probado con capturas de pantalla reales de las ocho pantallas.

**Retoques posteriores a credenciales y estilos — hecho (2026-09-10)**
- Credenciales: el campo `valor` (contraseña/API key) llevaba usuario+contraseña como JSON cuando hacía falta — se corrigió el mismo día: `usuario` es ahora su propia columna, sin cifrar (no es secreto), visible para la IA; solo la contraseña sigue cifrada y oculta. Ver "Credenciales" arriba.
- Credenciales: el navegador ofrecía autorrellenar esos dos campos con contraseñas guardadas de otro sitio (los reconocía como un login) — `autoComplete="off"`/`"new-password"` más los atributos que respetan 1Password/LastPass.
- Estilos: la caja de instrucciones (`rows={6}`/`{4}`) se quedaba corta y obligaba a hacer scroll — ahora `autosize` (crece con el contenido, hasta 30-40 líneas antes de scrollar) y con fuente monoespaciada en el detalle.

**Pantalla de usuarios en el panel del cliente — hecho (2026-09-10)**
Antes, dar de alta un usuario de la empresa o asignarle un rol en un proyecto era cosa exclusiva de superadmin (repo core, por curl) — el cliente tenía que pedírselo al equipo. Decisión (a petición explícita del usuario): el admin_tenant de un proyecto también puede, y se le da una pantalla para hacerlo sin salir de este panel (`Usuarios.jsx`, botón "Usuarios" junto a API keys/Credenciales/Estilos, visible solo si `proyecto.es_admin`). Reutiliza tal cual los endpoints del panel de administración del repo core (mismo JWT, mismo patrón que `login`/`listarProyectosDeLaEmpresa` — ver `docs/decisiones.md` del core → "Alta de usuarios: también admin_tenant"), así que no hay lógica de permisos duplicada aquí. `ver_proyecto` (`GET /v1/proyectos/{id}`) devuelve ahora también `id_tenant`, necesario porque los usuarios son por tenant, no por proyecto. Sin edición ni borrado de usuarios en ningún sitio — a propósito.

Probado con una usuaria real (no el enlace de soporte de superadmin): login normal con su propio email/contraseña, ve el botón, crea otro usuario ella sola sin que nadie del equipo intervenga. Datos de prueba limpiados al terminar.

**Conservar el archivo original — planificado (2026-09-10), pendiente de implementar**

Hoy solo se guarda el markdown que genera la IA; la foto o el PDF que sube el cliente se descarta. Riesgo real para un cliente tipo gestoría: si la IA lee mal algo, o si hace falta el escaneado original para algo legal, no está en ningún sitio. Diseño acordado con el usuario, sin implementar todavía:

- **Nueva tabla `gd_versiones_originales`** (no columnas dentro de `gd_versiones`, para no arrastrar binarios pesados en cada búsqueda/listado normal): `id`, `id_version` (FK → `gd_versiones.id`, única — una por versión, ON DELETE CASCADE), `archivo` (BLOB/BYTEA), `tipo_mime`, `nombre_fichero` (opcional), `fecha_alta`. No todas las versiones tendrán fila aquí — una corrección (`corregir_documento_gd`) no sube archivo nuevo.
- **`guardar_documento_gd` gana tres parámetros opcionales**: `archivo_original_base64`, `archivo_tipo_mime`, `archivo_nombre`. Opcionales para no romper casos sin archivo real, pero la propia herramienta debe instruir a la IA para que los mande siempre que tenga el archivo.
- **Vía de subida decidida**: la IA manda el archivo junto con el markdown, en la misma llamada — no una subida aparte desde el panel. Motivo: un solo paso, no cambia el flujo actual de conversación. Riesgo aceptado y pendiente de probar: un PDF escaneado de muchas páginas podría no caber bien en una llamada — validar con un caso real grande antes de darlo por cerrado.
- **Base64 solo de paso, nunca almacenado así**: es la única forma de que el archivo viaje dentro de una llamada a herramienta (JSON no lleva binario), pero en cuanto llega se decodifica y se guarda como binario de verdad (BYTEA) — un archivo en base64 ocupa un 33% más que en binario, y con miles de documentos acumulándose se nota.
- **Recuperación**: botón "Descargar original" en el detalle del documento del panel, mismo patrón que las imágenes de estilos (`GET .../documentos/{id}/original/contenido`, autenticado, sirve el binario con su `tipo_mime`). Exponerlo también a la IA (para que pueda mostrarlo/adjuntarlo) queda como posible fase 2, no imprescindible para la primera versión.

**Fase 5 — Piloto con un cliente real**
- Elegir el primer cliente, probar el ciclo completo (subir, consultar, corregir) y ajustar según lo que salga.
- Pendiente: modelo de coste al cliente por el uso de embeddings — decisión de negocio, no técnica.

## Cinco mejoras planificadas (2026-09-10), pendientes de implementar

Diseño acordado con el usuario para las cinco ideas que quedaron solo anotadas. Se implementan en este orden, de más a menos autocontenida.

### 1. Filtros en la búsqueda del panel — implementado y probado (2026-09-10)

`GET /v1/proyectos/{id}/documentos` acepta ahora parámetros opcionales `tipo_documento` y `fecha_desde`/`fecha_hasta` (no a la búsqueda por contenido, que sigue siendo solo el texto — son dos modos que no se combinan), con un `Select` de tipo y dos selectores de fecha en `Documentos.jsx`.

A mitad de esta implementación el cliente pidió que la lista de tipos dejara de ser cerrada — ver "Tipos de documento" más arriba, que se implementó primero por ser un prerrequisito: el `Select` de este filtro ahora carga sus opciones desde `listar_tipos_documento_gd()`/`GET /v1/proyectos/{id}/tipos-documento` en vez de una lista fija en el frontend.

### 2. Documentos pendientes: la pieza compartida por subida masiva e ingesta por email — implementado y probado (2026-09-10)

Decidido con el usuario: cuando un documento llega **sin nadie delante** (un lote subido al panel, o un email reenviado), no puede pasar por las preguntas que la IA siempre hace (tipo, nombre, si es una versión nueva...) — así que se queda **pendiente** hasta que el cliente habla con su IA, que lo procesa entonces con las mismas preguntas de siempre. No cambia la regla de "la IA siempre pregunta", solo cambia cuándo pregunta.

```
gd_documentos_pendientes
  - id
  - archivo         BLOB (BYTEA)   -- el fichero tal cual llegó
  - tipo_mime        VARCHAR(50)
  - nombre_original   VARCHAR(255)   -- nombre de fichero o asunto del email
  - origen            ENUM('panel', 'email')
  - fecha_alta         TIMESTAMP
```

Tools MCP:
- `listar_documentos_pendientes_gd()` — metadatos de lo que hay en la cola (nombre, origen, fecha), para que la IA pueda avisar al cliente ("tienes 2 documentos nuevos, ¿los proceso?") al empezar una conversación.
- `obtener_documento_pendiente_gd(id)` — devuelve el fichero como contenido de imagen/archivo nativo de la respuesta (mismo mecanismo que las imágenes de estilos: `Image` para `image/*`, `File` para el resto — PDF incluido), para que la IA pueda leerlo de verdad antes de preguntar.
- `guardar_documento_gd` gana un parámetro opcional `id_documento_pendiente` — si se indica, al guardar con éxito borra esa fila de la cola.

**Subida masiva** (vía panel): `GET/POST /v1/proyectos/{id}/documentos-pendientes` (POST multipart, campo repetido `archivos`, una fila por fichero) y `DELETE /v1/proyectos/{id}/documentos-pendientes/{id_pendiente}` para descartar uno sin procesarlo. Abierto a cualquier usuario del proyecto (no solo admin) — mismo criterio que archivar/desarchivar: es día a día con documentos, no configuración sensible. `Documentos.jsx` tiene un botón "Subir documentos" (selector múltiple) y, si hay algo en cola, una tabla pequeña con botón "Descartar" por fila.

**Ingesta por email**: el proceso que lee el correo entrante inserta en esta misma tabla, con `origen='email'` (ver "3. Ingesta por email").

### 3. Ingesta por email — implementado (2026-09-10, rediseñado el mismo día)

**Diseño descartado primero, y por qué:** la idea inicial era un buzón/dominio compartido de la plataforma (`<algo-por-cliente>@documentos.multiplika.net`), con `getmail` entregando a un script vía Postfix. Al ir a montarlo, la tabla `mail_domain` de ISPConfig estaba vacía — no hay ningún dominio de correo dado de alta en este servidor — así que hacía falta crear uno nuevo, tocando DNS del dominio raíz. Se probó un atajo (una dirección bajo el propio hostname del servidor, `facturae.multiplika.net`, que Postfix ya acepta sin tocar DNS, con un alias en `/etc/aliases` que canaliza el correo directo a un script) y **el usuario lo frenó a tiempo**: no tiene sentido depender de una dirección del servidor cuando cada cliente de Gestión Documental ya tiene su propia cuenta de correo de empresa. Diseño final, mucho más simple: **cada cliente da de alta SU PROPIA cuenta de correo** (la que ya usa) en el panel, y esa misma cuenta sirve para las dos cosas — mandar los avisos de caducidad y recibir documentos.

```
gd_configuracion (añadido a la fila única)
  - email_cuenta_direccion         VARCHAR(255)
  - email_cuenta_usuario           VARCHAR(255)  -- login SMTP/IMAP si es distinto de la dirección
  - email_cuenta_password_cifrada  VARCHAR(500)  -- Fernet, lib.cifrado, igual que gd_credenciales
  - email_cuenta_smtp_host / _smtp_port (587) / _smtp_seguridad ENUM('starttls','ssl','ninguna')
  - email_cuenta_imap_host / _imap_port (993) / _imap_seguridad ENUM('ssl','starttls','ninguna')
```

`_seguridad` es explícito, elegido por el cliente en el panel — la primera versión lo adivinaba por el puerto (465 = SSL, cualquier otro = STARTTLS, e IMAP siempre SSL), lo que no vale para configuraciones fuera de lo habitual. El usuario lo pidió al revisar la pantalla.

- Panel: `GET/PUT /v1/proyectos/{id}/configuracion/cuenta-email` (solo admin) — pantalla "Cuenta de correo" (botón junto a los demás en `Documentos.jsx`). El `GET` nunca devuelve la contraseña, aunque esté guardada; el `PUT` solo la sobrescribe si se manda una nueva (dejarla vacía no la borra) — mismo patrón que `gd_credenciales`.
- `scripts/revisar_correo_entrante.py` (cron cada 15 min, `mcp_gd_revisar_correo`): por cada proyecto con cuenta configurada, se conecta por IMAP, busca correos no leídos, extrae los adjuntos válidos (imagen o PDF) de cada uno, los inserta en `gd_documentos_pendientes` con `origen='email'`, y marca el correo como leído (tenga o no adjuntos válidos, para no revisarlo otra vez). Una cuenta mal configurada (contraseña caducada, servidor caído...) de un cliente no impide revisar la de los demás — mismo `try/except` por proyecto que ya lleva `avisar_caducidades.py`.
- `scripts/avisar_caducidades.py` (ver "4." más abajo) se actualizó para mandar los avisos desde esta misma cuenta por SMTP, en vez de desde un remitente compartido del servidor.

**Probado:** el parseo MIME/extracción de adjuntos (con un correo sintético) y el CRUD del panel — de punta a punta con una cuenta IMAP/SMTP real todavía no, porque hace falta una cuenta de verdad para probarlo (una cuenta de prueba del propio usuario, o una que cree para el caso).

**Bug real encontrado al probar el CRUD del panel (2026-09-10):** `actualizar_cuenta_email` solo protegía la contraseña de un `PUT` parcial — el resto de campos (dirección, usuario, hosts, puertos) se escribían literalmente, así que corregir un solo campo (p.ej. el host SMTP) borraba todo lo demás ya guardado a `NULL`. Arreglado igual que la contraseña: solo se actualizan los campos que llegan con un valor (no `None`). Verificado por revisión de código y por la lógica ya probada del mismo patrón en la contraseña; no se ha vuelto a lanzar el test de extremo a extremo tras el arreglo.

### 4. Fechas de caducidad y avisos proactivos por email — implementado (2026-09-10)

- `gd_versiones.fecha_caducidad` (DATE, opcional) — junto a `fecha_documento`, no en `gd_documentos`: la caducidad es del contenido de esa versión concreta (un contrato renovado es, en la práctica, otra fecha). `gd_versiones.aviso_caducidad_enviado` (BOOLEAN) acompaña al campo: **un solo aviso por documento, no un recordatorio diario** (decidido explícitamente por el usuario al planificar esto) — se marca a `true` en cuanto se manda el correo, para no repetirlo.
- `guardar_documento_gd` gana un parámetro opcional `fecha_caducidad`.
- Tool `listar_documentos_por_caducar_gd(dias=30)` — para que la IA pueda responder si se le pregunta (independiente del aviso proactivo).
- **Aviso proactivo por email**: `gd_configuracion.email_avisos` (a quién avisar; NULL desactiva el aviso), gestionable desde el panel (`GET/PUT /v1/proyectos/{id}/configuracion/avisos`, solo admin — pantalla "Avisos de caducidad", botón junto a los demás en `Documentos.jsx`) sin depender de nosotros. Script diario `scripts/avisar_caducidades.py` (cron `mcp_gd_avisos_caducidad`, 07:15 — mismo patrón que `backup_diario.py` del core: recorre `mcpc_proyectos` con `motor='postgres'` y `tipo_producto='gestion_documental'`) que, por cada proyecto con algo por caducar y `email_avisos` configurado, manda UN correo con todo lo pendiente y marca esas versiones como avisadas — **por SMTP desde la cuenta de correo propia del cliente** (`gd_configuracion.email_cuenta_*`, ver "3. Ingesta por email" — mismo mecanismo, se comparte la misma cuenta), sin remitente compartido de la plataforma. Sin cuenta configurada, o sin `email_avisos`, se omite ese proyecto.

**Bug real encontrado al probarlo end-to-end (2026-09-10):** el envío por `smtplib` no tenía manejo de errores — un `email_avisos` mal configurado (buzón inexistente, dominio caído...) de UN solo cliente propagaba la excepción hasta abortar el script entero, dejando sin avisar a TODOS los demás clientes esa noche (sin pérdida de datos: al no marcarse `aviso_caducidad_enviado`, se reintenta solo con la siguiente ejecución diaria, pero silenciosamente hasta entonces). Arreglado con un `try/except` alrededor del envío en `_procesar_proyecto()`, que solo salta ese proyecto y sigue con el resto. Autocontenido a propósito (SQL en línea contra `gd_versiones`/`gd_documentos`/`gd_configuracion`, sin pasar por `database/modelos` de este repo) para no depender de que sus imports relativos funcionen fuera del árbol de despliegue del servidor MCP — ver el docstring del propio script para el razonamiento completo. Desplegado junto a `panel_cliente/`, en `apps/mcp_server/paneles_cliente/multiplika_gestion_documental_mcp/scripts/`.

### 5. Exportar un informe a PDF — implementado (2026-09-10)

Sencillo para empezar (texto formateado + logo, no maquetación compleja). Tool `generar_informe_pdf_gd(markdown, nombre_archivo, nombre_tipo_estilo=None)`: convierte el markdown que acaba de escribir la IA a HTML (biblioteca `markdown`) y de ahí a PDF (`WeasyPrint` — valorado `pandoc`, no está instalado en el servidor y añadiría una dependencia externa al margen de Python), incrustando las imágenes fijas del estilo indicado (si se pasa uno) al principio del documento, y devuelve el PDF como contenido de archivo nativo de la respuesta (la IA se lo entrega al cliente directamente, sin pasar por el panel).

**Infraestructura de servidor que hizo falta (no solo pip):** WeasyPrint necesita bibliotecas nativas del sistema (Pango, Cairo, GDK-Pixbuf, GObject) — `libgdk-pixbuf-2.0-0` no estaba instalada en `mcp-d`; el mirror `security.debian.org` tenía el índice caducado para la versión exacta esperada, así que se instaló la versión equivalente disponible en el mirror normal (`apt-get install libgdk-pixbuf-2.0-0=2.42.2+dfsg-1+deb11u2 ...`).

**Gotcha real de conda encontrado al probarlo:** el proceso del servidor MCP corre en un entorno conda (`py313mcp`) **compartido por las herramientas de todos los proyectos**. Ese entorno trae su propio `libffi`, incompatible con el `libgobject` del sistema que WeasyPrint carga por `dlopen` (fallo real: `undefined symbol: ffi_type_uint32, version LIBFFI_BASE_7.0`). Instalar Pango/Cairo/GObject vía `conda install -c conda-forge pango` habría sido la solución "de manual", pero el servidor solo tiene ~1 GB de RAM libre y sin swap — el solver de conda-forge se quedó sin memoria y el proceso murió (`Terminado (killed)`), en un servidor que aloja más servicios además de este. Se descartó por riesgo de tumbar algo más mientras resuelve.

Solución adoptada, sin tocar el entorno compartido: `generar_informe_pdf_gd` lanza el render de WeasyPrint en un **subproceso aparte** (`asyncio.create_subprocess_exec`, HTML por stdin, PDF por stdout), con `LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libffi.so.7` puesto solo en el entorno de ese subproceso — fuerza a usar el libffi del sistema (compatible con el gobject del sistema) sin cambiar nada del proceso principal del servidor ni de las demás herramientas que comparten ese mismo entorno conda.

---

Orden de implementación: 1 → 2 (con subida masiva) → 5 → 4 → 3. Las cinco, implementadas y desplegadas el 2026-09-10 — la 3 tuvo que rediseñarse a mitad de camino (ver su apartado: se descartó un buzón/dominio propio de la plataforma a favor de que cada cliente use su propia cuenta de correo).

## Normativas legales como caso de uso (2026-09-11)

Un cliente puede usar la Gestión Documental para consultar normativas legales (leyes, reglamentos, órdenes) además de sus propios documentos. No hizo falta esquema nuevo salvo dos campos:

- **Tipo de documento**: `"normativa"` como cualquier otro valor de `tipo_documento` — el catálogo ya es texto libre (ver "Tipos de documento" más arriba), no hace falta ningún cambio.
- **Vigente / derogada**: ya cubierto por el mecanismo de versiones existente. Cuando una normativa se sustituye por otra, es una nueva versión del mismo documento (`guardar_documento_gd` con `id_documento_existente`): la anterior deja de ser `vigente` pero queda en el histórico, tal cual ya funciona hoy para cualquier documento corregido.
- **`gd_versiones.url_origen`** (VARCHAR(1000), opcional, campo nuevo): URL pública de donde se leyó esa versión (p.ej. la ficha del BOE de esa publicación concreta). Es solo referencia para poder volver a consultar la fuente si hace falta — el markdown guardado sigue siendo la fuente de verdad, no se depende de que la URL siga viva. Cada versión de una normativa suele tener su propia URL oficial (una revisión posterior es una publicación distinta), así que vive en `gd_versiones`, no en `gd_documentos`.
- **`gd_documentos.ambito`** (VARCHAR(50), opcional, campo nuevo, 2026-09-11): ámbito de aplicación — p.ej. "nacional", "autonómica", "privada" para normativas. Texto libre como `tipo_documento`, pero sin catálogo de sugerencias (a diferencia de `gd_tipos_documento`): son pocos valores esperados y no aplica a todos los tipos de documento (una factura no tiene ámbito). Vive en `gd_documentos`, no en `gd_versiones` — no cambia entre versiones del mismo documento. Solo se fija al crear el documento (parámetro `ambito` de `guardar_documento_gd`); no se puede cambiar al subir una versión nueva de uno ya existente, igual que `tipo_documento`. Decidido explícitamente para NO meterlo dentro de `tipo_documento` (p.ej. "normativa nacional", "normativa autonómica") porque el filtro de tipo del panel dejaría de poder agrupar todas las normativas juntas.

**Flujo de ingesta desde una URL**: no hay una tool de descarga en el servidor MCP — es el propio cliente IA (Claude Desktop/Code, con su capacidad de leer URLs) quien descarga y lee el PDF, igual que hoy lee un PDF adjunto en la conversación. `guardar_documento_gd` gana el parámetro opcional `url_origen` para guardar esa referencia; el resto del pipeline (preguntas de siempre, markdown, indexado) no cambia.

Implementado y desplegado (2026-09-11): columnas en `_dep_versiones.py`/`_dep_documentos.py`, parámetros en `guardar_documento()` (`database/modelos/_mod_versiones.py`) y en la tool `guardar_documento_gd` (`mcp_server/herramientas/_herr_documentos.py`), devueltos también por `obtener_documento_completo_gd` y por el detalle de documento del panel (`GET /v1/proyectos/{id}/documentos/{id}`, mostrado en `DocumentoDetalle.jsx` como filas "Fuente" y "Ámbito" de la tabla de metadatos). Migración (`update_db.py`) aplicada en la base del proyecto de pruebas interno (`desarrollo_interno_gestion_documental_dev`) — sigue pendiente para cualquier otra base de cliente que se provisione antes de tener esto ya en su `update_db.py` de referencia (hoy no hay ninguna: solo existe ese proyecto de pruebas).

### Ayuda para el cliente: mismo texto en la IA y en el panel (2026-09-11)

El cliente puede preguntarle a su IA "¿cómo funciona esto?" y también quiere un sitio equivalente en el panel — un único texto explicando todo el flujo (guardar, cola de pendientes, buscar, corregir, versiones, archivar, caducidades, normativas/ámbito, informes PDF, qué se gestiona desde el panel), sin mantener dos redacciones distintas.

**Dónde vive el contenido:** `database/ayuda_gd.py` (constante `TEXTO_AYUDA_GD`, markdown en texto plano) — no en `docs/` porque `sync.py` no despliega `docs/` a ningún sitio (ver "Cómo se organizan los proyectos" del repo core), y `database/` sí: es la única carpeta que `sincroniza_proyectos()` copia **entera** tanto a `apps/mcp_server/proyectos/p<id>/database/` (para las tools MCP) como a `apps/mcp_server/paneles_cliente/<repo>/database/` (para el panel) — ver "Cómo compilar el frontend..." más arriba sobre esa doble copia. Poniendo el contenido ahí, con el mismo import relativo `..database.ayuda_gd` que ya usan `modelos`/`dependencias`, un solo archivo de origen llega a los dos árboles de despliegue sin duplicar texto ni depender de rutas de fichero calculadas a mano (que además serían distintas en cada árbol).

- Tool MCP **`obtener_ayuda_gd()`** (`mcp_server/herramientas/_herr_documentos.py`): devuelve el texto tal cual, para que la IA lo use en conversación.
- Panel: **`GET /v1/ayuda`** (`panel_cliente/servidor.py`) — sin autenticación ni proyecto, es contenido estático igual para cualquier cliente. Pantalla nueva "Ayuda" (`Ayuda.jsx`), enlazada con un botón más en `Documentos.jsx`/`App.jsx`, mismo patrón de texto monoespaciado que ya usa `DocumentoDetalle.jsx` para el markdown de un documento (no hace falta una librería de renderizado de markdown para esto).

**Por partes (2026-09-29):** la ayuda se reescribió al día y se partió en secciones (`SECCIONES_AYUDA_GD`: `id`, `titulo`, `resumen`, `markdown`) en el mismo orden que el menú del panel — primeros pasos, conectar la IA, documentos y las pestañas de su ficha (pendientes, comentarios, enviar, compartir, caducidades), tipos, estilos, registros, reglas, grupos, entidades, scripts, actividad, chat, administración, credenciales/buzones y GDs enlazadas. `TEXTO_AYUDA_GD` sigue existiendo como todo junto.
- `obtener_ayuda_gd(seccion=None)`: sin sección devuelve el índice; con sección, solo esa parte; con un id que no existe, el índice. Solo se usa cuando el usuario pide ayuda: el núcleo ya no la mete en el `initialize` (decisión del usuario, ver docs/decisiones.md del núcleo), y las notas que eran para la IA (actividad, compartir, cuándo usar registros) pasaron a los docstrings de sus tools.
- `GET /v1/ayuda` devuelve el índice (`{"secciones": [{id, titulo, resumen}]}`) y `GET /v1/ayuda/{id_seccion}` una parte (404 si no existe). `Ayuda.jsx` muestra el índice a la izquierda y la parte elegida a la derecha.
- Al añadir una pantalla o función nueva, añadir o ampliar su sección aquí; la dirección del servidor MCP ya no va fija (antes decía mcp-d), cada cliente tiene la suya.

### Formularios MCP (elicitation) para datos que da el cliente (2026-09-15)

Hasta ahora, los datos que solo puede rellenar el cliente (nunca deducirlos del contenido) se le pedían en texto suelto por chat, uno detrás de otro. El protocolo MCP tiene un mecanismo pensado justo para esto — **elicitation**: la propia tool le pide a la aplicación (Claude Desktop/Code, ChatGPT en modo desarrollador...) que le muestre un formulario de verdad al cliente; la respuesta vuelve a la tool ya estructurada, sin que la IA tenga que transcribir ni interpretar nada. `fastmcp` (framework ya usado por el core) lo trae de serie: `ctx: Context` como parámetro de la tool (FastMCP lo inyecta solo, no aparece en el esquema que ve la IA) y `await ctx.elicit(mensaje, response_type=UnModeloPydantic)`.

Dos tools migradas a este mecanismo:

- **`guardar_documento_gd`**: los campos que "se preguntan siempre al cliente" (nombre, tipo de documento, fecha del documento, fecha de caducidad, ámbito, si el histórico debe quedar buscable) salen de la firma de la tool y se piden con un formulario (`_DatosDocumento`) en cuanto se llama. Lo que sigue siendo parámetro de la tool es lo que decide la propia IA a partir de la conversación o del contenido: `markdown`, `id_documento_existente` (tras confirmar con `buscar_documentos_gd`), `id_documento_pendiente`, `url_origen`, `borrador`, `incumplimientos`. El mensaje del formulario incluye los tipos de documento ya usados en el proyecto (consultando `gd_tipos_documento`), a modo de sugerencia.
- **`crear_credencial_gd`** (tool nueva): antes solo se podía dar de alta una credencial desde el panel, precisamente para que su valor no quedara escrito en la conversación con la IA (ver "Credenciales" más arriba). Con elicitation esa razón deja de obligar a pasar por el panel: el formulario (`_DatosCredencialNueva`) recoge nombre/descripción/valor/usuario directamente del cliente, y el valor va del formulario al servidor sin que la IA lo vea ni lo escriba en ningún mensaje — igual de seguro que el panel, pero sin salir de la conversación. Editar o borrar una credencial ya creada sigue siendo solo desde el panel (no hay tool para eso).

Si el cliente cierra el formulario sin rellenarlo (`action != "accept"`), la tool falla con `ToolError` y la propia IA debe avisar de que no se ha guardado nada, sin insistir ni pedir los datos por chat como alternativa.

**Sin probar todavía contra un cliente MCP real** (ni Claude ni ChatGPT) — depende de que la aplicación que conecta soporte elicitation; en ChatGPT hace falta además su "Developer Mode". Antes de dar esto por bueno hay que verificarlo con una conexión real.

### Notas de seguimiento: comentarios, anotaciones, observaciones, incidencias (2026-09-16; se llamaban "registros" hasta el 2026-09-28, ver el renombrado al final de este apartado)

El cliente quiere poder dejar comentarios/anotaciones/observaciones sobre un documento, abrir incidencias con un responsable asignado, resolverlas dejando constancia de cómo, relacionar estas notas entre sí, y que todo eso siga disponible aunque el documento tenga una versión nueva.

**Decisión clave — una sola tabla (`gd_notas`), no cinco.** Un campo `tipo` (`comentario` / `anotacion` / `observacion` / `incidencia` / `resolucion`) distingue cada caso. Ventaja principal: relacionar dos notas entre sí es la misma mecánica sea cual sea su tipo, y una resolución no deja de ser más que una nota de tipo `resolucion` enlazada a su incidencia — no hace falta un mecanismo aparte para "resolver".

- **Cuelga de `gd_documentos`, no de `gd_versiones`** — a propósito, para que una nota siga apareciendo entera con cualquier versión nueva del documento sin copiarla ni migrarla. Lleva además `id_version_origen` (nullable, informativo): en qué versión estaba el documento cuando se creó, pero nunca decide en qué versiones se ve.
- **`creado_por` es texto libre, no un id de usuario real.** Desde el panel se podría resolver de sobra (hay sesión, `puede_editar_documento_actual` ya da el `id_usuario`, ver "Edición desde el panel"), pero desde una tool MCP no hay una identidad de persona fiable — la API key identifica al proyecto, no a quién escribe en ese momento del chat. En vez de dos mecanismos distintos según el origen, un único campo de texto: el panel lo rellena solo con el nombre real de quien tiene la sesión, y por chat se le pregunta a la IA que lo pida si no lo sabe ya (nunca que lo invente).
- **`responsable` es texto libre en cualquier tipo de nota, no solo en incidencias** — decisión explícita del cliente: no hace falta que sea un usuario real del sistema, y no vale la pena limitarlo a un tipo concreto.
- **`estado` (`abierta`/`resuelta`) solo tiene sentido en incidencias** — estructuralmente disponible en cualquier nota (columna nullable en la misma tabla, no una tabla aparte) por simplicidad, pero NULL fuera de ese tipo.
- **Relaciones en tabla aparte (`gd_notas_relaciones`)**, no una columna `id_nota_padre`: una nota puede relacionarse con más de una, y en cualquier dirección. `tipo_relacion` es una etiqueta libre (p.ej. "relacionado", "duplica"); `"resuelve"` la pone siempre `resolver_incidencia()`, nunca a mano — así una incidencia resuelta tiene garantizado tener su resolución enlazada (misma transacción: crear la nota de resolución, crear la relación, marcar `estado='resuelta'`).
- **Crear una `resolucion` directamente está bloqueado** (`crear_nota()` solo acepta los otros cuatro tipos) — la única vía es `resolver_incidencia_gd`/el endpoint de resolver, para que ese invariante (incidencia resuelta ⇒ resolución enlazada) no se pueda romper por otro camino.

**Tools MCP** (`mcp_server/herramientas/_herr_notas.py`): `crear_nota_documento_gd`, `listar_notas_documento_gd`, `resolver_incidencia_gd`, `asignar_responsable_nota_gd`, `relacionar_notas_gd`. Sin elicitation aquí — a diferencia de `guardar_documento_gd`/`crear_credencial_gd`, `creado_por`/`responsable` son campos sueltos de bajo riesgo (no secretos, no un cluster de varios campos), así que van como parámetro normal de la tool con instrucción en el docstring de preguntarlos por chat en vez de inventarlos.

**Panel**: sección nueva "Comentarios e incidencias" en `DocumentoDetalle.jsx` (`componentes/NotasDocumento.jsx`) — listar, crear, resolver, asignar responsable y relacionar, todo desde la ficha del documento. Mismo criterio de permisos que editar el documento (`puede_editar_documento_actual`): invitado puede leer, no crear.

**Estado (2026-09-16): implementado y desplegado en los 4 servidores** (`mcp-d`, `maderascilpe`, `mgsasesores`, `adimelsl`), esquema aplicado sobre Postgres real en las 4 bases sin tocar datos existentes (verificado contando filas de `gd_documentos`/`gd_versiones` antes y después). Sin probar todavía con un cliente MCP real end-to-end (Claude Desktop/Code) ni desde el panel en producción — pendiente de una prueba real antes de darlo por cerrado del todo.

Quién decidió: usuario (confirmado en conversación, incluida la decisión explícita de que `responsable` sea libre en todos los tipos).
Reversible: sí — son dos tablas nuevas, sin tocar ninguna existente; quitar las tools/el endpoint/la sección del panel no afecta a nada más.

#### Renombrado a "notas" (2026-09-28, decisión del usuario)

`gd_registros` → `gd_notas` y `gd_registros_relaciones` → `gd_notas_relaciones`, con sus columnas `id_registro_origen`/`id_registro_destino` → `id_nota_origen`/`id_nota_destino`. Motivo: hacía falta el nombre "registro" para los **registros de datos** (anotaciones estructuradas con su propio modelo, ver `docs/planificacion/registros-y-modelos-de-registro.md`), y tener dos cosas distintas llamadas igual confundiría a la IA y al cliente todos los días.

Se eligió "nota" y no "anotación" (la palabra que usó el usuario) porque `anotacion` es ya uno de los cinco valores de `tipo` dentro de esa misma tabla: habría reproducido la confusión en pequeño.

Momento aprovechado: las seis bases de los cinco servidores tenían 4 filas en total (4 comentarios y 1 relación, en Codemartia). Renombrar con datos de verdad dentro habría sido otra conversación.

Cambia también lo que ve la IA: `crear_registro_documento_gd` → `crear_nota_documento_gd`, `listar_registros_documento_gd` → `listar_notas_documento_gd`, `asignar_responsable_registro_gd` → `asignar_responsable_nota_gd`, `relacionar_registros_gd` → `relacionar_notas_gd` (`resolver_incidencia_gd` no cambia). Y las rutas del panel `/documentos/{id}/registros…` → `/documentos/{id}/notas…`, más `total_registros` → `total_notas` en el listado de documentos.

**Cómo se aplicó en cada base** (el `ManagerDB` no entiende de renombrados: con el nombre nuevo en el código habría creado una tabla vacía y dejado la vieja con los datos dentro):

```sql
ALTER TABLE gd_registros RENAME TO gd_notas;
ALTER TABLE gd_registros_relaciones RENAME TO gd_notas_relaciones;
ALTER TABLE gd_notas_relaciones RENAME COLUMN id_registro_origen TO id_nota_origen;
ALTER TABLE gd_notas_relaciones RENAME COLUMN id_registro_destino TO id_nota_destino;
-- índices y restricciones, que en Postgres conservan el nombre viejo al renombrar la tabla
ALTER INDEX gd_registros_pkey RENAME TO gd_notas_pkey;
ALTER INDEX gd_registros_relaciones_pkey RENAME TO gd_notas_relaciones_pkey;
ALTER INDEX id_registro_origen_idx RENAME TO id_nota_origen_idx;
ALTER INDEX id_registro_destino_idx RENAME TO id_nota_destino_idx;
ALTER TABLE gd_notas RENAME CONSTRAINT gd_registros_id_documento_fkey TO gd_notas_id_documento_fkey;
ALTER TABLE gd_notas RENAME CONSTRAINT gd_registros_id_version_origen_fkey TO gd_notas_id_version_origen_fkey;
ALTER TABLE gd_notas_relaciones RENAME CONSTRAINT gd_registros_relaciones_id_registro_origen_fkey TO gd_notas_relaciones_id_nota_origen_fkey;
ALTER TABLE gd_notas_relaciones RENAME CONSTRAINT gd_registros_relaciones_id_registro_destino_fkey TO gd_notas_relaciones_id_nota_destino_fkey;
-- el registro interno del ORM, que compara contra lo que tiene apuntado
DELETE FROM estructura_actual WHERE tabla IN ('gd_registros', 'gd_registros_relaciones');
```

Después, el script de esquema con `TABLA_NOTAS`/`TABLA_NOTAS_RELACIONES` vuelve a apuntar la estructura con el nombre nuevo (todo lo que emite es `IF NOT EXISTS` sobre lo que ya existe renombrado). Orden por servidor: copiar el código nuevo sin reiniciar → renombrar en la base → reiniciar `multiplika_mcp` y el panel. Vuelta atrás: el mismo SQL al revés.

### Aviso de incidencias abiertas por email (2026-09-17)

Mismo problema que resolvió "Fechas de caducidad y avisos proactivos por email" (más arriba), aplicado a incidencias: si nadie entra al panel ni le pregunta a la IA, abrir una incidencia y asignarle un responsable no avisa a nadie de que existe.

**Decisión: un aviso por asignación, no un recordatorio diario mientras siga abierta.** Se valoró mandar un resumen diario con todo lo abierto (como hace `avisar_caducidades.py` cada día hasta que caduca), pero una incidencia puede tardar semanas en resolverse — recibir el mismo aviso cada día durante ese tiempo es ruido, no ayuda a que se resuelva antes. En vez de eso: columna `gd_notas.aviso_responsable_enviado` (mismo patrón que `gd_versiones.aviso_caducidad_enviado`), y `NotasCRUD.actualizar_responsable()` la reinicia a `false` cada vez que cambia el responsable — así reasignarla sí vuelve a avisar (a quien corresponda ahora), pero dejarla como está no genera más correos.

**El correo va a `email_avisos`, no al responsable directamente** — `responsable` es texto libre (ver decisión de arriba), no necesariamente un email real ni un usuario del sistema, así que no hay a quién escribirle de forma fiable. El cuerpo del correo menciona el nombre del responsable en cada línea para que quien lo reciba (normalmente un admin, la misma persona que ya recibe los avisos de caducidad) sepa a quién avisar.

**`scripts/avisar_incidencias.py`** — autocontenido, mismo patrón exacto que `avisar_caducidades.py` (SQL en línea, no importa `database/modelos`, recorre `mcpc_proyectos` con `motor='postgres'` y `tipo_producto='gestion_documental'`, manda desde la cuenta de correo propia del cliente, un fallo de un proyecto no tumba a los demás). Cron `mcp_gd_avisos_incidencias`, 07:20 (justo después del de caducidad, 07:15, para no competir por la misma conexión SMTP del cliente al mismo tiempo).

Quién decidió: usuario pidió "programar esos avisos" tras una recomendación del asistente; el diseño concreto (una vez por asignación, destinatario `email_avisos`) lo decidió el asistente por las razones de arriba — a revisar si no encaja con lo que el cliente esperaba.
Reversible: sí — una columna nueva (`aviso_responsable_enviado`, `NOT NULL DEFAULT false`, no rompe nada existente) y un script/cron independiente; quitar el cron basta para desactivarlo del todo.

### El responsable puede llevar su propio email (2026-09-17)

A los pocos minutos de cerrar lo de arriba, pregunta obvia en retrospectiva: si `responsable` es texto libre, ¿por qué no dejar apuntar también su email, para escribirle a él en vez de al `email_avisos` genérico?

**`gd_notas.responsable_email`**, columna nueva, opcional — no se valida el formato (es un dato de contacto, no una cuenta del sistema; ver la misma filosofía de `responsable` en sí). `NotasCRUD.actualizar_responsable()` la actualiza junto con `responsable` y sigue reiniciando `aviso_responsable_enviado` si cualquiera de los dos cambia (así añadir el email que faltaba también dispara un aviso nuevo, no solo cambiar de persona).

`avisar_incidencias.py` ahora separa las incidencias pendientes de aviso en dos grupos: las que tienen `responsable_email` van agrupadas por dirección (una persona con varias incidencias recibe un solo correo con todas) directo a esa persona; las que no, siguen cayendo en el correo a `email_avisos` de siempre, mencionando el nombre. Un proyecto sin `email_avisos` configurado ya no bloquea los avisos a responsables que sí tienen email — cada grupo se manda con independencia del otro.

Tools/API: `crear_nota_documento_gd`, `asignar_responsable_nota_gd` y sus endpoints/formulario del panel llevan `responsable_email` opcional junto a `responsable`. Mismo criterio que el nombre: si viene por chat, la IA lo pasa solo si el cliente lo da, nunca lo inventa.

Quién decidió: usuario.
Reversible: sí — columna nullable, no rompe nada existente; sin `responsable_email` en ninguna nota, el comportamiento es idéntico al de antes de este cambio.

### Grupos de documentos (2026-09-17)

El cliente quiere poder agrupar documentos "para un fin concreto" (una auditoría, un expediente) sin que eso implique que todo documento tenga que estar en un grupo.

**Decisión: muchos-a-muchos, no un `id_grupo` en `gd_documentos`** — confirmado con el usuario: un mismo documento puede estar en varios grupos a la vez (p.ej. una factura relevante tanto para "Auditoría 2026" como para "Proyecto X"). De ahí `gd_documentos_grupos`, tabla de relación pura, mismo patrón que `gd_notas_relaciones` — índice único `(id_documento, id_grupo)` para que asignar dos veces no duplique fila, `ON DELETE CASCADE` en ambos lados (borrar un documento o un grupo limpia sus relaciones solas).

**`gd_grupos` deliberadamente mínima: solo `nombre` (único) y `proposito`** — el usuario descartó explícitamente añadir responsable/estado al grupo en esta primera versión; se puede ampliar después si hace falta, sin migrar nada existente.

**Borrar un grupo no toca los documentos** — solo desaparecen sus filas de `gd_documentos_grupos` (cascada), los documentos en sí quedan intactos. Sin "archivar" (a diferencia de documentos/versiones): un grupo es metadato organizativo sin historial que conservar, borrar sin más es suficiente.

**Tools MCP** (`mcp_server/herramientas/_herr_grupos.py`): `crear_grupo_gd`, `listar_grupos_gd`, `asignar_documento_grupo_gd`, `quitar_documento_grupo_gd`, `listar_documentos_grupo_gd`, `eliminar_grupo_gd`.

**Panel**: pantalla nueva "Grupos" (`Grupos.jsx` → lista y crea; `GrupoDetalle.jsx` → edita, borra, añade/quita documentos), enlazada en la barra lateral igual que Tipos de documento/Estilos (no gated a admin — es día a día, no configuración). En la ficha de cada documento, `componentes/GruposDocumento.jsx` muestra sus grupos como chips (con su propósito en el tooltip) y deja añadir/quitar sin salir de ahí. Mismo criterio de permisos que las notas: cualquiera con acceso lee, `puede_editar` para crear/asignar/quitar/borrar.

**Ajuste (2026-09-17, mismo día): crear un grupo nuevo también desde la ficha del documento.** La primera versión de `GruposDocumento.jsx` solo dejaba asignar a grupos ya existentes — para crear uno había que ir a la pantalla "Grupos" y volver. El usuario no quería salir del documento en ningún caso: se añadió un formulario compacto (nombre + propósito) plegable en el propio widget, que crea el grupo y lo asigna al documento en el mismo paso (dos llamadas seguidas, `crearGrupo` + `asignarDocumentoGrupo`, sin transacción — aceptable: si la segunda fallase, el grupo queda creado pero sin asignar, visible y corregible a mano desde "Grupos", no es un estado inconsistente grave). **Mismo ajuste en `EntidadesDocumento.jsx` (2026-09-17, pedido después)** — con una diferencia: en vez de un formulario compacto inline (la entidad tiene 11 campos, no 2), se abre en un `Modal` reutilizando `FormularioEntidad.jsx` (el mismo componente que ya usan `Entidades.jsx`/`EntidadDetalle.jsx`) — sigue sin salir de la ficha del documento, solo que como superposición en vez de un bloque plegable, por el volumen de campos. Mismo patrón de dos llamadas seguidas (`crearEntidad` + `relacionarDocumentoEntidad`). De paso, los dos selectores de "añadir/relacionar" (grupos y entidades) se agrandaron (de `size="xs" w=200/220` a `size="sm" w=340`) — ya eran buscables (`searchable`), pero al ser tan pequeños no se notaba.

Fuera de alcance por ahora: filtrar el listado principal de documentos por grupo (se puede añadir después, es solo una columna más en `DocumentosCRUD.buscar()` y un `Select` más en `Documentos.jsx`, pero no se pidió y no hacía falta para lo de asignar).

Quién decidió: usuario (nombre del feature, y las dos preguntas de diseño — muchos-a-muchos, y grupo mínimo sin responsable/estado).
Reversible: sí — dos tablas nuevas, sin tocar ninguna existente.

### Entidades (2026-09-17)

El cliente quiere una tabla de clientes/proveedores/empleados relacionable con documentos, con solo los campos básicos de contacto.

**`gd_entidades`**: `nombre`, `tipo`, `direccion`, `localidad`, `provincia`, `codigo_postal`, `pais`, `telefono`, `email`, `observaciones`, `codigo` (para vincular con el ERP del cliente, único si se rellena). `tipo` es el campo que el cliente llamó "entidad" en la petición original ("id, nombre, entidad, dirección...") — aclarado en conversación: es el qué-es-esto (cliente/proveedor/empleado), no un segundo nombre. Se renombró a `tipo` para no repetir "entidad" dentro de la propia tabla `gd_entidades` y para seguir el mismo patrón que `gd_documentos.tipo_documento` — catálogo abierto, texto libre, sin tabla de catálogo aparte (el cliente pidió expresamente "solo los campos básicos").

**Relación con documentos: muchos-a-muchos**, mismo patrón que grupos — `gd_documentos_entidades`, sin campo de "rol" en la relación (a diferencia de `gd_notas_relaciones`, aquí no se pidió distinguir "cliente" de "proveedor" en una factura con dos entidades; si hiciera falta más adelante, se añade un `rol` a esta tabla sin tocar el resto).

`codigo_postal` es texto, no número (hay formatos con letras fuera de España, y `pais` ya es un campo aparte). Sin "archivar" en entidades — a diferencia de documentos: no se pidió, y borrar sin más ya dijo el cliente que no debía tocar los documentos relacionados (limpieza en cascada solo de la fila de relación, `ON DELETE CASCADE` en `gd_documentos_entidades`, nunca en `gd_documentos` ni en `gd_entidades` entre sí).

**Tools MCP** (`mcp_server/herramientas/_herr_entidades.py`): `crear_entidad_gd`, `listar_entidades_gd` (por nombre y/o tipo), `actualizar_entidad_gd` (solo toca los campos que se pasen, no borra los que se omiten), `eliminar_entidad_gd`, `relacionar_documento_entidad_gd`, `quitar_relacion_documento_entidad_gd`, `listar_documentos_entidad_gd`, `listar_entidades_documento_gd`.

**Panel**: pantalla "Entidades" (lista + buscador por nombre/tipo + modal de alta) y `EntidadDetalle.jsx` (editar todos los campos, borrar, relacionar/quitar documentos) — mismo componente de formulario (`FormularioEntidad.jsx`) en los dos sitios, para no mantener 11 campos duplicados. En la ficha de cada documento, `EntidadesDocumento.jsx` (mismo patrón que `GruposDocumento.jsx`) muestra sus entidades como chips y deja añadir/quitar sin salir de ahí. `tipo` se rellena con un `Autocomplete` (texto libre con sugerencias de los tipos ya usados), no un `Select` cerrado.

Quién decidió: usuario (los 11 campos, la relación muchos-a-muchos con documentos); el nombre de columna `tipo` (en vez de repetir `entidad`) lo decidió el asistente por claridad, ver arriba.
Reversible: sí — dos tablas nuevas, sin tocar ninguna existente.

### Comunicaciones y envíos (2026-09-17)

El despacho manda comunicaciones a clientes y otras entidades con frecuencia, cada una con contenido distinto (nombre, importe, fecha...). Se pidió: el documento hace de plantilla con variables dentro del texto, y desde ahí se programan envíos por email a las entidades que se elijan, a mano o en automático.

**Decisión: la plantilla es un documento normal, no una tabla aparte** — cualquier `gd_documentos` puede usarse para esto, sin marcarlo de ninguna forma especial. Las variables son `{{asi}}` (regex `\{\{\s*(\w+)\s*\}\}`) dentro de `nombre` (asunto) y del markdown (cuerpo); no hace falta declararlas en ningún sitio aparte, se detectan solas leyendo el texto. Se aprovecha todo lo que ya existe para documentos (versiones, comentarios/incidencias, grupos, entidades relacionadas) sin construir nada nuevo para "plantillas".

**Tres decisiones de producto, confirmadas con el usuario antes de construir esto**:
1. **Variables compartidas por lote, no una tabla por entidad.** Al mandar el mismo documento a varias entidades a la vez, las variables que NO coinciden con un campo de la entidad (ver abajo) se escriben una sola vez y valen para todas — no hay una cuadrícula de "un valor por entidad y variable". Más simple, cubre circulares y avisos generales; no vale para "cada cliente debe un importe distinto" en el mismo lote (eso necesitaría una entrada de datos por fila, descartado por complejidad para esta primera versión).
2. **Solo envíos programados para una fecha/hora concreta, no recurrentes.** Programar "cada mes" habría exigido que las variables se recalculen solas en cada repetición (fechas relativas, importes que cambian) — no encaja con variables de valor fijo escritas una vez. Para repetir, se crea un envío nuevo cada vez.
3. **El correo se manda con formato (HTML), no texto plano** — a diferencia de los avisos de caducidad/incidencias (que son avisos internos), una comunicación a un cliente cuida más la imagen. Se reaprovecha la misma conversión que ya usa `generar_informe_pdf_gd` (librería `markdown`, ya en `requirements.txt`) — el correo va como `multipart/alternative`, con una parte de texto plano (el markdown sin convertir, para clientes que no muestran HTML) y una parte HTML.

**El contenido se resuelve y se guarda YA HECHO al crear el envío, no al mandarlo** (`gd_envios.asunto`/`contenido_html`/`contenido_texto`) — así un envío programado manda exactamente lo que se aprobó, aunque el documento se edite después; y el cron que manda los programados (`scripts/procesar_envios.py`) no necesita la librería `markdown` ni la lógica de variables, solo lee esas columnas y las manda tal cual — mismo patrón autocontenido que `avisar_caducidades.py`/`avisar_incidencias.py`, y más simple que esos dos porque no hay nada que calcular en el momento de mandar.

**Variables "auto" vs "personalizadas`**: auto = coincide con una columna de `gd_entidades` (`nombre`, `tipo`, `direccion`, `localidad`, `provincia`, `codigo_postal`, `pais`, `telefono`, `email`, `observaciones`, `codigo`) y se resuelve sola por entidad; cualquier otra (`importe`, `fecha_limite`...) es personalizada. Una variable sin valor se deja tal cual en el texto (`{{asi}}` literal) en vez de desaparecer en blanco — para que se note en la vista previa que falta rellenarla.

**`gd_envios`**: un registro por entidad destinataria (aunque el "lote" cree varios a la vez) — cada uno necesita su propio `email_destino` y sus propias variables auto. `estado` (`programado`/`enviado`/`fallido`/`cancelado`); `fecha_programada` NULL significa "ya" — se manda en el mismo paso de crear el envío, sin esperar al cron. Sin email en la entidad → se crea igual, en `fallido` con el motivo, en vez de omitirse en silencio.

**Tools MCP** (`mcp_server/herramientas/_herr_envios.py`): `detectar_variables_documento_gd`, `crear_envios_gd` (crea el lote; si no se programa, el propio flujo de chat llama después a `enviar_envio_gd` por cada uno), `enviar_envio_gd`, `listar_envios_documento_gd`, `listar_envios_entidad_gd`, `cancelar_envio_gd`, `reintentar_envio_gd`.

**Panel**: pestaña nueva "Enviar" en `DocumentoDetalle.jsx` (`componentes/EnviosDocumento.jsx`) — detecta variables, elige entidades (`MultiSelect`), pide las personalizadas, fecha opcional, vista previa (con sustitución hecha en el propio JS, reutilizando `Markdown.jsx` — no hace falta ida y vuelta al servidor solo para previsualizar) y la lista de envíos de ese documento con cancelar/reintentar.

**Cron `mcp_gd_procesar_envios`, cada 5 minutos** (`scripts/procesar_envios.py`) — más frecuente que los avisos diarios porque aquí la hora programada importa de verdad, no es un resumen del día.

Quién decidió: usuario (la idea completa, y las tres decisiones de producto de arriba, cada una con dos opciones planteadas por el asistente).
Reversible: sí — una tabla nueva, sin tocar ninguna existente; quitar el cron desactiva la parte automática sin afectar a los envíos manuales.

### Editor y visor de documentos, y exportar a PDF (2026-09-17)

Tres retoques seguidos sobre cómo se ve/edita un documento en el panel, a petición del usuario ("un poco cutre"):

- **Editor**: el `Textarea` monoespaciado de "Editar" se sustituyó por `MDEditor` (`@uiw/react-md-editor`) — mismo componente que ya usaba "Contexto de negocio", así que no fue una dependencia nueva. Barra de formato + vista previa en vivo (`preview="live"`), más alto (560px) que en Contexto por tratarse de documentos completos, no dos párrafos.
- **Visor** (`Markdown.jsx`): fallo real, no solo de estilo — `react-markdown` sin `remark-gfm` no interpreta tablas (ni tachado, ni listas de tareas): una tabla se veía como una línea de texto con barras verticales sueltas. El CSS de `.contenido-documento` para tablas ya existía desde antes pero nunca se llegaba a aplicar porque no se generaba ningún `<table>`. Añadido `remark-gfm` (ya lo trae `react-markdown` como dependencia opcional habitual, se instaló aparte) y completado el CSS que faltaba (h4-h6, blockquote, código/pre, hr).
- **Exportar a PDF**: botón "Descargar PDF" en la ficha del documento — la versión vigente, con el mismo formato que se ve en pantalla. Reutiliza el mecanismo que ya existía para los informes que redacta la IA (`generar_informe_pdf_gd`: markdown → HTML → WeasyPrint en subproceso aparte, por el conflicto de `libffi` con el entorno conda compartido, ver comentario en el código). Ese render se sacó de `mcp_server/herramientas/_herr_pdf.py` a `database/modelos/_mod_pdf.py` — la única carpeta que llega a los dos árboles de despliegue (proyecto y panel) — para que el panel pudiera reutilizarlo sin duplicar el subproceso ni su gotcha de libffi; `_herr_pdf.py` quedó como una fachada fina sobre ese módulo. CSS de impresión aparte (`CSS_DOCUMENTO`, distinto de `CSS_INFORME`): en pantalla el cuerpo va en gris "dimmed" de baja intensidad, que en papel impreso se lee mal, así que el PDF usa texto oscuro/negro sólido.

### Scripts reutilizables (2026-09-25)

Tabla `gd_scripts` para que la IA guarde los scripts que ya ha escrito para tareas puntuales del cliente (un backup, un informe ad-hoc, una migración...) y los reaproveche en vez de reescribirlos cada vez. Esquema en `database/dependencias/_dep_scripts.py`, CRUD en `database/modelos/_mod_scripts.py`:
- Columnas: `titulo`, `descripcion` (qué hace y cuándo usarlo — lo que se lee al buscar), `lenguaje` (texto libre, catálogo abierto como `gd_entidades.tipo`), `codigo`, `etiquetas` (texto libre, opcional), `creado_por`, `veces_usado`/`fecha_ultimo_uso` (para ver cuáles compensan tener guardados) y `archivado` (igual que `gd_documentos.archivado`, para retirar uno obsoleto sin borrarlo).
- Tools MCP (`mcp_server/herramientas/_herr_scripts.py`): `crear_script_gd`, `buscar_scripts_gd`/`obtener_script_gd` (solo lectura), `actualizar_script_gd`, `marcar_uso_script_gd` (incrementa el contador — la IA la llama al reaprovechar uno, no al crearlo) y `archivar_script_gd`/`desarchivar_script_gd`.
- Panel: pantalla "Scripts" (listar/buscar por título, descripción o etiqueta, y el detalle) — solo para consultar y curar metadatos, **el código no se puede editar desde el panel a propósito** (`ActualizarScript` en `panel_cliente/servidor.py` no lleva ese campo): quien corrige o mejora un script es la IA, vía `actualizar_script_gd`. El código se muestra coloreado según el lenguaje con `@mantine/code-highlight` (adaptador `highlight.js`, añadidos como dependencias nuevas del frontend) — tema oscuro fijo (`highlight.js/styles/github-dark.css`), no ligado al claro/oscuro del panel, para no tener que mantener dos hojas de estilo sincronizadas con el selector de tema.
- **Relación con documentos (2026-09-25)**: tabla `gd_documentos_scripts`, muchos-a-muchos, mismo patrón que `gd_documentos_entidades` (índice único `(id_documento, id_script)`, `ON DELETE CASCADE` en ambos sentidos — a diferencia de `gd_scripts` en solitario, esta tabla sí tiene FK hacia `gd_documentos`, así que un despliegue en un servidor real tiene que registrar también `TABLA_DOCUMENTOS` en el script `ManagerDB` ad-hoc, ver [[despliegue_panel_cliente_gotchas]]). Tools MCP: `relacionar_documento_script_gd`, `quitar_relacion_documento_script_gd`, `listar_scripts_documento_gd`/`listar_documentos_script_gd` (solo lectura). Panel: `ScriptsDocumento.jsx` (fila de badges en `DocumentoDetalle.jsx`, mismo patrón visual que `EntidadesDocumento.jsx` pero sin modal de "crear y relacionar" — los scripts no se crean a mano) y la sección "Documentos relacionados" en `ScriptDetalle.jsx` (idéntica a la de `EntidadDetalle.jsx`).

Quién decidió: usuario (los tres retoques); la extracción a `_mod_pdf.py` y el CSS de impresión aparte los decidió el asistente por las razones de arriba.
Reversible: sí — ninguno toca el esquema; quitar el botón o revertir el import no afecta a nada más.

### GDs enlazadas: una central de conocimiento consultada por otras (2026-09-27, implementado el mismo día — ver "Estado de la implementación" al final)

Idea del usuario: una gestión documental "central" alberga una gran base de conocimiento (p.ej. toda la normativa de la asesoría) y otras GDs "enlazadas" (una por cliente) la consultan para responder lo que no está en sus propios documentos. La central se mantiene una sola vez; las enlazadas se benefician al instante.

Tres requisitos fijados por el usuario: la enlazada **solo lee**; la central puede **reservar** cierta información para que no salga hacia fuera; y la central **toma nota de las preguntas que no supo resolver** para cubrirlas después.

**Cómo se comunican.** La enlazada llama al servidor MCP público de la central por HTTPS (`https://<dominio central>/mcp`) como un cliente más, con una API key emitida por la central — exactamente el mismo mecanismo que ya usa el chat del panel contra su propio MCP (`panel_cliente/chat_ia.py`, cliente `fastmcp`). No hay acceso directo entre bases de datos (son VPS distintos) ni código nuevo de red: se reutiliza `/mcp` tal cual. La búsqueda (fulltext o semántica, con las claves de embedding de la central) la hace la central; la enlazada no necesita nada de eso.

**Rol nuevo en el núcleo: `gd_enlazada` (id 5, `mcpc_roles`).** Una key con este rol es la que la central le da a cada enlazada. Se comporta como `invitado` (lista blanca `readOnlyHint`, `apps/mcp_server/core/solo_lectura.py`) **más** las herramientas etiquetadas con `tags={"gd_enlazada"}` (etiqueta nativa de `fastmcp`, sin depender de campos extra en las anotaciones MCP, que no admiten extras — comprobado en fastmcp 4.0.3). Hace falta un rol propio, no vale `invitado`, por dos motivos: la central tiene que saber que quien pregunta es una GD ajena (para ocultarle lo reservado y para anotar la pregunta), y necesita permitirle una única escritura (anotar). El contexto de la petición (`auth.py`, `_proyecto_actual`) expone también el `nombre` de la key — la central lo usa como "quién preguntó" (el admin la nombra al emitirla: "GD Maderas Cilpe"). Selector de rol en ambos paneles: opción nueva "GD enlazada". El rol se propaga solo al desplegar (`insertar_registros_iniciales` del ORM inserta los que falten).

**Lado central (repo GD):**
- `gd_documentos.reservado` BOOLEAN, default False: "no se comparte con GDs enlazadas". Filtro `AND d.reservado = false` en `buscar_fulltext`, `buscar_semantico`, `buscar` (metadatos) y `obtener_documento_completo_gd` **solo cuando la key es de rol `gd_enlazada`** — los usuarios de la propia central lo ven todo. Toggle "Reservado" en `DocumentoDetalle.jsx` (junto a archivar), badge en el listado, y parámetro opcional en `guardar_documento_gd`/tool `marcar_reservado_gd`.
  - Por defecto se comparte todo y se marca la excepción (no al revés): una central existe para compartir; obligar a marcar uno a uno los cientos de documentos compartibles sería lo tedioso. Ejemplo: de 300 normativas, se reservan las 5 notas internas de la asesoría.
- Tabla nueva `gd_preguntas_pendientes`: `pregunta`, `origen` (nombre de la key = qué GD preguntó), `motivo` ENUM(`sin_resultados`, `no_resuelta`), `veces` (misma pregunta normalizada + mismo origen → se incrementa, no se duplica), `estado` ENUM(`pendiente`, `resuelta`), `fecha_primera`, `fecha_ultima`. Sin FKs.
- Dos vías de anotación: **automática** — `consultar_documentos_gd` llamada por una key `gd_enlazada` que devuelve 0 fragmentos anota `sin_resultados` sola (no depende de que la IA se acuerde); y **explícita** — tool `anotar_pregunta_pendiente_gd(pregunta, detalle)` etiquetada `gd_enlazada`, para cuando hubo resultados pero no respondían (`no_resuelta`), que es lo que solo la IA del lado enlazado puede juzgar.
- Panel de la central: pantalla "Preguntas pendientes" (solo admin): listado ordenado por `veces` desc, filtro por estado/origen, botón "marcar resuelta". Tools de solo lectura `listar_preguntas_pendientes_gd` + `resolver_pregunta_pendiente_gd` para hacerlo también desde el chat.

**Lado enlazado (mismo repo — toda GD puede ser central y enlazada a la vez):**
- Tabla `gd_enlaces`: `nombre`, `url` (el `/mcp` de la central), `api_key_cifrada` (Fernet, `lib.cifrado` del núcleo, igual que `gd_credenciales`), `activo`, `fecha_alta`. Varias filas: enlazar con más de una central cuesta lo mismo que con una.
- Panel: pantalla "GDs enlazadas" (solo admin): alta (nombre, URL, key), botón "probar conexión" (hace `list_tools` contra la central), activar/desactivar, borrar. La key nunca se vuelve a mostrar.
- Tools MCP nuevas (`_herr_enlaces.py`), todas `SOLO_LECTURA` porque no tocan datos propios: `consultar_gds_enlazadas_gd(pregunta, limite)` — recorre los enlaces activos, llama a `consultar_documentos_gd` de cada central y devuelve los fragmentos con un campo `origen`; `obtener_documento_enlazado_gd(id_enlace, id_documento)` — el documento completo de la central; `anotar_pregunta_pendiente_enlazada_gd(id_enlace, pregunta, detalle)` — reenvía la anotación a la central. Esta última también va marcada de solo lectura a propósito: no modifica nada de la enlazada y no queremos que el chat pida confirmación por cada anotación (sería un estorbo y las preguntas ya viajan a la central al consultarla). Una central caída no rompe la respuesta: se devuelve el error de ese enlace como un resultado más y se sigue con el resto. Añadida después (2026-09-28): `listar_herramientas_enlace_gd(id_enlace)` — el mismo `list_tools` que el botón "probar conexión" del panel, para que el chat pueda comprobar un enlace y ver qué le deja pedir esa GD sin entrar al panel; vale para los dos sentidos, porque de ambos guardamos su key.
- `SYSTEM_PROMPT` de `chat_ia.py`: instrucción de consultar primero los documentos propios, después las GDs enlazadas si existen, citar de qué GD viene cada fragmento, y anotar en la central lo que no se resolvió. Sin coste de IA en la central: allí solo se ejecuta una búsqueda; el gasto de Claude sigue siendo únicamente el del chat de la enlazada (una llamada de herramienta más por turno cuando aplica).

**Fases:** (1) núcleo: rol 5, middleware con etiquetas, nombre de key en el contexto, selectores de rol; (2) central: `reservado` + filtros + `gd_preguntas_pendientes` + tools + panel; (3) enlazada: `gd_enlaces` + tools + panel + prompt; (4) prueba real en mcp-d contra sí misma (enlace apuntando a su propio dominio público — vale como prueba de punta a punta) y después contra un servidor real; (5) despliegue a los 5 servidores (todos llevan el mismo código; cada uno hace de central o de enlazada según lo que configure).

Quién decidió: usuario (idea y los tres requisitos); el asistente propuso rol propio en vez de reutilizar `invitado`, "compartido por defecto", la anotación automática al no haber resultados, y no pedir confirmación para anotar.
Reversible: sí — una columna con default y dos tablas nuevas sin FKs; borrar los enlaces desactiva todo sin tocar documentos.

#### Aprendizaje de la central a partir de las enlazadas (2026-09-27, implementado)

Segunda parte de la idea: la central no solo se consulta, también **aprende** de lo que las enlazadas van guardando, para convertirse en el saber hacer acumulado del sector. Regla innegociable del usuario: **nada de lo que sube puede llevar nombres propios, empresas, direcciones, expedientes ni ninguna referencia que identifique de quién viene** — vulneraría la confidencialidad entre clientes.

Flujo (propuesto por el usuario, tal cual):
1. **La enlazada no se toca**: su documento queda exactamente como lo guardó el usuario.
2. **La central aspira un resumen** del documento y lo guarda como **candidato** (`gd_aprendizajes`, estado `candidato`): nombre, tipo, fecha, resumen corto generado por la IA de la central, y de forma interna `id_enlace` + `id_documento` de origen (solo visible para el admin de la central; nunca para otras enlazadas). Decidir con el resumen es barato; el gasto de IA gordo solo llega si se le da vía libre.
3. **Vía libre del admin** → la central obtiene la copia completa (`obtener_documento_completo_gd` de la enlazada), **la IA sustituye los datos sensibles por nombres genéricos** ("la empresa", "el cliente", "el lote", "la inspectora"), y **se guarda en la central el documento completo ya anonimizado**, en estado `pendiente_revision`. El texto sin anonimizar solo pasa por memoria para anonimizarlo; en origen permanece intacto.
4. El admin revisa la copia (puede retocarla con el editor que ya existe) y la **aprueba** → se crea como documento normal de la central (`guardar_documento_gd`), compartible como cualquier otro, con el aprendizaje marcado `aprobado`. O la **rechaza** (queda `rechazado`, con motivo).

**Enlace en ambos sentidos en un solo proceso (decisión del usuario).** Enlazar una GD con la central (GDC) es una única acción, no dos altas por separado:
1. El admin de la central emite una key de rol `gd_enlazada` con el nombre de la enlazada ("GD Maderas Cilpe") y se la entrega al admin de la enlazada (fuera del sistema, como cualquier key).
2. El admin de la enlazada, en "Enlazar con central", pega la URL de la central y esa key. En ese mismo paso la enlazada: guarda el enlace (`gd_enlaces`, sentido consulta), **genera sola una key propia de rol `gd_enlazada`** (mecanismo `clave_interna_proyecto` del núcleo, nombre "Central: <nombre>") y llama a la tool `registrar_enlace_gd(nombre, url_mcp, api_key)` de la central (etiquetada `gd_enlazada`), que da de alta el sentido contrario en la `gd_enlaces` de la central. Ninguna persona llega a ver la key inversa.
3. Desenlazar hace lo mismo al revés desde cualquiera de los dos lados: revoca su key y avisa al otro para que borre el enlace.
Hace falta que la enlazada conozca su propia URL pública de `/mcp` — sale del dominio público del servidor ya configurado en el núcleo (a comprobar en implementación dónde vive exactamente).

**Coste de la IA de la central repercutido a los clientes según su uso (decisión del usuario).** La central registra cada uso hecho por o para una enlazada en `gd_uso_enlaces`: `id_enlace`, `tipo` ENUM(`consulta`, `documento_completo`, `resumen`, `anonimizacion`, `embedding_consulta`), `tokens_entrada`, `tokens_salida`, `modelo`, `coste_estimado` (calculado en el momento con la tabla de precios vigente — los precios cambian, se guarda el importe, no solo los tokens) y `fecha`. Las consultas cuestan 0 de IA (la central solo busca) pero cuentan como uso; el resumen y la anonimización llevan los tokens reales que devuelve la API de Claude. Panel de la central: pantalla "Uso por GD enlazada" con totales por mes y por tipo, exportable a CSV. **La factura al cliente se hace fuera del sistema** con ese informe — la plataforma mide, no cobra (decisión del asistente; si se quiere que el importe salga directamente en el panel del cliente enlazado, es un endpoint más sobre la misma tabla).

Detalles decididos por el asistente, pendientes de corregir por el usuario:
- `reservado` en la enlazada sirve también para excluir lo que un cliente no quiere ceder a la central (confirmado por el usuario).
- **Cómo se eligen candidatos**: en v1, a mano — el admin de la central ve en su panel el listado de documentos (no reservados) de cada enlazada y marca los que quiere aspirar. Automatizarlo (p.ej. aspirar todo lo nuevo de cierto tipo) queda para después de ver cómo se usa.
- **Anonimización**: prompt específico que devuelve el markdown completo con las sustituciones y una lista de lo sustituido (para que el admin lo compruebe de un vistazo). La IA puede fallar en algún nombre — por eso la revisión humana no es opcional.
- Panel de la central: pantalla "Aprendizajes" con los cuatro estados, acciones vía libre / aprobar / rechazar, y la lista de sustituciones al lado del texto anonimizado.

Fases adicionales: (6) enlace bidireccional en un solo paso + registro de uso; (7) aprendizajes (candidato → anonimizado → aprobado) + panel de uso.

#### Jerarquía de GDs (2026-09-27, decisión del usuario)

**Todas las GDs pueden actuar como central**, y pueden encadenarse: GD de cliente → central de la asesoría → central del sector. No es un modo ni una configuración: "central" y "enlazada" son solo el papel que juega cada GD en cada fila de `gd_enlaces`, con el mismo código en todas.

Consecuencias en el diseño (propuestas por el asistente, pendientes de confirmar):
- **Las consultas suben de nivel (transitivas)**: `consultar_documentos_gd` llamada con una key `gd_enlazada` busca en lo propio y, si la GD tiene a su vez centrales enlazadas, también en ellas, devolviendo los fragmentos con su `origen` completo ("Central sector › Asesoría"). Dos protecciones: **profundidad máxima 3** y un parámetro interno `_cadena` (lista de URLs públicas `/mcp` ya visitadas) que cada salto amplía y que impide volver a una GD ya recorrida — dos GDs enlazadas mutuamente no entran en bucle.
- **El uso se apunta en cada nivel** (`gd_uso_enlaces` de cada GD) → el coste baja en cascada y proporcional: el sector le repercute a la asesoría lo que consumió su subárbol, la asesoría a cada cliente lo suyo.
- **Preguntas pendientes en cada nivel**: cada GD anota `sin_resultados` cuando ni lo propio ni lo de arriba devolvió nada — así cada admin ve lo que su subárbol no supo responder, y el de arriba lo que nadie supo.
- **El aprendizaje también sube**: lo que una central intermedia aprobó (ya anonimizado) es un documento normal suyo y su central superior puede aspirarlo con el mismo flujo; la segunda anonimización es una pasada rápida, no encuentra nada que sustituir.
- `reservado` se aplica en cada salto: lo reservado en la asesoría no sube al sector ni baja al cliente.

#### Estado de la implementación (2026-09-27)

Todo lo anterior está en código, en ambos repos, **sin probar todavía de punta a punta** (pendiente: mcp-d contra sí misma, después un servidor real, después los 5).

Diferencias respecto al plan, decididas al implementar:
- **Una key `gd_enlazada` ve SOLO las herramientas etiquetadas** (`tags={"gd_enlazada"}`), no "las de lectura más las etiquetadas": las de lectura incluyen credenciales, entidades, notas, contexto de negocio… y esa key la tiene otra empresa. Etiquetadas en la central: `consultar_documentos_gd`, `buscar_documentos_gd`, `obtener_documento_completo_gd` (las tres filtran `reservado` y apuntan uso cuando llama una enlazada), `registrar_enlace_gd`, `eliminar_enlace_gd`, `anotar_pregunta_pendiente_gd`.
- El núcleo expone en el contexto de la petición `id_api_key` y `nombre_api_key` (`auth.py`); `clave_actual_es_solo_lectura()` cubre invitado y gd_enlazada, y `clave_actual_es_gd_enlazada()` distingue la segunda. Rol 5 en `mcpc_roles` (se inserta solo al desplegar: `insertar_registros_iniciales`), `ROLES_API_KEY` y `ROLES_SOLO_LECTURA` en `lib/roles_proyecto.py`, opción "GD enlazada" en el selector de rol de ambos paneles.
- `gd_enlaces.id_api_key_emitida` (única): la key que NOSOTROS emitimos a la otra GD. Desenlazar desde cualquier lado revoca las dos: la propia directamente y la de la otra GD llamando a su `eliminar_enlace_gd` (que borra su fila y revoca la key con la que la llamamos). `registrar_enlace_gd` toma como nombre del enlace el nombre de la key con la que le llaman (el que puso el admin de la central al emitirla) — es el mismo `origen` que usan preguntas pendientes y uso, así todo cuadra.
- `consultar_documentos_gd(pregunta, limite, cadena_gds)`: `cadena_gds` es el parámetro interno de la transitividad (URLs ya recorridas; `PROFUNDIDAD_MAXIMA = 3`). Documentado en el docstring como "no lo rellenes".
- Documento completo solo de una central directa; un fragmento que llegó a través de otra ("A › B") no se puede pedir completo (marcado en el docstring). Cubre el caso real; si hace falta, es enrutar `obtener_documento_completo_gd` por la misma cadena.
- Aprendizajes: para resumir, el documento completo viaja a la central (en memoria) — se guarda solo el resumen. `sustituciones` guarda descripciones POR TIPO, nunca los valores originales (sería guardar justo lo que se quiere evitar). Tarifas en `_mod_aprendizajes.py::TARIFAS_USD_POR_MILLON` (mismas cifras que `MODELOS_ANTHROPIC` del núcleo); un modelo sin tarifa se apunta con coste 0 y su nombre.
- Ficheros: núcleo `_dep_roles.py`, `lib/roles_proyecto.py`, `core/dependencias/auth.py`, `core/solo_lectura.py`, `_api_api_keys.py`, `ApiKeys.jsx`. GD: `_dep_enlaces.py`, `_dep_aprendizajes.py`, `_mod_enlaces.py` (CRUDs + cliente MCP + `consultar_centrales` + emisión/revocación de keys), `_mod_aprendizajes.py`, `_herr_enlaces.py`, `_anotaciones.py`, `_herr_documentos.py`, `_mod_documentos/_mod_versiones/_mod_chunks.py` (`solo_compartidos`), `_dep_documentos.py` (`reservado`), `update_db.py`, `panel_cliente/servidor.py` (bloques "GDs enlazadas" y "Aprendizajes"), `chat_ia.py` (prompt), `ayuda_gd.py`, frontend `Enlaces.jsx` + `componentes/Aprendizajes.jsx` + `Sidebar/App/api.js/DocumentoDetalle/Documentos`.
- Despliegue: núcleo primero (rol 5 + middleware), luego GD; en un servidor real, aplicar `gd_documentos.reservado` y las 4 tablas nuevas con `ManagerDB` registrando también `TABLA_ESTILOS` (FK de `gd_documentos`) — las 4 tablas nuevas no tienen FKs. `frontend/dist` se sube a mano como siempre.

### Reglas de comportamiento: jerarquía de contexto para la IA (2026-09-27, implementado y desplegado en los 5 servidores el mismo día)

Plan original en `docs/planificacion/sistema-reglas-jerarquia-contexto.md`. Idea del usuario: hoy las instrucciones a la IA se guardan como documentos normales, mezcladas con normativa e informes; la IA tiene que buscarlas, leerlas e interpretarlas cada vez, y nada garantiza que las cargue en el momento adecuado. Las reglas separan el **comportamiento** (cómo actuar aquí) del **contenido** (los documentos), con su propio mecanismo de carga.

**Tabla `gd_reglas`** (`database/dependencias/_dep_reglas.py`, sin FKs, CRUD en `database/modelos/_mod_reglas.py`): `nombre` (obligatorio, único y renombrable), `texto` (una idea por regla), `categoria` (texto libre, catálogo abierto igual que `gd_scripts.lenguaje`), `es_global`, `prioridad`, `activa`, `reservada`, `fecha_alta`.

**Tres niveles de carga:**
1. **Al abrir sesión**: el bloque de reglas globales entra solo en el `instructions` del `initialize` de MCP, sin que la IA tenga que pedir nada. Lo monta `texto_reglas_globales()` y lo recoge el middleware del núcleo (ver más abajo).
2. **Bajo demanda**: `obtener_reglas_gd` justo antes de la tarea que las necesita — por `categoria` (tipo de tarea) o por `nombres` (cuando una regla global remite a otras por su nombre). Solo cuesta tokens cuando viene a cuento.
3. **Regla meta** (`REGLA_META`, texto fijo del servidor): va siempre dentro del bloque global, tenga el cliente reglas o no, y es lo que le dice a la IA que existe el nivel 2 y cómo se resuelven los conflictos.

**Precedencia**: reglas propias > heredadas de la central > instrucciones del servidor (el bloque de reglas se añade al final del contexto inicial, después de la ayuda, el negocio y las preferencias de trabajo; en el chat del panel, después del `SYSTEM_PROMPT`).

**Tools MCP** (`mcp_server/herramientas/_herr_reglas.py`): `obtener_reglas_globales_gd` (devuelve el bloque de texto), `obtener_reglas_gd(categoria, nombres)` (las que hay que cumplir: propias + heredadas), `listar_reglas_gd` (las propias con su estado, para gestionarlas), `crear_regla_gd`, `actualizar_regla_gd`, `eliminar_regla_gd`, y `obtener_reglas_compartidas_gd` (etiquetada `gd_enlazada`, uso interno entre GDs).

**Panel**: pantalla "Reglas de la IA" (`frontend/src/paginas/Reglas.jsx`), separada de documentos: alta, edición en línea (incluido renombrar), interruptores de global / activa / reservada, filtro por categoría y por ámbito (propias / heredadas, estas de solo lectura) y aviso del peso aproximado en tokens de las globales (endpoint `/reglas/globales/texto`, umbral `TOKENS_GLOBALES_AVISO`). Escritura para cualquiera salvo invitado, igual que los estilos de informe.

**Cambio en el núcleo** (`apps/mcp_server/core/instrucciones_iniciales.py`): el middleware que ya inyectaba ayuda + negocio + preferencias añade ahora el texto de la tool que empiece por `obtener_reglas_globales` (convención de nombre, igual que `obtener_ayuda*`; ningún nombre de producto vive en el núcleo). La ayuda se cachea por proceso y las reglas **no**: el cliente las cambia en caliente y la siguiente sesión tiene que verlas ya.

#### Nombre de la regla, para que una global localice a sus subordinadas (2026-09-28, decisión del usuario)

`gd_reglas.nombre`: obligatorio, sin repetir y renombrable, igual que el nombre de una API key. La unicidad va como `unique=True` **de la columna**, no como un `Index(unico=True)`: el ORM nombra los índices solo por sus columnas (`nombre_idx`) y ese nombre ya lo tenía `gd_documentos` en el mismo esquema, así que el índice no llegaba a crearse y nadie se enteraba (descubierto al desplegar el 2026-09-28; aplicado a mano como `gd_reglas_nombre_key` en las 6 bases). Además se comprueba en el CRUD, para dar un mensaje claro en vez de un error de base de datos. Va **delante de cada regla** en el bloque que recibe la IA — `- nombre [categoria]: texto` — y `obtener_reglas_gd` acepta `nombres=[...]` (varias de golpe, para no encadenar llamadas).

Con esto una regla global hace de índice de sus subordinadas: la global "boletines" dice en su texto "antes de redactar un boletín carga boletines_replicas y boletines_firma", y la IA se las trae en una sola llamada sin que esas dos ocupen sitio en las sesiones donde no hacen falta.

El usuario descartó a propósito las otras dos opciones que se le ofrecieron: un campo de dependencia (`depende_de`) y que el nombre sustituyera a la categoría. El vínculo lo escribe él en el texto de la global, que es justo lo que la IA ya lee. Consecuencia asumida: al renombrar una regla, si otra la mencionaba por el nombre viejo hay que cambiarlo en ese texto a mano (avisado en el panel y en el docstring de `actualizar_regla_gd`).

Se aplicó con `gd_reglas` vacía en los 6 proyectos de los 5 servidores, así que la columna `NOT NULL` entra sin migración ni valores por defecto.

Decisiones tomadas al implementar (pendientes de corregir por el usuario):
- **`ambito` no es una columna**: una fila de `gd_reglas` es siempre `propia`, y las heredadas se piden **en vivo** a las centrales enlazadas (tool `obtener_reglas_compartidas_gd`), igual que los documentos, que tampoco se copian. Así no hay nada que sincronizar ni que quede obsoleto. Solo un salto (las centrales de la central no se recorren, a diferencia de las consultas de documentos).
- **Timeout corto para las heredadas** (`TIMEOUT_REGLAS_HEREDADAS_SEGUNDOS = 5`, frente a los 30 s de una consulta normal): se piden dentro del `initialize`, así que una central lenta dejaría al cliente sin poder conectarse. Una central caída se salta y se trabaja con las propias.
- **Los conflictos se resuelven por orden, no descartando reglas**: primero las propias, después las heredadas de cada central, y la regla meta dice que manda la propia. El plan decía descartar las heredadas de una categoría en la que haya reglas propias; una regla es texto libre y el servidor no puede saber si dos se contradicen de verdad o hablan de cosas distintas, así que descartar por categoría perdería instrucciones que no estorbaban.
- **`reservada`**, no prevista en el plan: una regla suele llevar datos de la empresa (correos, criterios internos) y las globales se inyectan también cuando llama una key `gd_enlazada`, que es de otra empresa. Mismo concepto que `gd_documentos.reservado`. Por eso, además, `obtener_reglas_globales_gd` devuelve vacío si quien llama es una GD enlazada: lo que hereda sale solo por `obtener_reglas_compartidas_gd`, ya filtrado.
- **`es_global`, no `global`**: `global` es palabra reservada de Python y no puede ser parámetro de una tool.
- `listar_reglas_gd` enseña solo las propias (es la de gestionarlas); las heredadas se ven con `obtener_reglas_gd`, que es la de cumplirlas.
- El chat del panel (`chat_ia.py`) arma su propio prompt, así que pega a mano detrás del `SYSTEM_PROMPT` el `instructions` que le da su propia conexión MCP al abrirla (`Client.instructions`): el mismo bloque que recibe Claude Desktop, con el negocio, las preferencias de trabajo y las reglas globales (antes solo le llegaban las reglas).

Quién decidió: usuario (plan completo); el asistente, los seis puntos de arriba.
Reversible: sí — una tabla nueva sin FKs y un bloque de texto más en el contexto inicial; sin reglas, todo se comporta como antes.
Despliegue (hecho el 2026-09-27 en los 5 servidores, `gd_reglas` en las 6 bases): núcleo primero (el middleware, un `rsync` del fichero suelto — el árbol del núcleo ya estaba idéntico al local en los 5), luego la GD por git, `gd_reglas` con un `ManagerDB` ad-hoc (no tiene FKs, así que no hay que registrar ninguna otra tabla y no toca nada más), `frontend/dist` a mano como siempre, y reinicio de `multiplika_mcp` y del panel de cada servidor. Probado de punta a punta solo en mcp-d. Para comprobar el nivel 1 en un servidor: el cliente `fastmcp` no expone el `instructions` del handshake, hay que hacer el `initialize` en crudo con `httpx` contra `127.0.0.1:8110/mcp` (`accept: application/json, text/event-stream`, leer la línea `data:`) con una clave de `clave_interna_proyecto`.

### Registros de datos: anotaciones con forma, y sus modelos (2026-09-28)

Planteamiento completo en `docs/planificacion/registros-y-modelos-de-registro.md`. Idea del usuario: aparte de los documentos, el cliente anota una y otra vez datos con la misma estructura (temperaturas de cámaras, partes de limpieza, resultados de un análisis). No son documentos ni notas sobre un documento: son datos, y lo que da valor es poder filtrarlos, contarlos y ver si cumplen.

**Dos tablas** (`database/dependencias/_dep_registros.py`, CRUD en `database/modelos/_mod_registros.py`):
- `gd_modelos_registro`: `nombre` (identifica a la familia), `titulo`, `descripcion`, `esquema` (un JSON Schema, guardado como texto porque el ORM no tiene tipo JSON), `version`, `id_modelo_raiz`, `motivo_version`, `periodicidad`, `activo`. Único `(nombre, version)`.
- `gd_registros`: `id_modelo` (la versión EXACTA con la que se validó), `valores` (JSON como texto), `fecha` y `hora` (el momento al que se refiere, distinto de `fecha_alta`), `creado_por`, `conforme`, `observaciones`, `id_entidad` e `id_documento` (opcionales y **sin FK**, para poder aplicar el esquema en un servidor real sin registrar `gd_entidades`/`gd_documentos` y provocar `ALTER` sobre tablas con datos).

**Un modelo con registros no se toca** (decisión del usuario): para cambiarlo se crea la versión siguiente, que desactiva la anterior. Cada registro sigue apuntando a la versión con la que nació, así que la pregunta de auditoría "qué forma tenía este parte el día que se rellenó" se responde sola, y `motivo_version` dice en qué cambió. Un modelo que todavía no tiene ningún registro sí se corrige en el sitio: es un borrador que nadie ha usado. La excepción son las **leyendas** de los campos: cada campo del esquema lleva un `title` (p.ej. `"temp_c"` → `"Temperatura (°C)"`) que es lo que se enseña en el formulario y en los listados en vez del nombre del campo; como no cambia qué se valida, se puede corregir aunque el modelo ya tenga registros.

**Validación estricta, en la capa de modelos** (`comprobar_esquema`/`comprobar_valores`), para que valga igual por MCP y desde el panel: el esquema tiene que ser un JSON Schema de `type: object` con campos, y los valores tienen que encajar con él. Si no, no se guarda y el error dice qué campo falla y por qué (el detalle lo da `jsonschema`, en inglés; la ruta del campo la ponemos nosotros). `jsonschema` ya venía instalado de rebote con `fastmcp`, pero pasa a estar explícito en `requirements.txt`.

**Buscar dentro del JSON**: `valores::jsonb ->> 'campo'` en la propia consulta, sobre una columna de texto y sin índice — a 5.000 registros Postgres los recorre en milisegundos. Los índices son compuestos, `(id_modelo, fecha)` y `(id_modelo, id_entidad)`, que son las dos consultas reales; además así se esquiva el problema de los nombres de índice (`fecha_idx` e `id_entidad_idx` ya estaban cogidos por otras tablas, ver "Reglas de comportamiento").

**Contexto para la IA**, que es la otra mitad del trabajo: el docstring de `crear_modelo_registro_gd` explica CUÁNDO usarlos y en qué se diferencian de un documento o una nota (hasta el 2026-09-29 lo hacía la sección "Registros de datos" de `ayuda_gd.py`, que entraba en el `initialize`); los docstrings de las tools explican CÓMO — `crear_modelo_registro_gd` lleva un JSON Schema de ejemplo completo y la lista de lo que NO va en el esquema porque ya son columnas, y `obtener_modelo_registro_gd` devuelve, además del esquema, un `valores_de_ejemplo` con la forma exacta que debe tener el JSON del registro, para no tener que deducirla.

**Tools MCP** (`mcp_server/herramientas/_herr_registros.py`): `listar_modelos_registro_gd`, `obtener_modelo_registro_gd`, `listar_versiones_modelo_registro_gd` (solo lectura), `crear_modelo_registro_gd`, `corregir_modelo_registro_gd` (solo sin registros), `nueva_version_modelo_registro_gd`, `retirar_modelo_registro_gd`, `crear_registro_gd`, `listar_registros_gd` y `resumir_registros_gd` (solo lectura, mínimo/máximo/media de un campo numérico sin traerse los registros), `corregir_registro_gd` y `eliminar_registro_gd`. Ninguna lleva la etiqueta `gd_enlazada`: los registros son datos operativos del cliente y una central no tiene por qué verlos.

Quién decidió: usuario (la idea, el JSON con su modelo, la fecha y la hora, y el versionado inmutable). El asistente: `conforme` como columna aparte, `id_entidad`/`id_documento` sin FK, enlazar cada versión con la primera en vez de con la anterior, y `resumir_registros_gd`.
Reversible: sí — dos tablas nuevas que solo se referencian entre sí; quitar las tools no afecta a nada existente.
**Panel** (`frontend/src/paginas/Registros.jsx`, pantalla "Registros de datos", dos pestañas): "Anotaciones" — selector de modelo, filtros por fecha y por conformidad, una columna por campo del esquema, y alta/corrección/borrado; y "Modelos" — alta, edición (solo sin registros), versión nueva (pide el motivo) y el historial de versiones. El formulario de alta **se genera a partir del JSON Schema** del modelo: desplegable para los campos con `enum`, `NumberInput` con sus `minimum`/`maximum`, casilla para los booleanos y campo de fecha para `format: date`, así que la pantalla no sabe nada de ningún modelo concreto. Al corregir un registro anotado con una versión anterior, el formulario se monta con el esquema de ESA versión (se pide aparte, porque el listado de modelos solo trae la última de cada uno). Escritura para cualquiera salvo invitado, igual que las reglas; `creado_por` sale de la sesión.

**Archivo original de un registro** (2026-09-28, petición del usuario: "lo mismo que un documento"): `gd_registros.archivo_original` + `_nombre` + `_tipo_mime`, BLOB opcional en la misma fila, igual que `gd_versiones.archivo_original` — un archivo por registro (la foto del parte, el PDF del análisis), guardado tal cual, solo de referencia/descarga. Los listados nunca traen el binario (`COLUMNAS_SIN_ARCHIVO` en el CRUD, `sin_archivo()` para lo que sale por MCP y panel); `archivo_original_nombre` dice si hay. Panel: campo "Archivo original" en el formulario de alta/corrección (elegir otro sustituye al anterior) y clip para descargarlo en el listado. Se sube aparte (`POST .../registros/{id}/archivo-original`) porque el alta es JSON, no un formulario. Por MCP, `adjuntar_archivo_original_gd` (base64 → binario, hasta 20 MB) vale para un registro (`id_registro`) o para la versión vigente de un documento (`id_documento`); petición del usuario tras ver que la IA no tenía forma de guardar el PDF. Solo sirve si la IA tiene el archivo a mano (Claude Code, ejecución de código): desde un chat sin herramientas de código no puede producir el base64 de un adjunto.

**Archivo desde la cola y varios documentos por registro** (2026-09-28, petición del usuario: el base64 "sale caro" — la IA escribe el archivo entero como tokens —, y un registro debe poder vincularse a documentos):
- El archivo entra por la cola de pendientes, igual que los documentos (subida del panel o `guardar_adjunto_correo_gd`). `crear_registro_gd` y `corregir_registro_gd` aceptan `id_documento_pendiente`: `RegistrosCRUD.adjuntar_pendiente()` copia el archivo como `archivo_original` del registro y lo saca de la cola, sin que pase por la conversación. `adjuntar_archivo_original_gd` queda como último recurso y su docstring lo dice. De paso, `guardar_documento_gd` con `id_documento_pendiente` guarda ahora también el archivo como `archivo_original` de la versión: antes lo borraba de la cola y se perdía.
- Tabla nueva `gd_registros_documentos` (`id_registro` con FK en cascada, `id_documento` sin FK por el mismo motivo que `id_entidad`, único `(id_registro, id_documento)`; índices con nombre propio porque `id_documento_idx` ya existe en el esquema). Sustituye a `gd_registros.id_documento`, que solo admitía uno: los valores que hubiera se copian a la tabla nueva y la columna se borra con SQL a mano en cada base (`ManagerDB` no borra columnas con `permitir_drop=False`). Tools: `vincular_documento_registro_gd`, `desvincular_documento_registro_gd`, `crear_registro_gd(id_documentos=[...])`, `listar_registros_gd(id_documento=...)`; cada registro devuelto trae `documentos`. Panel: selector múltiple "Documentos vinculados" en el alta/corrección, columna "Documentos" en la tabla, y en la ficha del documento la fila "Registros" (se pueden quitar desde ahí; se añaden desde el registro, porque elegir entre cientos de registros desde el documento no es práctico).
- Probado contra un Postgres local: esquema viejo con datos → esquema nuevo → migración → volver a aplicar el esquema (no recrea la columna); vincular dos veces, desvincular, filtro por documento, archivo desde la cola, borrado en cascada. Panel probado en navegador con datos simulados.

Quién decidió: usuario (archivo como en documentos, varios documentos por registro). El asistente: vincular desde el registro y solo ver/quitar desde el documento; guardar también el original de los documentos que salen de la cola.

### Correo por IMAP (2026-09-28)

Petición del usuario: que la GD se conecte por IMAP a una cuenta de correo dada, con la contraseña del registro de credenciales, y atienda lo que le pida la IA. Distinto de la ingesta automática ("3. Ingesta por email", `scripts/revisar_correo_entrante.py`), que usa la cuenta única de `gd_configuracion` y solo recoge adjuntos: aquí la cuenta es cualquier credencial, elegida por su nombre en cada llamada, y la IA decide qué hacer.

**Una conexión por petición**, no una sesión abierta: cada tool abre, autentica, hace su operación y cierra (`_mod_correo_imap._sesion`). ~1 s más por llamada, a cambio de aguantar reinicios y no mantener decenas de buzones conectados. `imaplib` es bloqueante: va en `asyncio.to_thread`.

**Cómo se lee la credencial**: `usuario` = login/dirección, `valor` = contraseña. Campos extra opcionales (`gd_credenciales_campos`, bloque "Avanzado" del panel): `imap_host` (si falta, tabla de proveedores conocidos por dominio y si no `imap.<dominio>` y, si no responde, `mail.<dominio>` — añadido tras la primera prueba real, Labosur, cuyo servidor es `mail.labosur.es`), `imap_port` (993), `imap_seguridad` (`ssl` | `starttls` | `ninguna`). **Microsoft 365** no acepta contraseña desde 2022: si la credencial trae `tenant_id` y `client_id`, se pide un token OAuth de aplicación (client credentials contra `login.microsoftonline.com`, scope `https://outlook.office365.com/.default`) y se entra con `AUTHENTICATE XOAUTH2`; el secreto va en el campo extra `client_secret` o, si no, en `valor`. Requiere que el cliente registre la app en Entra ID con `IMAP.AccessAsApp` y dé acceso al buzón a su service principal (`New-ServicePrincipal` + `Add-MailboxPermission` en Exchange Online). Gmail funciona con contraseña de aplicación, sin OAuth. Sin dependencias nuevas (urllib para el token).

**Correos identificados por `uid` dentro de una carpeta** (estable aunque entren o se borren otros; cambia al mover). Leer usa `BODY.PEEK`: nunca marca como leído, eso es explícito con `marcar_correo_leido_gd`. Mover usa `UID MOVE` si el servidor lo anuncia; si no, `COPY` + `\Deleted` + `UID EXPUNGE` (o `EXPUNGE` sin UIDPLUS, que purgaría también otros ya marcados como borrados — caso raro). UTF-8: si el servidor admite `UTF8=ACCEPT` se activa; si no, los nombres de carpeta van en UTF-7 modificado y los filtros de remitente/asunto con acentos se aplican aquí en vez de en el servidor (entonces `coincidencias` sale `null`).

**Tools MCP** (`mcp_server/herramientas/_herr_correo.py`), todas con `credencial` (nombre) como primer parámetro: `listar_carpetas_correo_gd`, `listar_correos_gd`, `leer_correo_gd` (HTML pasado a texto, recorte a 20.000 caracteres), `obtener_adjunto_correo_gd` (solo lectura: devuelve el archivo a la IA), `guardar_adjunto_correo_gd` (a `gd_documentos_pendientes` con `origen='email'`), `marcar_correo_leido_gd` y `mover_correo_gd`. Ninguna va marcada con `SOLO_LECTURA`, ni siquiera las que solo leen: **una key de invitado no ve ni puede usar ninguna** (decisión del usuario: los invitados no leen el buzón). Tampoco llevan la etiqueta `gd_enlazada`.

**Probado** en local contra GreenMail (servidor IMAP de pruebas): carpetas con acentos (UTF-7), filtros por asunto con acentos, fechas, no leídos, correo solo HTML, adjunto PDF, marcar leído, mover con `MOVE` y sin él, carpeta/uid/credencial inexistentes, contraseña errónea, y el error de Microsoft con un tenant falso. **Sin probar** con una cuenta real de ningún proveedor ni con un token OAuth válido de Microsoft 365.

Quién decidió: usuario (IMAP con credenciales, que la IA pueda marcar como leído y mover, cualquier proveedor). El asistente: conexión por petición, OAuth de aplicación para Microsoft 365, y `obtener_adjunto`/`guardar_adjunto` como tools aparte. Usuario: invitados sin acceso al buzón.
Reversible: sí — sin tablas nuevas; quitar `_herr_correo.py` no afecta a nada existente.

### Registro de actividad (2026-09-28)

Quién cambió qué y cuándo, en una sola tabla `gd_actividad` (esquema en `database/dependencias/_dep_actividad.py`). Se apunta todo cambio que sale bien, venga de donde venga; las consultas no. Decisiones del usuario: lo ve cualquiera menos los invitados (en el panel y por MCP), y se borra lo que tenga más de 365 días.

- **Sin FKs a propósito**: `quien` y `nombre_objeto` son copias del nombre en ese momento, para que el apunte siga legible aunque se borre el documento, el usuario o la key.
- **Lado MCP** (`mcp_server/herramientas/_herr_actividad.py`): un middleware de fastmcp que el propio proyecto engancha a su instancia al importarse (`mcp_app.add_middleware`), sin tocar el core. Apunta solo las herramientas de la lista `ACCIONES_MCP` — lista explícita porque hay herramientas que leen sin estar marcadas `readOnlyHint` (las de correo). **Una herramienta nueva que cambie datos debe añadirse ahí.** Quién = nombre de la API key; si la key compartida la usan varias personas, no se distinguen.
- **Chat del panel**: llama al MCP con su key interna ("Chat interno (...)") y manda el id del usuario en la cabecera `x-gd-id-usuario`; el middleware la cree solo con esa key interna (nunca se enseña a nadie) y apunta a la persona con `origen="chat"`.
- **Lado panel** (`panel_cliente/actividad_panel.py`): middleware ASGI que empareja cada POST/PUT/DELETE con su endpoint por el nombre de la función y apunta los de `ACCIONES_PANEL` que respondan < 400. **Un endpoint nuevo que cambie datos debe añadirse ahí.** Fuera a propósito: el borrador automático, las conversaciones del chat y "probar enlace". Superadmin = "Soporte Multiplika".
- **Sin secretos**: `limpiar_detalle` oculta cualquier campo cuyo nombre suene a clave/contraseña/token/base64 y recorta textos a 300 caracteres; el cuerpo de credenciales, certificados, cuenta de correo, enlace y emisión de key no se guarda nunca.
- **Nombre antes de ejecutar**: para que un borrado siga diciendo qué se borró, el nombre se lee antes de la acción y se vuelve a leer después (por si cambió o se creó).
- **Apuntar nunca tumba la acción**: si falla el insert, se escribe en la salida del proceso y se sigue.
- **Consulta**: tool `consultar_actividad_gd` (marcada de lectura para que el chat no pida confirmación, pero rechaza keys de invitado dentro), pantalla "Actividad" del panel y pestaña "Actividad" en la ficha de cada documento (`GET /v1/proyectos/{id}/actividad`, con `escritor_gestion_documental_actual`).
- **Limpieza**: `scripts/limpiar_actividad.py`, cron mensual, mismo patrón que `limpiar_conversaciones_chat.py`.
- **El log de certificados** (`gd_certificados_log`, descargas) se queda como estaba: apunta lecturas, que este registro no apunta.

### Compartir un documento por enlace (2026-09-28)

Un enlace público para que alguien de fuera, sin cuenta, descargue un documento en PDF y, si se elige, también su archivo original. Tabla `gd_compartidos` (`database/dependencias/_dep_compartidos.py`), lógica en `database/modelos/_mod_compartidos.py`.

Decisiones del usuario: la caducidad se elige al crear (7, 30 o 90 días; 7 por defecto) y se puede anular antes; el contenido queda **congelado** al compartir (si el documento se corrige después, el enlace sigue dando lo que se mandó); el enlace se puede copiar o mandar por email desde la cuenta de correo del proyecto; sin protección extra aparte del token, pero se cuentan las descargas.

- **PDF guardado al crear** (columna `pdf`), no generado en cada visita: así queda congelado de verdad (la edición desde el panel cambia `markdown_actual` de la misma versión) y una página pública no lanza WeasyPrint cada vez que alguien la abre. Mismo formato que "Descargar PDF" del panel: `pdf_de_documento` en `_mod_pdf.py`, compartido por los dos.
- **Archivo original**: sale de la versión vigente al compartir (`id_version`), no se copia.
- **Token en claro** (no su hash), para poder volver a copiar el enlace desde el panel: quien lee la tabla ya puede leer el documento, el hash no protegería nada.
- **URL**: `GD_URL_PUBLICA` + `/v1/compartido/{id_proyecto}/{token}` (página con los botones), `/pdf` y `/original`. Públicas, como el formulario de credencial; con `no-store`, `noindex` y `no-referrer`. Caducado, anulado o inexistente dan la misma página "Enlace no disponible".
- **Email**: `mandar_correo` (sacado de `enviar_envio` en `_mod_envios.py`). Si falla, el enlace queda creado igual con `estado_email='fallido'` y el motivo, para copiarlo a mano.
- **No se comparte un documento archivado**; los enlaces ya creados siguen funcionando si se archiva después. Si se borra el documento, sus enlaces caen con él (`ON DELETE CASCADE`).
- **Tools MCP** (`_herr_compartidos.py`): `compartir_documento_gd`, `listar_compartidos_documento_gd`, `anular_compartido_gd` (invitados: solo listar). **Panel**: pestaña "Compartir" en la ficha del documento. Crear y anular se apuntan en el registro de actividad; las descargas no (van en los contadores del propio enlace).

Quién decidió: usuario (caducidad elegible, contenido congelado, copiar o mandar, sin protección extra). El asistente: PDF guardado en la tabla, token en claro, rutas públicas.
Reversible: sí — tabla nueva sin dependencias de otras.

### Chat en panel lateral (2026-09-29)

El chat dejó de ser una pantalla más: vive en `AppShell.Aside` (a la derecha), se abre y se cierra con la opción del menú (o con su X) y se puede cambiar de ancho arrastrando su borde izquierdo (mín. 320 px; se recuerda en `localStorage`, clave `gd_panel_ancho_chat`). `Chat.jsx` se monta la primera vez que se abre —para no crear una conversación vacía a quien nunca lo usa— y ya no se desmonta al ocultarlo ni al navegar, así que la conversación y una respuesta en camino siguen intactas. Se desmonta al cerrar sesión o cambiar de empresa. La lista de conversaciones pasó a un desplegable (no cabía una columna en un panel estrecho). En móvil (`breakpoint: "sm"`) Mantine lo pone a pantalla completa y se cierra con la X. Probado con Playwright y datos simulados: navegar mientras llega una respuesta, cerrar y reabrir sin volver a pedir la conversación, arrastrar, recarga y móvil.

### Programaciones y notificaciones (2026-09-29, fase 1)

Avisos puntuales o repetidos para personas concretas del proyecto, enlazables a varios documentos, con tareas que esperan un "Hecho". Plan completo y fases siguientes (avisos del sistema operativo, calendario, scripts): `docs/planificacion/programaciones-avisos-y-notificaciones.md`.

- **Tablas** (`database/dependencias/_dep_programaciones.py`): `gd_programaciones` (qué, cuándo en JSON, próxima vez, estado activa/pausada/terminada, email sí/no, "Hecho" con máximo de recordatorios y cada cuántos días), `gd_programaciones_documentos` y `gd_programaciones_destinatarios` (muchos a muchos; el usuario sin FK porque vive en la base de control), `gd_ejecuciones` (cada vez que saltó: resumen legible por persona y el estado del "Hecho") y `gd_notificaciones` (la bandeja de cada usuario; campo `origen` pensado para que entren luego caducidades e incidencias). Borrar una programación se lleva su historial y sus notificaciones.
- **Horas de Madrid sin zona**: se guardan y se comparan en hora de reloj de Madrid (`ahora_madrid()`), no con `CURRENT_TIMESTAMP`; así "a las 9:00" sigue siendo a las 9:00 tras el cambio de hora.
- **Repeticiones** (`database/modelos/_repeticiones.py`, sin base de datos): una_vez, cada_dias, semanal (días 1–7), mensual (el día de la fecha; si el mes no lo tiene, el último) y anual, con `hasta` opcional. Si el servidor estuvo parado, al volver salta una sola vez, no una por cada fecha perdida.
- **Lógica común** (`database/modelos/_mod_programaciones.py`): la usan las tools, el panel y el cron. Validaciones con mensajes que se enseñan tal cual; los destinatarios tienen que ser usuarios activos con rol en el proyecto.
- **Cron `mcp_gd_programaciones`, cada minuto** (`scripts/procesar_programaciones.py`): a diferencia de los otros scripts, se lanza como módulo (`python -m apps.mcp_server.paneles_cliente.multiplika_gestion_documental_mcp.scripts.procesar_programaciones` desde la raíz del core) para reutilizar la lógica en vez de copiarla. Cada programación y cada recordatorio se reclama con un UPDATE condicionado antes de avisar, así que dos pasadas solapadas no repiten nada. El email sale desde la cuenta de correo del proyecto al email del usuario; si no hay cuenta o falla, la notificación del panel se crea igual y queda anotado.
- **"Hecho"**: cada vez que salta es independiente (el del lunes no cierra el del lunes siguiente). Lo cierra cualquiera de los avisados o cualquiera que pueda escribir; al cerrarlo, las notificaciones de todos pasan a leídas. Pausar para los avisos nuevos, no los recordatorios de uno ya mandado.
- **Tools MCP** (`_herr_programaciones.py`): `listar_usuarios_proyecto_gd`, `crear/actualizar/pausar/reanudar/eliminar_programacion_gd`, `listar_programaciones_gd`, `obtener_programacion_gd`, `listar_avisos_pendientes_gd`, `marcar_hecho_gd`. Con una API key normal no se sabe quién está detrás: si no se dice a quién avisar, la tool falla pidiendo que se pregunte. Desde el chat del panel se avisa por defecto a quien escribe.
- **Panel**: "Notificaciones" (con el número de no leídas, que se consulta cada minuto) y "Avisos programados" en el menú, ficha de cada aviso con historial, y pestaña "Avisos" en la ficha del documento. Crear y cambiar, cualquiera salvo invitado; soporte no tiene notificaciones propias.
- Todo lo que cambia datos está en `ACCIONES_MCP` y `ACCIONES_PANEL` (registro de actividad), tipo de objeto `programacion`. Leer notificaciones no se apunta.

Quién decidió: usuario (avisos a personas concretas, "Hecho" con número de recordatorios elegible, scripts aplazados). El asistente: horas de Madrid sin zona, una sola ejecución tras una parada, cron como módulo.
Reversible: sí — tablas nuevas sin tocar ninguna existente; quitar el cron desactiva los avisos.

### Bloc de notas (2026-10-01)

Notas sueltas de los usuarios (reuniones, llamadas, ideas) enlazables entre sí, con documentos y con registros de datos. Nada que ver con las notas de seguimiento (`gd_notas`), que cuelgan siempre de un documento y siguen igual. Plan y decisiones: `docs/planificacion/bloc-de-notas.md`.

- **Tablas** (`database/dependencias/_dep_bloc_notas.py`): `gd_bloc_notas` (fecha editable, título, descripción, contenido markdown, visibilidad `privada`/`personas`/`todos`, color opcional, fijada, archivada, autor sin FK) y, con FK y `ON DELETE CASCADE`, `gd_bloc_notas_personas`, `gd_bloc_notas_etiquetas`, `gd_bloc_notas_relaciones` (nota↔nota sin dirección, una fila con el id menor en `id_nota_a`), `gd_bloc_notas_documentos` y `gd_bloc_notas_registros`. Además `gd_programaciones.id_nota_bloc` (el recordatorio de una nota; se borra con ella).
- **Quién ve qué** (`database/modelos/_mod_bloc_notas.py`, común a tools y panel): cada función recibe la persona que pregunta o `None`. Con `None` solo existen las notas de todos. Una nota que no ves es como si no existiera (mismo error que un id que no está), y los enlaces a notas que no ves no salen. Editar: cualquiera que la vea (salvo invitado). Cambiar visibilidad, archivar y borrar: el autor, o cualquiera si no tiene autor.
- **Quién es "yo"**: en el panel, el usuario (soporte = `None`). Por MCP, el usuario del chat del panel; si no, el dueño de la API key (`mcpc_api_keys.id_usuario`, nueva en el núcleo: NULL = clave de todos, lo de siempre); si no, `None`. Las dos pantallas de API keys (núcleo y GD) dejan elegir "De todos" o una persona al emitirla.
- **Tools MCP** (`_herr_bloc_notas.py`): `buscar_notas_bloc_gd`, `obtener_nota_bloc_gd`, `listar_etiquetas_bloc_gd` (solo lectura), `crear/actualizar/enlazar/desenlazar/eliminar_nota_bloc_gd`; archivar es `actualizar_nota_bloc_gd(archivada=True)`. El recordatorio, `crear_programacion_gd(id_nota_bloc=...)`, que además avisa por defecto al dueño de la key si la key es de una persona. Búsqueda por texto (cada palabra en título, descripción, contenido o etiquetas), no semántica. El color se guarda con el nombre de Mantine (`red`, `grape`...) y la IA lo pide en español (`rojo`, `morado`...; "ninguno" lo quita).
- **Panel**: "Bloc de notas" en el menú (lista con filtros y ficha de cada nota con enlaces y recordatorios), pestaña "Bloc de notas" en la ficha del documento y botón en cada fila de registros de datos.
- **Registro de actividad**: tipo `nota_bloc` en `ACCIONES_MCP`/`ACCIONES_PANEL`. Como el registro lo ve todo el proyecto, de una nota que no es de todos no se guarda ni el título ni el detalle (`TIPOS_PRIVADOS` en `_mod_actividad.py`).

**Enlace con entidades (2026-10-06, petición del usuario)**: `gd_bloc_notas_entidades`, mismo patrón que `gd_bloc_notas_documentos` (FK `ON DELETE CASCADE` a los dos lados: borrar la entidad quita el enlace, la nota sigue). Tipo de enlace `entidad` en `enlazar/desenlazar_nota_bloc_gd`, `ids_entidades` al crear y filtro `id_entidad` al buscar. Panel: "Entidad" en el modal de enlazar de la nota (el badge abre la ficha de la entidad) y sección "Bloc de notas" en la ficha de la entidad, con "Nueva nota" ya enlazada. Al desplegar, la FK hacia `gd_entidades` obliga a registrar también `TABLA_ENTIDADES` si se aplica con un script `ManagerDB` ad hoc (`update_db.py` ya la lleva).

Quién decidió: usuario (visibilidad por nota, claves de una persona o de todos, etiquetas, IA, recordatorio, fijar/archivar, notas de seguimiento aparte). El asistente: permisos de edición, búsqueda por texto, privacidad en el registro de actividad.
Reversible: sí — tablas nuevas y dos columnas que admiten NULL (`gd_programaciones.id_nota_bloc`, `mcpc_api_keys.id_usuario`).

### Seguimiento (2026-10-01)

Estado de seguimiento para notas del bloc, documentos y notas de documentos (`gd_notas`), para no perder de vista lo que hay que hacer, y un resumen diario de lo pendiente. Plan y decisiones: `docs/planificacion/seguimiento.md`.

- **Estados**: sin estado (no tener fila: lo normal, también para todo lo que ya existía), `pendiente`, `en_curso`, `realizado` y `aplazado`. Cada elemento con estado puede tener un responsable (usuario del proyecto que no sea invitado) o nadie.
- **Tablas** (`database/dependencias/_dep_seguimiento.py`): `gd_seguimiento`, una sola para los tres tipos, con `id_nota_bloc` / `id_documento` / `id_nota` (cada una única y con FK `ON DELETE CASCADE`; va rellena exactamente una), estado, `id_usuario_responsable` sin FK, `aplazado_hasta`, `id_programacion` (FK `SET NULL`) y quién/cuándo lo cambió. `gd_seguimiento_resumenes`: una fila por día con resumen mandado, para no repetirlo.
- **Aplazado**: exige fecha (y hora, por defecto 9:00) y crea un aviso programado normal (`gd_programaciones`, una vez) al responsable, o a quien lo aplaza, o, si no se sabe quién es, a todos los que pueden escribir. Cuando el aviso salta, `_saltar` (`_mod_programaciones.py`) devuelve el elemento a pendiente. Cambiar la fecha o salir del aplazado borra el aviso si no ha saltado. Red de seguridad: si alguien borra o pausa ese aviso, el cron lo devuelve a pendiente igual al llegar la fecha. Para una nota del bloc que no es de todos, el aviso no lleva su título (la lista de avisos la ve todo el proyecto).
- **Resumen diario** (`_mod_seguimiento.py → mandar_resumen_diario`, desde el cron de cada minuto `procesar_programaciones.py`, sin cron nuevo): a partir de las 8:00 de Madrid, una vez al día, a cada persona lo pendiente y en curso de lo que se encarga más lo que no tiene responsable (esto último no a los invitados), solo de lo que ve y sin archivados. Campanita (`gd_notificaciones.origen = 'seguimiento'`, sin programación) y email con la cuenta del proyecto. Quien no tiene nada no recibe nada.
- **Quién ve y cambia**: lo mismo que el elemento. Notas del bloc, según su visibilidad (y el responsable tiene que poder verla); documentos y sus notas, todo el proyecto. Cambiar, cualquiera salvo invitado.
- **Tools MCP** (`_herr_seguimiento.py`): `cambiar_seguimiento_gd` y `listar_seguimiento_gd` (solo lectura). `obtener_nota_bloc_gd` y `listar_notas_documento_gd` traen además el seguimiento.
- **Panel**: "Seguimiento" en el menú (todo junto, con filtros por estado, tipo y responsable), y el estado se cambia pulsando su etiqueta en la ficha de la nota del bloc, en la cabecera del documento y en cada nota del documento. La lista del bloc enseña el estado de cada nota. Pulsar un resumen en Notificaciones lleva a Seguimiento.

Quién decidió: usuario (los cinco estados, aplazado con aviso, sin estado por defecto, cada uno lo suyo y lo de nadie a todos, campanita + email a las 8:00). El asistente: una sola tabla, responsable distinto del `responsable` de texto libre de `gd_notas`, resumen dentro del cron de programaciones, invitados fuera.
Reversible: sí — dos tablas nuevas; no toca ninguna columna existente.

### CRM (2026-10-06, fase 1)

Contactos, embudo de ventas y oportunidades encima de las entidades. Plan completo (4 fases, la 2 es la conexión con Multiplika SIF o la importación desde Excel): `docs/planificacion/crm.md`.

- **Tablas** (`database/dependencias/_dep_crm.py`): `gd_entidades_contactos` (FK CASCADE a la entidad; `principal`, como mucho uno por entidad), `gd_crm_etapas` (nombre, orden, probabilidad 0-100, tipo `abierta`/`ganada`/`perdida`; las de por defecto las siembra `update_db.py` si la tabla está vacía), `gd_oportunidades` (FK RESTRICT a entidad y etapa: no se borra una entidad con oportunidades ni una etapa en uso; contacto SET NULL; `id_usuario_responsable` sin FK; `proximo_paso` + `fecha_proximo_paso`; `codigo_erp` para la fase 2), `gd_oportunidades_documentos` y `gd_oportunidades_cambios` (cada cambio de etapa con copia del nombre de la etapa, para el historial y los informes de conversión).
- **Reglas** (`database/modelos/_mod_crm.py`, comunes a tools y panel): crear sin etapa la pone en la primera abierta; pasar a ganada/perdida pone `fecha_cierre` (hoy si no viene); volver a una abierta quita cierre y motivo de pérdida; cambiar de entidad quita el contacto; el responsable tiene que ser del proyecto y no invitado. `guardar_etapas` deja el embudo tal cual llega (crea, cambia, borra y reordena en una transacción) y exige al menos una etapa de cada tipo.
- **Próximo paso en el resumen de las 8:00** (en vez de meter las oportunidades en `gd_seguimiento`, que es de estados): `ventas_para_resumen` añade una sección "Ventas" al resumen diario de seguimiento con las abiertas de cada persona (y las de nadie, a quien puede escribir) cuyo próximo paso es para hoy o se pasó, o que no tienen próximo paso.
- **Historial de la entidad** (`historial_entidad`): una consulta que une documentos relacionados, notas del bloc enlazadas que ve quien pregunta, envíos, oportunidades y cambios de etapa, y contactos. Sin tabla nueva.
- **Tools MCP** (`_herr_crm.py`): `listar/crear/actualizar/eliminar_contacto_gd`, `listar_etapas_gd`, `configurar_etapas_gd`, `listar_oportunidades_gd` (con resumen por etapa), `obtener/crear/actualizar/eliminar_oportunidad_gd`, `relacionar/quitar_documento_oportunidad_gd` e `historial_entidad_gd`. Las que cambian datos, en `ACCIONES_MCP`; tipos `oportunidad` y `contacto` en `NOMBRE_POR_TIPO`.
- **Panel**: "CRM" en el menú (tablero por etapas con arrastrar y soltar, filtros abiertas/todas, de quién y texto; botón Etapas), y en la ficha de la entidad las secciones Personas de contacto, Oportunidades de venta e Historial. Los endpoints que cambian datos, en `ACCIONES_PANEL`.

Quién decidió: usuario (hacer el CRM dentro de la GD, la conexión con el ERP por Multiplika SIF con usuario y contraseña del obligado o importación desde Excel). El asistente: un solo embudo por proyecto, próximo paso como campos de la oportunidad (no como seguimiento), cerrar = mover a etapa ganada/perdida, etapas editables por cualquiera que pueda escribir.
Reversible: sí — cinco tablas nuevas; no toca ninguna columna existente.

### CRM: conexión con el ERP (2026-10-06, fase 2, lectura)

Dos vías que llenan las mismas tablas (`database/dependencias/_dep_erp.py`): **Multiplika SIF** y **importación desde Excel/CSV** para cualquier otro ERP. Escribir en SIF (alta de cliente, presupuesto) queda pendiente de decisión del usuario.

- **gd_entidades**: columnas nuevas `nif`, `baja_erp` y `fecha_sync_erp` (el NIF también en el formulario del panel y en crear/actualizar_entidad_gd). Cruce (`buscar_entidad`): código, luego NIF normalizado, luego nombre exacto. Los campos que vienen vacíos no borran lo que hay; nunca se borra una entidad.
- **gd_erp_facturas**: solo cabeceras, únicas por (origen, número, fecha): reimportar actualiza. `pendiente_cobro` NULL = no se sabe. El resumen de la ficha (`resumen_economico`) suma la base, o el total si no hay base (SIF no la da en el listado; se avisa con `incluye_impuestos`).
- **SIF** (`_mod_sif.py`, `gd_erp_conexiones`): entra con usuario y contraseña del obligado (credencial normal de la GD). Con API key no vale: en SIF una sesión `uak` solo llega a las rutas de la pasarela. Cookie `access_token` en un `httpx.AsyncClient`; 401 = volver a entrar una vez. Lee `/obligados/receptores/listar`, `/facturas_emitidas/listar` (sin filtro de fecha en la API: de la más nueva hacia atrás hasta el corte, 2 años la primera vez y 90 días después) y `/ventas/gestion_cobros/recibos/listar` con `estado_calculado = pendientes`, sumando `importe_pendiente` por `id_factura`. Todo en una transacción con un savepoint por registro. Cada noche desde las 3:00 (`procesar_nocturno`, dentro del cron de cada minuto `procesar_programaciones.py`; `fecha_ultimo_intento` evita reintentar cada minuto); si falla, notificación `origen = 'erp'` a quien puede escribir.
- **Excel** (`_mod_erp.py`, `gd_erp_importaciones`, `gd_erp_mapeos`): `.xlsx` (openpyxl, dependencia nueva) y `.csv` (separador y codificación detectados); `.xls` se rechaza pidiendo guardarlo como `.xlsx`. La cabecera es la primera fila con textos de las 15 primeras. Mapeo propuesto por sinónimos (sin coste de IA; por MCP la IA lo revisa con el cliente), guardado por huella de cabeceras. La vista previa **simula la importación de verdad dentro de una transacción que se deshace**, así cuenta exactamente lo que pasaría. Ojo: antes del primer `cx.transaction()` hay que lanzar una consulta, o psycopg abre una transacción propia que se confirma en vez de un savepoint. Por MCP el fichero entra por la cola de pendientes (`id_documento_pendiente`) o en base64.
- **Tools MCP** (`_herr_erp.py`): `importar_excel_erp_gd`, `revisar_importacion_erp_gd`, `aplicar_importacion_erp_gd`, `descartar_importacion_erp_gd`, `listar_importaciones_erp_gd`, `datos_erp_entidad_gd`, `estado_conexion_sif_gd`, `conectar_sif_gd`, `sincronizar_sif_gd`. **Panel**: CRM → «Conexión con el ERP» (pestañas Multiplika SIF e Importar desde Excel) y sección «Facturación» en la ficha de la entidad. Alta y baja de la conexión con SIF: solo admin.
- **Sin probar contra un SIF real**: probado contra un SIF simulado con las rutas y campos leídos del código de multiplika_sif.

Quién decidió: usuario (SIF con usuario y contraseña del obligado por defecto; Excel como alternativa). El asistente: solo lectura hasta que el usuario decida lo de escribir, cabeceras de factura sin líneas, el fichero importado no se guarda como documento (se vacía al aplicar), sincronización nocturna dentro del cron de cada minuto.
Reversible: sí — cuatro tablas nuevas y tres columnas que admiten NULL o tienen valor por defecto en gd_entidades.

### Webs y redes sociales (2026-10-06, fase 1)

Gestionar las webs, redes sociales y bases de datos de la empresa desde la GD, por las tres vías (IA por suscripción vía MCP, chat del panel y pantallas del panel) con el mismo freno. Plan completo, decisiones y fases siguientes: `docs/planificacion/webs-y-redes-sociales.md`. Fase 1: inventario, sistema de propuestas y WordPress (contenido).

- **Tablas** (`database/dependencias/_dep_activos_digitales.py`), sin FKs como `gd_actividad`: `gd_activos_digitales` (inventario: tipo, plataforma, dirección, credencial, entidad opcional, nivel de permiso, estado, `ajustes` en JSON con solo lo que difiere del valor por defecto) y `gd_cambios_externos` (cada cambio desde que se propone: antes, después, lo que guardó la web de verdad, estado, quién y por qué vía propuso y resolvió, y `detalle_purgado`). Estados y niveles como VARCHAR validado en el código, para ampliarlos sin migrar.
- **Freno común** (`_mod_cambios_externos.py`): proponer (lee la web, guarda antes/después, no cambia nada) → aplicar (vuelve a leer la web: si alguien la cambió entretanto, la propuesta queda `caducado` sin tocar nada; reserva la fila con `aplicando` para que dos aprobaciones a la vez no apliquen dos veces; aplica; comprueba que la portada responde y si WordPress guardó algo distinto) → deshacer (solo si lo aplicado sigue igual; si no, no pisa). Un fallo de la web no lanza: deja la propuesta `fallido` con el motivo.
- **Niveles de permiso** por activo: `lectura` (por defecto), `proponer` (solo se aplica desde el panel), `aplicar_confirmando`, `autonomo` (además `aplicar_ya` para `OPERACIONES_AUTONOMAS`: de momento solo moderar comentarios). La IA puede crear activos solo en lectura y bajar el nivel, nunca subirlo; subirlo es de un administrador en el panel. Lo impone el modelo, no los docstrings.
- **WordPress** (`_mod_wordpress.py`): API REST oficial con contraseña de aplicación (credencial de la GD: usuario + valor), `?rest_route=` si la web no tiene `/wp-json`. Lectura de entradas, páginas, comentarios, medios, plugins y usuarios; cambios: crear/editar entrada y página, moderar comentario, subir a medios el archivo original de un documento. No deja conectar a direcciones internas o privadas (`GD_PERMITIR_URLS_LOCALES=1` solo para pruebas en local).
- **Tools MCP** (`_herr_webs.py`, 14): inventario (`listar/obtener/crear/actualizar_activo_digital_gd`, `cambiar_ajustes_activo_gd`, `probar_conexion_activo_gd`), contenido (`listar/obtener_contenido_web_gd`) y cambios (`proponer/aplicar/rechazar/deshacer_cambio_web_gd`, `listar/obtener_cambio_web_gd`). Las de lectura y `proponer_cambio_web_gd` van marcadas de solo lectura (proponer no cambia nada fuera, y así el chat del panel enseña la vista previa sin pedir permiso dos veces; el permiso se pide al aplicar), pero todas rechazan claves de invitado por dentro.
- **Panel**: "Webs y redes" en el menú (no lo ven los invitados): lista, ficha con pestañas Contenido / Cambios / Datos y ajustes, editor de entradas y páginas, moderar comentarios, subir un documento a medios y la ventana de vista previa (antes/después, aplicar, rechazar, deshacer). Dar de alta, editar, nivel y ajustes: solo admin; contenido y propuestas: cualquiera que pueda escribir.
- **Ajustes** por activo (`AJUSTES` en `_mod_activos_digitales.py`): días que vale una propuesta (7) y días que se guarda la copia de cada cambio (365). Solo están los que ya hacen algo: copias de seguridad, actualizaciones y robots de IA llegarán con sus fases.
- **Cron diario** `scripts/limpiar_cambios_web.py` (SQL en línea, como `limpiar_actividad.py`): caduca propuestas viejas y borra la copia de los cambios más antiguos que su plazo.
- **Actividad**: todas las tools y endpoints que cambian algo están en `ACCIONES_MCP` / `ACCIONES_PANEL`, con los tipos `activo_digital` y `cambio_externo`.

Probado en local contra un Postgres temporal y un WordPress simulado: 49 comprobaciones de la lógica, las 14 tools por un cliente MCP en memoria y el panel en el navegador. Con la fase 2 se probó además contra un **WordPress 7.1.2 real** (montado en local con PHP de conda y la integración oficial de SQLite): editar, crear, moderar, subir imagen y deshacer, todo bien.

Quién decidió: usuario (las 9 decisiones del plan y las tres vías). El asistente: ajustes en JSON en vez de tabla aparte, sin FKs, nivel de permiso solo se sube desde el panel, `proponer` marcada de solo lectura.
Reversible: sí — dos tablas nuevas; no toca ninguna existente.

### Webs y redes sociales: vigilancia, conector, copias, actualizaciones y Cloudflare (2026-10-06, fase 2)

Plan: `docs/planificacion/webs-y-redes-sociales.md` (fase 2). Todo por las tres vías, como la fase 1.

- **Vigilancia** (`_mod_vigilancia.py` + `_mod_comprobaciones_web.py`, tablas en `_dep_vigilancia.py`: `gd_comprobaciones`, `gd_resultados_comprobacion`, `gd_vigilancia_resumenes`, `gd_cache_vulnerabilidades`, sin FKs). Cada activo con dirección tiene sus comprobaciones, creadas solas, cada una con su frecuencia: disponibilidad (5 min, reintenta una vez antes de dar la alarma), certificado, dominio (RDAP; los .es no publican caducidad → `sin_datos`), cabeceras, archivos expuestos (reconocidos por contenido, sin falsos positivos en webs que contestan 200 a todo), WordPress (administradores nuevos —siguen avisando hasta que una persona los da por buenos— y plugins con fallos conocidos vía WPScan, credencial «wpscan», con caché diaria) y spam. Estados: ok, aviso, grave, sin_datos, error. Activos en pausa o archivados no se vigilan.
- **Avisos**: lo grave, en el momento (campanita + correo, origen `vigilancia`) a quienes pueden escribir, solo al pasar a grave y otra vez al arreglarse (`estado_avisado`). Lo demás, en el resumen de los lunes desde las 8:00 (una vez por semana, reclamado en `gd_vigilancia_resumenes`).
- **Cron** `scripts/procesar_vigilancia.py` cada 5 minutos, como módulo (igual que `procesar_programaciones.py`) y aparte de él para que una web lenta no retrase los avisos. Cada comprobación se reclama con un UPDATE condicionado (dos pasadas a la vez no la repiten). `limpiar_cambios_web.py` borra además los resultados más antiguos que el plazo del activo.
- **Conector de Multiplika** (`conector_wordpress/multiplika-conector/`, plugin PHP): rutas en `/wp-json/multiplika/v1` solo para administradores (contraseña de aplicación + `manage_options`): estado (versiones, actualizaciones pendientes, espacio), integridad (sumas de control de WordPress.org, PHP de más en wp-admin/wp-includes y PHP en subidas), errores (cola del registro), copias (crear zip con volcado de la base de datos + wp-content, listar, descargar, borrar, restaurar con copia previa automática) y actualizar plugin/tema. Copias en `wp-content/multiplika-copias` con nombres imposibles de adivinar (el .htaccess no vale en Nginx). Se detecta solo al probar la conexión (`conector_instalado`). El panel lo descarga comprimido desde `GET /v1/proyectos/{id}/conector-wordpress.zip`, que lee la carpeta `conector_wordpress/` del repo: **hay que desplegarla junto al panel**.
- **Con conector**, cuatro comprobaciones más (`_mod_mantenimiento_web.py`): integridad, errores (solo los graves nuevos desde la pasada anterior), actualizaciones y copias. Copias: modo vigilar (última copia visible y plugins de copias conocidos) o hacerlas según los ajustes: frecuencia, cuántas en el servidor de la web (0 = solo remoto), servidor remoto por SFTP (credencial con usuario, contraseña o «clave_privada», y campos «host»/«puerto»; `_mod_conector.py`, paramiko), cuántas allí, y borrar la más antigua si falta espacio. Las copias van del servidor de la web al remoto pasando por un temporal en el servidor de la GD que se borra al terminar; nunca se guardan en Multiplika. Actualizaciones: avisar o automáticas (copia → actualizar → comprobar portada → si falla, restaurar la copia y aviso grave), con lista de exclusiones; cada actualización automática se apunta en `gd_cambios_externos` con vía `automatica`.
- **Operaciones nuevas** en el sistema de propuestas: `wp_actualizar_plugin`, `wp_actualizar_tema` y `wp_restaurar_copia` (con conector; antes de aplicar se hace una copia y deshacer vuelve a ella) y `cf_nivel_seguridad` (Cloudflare, también para webs que no son WordPress).
- **Cloudflare** (`_mod_cloudflare.py`): con una credencial de token en el ajuste `cloudflare_credencial`, comprobación (zona activa, modo SSL, https obligatorio, nivel de seguridad; avisa si «estoy siendo atacado» lleva más de un día) y cambio de nivel de seguridad por propuesta. **Sin probar contra una cuenta real de Cloudflare**, solo contra una API simulada.
- **Ajustes** ahora con tipo (número, sí/no, opción, texto, credencial) y marca `necesita_conector`: copias, actualizaciones, exclusiones, Cloudflare y días del histórico de vigilancia.
- **Tools MCP** nuevas (`_herr_vigilancia.py`): `estado_vigilancia_gd`, `resumen_vigilancia_gd`, `comprobar_ahora_gd`, `historial_vigilancia_gd`, `configurar_vigilancia_gd`, `aceptar_administradores_web_gd`, `listar_copias_web_gd`, `hacer_copia_web_gd`, `leer_errores_web_gd`. 23 en total entre webs y vigilancia.
- **Panel**: pestañas Vigilancia (estado de cada comprobación, frecuencia, «Comprobar», problemas de los últimos 30 días agrupados por cambio, instrucciones para instalar el conector, botones «Actualizar», «Son de confianza» y el de Cloudflare) y Copias (local y remota, «Hacer copia ahora», «Restaurar…»); columna Vigilancia en la lista; los ajustes se pintan según su tipo; las notificaciones de vigilancia llevan a "Webs y redes".

Probado en local: 33 comprobaciones de vigilancia (WordPress y servicios simulados), checks de certificado y dominio contra webs públicas reales (incluido un certificado caducado), 19 comprobaciones del conector contra el **WordPress 7.1.2 real** y un servidor SFTP local (copias con retención en los dos sitios, actualizar y deshacer, restaurar y deshacer, automáticas con exclusión y vuelta atrás si la web se rompe), 8 de Cloudflare simulado, las tools por un cliente MCP en memoria y el panel en el navegador. No probado: WPScan y Cloudflare reales, copias de webs grandes (el conector hace la copia de una vez; en webs de varios GB puede agotar el tiempo del hosting), restauración en MySQL real (se probó con SQLite).

**Despliegue** (además de lo de la fase 1): 4 tablas nuevas; cron `/etc/cron.d/mcp_gd_vigilancia` cada 5 minutos como módulo y `limpiar_cambios_web.py` diario; la carpeta `conector_wordpress/` junto al panel; `paramiko` (ya está en el núcleo, añadido también a `requirements.txt`).

Quién decidió: usuario (copias en el espacio del cliente, propio servidor o remoto, con control de espacio; actualizaciones a elección del cliente; conector propio). El asistente: SFTP como único destino remoto de la v1, conector con contraseña de aplicación en vez de clave propia, cron aparte cada 5 minutos, administradores nuevos hasta que una persona los acepte, Cloudflare sin probar en real.
Reversible: sí — 4 tablas nuevas y columnas ya existentes; el conector se desinstala como cualquier plugin.

### Webs y redes sociales: SEO (2026-10-06, fase 3)

Plan: `docs/planificacion/webs-y-redes-sociales.md` (fase 3). Por las tres vías, como las anteriores.

- **Google** (`_mod_google.py`): Search Console con una **cuenta de servicio de Google de Multiplika** (JSON en la ruta de `GD_GOOGLE_CUENTA_SERVICIO`, token JWT firmado con PyJWT, sin dependencias nuevas): el cliente solo añade su correo como usuario restringido de su propiedad; la propiedad se encuentra sola por la dirección (de dominio o de prefijo) o se fija en el ajuste `seo_propiedad_search_console`. No va en las credenciales de la GD porque la clave (~2,3 KB) no cabe en sus 500 caracteres y porque es de Multiplika, no del cliente. Los datos de Google no se guardan: se piden en vivo (Google ya guarda 16 meses). PageSpeed Insights con la clave de `GD_GOOGLE_API_KEY` (sin clave, Google ya no deja apenas consultas: se comprobó el 2026-10-06).
- **Auditoría propia** (`_mod_rastreo.py` + `_mod_seo.py`, tablas `gd_auditorias_seo` y `gd_hallazgos_seo` en `_dep_seo.py`): recorre la web desde la portada y el sitemap respetando robots.txt, sin salir del dominio (tampoco por redirecciones), de 4 en 4 páginas, hasta el máximo del ajuste `seo_paginas_maximo` (200). HTML con `html.parser` de la biblioteca estándar. Reglas: robots.txt, sitemap, https obligado, páginas rotas (con desde dónde se enlazan), cadenas de redirecciones, respuesta lenta, noindex (grave si está en el sitemap), título (falta, largo, corto, duplicado), descripción (falta, larga, corta, duplicada), H1, imágenes sin alt, poco texto, canonical a otra, fuera del sitemap, datos estructurados e idioma en la portada. **Prioridad** = gravedad × visitas desde Google de esa página (28 días). Reconoce qué entrada o página de WordPress es cada URL (clases del body o shortlink) para poder proponer el arreglo. Una auditoría nueva marca como resuelto lo que ya no aparece y respeta lo ignorado y lo convertido en tarea. Desde la IA o el panel se lanza en segundo plano; la semanal la hace la vigilancia.
- **Arreglos** por el sistema de propuestas: `wp_editar_seo` (título y descripción para Google y palabra clave; conector 1.1.0) y `wp_editar_medio` (texto alternativo y título de una imagen, por la API de WordPress). El conector escribe donde los lee el plugin de SEO de la web (Yoast, Rank Math, SEOPress) o, sin plugin, los guarda él y los pone en la página (`pre_get_document_title` y `wp_head`); AIOSEO no se toca (tablas propias). La operación «editar» quedó genérica por tipo (`CAMPOS_POR_TIPO`, `_leer`/`_escribir`).
- **Tareas**: un hallazgo se convierte en nota del bloc (etiqueta SEO) con seguimiento «pendiente», y entra en el resumen diario.
- **Informe mensual** en markdown (visitas y su evolución, páginas y búsquedas, cambios del mes con clics de esa página 28 días antes y después, lo más prioritario por arreglar), guardado como documento tipo «Informe SEO» (versión nueva si ya existía el del mes), para sacarlo en PDF con el estilo del cliente como cualquier documento.
- **Vigilancia**: comprobaciones nuevas `velocidad` (diaria, solo con clave de Google), `trafico_google` (diaria; avisa si las visitas de 7 días caen un 30 % con al menos 20 antes), `auditoria_seo` (semanal, para toda web con dirección) e `informe_seo` (el día 1, si el ajuste `seo_informe_mensual` está activo y hay Search Console). Las largas (copias, actualizaciones, auditorías) solo las hace un proceso del cron a la vez (cerrojo de archivo en `procesar_vigilancia.py`), para no amontonar procesos en memoria si una tarda.
- **Conector 1.1.0**: rutas `/seo/{id}` (leer y escribir). Las webs con una versión anterior reciben aviso en la comprobación de actualizaciones (`VERSION_CONECTOR`).
- **Tools MCP** (`_herr_seo.py`): `rendimiento_google_gd`, `velocidad_web_gd`, `auditar_seo_gd`, `hallazgos_seo_gd`, `marcar_hallazgo_seo_gd`, `hallazgo_a_tarea_gd`, `informe_seo_gd`, `guardar_informe_seo_gd`, `leer_seo_pagina_gd`. 32 en total entre webs, vigilancia y SEO.
- **Panel**: pestaña SEO (Google con instrucciones si falta el acceso, velocidad, auditoría con «Arreglar» / «Crear tarea» / «Ignorar», informe).

Probado en local: 27 comprobaciones contra el **WordPress real** con Google simulado (Search Console, token y PageSpeed): auditoría, prioridad por visitas, arreglar descripción y título en la página real sin plugin de SEO y **con Yoast instalado**, texto alternativo, tarea, re-auditoría, vigilancia SEO e informe guardado; el panel en el navegador; las 32 tools por un cliente MCP en memoria; y las pruebas de las fases 1 y 2 otra vez (153 comprobaciones en total). No probado: Search Console y PageSpeed reales (falta la cuenta de servicio y la clave), Rank Math y SEOPress reales (se escriben igual que Yoast, en metadatos de la entrada), webs grandes.

**Despliegue** (además de lo de las fases 1 y 2): 2 tablas nuevas; el conector 1.1.0; y, para Search Console y PageSpeed, que Multiplika cree una vez un proyecto de Google Cloud con una cuenta de servicio (activando Search Console API y PageSpeed Insights API) y una clave de API, y ponga en el entorno del servicio MCP, del panel y del cron de vigilancia `GD_GOOGLE_CUENTA_SERVICIO` (ruta del JSON) y `GD_GOOGLE_API_KEY`. Sin eso todo lo demás funciona y el panel dice que Google no está disponible todavía.

Quién decidió: usuario (empezar con lo gratuito dejando abierta la entrada a herramientas de pago). El asistente: cuenta de servicio de Multiplika en vez de OAuth por cliente, datos de Google en vivo sin guardarlos, auditoría propia sin dependencias, prioridad por visitas, conector como sustituto de plugin de SEO cuando no hay ninguno.
Reversible: sí — 2 tablas nuevas; el conector anterior sigue funcionando (sin la parte de SEO).

### Webs y redes sociales: bases de datos, redes sociales, GEO y webs a medida (2026-10-06, fases 4, 5 y 6)

Plan: `docs/planificacion/webs-y-redes-sociales.md`. Por las tres vías, como las anteriores. Cada activo tiene ahora una **capacidad** según su plataforma (`CAPACIDAD_POR_PLATAFORMA`: wordpress, bd, red, ficheros; Shopify, PrestaShop, Wix y «otra» siguen solo en el inventario) y sus **ajustes disponibles** (`para` en `AJUSTES`). `modo_conexion` se valida según la capacidad (`MODOS_CONEXION`).

**Fase 4 — Bases de datos** (`_mod_bases_datos.py`, tabla `gd_consultas_bd`). MySQL/MariaDB (pymysql) y PostgreSQL (psycopg), conectando directo, por túnel SSH (reenvío propio sobre paramiko; credencial en el ajuste `bd_credencial_ssh`) o por el conector de una web WordPress (`bd_id_web`; rutas `/bd/esquema` y `/bd/transaccion` del conector 1.2). Las consultas: una sola sentencia de lectura, dentro de una transacción de SOLO LECTURA (la base de datos rechaza cualquier escritura disfrazada, p. ej. un `WITH ... DELETE`), cortada a los 30 s y a 1000 filas. Los cambios nunca son SQL libre: `bd_actualizar` / `bd_insertar` / `bd_borrar` estructurados (tabla, valores, condiciones de igualdad), solo en tablas con clave primaria, como mucho `bd_max_filas` (100); al proponer se leen las filas (copia para deshacer); al aplicar se comprueba que no han cambiado y se cambia fila a fila por clave en una transacción que se anula si toca un número distinto del previsto; deshacer deja cada fila como estaba (o borra lo insertado, o reinserta lo borrado con su misma clave). Consultas guardadas para ejecutar con un botón. Tools: `esquema_bd_gd`, `consultar_bd_gd`, `guardar_consulta_bd_gd`, `listar_consultas_bd_gd`, `ejecutar_consulta_guardada_gd`, `borrar_consulta_bd_gd`. Panel: pestaña «Base de datos».

**Fase 5 — Redes sociales** (`_mod_redes.py`, `_mod_publicaciones.py`, tablas `gd_publicaciones` y `gd_publicaciones_medios`). Pieza común con las mismas operaciones para todas (publicar, borrar, métricas, comentarios, responder): por **intermediario** (Ayrshare: Facebook, Instagram, LinkedIn, Google Business, X, TikTok, YouTube) o **directo** (Graph API de Meta para Facebook e Instagram, con la aplicación del cliente). Calendario editorial: borrador → pendiente → aprobada → se publica sola a su hora (el cron de cada minuto, `procesar_programaciones.py`, reservando la publicación para no publicarla dos veces) → publicada / parcial / error; se puede **retirar** (deshacer: se borra de las redes; Instagram no lo permite por API y se dice). Aprobar respeta el nivel de permiso de cada red (proponer = solo desde el panel; lectura = no se publica). Límites de texto por red e imagen obligatoria en Instagram, TikTok y YouTube. Las imágenes salen de documentos de la GD por un **enlace público temporal propio** (`GET /v1/medio-publico/{id_proyecto}/{token}`, caduca a los 7 días), porque las redes piden una dirección y no aceptan el archivo. Métricas al día durante el primer mes. Responder a un comentario es una propuesta (`red_responder`) que se deshace borrando la respuesta. Los pasos para conectar cada red se enseñan en su pestaña, cuando se usa. Tools: `crear/actualizar/listar/obtener/aprobar/cancelar/retirar_publicacion_gd`, `metricas_publicacion_gd`, `comentarios_publicacion_gd`. Panel: «Calendario de publicaciones» (vista mes) y pestaña «Publicaciones» en cada red.

**Fase 6 — GEO** (`_mod_geo.py`, `_mod_geo_claude.py`, `_mod_geo_motores.py`, tablas `gd_preguntas_geo` y `gd_mediciones_geo`). Preguntas de seguimiento por web (máx. 50); cada medición las hace a Claude (SDK de Anthropic con la clave y el modelo de «Configuración de IA» de la empresa y la herramienta de búsqueda web del servidor, leyendo resultados y citas) y a ChatGPT, Gemini y Perplexity si el cliente da su clave (credenciales «openai», «gemini», «perplexity»; sus APIs por HTTP y en archivo aparte). Se apunta si sale la marca (ajuste `geo_marcas`, sin distinguir tildes), si cita la web, su puesto entre los sitios citados y los competidores. Comprobación de vigilancia `geo` una vez al mes y sección en el informe SEO mensual. Sobre la web (conector 1.3, `/geo`): qué robots de IA pueden leerla (lo decide el cliente, robot a robot; si hay un robots.txt físico se avisa de que manda él), `/llms.txt` y datos estructurados de la empresa en la portada, por la propuesta `wp_geo` (solo cambia los robots que se nombran). Tools: `preguntas_geo_gd`, `anadir_preguntas_geo_gd`, `quitar_pregunta_geo_gd`, `medir_geo_gd`, `resultados_geo_gd`, `leer_geo_web_gd`.

**Fase 6 — Webs a medida** (`_mod_ficheros.py`). Archivos por SFTP (carpeta `ruta_web`) o por Git (clon temporal, un commit por cambio y push a la rama; token en la credencial). Solo texto hasta 1 MB y siempre dentro de la carpeta de la web (una ruta con `..` no puede salir). Propuesta `fichero_editar` con el archivo completo: comprueba que no ha cambiado por fuera, y deshacer lo deja como estaba (o lo borra si era nuevo; por Git, con otro commit). Tools: `listar_ficheros_web_gd`, `leer_fichero_web_gd`. Panel: pestaña «Archivos». No hay copias de seguridad para webs a medida (dependen de su hosting).

**Otras plataformas** (Shopify, PrestaShop, Wix): no incluidas; se añadirían como otra capacidad cuando un cliente lo pida.

Probado en local: 35 comprobaciones de bases de datos contra **MySQL 9.7 real** (conda), PostgreSQL, un túnel SSH y la base de datos del **WordPress real** por el conector; 26 de redes con Ayrshare y Meta simulados (descargando de verdad las imágenes por el enlace público); 25 de la fase 6 (GEO con el SDK real de Anthropic contra una respuesta simulada con búsqueda web y citas, `robots.txt`, `/llms.txt` y datos estructurados en el **WordPress real**, archivos por SFTP y por Git en un repositorio local); las pantallas en el navegador; las 56 tools por un cliente MCP en memoria; y todas las pruebas de las fases 1 a 3 otra vez (239 comprobaciones en total). No probado: Ayrshare, Meta, OpenAI, Gemini y Perplexity reales; Git por https con un proveedor real (se probó con un repositorio local).

**Despliegue** (además de lo de las fases 1 a 3): 7 tablas nuevas; el conector 1.3; las publicaciones las lanza el cron de cada minuto que ya existe; el GEO, el cron de vigilancia. Requiere `git` en el servidor para las webs a medida por Git.

Quién decidió: usuario (todas las fases, redes por intermediario y directo, webs a medida). El asistente: cambios de base de datos estructurados y nunca SQL libre, enlace público propio para las imágenes de las redes, Ayrshare como intermediario y Meta como primer directo, Claude con la clave de la empresa para el GEO.
Reversible: sí — tablas nuevas; ninguna existente cambia de forma.

### Copias de seguridad de la base de datos (2026-10-07)

Pantalla "Copias de seguridad" en el bloque de Administración del panel (solo admin del proyecto o soporte): hacer una copia ahora, descargarla, borrarla, volver a ella (restaurar) y programarlas. Decisiones del usuario: va en el panel del cliente (cada cliente ve solo las suyas); el cifrado es con una contraseña que pone el usuario, para que pueda abrir la copia por su cuenta; se puede todo (hacer, descargar, borrar, restaurar, programar). Lógica en `database/modelos/_mod_copias_bd.py`, endpoints `/v1/proyectos/{id}/copias-bd...` en `panel_cliente/servidor.py`, pantalla `paginas/CopiasBD.jsx`.

- **Aparte del backup del núcleo** (`scripts/backup_diario.py` del repo core, de Multiplika para todos los clientes, 30 días y al Storage Box): ese sigue igual. Estas las gestiona el cliente.
- **En disco, no en la base**: `GD_COPIAS_BD_DIR` (por defecto `/opt/multiplika/gd_copias_bd`) `/p<id>/`, con `ajustes.json`, cada copia y un `.json` al lado (fecha, origen, resultado de la subida remota). Si la lista o los ajustes vivieran en la base, una restauración los devolvería también al pasado. Carpeta 700, archivos 600. Fuera de `mcp_backups/` a propósito: allí el núcleo borra a los 30 días y lo sube todo al Storage Box.
- **Formato**: `pg_dump -Fc --no-owner --no-privileges` (`.dump`). Cifrada: `.7z` (`py7zr`, dependencia nueva) con AES-256, clave derivada con 2^19 rondas de SHA-256 y la cabecera también cifrada (no se ven ni los nombres de dentro); sin recomprimir. Endurecido el 2026-10-07 a petición del usuario: la primera versión era ZIP AES (PBKDF2 de 1.000 rondas), unas 500 veces más rápido de atacar probando contraseñas; con 8 caracteres de minúsculas y números una GPU la sacaba en días. Se abre con 7-Zip o WinRAR.
- **Contraseña en el almacén de credenciales de la GD** (decisión del usuario): una sola, mínimo 12 caracteres, en `gd_credenciales` con el nombre reservado `NOMBRE_CREDENCIAL_COPIAS_BD` (`_mod_credenciales.py`). Reservado quiere decir: `obtener_por_nombre` no la devuelve salvo con `permitir_reservada=True` (así ninguna conexión que la IA pueda configurar contra un servidor cualquiera —webs, bases de datos, SFTP— puede usarla y mandarla fuera) y nadie más puede crear una credencial con ese nombre (ni la IA ni el panel). Se pone y se cambia solo desde la pantalla de copias; no se vuelve a enseñar. Cambiarla no recifra las copias anteriores.
- **Copia manual**: solo con las copias ya programadas (al menos un periodo) y la contraseña guardada, y siempre cifrada con ella (decisión del usuario). Las programadas, cifradas si se marca "cifrar"; la previa a restaurar, cifrada si hay contraseña.
- **Restaurar**: hay que escribir RESTAURAR (y la contraseña si es cifrada). Usa la contraseña guardada; si no abre la copia (se hizo con una anterior), pide que se escriba. Antes se hace sola una copia del estado actual (origen "antes de restaurar"), para poder deshacer. Como el almacén de credenciales está dentro de la base, la contraseña de las copias se lee antes y se vuelve a poner después: si no, la restauración la devolvería a la de entonces y las copias posteriores no se podrían abrir. `pg_restore --clean --if-exists --single-transaction`: si algo falla, la base se queda como estaba. Se dejan fuera las extensiones (`vector`, `unaccent`), el esquema `public` y la configuración `spanish_unaccent`: las crea el superusuario al aprovisionar y el usuario del cliente no puede tocarlas. Después se reaplica el esquema actual (`database/dependencias/_esquema.py`, la misma lista de tablas que `update_db.py`) por si la copia es de antes de un cambio de tablas.
- **Programadas por periodos** (ampliado el 2026-10-07 a petición del usuario: "diaria las 7 últimas, semanal las 10 últimas…"): hasta 10 periodos en `ajustes.json → periodos`, cada uno con su regla (diaria, días de la semana o un día al mes, a una hora; misma regla que los avisos programados, `_repeticiones.py`) y su forma de conservar: las N últimas copias o las de los últimos N días. Cada copia programada lleva en su `.json` la lista de periodos a los que pertenece; si dos tocan a la vez se hace una sola copia para los dos, y el archivo solo se borra cuando ya no lo quiere ningún periodo. Quitar un periodo hace que sus copias se borren en la siguiente poda (salvo las que sigan en otro). Las manuales y las de "antes de restaurar" no se borran solas. Cron `scripts/procesar_copias_bd.py` cada 5 minutos (módulo, como `procesar_programaciones.py`); el resultado de la última de cada periodo se enseña en la pantalla. Un `ajustes.json` del formato anterior (una sola regla) se convierte solo en un periodo al leerlo.
- **Una copia o restauración a la vez** por proyecto (bloqueo con `flock`).
- **Actividad**: hacer, borrar, restaurar, cambiar ajustes y también **descargar** (a mano en el endpoint, porque el middleware solo apunta escrituras). El cuerpo de esas peticiones no se guarda (lleva contraseñas).
- **Al desplegar**: `pip install py7zr`; `pg_dump`/`pg_restore` ya están en los servidores (los usa el backup del núcleo); cron `/etc/cron.d/mcp_gd_copias_bd` cada 5 minutos; la carpeta se crea sola.

### Asesor contable (2026-10-10, fases 0 y 1)

La IA como asesor contable, fiscal y financiero, con una biblioteca propia igual para todos los clientes y, en fases siguientes, conectada con la contabilidad de Multiplika SIF. Plan completo, estructura de temas y fuentes: `docs/contabilidad/`.

- **Activación por GD**: `gd_configuracion.modulo_contable` (por defecto apagado). Sin activar, `ModuloContableMiddleware` (`_herr_contabilidad.py`) oculta las herramientas con la etiqueta `contabilidad` y rechaza llamarlas, y el panel no enseña el apartado salvo al admin, que lo activa desde la propia pantalla.
- **Biblioteca** (`database/biblioteca_contable.py`, ficheros en `database/conocimiento_contable/`): `temas/` (área → bloque → [capítulo] → tema, cada nodo con id fijo en su cabecera YAML), `normativa/` (artículos literales del BOE con sus versiones) y `doctrina/` (consultas de la DGT resumidas). Se carga una vez por proceso; solo enseña las partes del árbol con algún tema. Los avisos de cada tema (no revisado, más de 12 meses, norma citada cambiada después de revisarlo) se calculan en código.
- **Tools MCP** (solo lectura): `buscar_temas_contables_gd`, `indice_contable_gd`, `obtener_tema_contable_gd`, `obtener_norma_contable_gd`. Las reglas del asesor (citar, avisar, proponer en vez de afirmar) van en sus docstrings: solo ocupan contexto donde el apartado está activado.
- **Panel**: `paginas/AsesorContable.jsx` (índice entero de una vez con `/contabilidad/arbol`, buscador, tema y normas citadas en un modal) y endpoints `/v1/proyectos/{id}/contabilidad/...` (`modulo` para activar, solo admin; el resto exige el apartado activado).
- **Mantenimiento** (en local): `python scripts/biblioteca_contable.py normativa` baja o actualiza del BOE los artículos citados (API de datos abiertos, sin clave) y `... comprobar` revisa ids, campos y enlaces. Lo que cambie se revisa, se hace commit y se despliega como siempre.
- **Fase 0**: el chat del panel recibe el negocio, las preferencias de trabajo y las reglas globales del `instructions` de su conexión MCP (ver "Reglas de comportamiento").

### Asesor contable conectado con el SIF (2026-10-10, fases 2 a 5)

Sin probar todavía contra un SIF real. Plan y decisiones: `docs/contabilidad/planificacion.md` y `memoria-anual.md`.

- **Accesos** (`_mod_contabilidad_sif.py`; decisión del usuario en [5.9] del canal compartido, 2026-10-10): **cada usuario vincula sus propios accesos al SIF** (dirección, usuario, contraseña) y ve lo que ese usuario del SIF ve; no hay nada que configurar a nivel de la GD (desapareció la conexión general con su modo y su clave reservada). `gd_conta_accesos` (varios por usuario; `tipo` empresa/asesoría sale del rol del SIF), credencial privada en `gd_credenciales.id_usuario_dueno` (no sale en el listado ni se encuentra por nombre, y el panel no deja editarla ni borrarla por id), `gd_conta_empresas` una vez por (SIF, id del SIF) y `gd_conta_accesos_empresas` con el nivel. Las empresas se nombran por `gd_conta_empresas.id` (`id_empresa`) en tools, panel, propuestas y proxy, porque el id del SIF se repite entre SIF; la empresa elige el acceso (el de mayor nivel si la ve por varios). Las empresas de cada acceso se refrescan al añadirlo, con "Actualizar" y cada noche.
- **Tools MCP** (etiqueta `contabilidad_sif`, ocultas si la GD no está conectada): `empresas_contables_gd`, `informe_contable_gd` (balance, pérdidas y ganancias, sumas y saldos, mayor y diario de 200 en 200, IVA, retenciones, cuadre y libros de IVA), `buscar_cuenta_contable_gd`, `analisis_financiero_gd` (ratios calculados en código, `_mod_conta_analisis.py`), `proponer_contable_gd`, `listar_propuestas_contables_gd`, y de la memoria `catalogo_memoria_gd`, `obtener_apartado_memoria_gd`, `memoria_contable_gd`, `datos_memoria_gd`, `proponer_apartado_memoria_gd`. Proponer está marcado de solo lectura (no escribe fuera, como `proponer_cambio_web_gd`) pero rechaza claves de invitado.
- **Propuestas** (`gd_conta_propuestas`): asiento (validado: cuadra y cuentas numéricas), reclasificación, aviso y apartado de memoria. Aceptar no toca el SIF salvo la memoria, que se guarda con la clave de quien acepta.
- **Revisión nocturna** (`scripts/revisar_contabilidad.py`, cron `mcp_gd_revisar_contabilidad` a crear a mano en cada servidor): refresca las empresas de cada acceso y, en los que su dueño activó `revision_automatica`, deja avisos por saldos anómalos y cuadre del IVA del último trimestre. Sin IA.
- **Memoria** (catálogo en `database/conocimiento_contable/memoria/<modelo>/`): pantalla "Memoria anual" y guardado en el SIF por `/contabilidad/memoria/*`, que el backend del SIF todavía no tiene.
- **Pantallas de contabilidad** (fase 5): `contabilidad_ui/` (Mantine 8, cliente configurable, `Embebido.tsx`) importada por el panel con el alias `@contabilidad` y carga diferida (`paginas/ContabilidadSIF.jsx`). Llama a `POST /v1/proyectos/{id}/contabilidad/sif/proxy/{id_obligado}/{ruta}`, que reenvía al SIF solo rutas `/contabilidad/*` con la sesión del usuario e impone la empresa. `mantine-react-table` no tiene versión para Mantine 8: va con `overrides` en `package.json`.
- **Panel**: "Asesor contable" con pestañas Biblioteca, Contabilidad, Propuestas, Memoria anual (estas tres con algún acceso propio) y Mis accesos al SIF.

### Inicio y menú agrupado (2026-10-10)

- **Inicio** (`paginas/Inicio.jsx`, `GET /v1/proyectos/{id}/inicio`): pantalla de entrada y destino de los botones "Inicio" de las pantallas de lista. Una petición que reúne, llamando a los endpoints de cada pantalla (mismos permisos y visibilidad), los 5 últimos y el total de: pendientes de clasificar, notificaciones sin leer y seguimiento propio (solo usuarios), avisos programados activos, documentos que caducan en 30 días, oportunidades abiertas con el importe del embudo, últimas notas del bloc, últimos documentos y, para quien puede editar o es admin, actividad reciente y webs con alertas de vigilancia. Con el asesor contable activado y el usuario con acceso, las propuestas contables pendientes. Una parte que falla se omite y se apunta en el log (`[inicio]`).
- **Menú** (`componentes/Sidebar.jsx`): grupos plegables Día a día, Documentación, Clientes y negocio, IA y automatización y Administración. Lo plegado se recuerda en `localStorage` (`gd_menu_plegados`); el grupo con la pantalla abierta se despliega solo. Los pendientes de clasificar salen como contador en "Documentos".
