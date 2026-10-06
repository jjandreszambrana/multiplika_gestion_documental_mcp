# CRM dentro de la gestión documental

Plan, 2026-10-06. **Fases 1 y 2 (lectura) implementadas el mismo día** (ver docs/gestion-documental.md → "CRM"; cambios respecto al plan abajo). Lo marcado **[DECIDIR]** queda pendiente del usuario; lo marcado **[COMPROBAR]** hay que verificarlo antes de empezar esa fase.

## Cambios respecto a este plan al implementar la fase 1

- El **próximo paso** son dos campos de la oportunidad (`proximo_paso`, `fecha_proximo_paso`), no una columna nueva en `gd_seguimiento`: el seguimiento es de estados (pendiente, en curso...) y una oportunidad ya tiene su etapa. Entra igual en el resumen de las 8:00, en una sección "Ventas".
- No hay `gd_bloc_notas_oportunidades`: las notas del bloc se enlazan con la entidad y salen en su historial.
- Se añade `gd_oportunidades_cambios` (historial de etapas) para la línea de tiempo y los informes de conversión de la fase 4.
- Un solo embudo por proyecto.

## Cambios respecto a este plan al implementar la fase 2 (lectura)

- La conexión con SIF no es un activo digital (no sale en Webs y redes): tabla propia `gd_erp_conexiones`, con la credencial de siempre.
- No hay `gd_entidades_erp`: el resumen se calcula al vuelo desde `gd_erp_facturas`.
- El Excel importado no se guarda como documento: se guarda en `gd_erp_importaciones` mientras se revisa y se vacía al aplicarlo o descartarlo.
- El listado de facturas de SIF no trae la base imponible ni filtra por fecha: se usa el total y se recorre de la más nueva hacia atrás.
- Pendiente: escribir en SIF (decisión del usuario) y la importación automática por correo con asunto «importar ...» (hoy el Excel que llega por correo entra en la cola de pendientes y la IA lo importa con importar_excel_erp_gd).

## Qué es

Convertir la GD en un CRM (gestión de clientes y ventas) sin hacer un producto aparte: se aprovechan las entidades, el bloc de notas, el seguimiento, los avisos, los envíos, el correo IMAP, el registro de actividad, los informes PDF y el chat. Se añaden cuatro piezas:

1. **Contactos y embudo de ventas**: personas dentro de cada empresa y oportunidades de venta con importe y etapa.
2. **Conexión con el ERP del cliente**: el ERP (programa de facturación y contabilidad) manda en clientes, facturas y cobros; la GD los lee y, con permiso, le escribe.
3. **Correo enlazado y captación desde la web**: los correos con un cliente aparecen en su ficha y los formularios de la web crean posibles clientes.
4. **Informes comerciales**: previsión de ventas, conversión y actividad por comercial.

La GD **no factura ni lleva contabilidad**. Presupuestos, pedidos y facturas viven en el ERP; la GD los consulta y guarda el PDF como documento cuando interesa.

## Lo que ya existe y se reaprovecha

| Pieza actual | Uso en el CRM |
| --- | --- |
| `gd_entidades` (con `codigo` único para el ERP) | La empresa cliente / posible cliente. `codigo` es la llave del cruce con el ERP |
| `gd_bloc_notas` + `gd_bloc_notas_entidades` | Llamadas, reuniones y visitas anotadas en la ficha del cliente |
| `gd_seguimiento` + resumen de las 8:00 | Próximos pasos con responsable |
| `gd_programaciones` | "Llamar a García el jueves" |
| `gd_envios` (plantillas con `{{variables}}`) | Campañas y comunicaciones a clientes |
| `_mod_correo_imap` | Leer los buzones para enlazar correos con clientes |
| `gd_activos_digitales` + sistema de propuestas de las webs | El ERP (SIF) como activo con su credencial y nivel de permiso; escribir en él con propuesta y aprobación |
| Ingesta de documentos (panel, chat, correo) | Entrada de los ficheros Excel a importar |
| `gd_credenciales` (cifradas) | Usuario y contraseña o token del ERP |
| Conector WordPress | Recoger los formularios de contacto de la web |
| `gd_actividad` | Historial de quién hizo qué en cada oportunidad |
| `generar_informe_pdf_gd` + estilos | Informes comerciales en PDF |

## Fase 1: contactos y embudo de ventas

Lo mínimo para poder llamarlo CRM. No depende del ERP.

