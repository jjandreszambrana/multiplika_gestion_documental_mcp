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
  - tipo_documento
  - todas_versiones_buscables  BOOLEAN DEFAULT FALSE
  - fecha_alta

gd_versiones
  - id
  - id_documento          FK
  - vigente               BOOLEAN   -- true solo en la última
  - markdown_original     TEXT      -- lo que generó la IA
  - markdown_actual       TEXT      -- vigente (= original o corregido a mano)
  - revisado_manualmente  BOOLEAN DEFAULT FALSE
  - tsvector_actual       (GENERATED ALWAYS AS to_tsvector(markdown_actual) STORED + índice GIN)
  - fecha_documento       -- la del propio documento, no la de subida
  - fecha_subida

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

### Pipeline de ingesta (2026-09-06)
Sin interfaz: el cliente le dice a su Claude "guárdame esta factura" (la pega o adjunta) y es el propio cliente IA quien gestiona todo el proceso vía tools MCP.

La IA **siempre pregunta** al usuario antes de guardar (no infiere del contenido), como mínimo:
1. Tipo de documento (factura, certificado, contrato, informe, otro).
2. Nombre/referencia corta para identificarlo después.
3. Si es una versión nueva de un documento ya guardado o uno distinto — si dice que es nueva versión, la IA debe confirmar cuál usando `buscar_documentos()`, no adivinar.
4. Fecha del propio documento (no la de subida).
5. Si ese documento necesita que todo su histórico quede buscable, o solo la última versión (por defecto: solo la última).

### Tools MCP (2026-09-06)
Tres herramientas cubren todo el ciclo de consulta (la de ingesta/guardado queda para cuando se aborde la implementación, junto con el mecanismo de corrección del punto B de arriba):

1. **`consultar_documentos(pregunta, limite=5)`** — la principal, para responder preguntas del cliente. Resuelve sola el modo de búsqueda del proyecto (fulltext o semántico) y devuelve los fragmentos más relevantes con su documento, tipo, fecha e identificadores, para que la IA cite la fuente y pueda pedir el documento completo si hace falta.
2. **`obtener_documento_completo(id_documento, version=None)`** — devuelve el markdown completo de la versión vigente (o la indicada), para cuando un fragmento no basta.
3. **`buscar_documentos(referencia)`** — búsqueda por metadatos (nombre, tipo, fecha), no por contenido; sirve tanto para consulta exploratoria como para evitar duplicados al ingerir.

### Estructura del repo: igual que cualquier proyecto de cliente de Multiplika MCP (2026-09-06)
Este proyecto no inventa una estructura propia — sigue exactamente la misma que ya usa cualquier proyecto de cliente sobre Multiplika MCP, documentada en `guia_nuevo_proyecto.md` del repo core:

```
multiplika_gestion_documental_mcp/
├── database/
│   ├── dependencias/    # esquema (gd_configuracion, gd_documentos, gd_versiones, gd_chunks)
│   ├── modelos/         # CRUD y lógica de negocio
│   └── update_db.py     # migración de esta base (vía mtpk-postgres, no mtpk-mariadb)
└── mcp_server/
    └── herramientas/     # las tools MCP (consultar_documentos, obtener_documento_completo, buscar_documentos...)
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

**Fase 5 — Piloto con un cliente real**
- Elegir el primer cliente, probar el ciclo completo (subir, consultar, corregir) y ajustar según lo que salga.
- Pendiente: modelo de coste al cliente por el uso de embeddings — decisión de negocio, no técnica.