**Contactos** (`gd_entidades_contactos`): `id`, `id_entidad` (FK CASCADE), `nombre`, `cargo`, `email`, `telefono`, `observaciones`, `principal` (bool), `fecha_alta`. Hoy una entidad es plana (un solo email y teléfono), así que "Ana, compras" y "Luis, gerencia" de la misma empresa no se distinguen. Los envíos ganan la variable `{{contacto}}` y pueden ir a un contacto en vez de al email general.

**Etapas** (`gd_crm_etapas`): `id`, `nombre`, `orden`, `probabilidad` (0–100), `tipo` (`abierta` / `ganada` / `perdida`). Por defecto: Contacto 10 %, Propuesta 30 %, Negociación 60 %, Ganada 100 %, Perdida 0 %. El cliente las renombra y añade. Un solo embudo por proyecto **[DECIDIR si algún cliente necesita varios, p. ej. "Obras" y "Mantenimiento"]**; si hace falta, se añade `id_embudo` sin tocar lo demás.

**Oportunidades** (`gd_oportunidades`): `id`, `titulo`, `id_entidad` (FK, sin cascada: no se borra un cliente con oportunidades), `id_contacto` (FK SET NULL), `importe` (NUMERIC), `id_etapa`, `fecha_prevista_cierre`, `id_usuario_responsable` (sin FK, como en seguimiento), `origen` (texto libre: web, recomendación, feria…), `motivo_perdida`, `fecha_cierre`, `codigo_erp` (el presupuesto o pedido en el ERP, si lo hay), `fecha_alta`, `creado_por`. Más `gd_oportunidades_documentos` y `gd_bloc_notas_oportunidades` (mismo patrón que las relaciones actuales).

**Próximo paso**: el seguimiento se amplía con `id_oportunidad` (una columna más en `gd_seguimiento`, igual que las otras tres). Una oportunidad abierta sin próximo paso ni aviso programado sale en el resumen de las 8:00 de su responsable como "sin próximo paso". Así no se queda nada parado sin que nadie lo vea.

**Ficha del cliente con línea de tiempo**: en `EntidadDetalle.jsx`, una pestaña "Historial" que junta por fecha documentos, notas del bloc, envíos, oportunidades y sus cambios de etapa, y (en la fase 3) correos. Es una consulta que une tablas que ya existen, sin tabla nueva.

**Panel**: menú "Ventas" con el tablero de columnas por etapa (arrastrar una tarjeta cambia la etapa y queda en `gd_actividad`), filtros por responsable y fecha, y total y total ponderado por probabilidad en cada columna. Pestañas "Contactos" y "Oportunidades" en la ficha de la entidad.

**Tools MCP** (`_herr_crm.py`): `crear_oportunidad_gd`, `actualizar_oportunidad_gd` (incluye mover de etapa, ganar o perder con motivo), `listar_oportunidades_gd` (solo lectura), `crear/actualizar/eliminar_contacto_gd`, `historial_entidad_gd` (solo lectura), `listar_etapas_gd` y `configurar_etapas_gd`. Con esto la IA contesta "¿a qué clientes no hemos llamado en 30 días?" o "prepárame la reunión con García".

**Pendientes de siempre**: tipos nuevos en `ACCIONES_MCP` / `ACCIONES_PANEL`, parte nueva en `ayuda_gd.py` y regla de producto en el contexto inicial (no crear una oportunidad sin entidad; buscar la entidad antes de crearla).

## Fase 2: conexión con el ERP

### Quién manda en qué

- **El ERP manda** en los datos fiscales y de contacto del cliente (nombre, NIF, dirección…), en las facturas, en los cobros y en los presupuestos y pedidos.
- **La GD manda** en lo comercial: contactos, oportunidades, notas, seguimiento y documentos.
- Al sincronizar, los campos que vienen del ERP se sobrescriben en la GD. Los que solo existen en la GD (observaciones, contactos, notas) no se tocan nunca.
- Un cliente dado de baja en el ERP **no se borra** en la GD: se marca `baja_erp = true` y deja de salir por defecto.

### Dos vías: Multiplika SIF o importación desde Excel (usuario, 2026-10-06)

El ERP de cada cliente es impredecible, así que no se programa un conector por ERP. Se intenta que el cliente use **Multiplika SIF** (nuestro programa de facturación, API REST en FastAPI, con clientes, presupuestos/pedidos/albaranes, facturas emitidas y cobros). Quien use otro ERP importa sus datos **desde Excel**. Las dos vías rellenan las mismas tablas de la GD, así que el resto del CRM no sabe ni le importa de dónde vienen los datos. Se dejan fuera de momento (se plantearon y el usuario eligió solo Excel): pasarela Veri\*Factu, copia de facturas por correo y conectores a medida por ERP.

| Vía | Clientes | Facturas | Cobros | Al día | Escribir (alta cliente, presupuesto) |
| --- | --- | --- | --- | --- | --- |
| **A. Multiplika SIF** (usuario y contraseña del obligado) | Sí | Sí | Sí | Cada noche + botón | Sí, por su API |
| **B. Importación desde Excel** | Sí | Sí | Si el ERP lo exporta | Lo que tenga el último fichero | No |

### Vía A: Multiplika SIF

**Conexión por defecto: usuario y contraseña de un obligado** (usuario, 2026-10-06). El obligado es la empresa que factura en SIF. Se da de alta como activo digital tipo `erp`, plataforma `multiplika_sif`, con una credencial normal de la GD (`gd_credenciales`, cifrada): `usuario` = usuario del obligado en SIF, `valor` = su contraseña y campos extra `url` (por defecto `https://sif2.multiplika.net`) e `id_obligado` (si falta, se saca de `GET /usuarios/me` al probar la conexión).

Por qué usuario y contraseña y no `api_key`/`api_secret`: en SIF, una sesión abierta con API key (`modo_login = "uak"`) solo puede usar las rutas de la pasarela Veri\*Factu (`apps/middleware/pasarela_middleware.py`), y la GD necesita clientes, cobros y presupuestos. Con contraseña (`modo_login = "up"`) el obligado ve lo suyo, igual que en la web de SIF. Las API keys quedan para cuando SIF permita darles acceso a esas rutas.

**Sesión.** `POST /apisif/v1/usuarios/login` con `{"username", "password"}` devuelve la cookie `access_token`. SIF la renueva cada pocos minutos en cualquier respuesta, así que se usa un cliente HTTP que guarde las cookies (`httpx.AsyncClient`) y se guarda siempre la última. Si una petición devuelve `401`, se vuelve a entrar y se repite una vez. Si vuelve a fallar (contraseña cambiada, usuario dado de baja), la sincronización se para y avisa en la campanita: "SIF no acepta la contraseña de <activo>; actualízala en Credenciales".

**Qué se lee** (todo `POST` con `id_obligado`):
- Clientes: `/apisif/v1/obligados/receptores/listar` (tabla `msif_obligados_receptores`: `id`, `NombreRazon`, `NIF`, `codigo`, `email`, `telefono`, `direccion`, `ciudad`, `provincia`, `codigo_postal`). Se cruzan con `gd_entidades` por `codigo` y, si no hay, por NIF. Cada noche se leen todos, porque SIF no tiene filtro de "modificado desde".
- Facturas: `/apisif/v1/facturas_emitidas/listar` con `fecha_desde`/`fecha_hasta` (`numero`, `fecha_emision`, `importe_total`, `id_receptor`, `NIF_receptor`). Cada noche se releen los últimos 90 días (para recoger anulaciones y rectificaciones) y la primera vez, los dos últimos años.
- Cobros: `/apisif/v1/ventas/gestion_cobros/listar_cobros` con `id_receptor`, fechas y estado, para calcular lo pendiente por cliente.
- Presupuestos y pedidos: `/apisif/v1/ventas/presupuestos/listar` y `/ventas/pedidos/listar`, solo cuando se consultan desde una oportunidad, sin copiarlos.
- Las líneas de una factura se consultan en vivo cuando se piden; no se copian.

**Qué se escribe** (solo si el nivel de permiso del activo lo deja y con propuesta aprobada): alta de cliente con `/obligados/receptores/crear_receptor` y presupuesto o pedido con `/ventas/presupuestos/crear` o `/ventas/pedidos/crear`.

**Riesgo de usar la contraseña del obligado**: con ella se puede hacer en SIF todo lo que hace el obligado, incluido emitir facturas. El freno lo pone la GD: el conector solo tiene las llamadas de arriba, y escribir exige nivel "proponer" o superior y aprobación. **[COMPROBAR en SIF si un obligado puede tener un segundo usuario solo para la GD; así cambiar la contraseña del usuario principal no rompe la sincronización y se ve en SIF qué hizo la GD]**.

### Vía B: importación desde Excel

**Qué se importa.** Tres listados, cada uno opcional e independiente: **clientes**, **facturas** (una fila por factura: número, fecha, cliente, base, total y, si lo trae, lo pendiente de cobro) y **cobros** (para los ERPs que exportan los cobros aparte). Valen `.xlsx`, `.xls` y `.csv` (con `;` o `,` y en UTF-8 o Latin-1, que es lo que sacan muchos ERPs españoles). Dependencia nueva: `openpyxl` (y `xlrd` para `.xls`). **[COMPROBAR si hace falta `.xls` con algún cliente real antes de añadir `xlrd`]**.

**Por dónde entra.**
- Panel: menú "Ventas" → "Importar desde Excel". Se arrastra el fichero y se elige qué listado es (o la IA lo adivina por las columnas).
- Chat: se adjunta el fichero y se le dice "importa esto".
- Correo: un fichero adjunto que llega a la dirección de entrada de la GD **con el asunto "importar clientes", "importar facturas" o "importar cobros"** se trata como importación y no como documento. Así el cliente puede programar en su ERP un envío automático, si su ERP lo permite.

**El mapeo: qué columna es qué.** Cada ERP exporta con sus nombres y su orden ("CODCLI", "Razón social", "Fecha fra."). La primera vez:
1. Se leen las cabeceras y las 10 primeras filas.
2. La IA propone qué columna es cada campo de la GD y en qué formato vienen las fechas y los importes (`1.234,56` o `1234.56`).
3. Una persona lo ve en una vista previa (la tabla ya interpretada) y lo aprueba o lo corrige.
4. Se guarda en `gd_erp_mapeos` (`id_activo`, `objeto` = clientes / facturas / cobros, `columnas` en JSON, `formato_fecha`, `separador_decimal`, `huella_cabeceras`).

Las siguientes veces, si las cabeceras coinciden (`huella_cabeceras`), se aplica el mapeo sin preguntar. Si cambian, se vuelve a proponer.

**Cómo se cruza cada fila.**
- **Clientes**: por `codigo` (el código del cliente en su ERP). Si no hay código, por NIF. Si tampoco hay NIF, **no se crea a ciegas**: se propone enlazar con una entidad de nombre parecido o crearla, y lo decide una persona.
- **Facturas**: por número y fecha, y su cliente por código o NIF. Volver a importar el mismo fichero **no duplica nada**: las facturas que ya existen se actualizan (por ejemplo, lo pendiente de cobro).
- Una factura cuyo cliente no existe crea el cliente con lo que trae la fila, si trae NIF. Si no, queda como "sin cliente" en el informe de la importación.

**Antes de aplicar, siempre resumen.** "Se van a crear 12 clientes, actualizar 340 y hay 3 filas con errores (fila 57: fecha no válida…)". Se aplica al confirmar, todo de una vez: si algo falla a mitad, no se aplica nada. Cada importación queda en `gd_erp_sincronizaciones` con el fichero original guardado como documento, para poder ver luego de dónde salió un dato.

**Qué no hace.** No borra clientes que falten en el fichero: un listado puede venir filtrado. Si se quiere marcar las bajas, se elige expresamente "este fichero son todos mis clientes" y los que falten se marcan `baja_erp`, sin borrarlos.

**Datos viejos.** La ficha del cliente enseña de qué fecha son los datos ("según la importación del 3/10/2026"). Opción por proyecto: aviso en la campanita si pasan más de N días (por defecto 30) sin importar.

**Plantilla.** Para quien no sepa exportar de su ERP, el panel ofrece una plantilla Excel con las columnas esperadas para rellenar a mano o pegar.

### Qué se guarda (las dos vías)

- **Clientes** → `gd_entidades`. Columnas nuevas: `nif`, `baja_erp` y `fecha_sync_erp`. Los campos que vienen del ERP se sobrescriben al sincronizar; los que solo existen en la GD no se tocan.
- **Facturas, solo la cabecera** → `gd_erp_facturas` (`id_activo`, `id_entidad`, `numero`, `fecha`, `base`, `total`, `pendiente_cobro` NULL si no se sabe, `origen` = sif / excel). Sin líneas.
- **Resumen económico por cliente** → `gd_entidades_erp` (`id_entidad`, `facturado_anio`, `facturado_anio_anterior`, `pendiente_cobro`, `fecha_ultima_factura`, `fecha_datos`), recalculado tras cada sincronización o importación.
- **Historial** → `gd_erp_sincronizaciones` (vía, fecha, quién, creados, actualizados, errores, `id_documento` del fichero si es Excel). Si una sincronización de SIF falla, aviso en la campanita.

### Escribir en el ERP (GD → ERP)

Solo con Multiplika SIF y siempre por el sistema de propuestas que ya usan las webs (se ve antes, se aprueba y queda constancia):

- **Dar de alta un cliente** en SIF cuando un posible cliente pasa a cliente.
- **Crear el presupuesto o pedido** al ganar una oportunidad. Su código vuelve a `gd_oportunidades.codigo_erp`.

Con Excel no se escribe nada en el ERP. Como mucho, la GD puede **exportar** a Excel los clientes nuevos para que el cliente los importe en su ERP a mano. Es un motivo más para que use SIF. **[DECIDIR: ¿se escribe en SIF desde la primera versión o se empieza solo leyendo?]**

### Tools MCP

`sincronizar_erp_gd`, `estado_sincronizacion_erp_gd`, `importar_excel_erp_gd` (propone mapeo y resumen; no aplica), `aplicar_importacion_erp_gd`, `consultar_erp_gd` (facturas, cobros y líneas de un cliente, de solo lectura) y `proponer_alta_cliente_erp_gd` / `proponer_presupuesto_erp_gd` (solo SIF).

### Riesgos

- **El Excel se queda viejo** si nadie lo importa: por eso la fecha visible y el aviso de los 30 días.
- **Exportaciones raras**: celdas combinadas, filas de totales, varias cabeceras. La vista previa lo deja ver antes de aplicar, y las filas que no se entienden salen como error, no se inventan.
- **Clientes sin código ni NIF** en el Excel: obligan a decidir a mano la primera vez. Después ya quedan enlazados.

## Fase 3: correo enlazado y captación desde la web

**Correo enlazado**: el cliente elige qué buzones se vigilan (credenciales IMAP ya existentes). Un proceso del cron revisa los mensajes nuevos de entrada y de enviados y, si el remitente o el destinatario coincide con el email de una entidad o de un contacto, guarda en `gd_correos_entidades` solo la referencia (`id_entidad`, `id_contacto`, buzón, carpeta, `message_id`, asunto, fecha, sentido entrada/salida y las primeras líneas). El cuerpo completo se lee del buzón al abrirlo, sin guardar una copia. Los adjuntos se pueden pasar a documentos con lo que ya existe. **[DECIDIR: ¿guardar solo la referencia (menos datos personales copiados, pero si se borra el correo del buzón desaparece el contenido) o una copia completa?]**

**Captación desde la web**: el conector WordPress recoge los envíos de los formularios de contacto (Contact Form 7, WPForms, Gravity Forms) y los manda a la GD. Cada envío crea, si no existe por email, una entidad `tipo = "posible cliente"` con su contacto, y una oportunidad en la primera etapa con `origen = "web"`, asignada a quien diga una regla del proyecto, o a nadie y entonces avisa a todos. Para webs a medida, un endpoint con clave por web al que se envía el formulario.

## Fase 4: informes comerciales

Consultas sobre las tablas de las fases 1–3, en el panel (menú "Ventas" → "Informes") y como PDF con el estilo del cliente:

- Previsión del trimestre: suma de importe × probabilidad por mes de cierre previsto.
- Conversión por etapa y por origen ("de cada 10 contactos de la web, 2 acaban en venta").
- Ganadas y perdidas por motivo.
- Actividad por comercial: notas, correos y oportunidades movidas.
- Con ERP conectado: lo previsto frente a lo facturado de verdad.

Se pueden programar con lo que ya existe (aviso programado que genera y envía el informe), cuando se retome la ejecución de scripts.

## Orden y estimación

| Fase | Depende de | Estimación |
| --- | --- | --- |
| 1. Contactos y embudo | Nada | 1–2 semanas |
| 2a. Multiplika SIF, lectura | Fase 1 | 1 semana |
| 2b. Importación desde Excel | Tablas de 2a | 1–1,5 semanas |
| 2c. Escritura en SIF | 2a y decisión del usuario | 3–5 días |
| 3. Correo y web | Fase 1 | 1–2 semanas |
| 4. Informes | Fases 1–3 | 1 semana |

Las fases 2 y 3 son independientes entre sí: si un cliente tiene prisa por el ERP, la 2 va antes.

## Pendiente de decidir con el usuario

1. ~~Qué ERP~~ → Multiplika SIF, y para el resto importación desde Excel (usuario, 2026-10-06).
2. **¿Escribir en SIF desde la primera versión** o empezar solo leyendo?
3. **¿El CRM va incluido en todas las GDs** o es un módulo que se activa y se cobra aparte? Si es módulo, hace falta una opción por proyecto que oculte el menú y las tools.
4. **Correos**: ¿guardar solo la referencia o una copia completa?
5. **¿Varios embudos por proyecto** o uno solo?
