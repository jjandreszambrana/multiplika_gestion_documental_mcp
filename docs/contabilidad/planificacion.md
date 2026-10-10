# Asesor contable y financiero dentro de la GD

Plan, 2026-10-10. **Fases 0 y 1 implementadas el mismo día** (código; el contenido del primer lote se está redactando y falta revisarlo; sin desplegar). Ver docs/gestion-documental.md → "Asesor contable". Lo marcado **[DECIDIR]** queda pendiente del usuario; lo marcado **[COMPROBAR]** hay que verificarlo antes de empezar esa fase.

Documentos de esta carpeta:

- **planificacion.md** (este): qué se construye y en qué orden.
- [estructura-temas.md](estructura-temas.md): cómo se organiza el conocimiento contable (índice → subíndice → capítulo → tema), formato de cada tema y árbol completo propuesto.
- [fuentes.md](fuentes.md): de dónde sale la información, qué se puede reutilizar y cómo se mantiene al día.

## Qué es

Un apartado nativo de la GD que trabaja como asesor contable y financiero de la empresa. Tiene dos modos:

1. **Sin SIF**: asesora con el conocimiento contable que va dentro de la app (biblioteca de temas) y con los documentos y registros que ya tiene la GD (facturas subidas, extractos, contratos...).
2. **Con la contabilidad de Multiplika SIF** (opcional): además lee la contabilidad real de la empresa y trabaja como asistente del contable. Una asesoría que lleva muchas empresas ve en la GD las contabilidades a las que tiene acceso en el SIF.

Decisiones del usuario (2026-10-10):

- Todo el conocimiento que necesita el asesor va en la app. El cliente añade sus reglas o protocolos con las reglas de la GD que ya existen (`gd_reglas`), sin nada nuevo.
- El conocimiento se **jerarquiza** (índice, subíndice, capítulo, tema) para que la IA cargue solo el tema que necesita.
- **Cada usuario de la GD se asocia a su usuario del SIF** guardando su acceso en las credenciales. La GD inicia sesión por dentro y el usuario no entra dos veces. Solo funciona si ese usuario tiene autorización de contabilidad en el SIF.
- La IA, de momento, **solo propone**. No escribe asientos ni nada en el SIF. Más adelante se verá.
- La interfaz de contabilidad ya diseñada (`multiplika_conta_ui`) se integra dentro de la GD.

## Lo que ya existe y se reaprovecha

| Pieza actual | Uso aquí |
| --- | --- |
| `database/ayuda_gd.py` (ayuda por partes: índice → parte) | Mismo patrón para la biblioteca contable, con un nivel más de profundidad |
| `gd_reglas` + jerarquía de contexto (`_mod_reglas.py`) | Reglas y protocolos propios del cliente para el asesor (p. ej. "en esta asesoría los gastos de vehículo se imputan al 50 %") |
| `gd_credenciales` (cifradas) | Usuario y contraseña del SIF de cada usuario |
| `ClienteSIF` (`database/modelos/_mod_sif.py`) | Login, cookie y reintento ante 401 contra la API del SIF; hoy lo usa el CRM |
| Chat del panel (`panel_cliente/chat_ia.py`) + chat lateral | Conversación con el asesor; las herramientas que escriben ya piden confirmación |
| `gd_programaciones` + resumen de las 8:00 | Revisiones periódicas (p. ej. "cada día 5, revisa el IVA del trimestre") |
| Ingesta de documentos (panel, chat, correo) + extracción de PDF/OCR | Facturas y extractos de los que la IA saca propuestas de asiento |
| `generar_informe_pdf_gd` + estilos | Informes de análisis financiero para el cliente |
| `gd_actividad` | Quién consultó o propuso qué |

Verificado en el SIF (2026-10-10):

- La API contable está en `/apisif/v1/contabilidad/*`, todo por POST. Tiene plan, asientos, diario, mayor, sumas y saldos, balance, pérdidas y ganancias, IVA (base del 303), retenciones (111/115), libros de IVA, cuadre de IVA, inmovilizado, cierre y declaraciones.
- Los permisos van por la tabla `msif_contabilidad_accesos`, con niveles `consulta < apuntes < cierre < admin`. Una autorización puede ser a un usuario o a toda una asesoría (representante).
- `/contabilidad/sesion/empresas` devuelve las empresas cuya contabilidad puede abrir el usuario.
- **La empresa se puede mandar en cada petición** (`id_obligado` en el cuerpo, `obligado_activo` en `_dep_api_conta.py`). No hace falta conmutar la sesión, así que un mismo usuario puede consultar dos empresas a la vez sin pisarse.
- Las claves api_key del SIF solo valen para la pasarela Veri\*Factu, no para la contabilidad. Por eso hay que guardar usuario y contraseña.

## Fase 0: arreglos previos (pequeño)

**El chat del panel no recibe el "negocio" ni las "preferencias de trabajo" del proyecto.** Claude Desktop sí los recibe (en el `initialize` del núcleo, `multiplika_mcp/apps/mcp_server/core/instrucciones_iniciales.py`). En el chat solo llegan si la IA llama a `obtener_contexto_proyecto`. Para un asesor esto importa: el negocio dice si la empresa es una asesoría, una industria o un autónomo. Se añaden al `system` del chat, detrás de las reglas y con la misma caché.

## Fase 1: biblioteca contable nativa (sin SIF)

### Tres capas de conocimiento (usuario, 2026-10-10)

Cada tipo de información se guarda de una forma distinta, según lo que se puede hacer con ella:

| Capa | Qué es | Cómo se guarda | Se actualiza |
| --- | --- | --- | --- |
| **Temas** | Explicación propia y práctica (no un resumen de la ley), con asiento de ejemplo, que cita los artículos en que se apoya | Un `.md` por tema, redactado por nosotros y revisado por otra IA | A mano; quedan "pendiente de revisar" cuando cambia un artículo que citan |
| **Artículos de ley** | Texto **literal** del BOE, solo los artículos que citan los temas (unos 500) | Un `.md` por artículo, con la norma, el artículo, la versión y la fecha | Solos, cada semana, con la API del BOE |
| **Doctrina** | Consultas de la DGT: resumen nuestro de 5-10 líneas + número + enlace. Consultas del ICAC: solo citadas dentro de los temas (su web no permite copiarlas) | Un `.md` por consulta DGT citada | No cambian; si una consulta queda superada por otra, se marca |

No se guardan: los manuales de la AEAT (son la base para redactar los temas y cambian cada año; se guardan solo sus enlaces, que se revisan cada enero), las consultas del ICAC (no se pueden copiar) ni los datos del Banco de España (son tablas de cifras que se consultan con una herramienta en la fase de comparación sectorial).

Ejemplo: "¿qué IVA de un coche se puede deducir?". La IA lee el tema de deducibilidad del IVA (unas 2 páginas) y, solo si hace falta la letra exacta, el artículo 95 de la Ley del IVA (1 página), en vez de la ley entera (cientos de páginas).

**Versiones anteriores**: cuando cambia un artículo se guarda la versión nueva y se conserva la anterior al menos dos años, con sus fechas de vigencia. Una asesoría trabaja a menudo con reglas pasadas: el Impuesto sobre Sociedades de 2025 se presenta en julio de 2026 con las reglas de 2025.

### Dónde vive

Todo en ficheros Markdown dentro del repo, no en una tabla de la base de datos:

- Es igual para todos los clientes. En la base habría que copiarlo en la de cada proyecto de los 5 servidores y mantener todas las copias iguales.
- Git guarda el registro de cada cambio (qué decía un artículo antes y después, y cuándo cambió).
- La IA que revisa los temas trabaja directamente con los ficheros.

La base de datos solo tendría sentido si el cliente pudiera editar este contenido. Lo propio de cada cliente va en sus reglas, que sí están en la base.

La única pega: un cambio de ley llega a los clientes cuando subimos la actualización, no al instante. Con el repaso semanal no es un problema, porque las leyes suelen publicarse días o semanas antes de entrar en vigor.

Temas: un fichero por tema, en carpetas que siguen la jerarquía (ver [estructura-temas.md](estructura-temas.md)). Mismo criterio que las ayudas del SIF (`multiplika_sif/lib/contabilidad/ayuda/`): un tema se corrige en el código y se sube, sin migrar nada. Es igual para todos los clientes y lo mantenemos nosotros. Lo propio de cada cliente va en sus reglas.

Ruta propuesta: `database/conocimiento_contable/` (con `temas/`, `normativa/` y `doctrina/`, ver [estructura-temas.md](estructura-temas.md)), para que llegue a los dos árboles de despliegue (herramientas MCP y panel) por el mismo import relativo que ya usa `ayuda_gd.py`. Comprobado el 2026-10-10: `sync.py` (núcleo) hace `git fetch` + `reset --hard` del repo en el servidor y copia `database/` entera con `rsync`, así que los `.md` llegan. Solo llega lo que esté **en el repositorio**: un tema sin commit no se despliega.

Un módulo `database/conocimiento_contable.py` lee la carpeta al arrancar y construye el árbol en memoria. Son pocos cientos de ficheros pequeños. Igual que en el SIF, el identificador que llega en una petición nunca se usa para componer una ruta: se busca en el árbol ya cargado.

### Herramientas MCP (todas de solo lectura)

Cuatro herramientas, no una por área. Cada herramienta ocupa espacio en el contexto de cada conversación del proyecto, aunque no se use; por eso solo aparecen en las GD con el apartado activado.

- `indice_contable_gd(id_nodo=None)`: sin parámetro devuelve las áreas con su resumen de una línea. Con un nodo devuelve sus hijos. Así la IA baja nivel a nivel.
- `obtener_tema_contable_gd(id_tema)`: el tema completo, con fuentes, fecha de revisión y temas relacionados.
- `buscar_temas_contables_gd(texto)`: busca por palabras en título, resumen y palabras clave y devuelve hasta 8 temas con su ruta. Es el atajo para ir directa ("leasing", "prorrata") sin recorrer niveles.
- `obtener_norma_contable_gd(id_fuente, fecha=None)`: el texto literal de un artículo de ley o el resumen de una consulta de la DGT, con su origen y fecha de versión. Con `fecha` devuelve la versión que estaba vigente ese día, si se conserva. La IA lo abre solo cuando necesita la letra exacta.

Coste de contexto, con números aproximados: una consulta típica (búsqueda, unos 300 tokens, más un tema de 1.500) carga unos 2.000 tokens. Cargar la biblioteca entera (unos 180 temas de 1.500 tokens) serían 270.000 tokens por mensaje, más de 100 veces más, y ni siquiera cabría con holgura.

### Reglas de producto para el asesor

Van en `REGLAS_PRODUCTO` (cortas, entran siempre):

- Antes de responder una duda contable o fiscal, buscar en la biblioteca y citar el tema y su fuente. Si la biblioteca no lo cubre, decirlo y responder con su conocimiento general avisando de que no está contrastado. Anotarlo como pregunta pendiente para que lo cubramos.
- Lo que propone es una **propuesta** para que la valide el contable. Nunca dice que algo está presentado o contabilizado.
- Si una regla del cliente contradice la norma (p. ej. deducir un gasto que la ley no permite), lo advierte en vez de aplicarla en silencio.
- Las cifras de normativa que cambian cada año (tipos, límites, plazos) se dan con el año del tema. Si el tema tiene más de 12 meses sin revisar, avisa.

### Panel

Apartado "Asesor contable" en el menú, con:

- Navegador de la biblioteca (árbol + buscador + tema en Markdown), útil también para el personal sin IA.
- El chat lateral de siempre.

**Decidido (usuario, 2026-10-10)**: el apartado se activa solo en las GD que lo vayan a usar (ajuste del proyecto). Sin activar, ni sale en el menú ni la IA ve sus herramientas, así que las conversaciones de un proyecto como Labosur no cargan nada de más.

### Contenido de la fase 1

El primer lote, los 81 temas marcados P1 en [estructura-temas.md](estructura-temas.md), es lo del día a día de una asesoría: operaciones habituales, IVA, cierre, análisis financiero y revisión de la contabilidad. Cómo se redacta y se revisa cada tema: ver [fuentes.md](fuentes.md).

## Fase 2: conexión con el SIF (modos, claves y empresas)

Decisiones del usuario (2026-10-10):

- Una GD trabaja con el SIF en uno de dos modos, **asesoría** o **empresa**, y lo elige el administrador.
- En modo asesoría, **nunca se ve una empresa que no sea de esa asesoría en el SIF**.
- **Las entidades de la GD no se mezclan con esto.** Siguen siendo solo los clientes y proveedores del propio tenant, y se sincronizan con su propio SIF como hasta ahora (CRM, `gd_erp_conexiones`). Las empresas que lleva una asesoría son otra lista, propia del apartado contable. Si fueran entidades, los clientes de la asesoría se mezclarían con los clientes de sus clientes.
- **Todo tiene que ser fácil de configurar desde el panel** (ver "Pantallas de configuración").

### Los dos modos

| | **Asesoría** (representante) | **Empresa** (obligado) |
| --- | --- | --- |
| Para quién | Una asesoría que lleva la contabilidad de muchos clientes | Una empresa que solo quiere la suya |
| Empresas que ve | Las de la asesoría en el SIF que cada usuario tenga autorizadas | Solo una, la que se fija al configurar |
| Selector de empresa | Sí, en la cabecera del apartado | No |
| Revisiones programadas | Por empresa, eligiendo cuáles | De la única empresa |
| Usuarios del SIF típicos | Rol 3 (representante) o usuarios con acceso por asesoría | Rol 4 (obligado) o 5 (operario), o el contable externo con acceso a esa empresa |

Cambiar de modo se puede hacer en cualquier momento. Las propuestas y revisiones se guardan con el `id_obligado_sif` de su empresa, no con el modo, así que no se pierde nada. Lo que deja de verse no se borra.

El permiso real (consulta, apuntes, cierre) lo sigue decidiendo el SIF en los dos modos.

### Dos claves, cada una para una cosa

| | **Clave de la GD** | **Clave de cada usuario** |
| --- | --- | --- |
| Quién la pone | El administrador, una vez | Cada usuario, en su perfil |
| De quién es | En asesoría, del representante; en empresa, del obligado | Del propio usuario del SIF |
| Para qué | Lo que hace la GD por su cuenta: marcar el límite de empresas (en asesoría, la lista de empresas de la asesoría; en empresa, la empresa fijada) y mantener al día la lista de empresas contables | Trabajar: pantallas de contabilidad, la IA consultando por él, y que en el SIF quede quién hizo cada cosa |
| Escribe en el SIF | Nunca | Lo que el SIF le permita, y solo desde las pantallas (la IA solo propone) |

**Lo que ve cada usuario = sus empresas en el SIF ∩ el límite de la GD.** Ejemplo: la asesoría tiene 150 empresas en el SIF. Ana tiene acceso a 120 de ellas y ve esas 120. Luis tiene acceso a 40 de la asesoría y a 5 de otra asesoría: en esta GD ve solo las 40, y las otras 5 no aparecen nunca. El servidor de la GD hace la comprobación antes de reenviar cada petición, así que una petición con otro `id_obligado` no llega al SIF.

**Opción para asesorías pequeñas** (apagada por defecto): "quien no tenga clave propia trabaja con la de la GD". Para una asesoría de una o dos personas evita pedir una clave a cada uno. Al activarla, el panel avisa de que en el SIF todo aparecerá como hecho por la asesoría y de que la clave de la GD pasará a poder escribir.

**Qué empresas son de una asesoría** (comprobado en el código del SIF, 2026-10-10). En el SIF hay dos cosas distintas:

1. **Vinculación**: cada empresa tiene su asesoría en `msif_obligados.id_representante`. Un usuario de la asesoría (rol 3) que llama a `/obligados/listar` recibe solo esas empresas: el SIF filtra por su `id_representante` (`_api_obligados.py`, listar). **Este es el límite de la GD.**
2. **Autorización de contabilidad**: estar vinculada no basta para entrar en su contabilidad. Hace falta una fila activa en `msif_contabilidad_accesos`, para el usuario o para toda la asesoría (`_mod_contabilidad_accesos.py`, `obligados_autorizados`). Es lo que devuelve `/contabilidad/sesion/empresas`.

Así queda:

- **Límite de la GD** = empresas vinculadas a la asesoría, leídas con la clave de la GD en `/obligados/listar`. Esta llamada la hace solo el servidor de la GD, en segundo plano. El proxy de las pantallas sigue dejando pasar únicamente `contabilidad/*`.
- **Lo que ve cada usuario** = sus empresas en `/contabilidad/sesion/empresas` ∩ el límite. Luis puede tener una autorización individual en una empresa de otra asesoría; aquí no aparece porque no está vinculada a esta.
- El resumen de configuración distingue las dos cifras, p. ej. "150 empresas vinculadas, 130 con contabilidad autorizada", para que el administrador vea si falta conceder acceso en el SIF.
- **La clave de la GD en modo asesoría tiene que ser de un usuario con rol 3 (representante).** Se rechazan los roles 1, 2 y 6 (superadministrador, administrador, desarrollador): el SIF les deja ver todas las empresas que gestionan sin mirar la asesoría, y no tienen `id_representante` con el que marcar el límite. El asistente lo explica: "este acceso es de administrador del SIF, no de la asesoría; usa el de un usuario de la asesoría".
- En modo empresa, la clave de la GD puede ser la del obligado (rol 4) o la de cualquier usuario con acceso a esa empresa. El límite es esa única empresa.

No hace falta pedir nada nuevo al SIF para esto.

### Lista de empresas contables

`gd_conta_empresas`: `id`, `id_obligado_sif` (único), `nif`, `nombre`, `baja` (bool), `fecha_alta`, `ultima_sincronizacion`. No tiene relación con `gd_entidades`.

- Se rellena y se actualiza con la clave de la GD: al configurar, cada noche (junto a la sincronización del CRM) y con un botón "Actualizar ahora".
- Una empresa que desaparece del SIF no se borra: se marca `baja` y deja de salir, pero sus propuestas y revisiones se conservan.
- En modo empresa tiene una sola fila.
- Si más adelante hace falta relacionar documentos de la GD con una empresa contable (p. ej. las facturas de un cliente de la asesoría), se hace con una tabla de relación propia, no con entidades.

### Credenciales con dueño

Hoy `gd_credenciales` es del proyecto: cualquier usuario del proyecto (y la IA) puede usar cualquier credencial. El campo `usuario` es el login externo, no el dueño. Se añade:

- `gd_credenciales.id_usuario_dueno` (INT, NULL = del proyecto, como hasta ahora; sin FK, el usuario vive en la base de control).
- Con dueño, solo la usa ese usuario. No sale en `listar_credenciales_gd` de otro, el administrador ve que existe pero no puede usarla ni cambiarla, y la IA solo la usa cuando la conversación es de ese usuario.
- La clave de la GD es una credencial normal de proyecto, sin dueño, apartada como la de las copias de seguridad para que ninguna otra función la encuentre por nombre.

### Configuración y estado

- Configuración del apartado (en la configuración del proyecto): `modo_contable` (`asesoria` / `empresa`), `id_credencial_gd`, `url_sif`, `usar_clave_gd_sin_clave_propia` (bool) y, en modo empresa, `id_obligado_sif` de la empresa fijada.
- `gd_conta_accesos` (una fila por usuario con clave propia): `id`, `id_usuario` (GD, único), `id_credencial` (credencial con dueño), `id_usuario_sif`, `estado` (`activo` / `sin_permiso` / `clave_incorrecta`), `ultima_comprobacion`, `ultimo_error`, `fecha_alta`.
- Al guardar una clave (de la GD o de un usuario), la GD entra en el SIF y llama a `/contabilidad/sesion/empresas`. Si no hay empresas dentro del límite, no se activa y se dice por qué ("tu usuario del SIF no tiene acceso a ninguna empresa de esta asesoría; pídeselo a tu administrador del SIF").
- Si más adelante el login falla (han cambiado la contraseña en el SIF), pasa a `clave_incorrecta` y el afectado ve un aviso: "vuelve a escribir tu clave del SIF". Si es la clave de la GD, el aviso le sale al administrador. No falla sin decir nada.
- La sesión (cookie) se guarda en memoria por clave y se vuelve a entrar sola ante un 401, como ya hace `ClienteSIF`.
- Las claves de IA sin dueño (de proyecto) no tienen acceso a la contabilidad, salvo con la opción de asesorías pequeñas activada.

### Pantallas de configuración

Lo que pide el usuario: que sea fácil. Tres pantallas, sin términos del SIF a la vista (nada de "obligado", "representante" ni "id"):

1. **Administración → Contabilidad**, asistente de tres pasos:
   1. "¿Cómo vais a usar la contabilidad?" con dos tarjetas: **"Somos una asesoría y llevamos la contabilidad de nuestros clientes"** o **"Solo nuestra propia empresa"**.
   2. "Acceso de la asesoría al SIF" (o "de la empresa"): usuario y contraseña, y un botón **Probar**. El resultado se ve en el momento: "Correcto: 150 empresas" o el error en palabras.
   3. En modo empresa, elegir la empresa de la lista (si solo hay una, se elige sola). En modo asesoría, la casilla de asesorías pequeñas con su aviso.

   Después la pantalla queda como resumen: modo, estado de la clave, número de empresas, última actualización y botón "Actualizar ahora". Debajo, la lista de usuarios con su estado (con clave y 120 empresas / sin clave / clave incorrecta).
2. **Mi perfil → Mi acceso a la contabilidad**: usuario y contraseña del SIF, **Probar**, y el resultado ("Ves 120 de las 150 empresas de la asesoría"). Si la clave falla, aquí sale el aviso.
3. **Cabecera del apartado Contabilidad**: si el usuario no tiene clave propia (y no aplica la opción de asesorías pequeñas), en vez de las pantallas sale un único mensaje con un botón que lleva a "Mi acceso a la contabilidad".

**Pendientes de siempre**: tipos nuevos en `ACCIONES_MCP` / `ACCIONES_PANEL`, parte nueva en `ayuda_gd.py`.

## Fase 3: la IA lee la contabilidad del SIF

Herramientas de solo lectura, agrupadas para no llenar el contexto:

- `empresas_contables_gd()`: las empresas que puede abrir el usuario dentro del límite de la GD (en modo empresa, solo la fijada).
- `informe_contable_gd(empresa, informe, desde, hasta, cuenta=None, nivel=None)`, con `informe` uno de: `balance`, `perdidas_y_ganancias`, `sumas_y_saldos`, `mayor`, `diario`, `iva`, `retenciones`, `cuadre_iva`, `libros_iva`.
- `buscar_cuenta_contable_gd(empresa, texto)`: buscar una cuenta o un tercero en el plan.
- `analisis_financiero_gd(empresa, ejercicio)`: ratios (liquidez, solvencia, endeudamiento, rentabilidad, periodos de cobro y pago, fondo de maniobra) **calculados en código** a partir del balance y la cuenta de pérdidas y ganancias. La IA no calcula, interpreta. Así un ratio no sale distinto en dos conversaciones.

Cuidado con el tamaño: un diario o un mayor de un año puede tener miles de líneas. Las herramientas devuelven totales y las primeras N líneas con aviso de que hay más, y aceptan filtros (fechas, cuenta). **[COMPROBAR]** qué paginación ofrecen `/informes/diario` y `/informes/mayor`.

Todas mandan `id_obligado` en el cuerpo con la sesión del usuario. El SIF comprueba el nivel de acceso, la GD no duplica esa comprobación.

## Fase 4: la IA propone

Nada se escribe en el SIF. La IA deja **propuestas** que el contable revisa.

`gd_conta_propuestas`: `id`, `id_obligado_sif` (la empresa del SIF; sirve en los dos modos), `tipo` (`asiento` / `reclasificacion` / `aviso`), `titulo`, `detalle` (JSON: para un asiento, fecha, concepto y apuntes con cuenta, debe y haber; que cuadre se comprueba en código antes de guardar), `justificacion`, `id_tema` (tema de la biblioteca en que se apoya), `id_documento` (si sale de una factura o extracto de la GD), `estado` (`pendiente` / `aceptada` / `descartada`), `motivo_descarte`, `creado_por`, `revisado_por`, `fecha_alta`, `fecha_revision`.

De dónde salen las propuestas:

- **De un documento**: llega una factura a la GD, la IA la lee y propone el asiento ("compra de material de oficina: 629 / 472 / 410"), mirando en el plan del SIF las cuentas que usa esa empresa.
- **De una revisión**: con las programaciones que ya existen, por ejemplo cada día 5 la IA revisa la contabilidad y propone. Ejemplos: caja con saldo acreedor, clientes con saldo acreedor, la 555 (partidas pendientes) sin cerrar, el IVA de las facturas que no cuadra con el contabilizado, inmovilizado sin amortizar este mes, gastos sin factura...
- **De una pregunta en el chat**: "¿cómo contabilizo este leasing?" termina en una propuesta con el asiento.

En el panel, una bandeja "Propuestas" por empresa. Aceptar en esta fase significa "la paso yo al SIF" y queda anotado. Más adelante podrá crear el asiento como **borrador** en el SIF (el SIF ya tiene borradores, `docs/modulo_contabilidad/13_borradores_en_el_diario.md`), y el contable lo confirma allí.

Coste de una revisión programada, con números aproximados: sumas y saldos de una empresa son unos 4.000 tokens, más 2 o 3 temas de la biblioteca (unos 4.500). Unos 10.000 tokens por empresa y revisión. Una asesoría con 50 empresas y revisión mensual serían 500.000 tokens al mes. Se avisa del coste al activar la revisión y se deja elegir qué empresas.

## Fase 5: la interfaz de contabilidad dentro de la GD

Viabilidad revisada el 2026-10-10 (`/home/jjandres/desarrollos/python3/multiplika_conta_ui`): es viable.

**Decidido (usuario, 2026-10-10)**: no se comparte código con la app de contabilidad independiente. Se ha copiado entera en `contabilidad_ui/` dentro de este repo y se trabaja solo para la GD. Por eso el punto 2 de abajo cambia: no hace falta separar un paquete para dos apps, basta con un componente raíz "embebido" dentro de esta copia.

- **A favor**: las dos son React 19 + Vite 8 + Mantine e iconos Tabler, y ninguna usa router. Las pantallas reciben empresa, ejercicio y nivel por props, y todo pasa por un único cliente de API (`src/api/cliente.ts`).
- **En contra**: Mantine 7 en contabilidad y 8 en la GD. Login, selector de empresa y `AppShell` propios (`App.tsx`, `Estructura.tsx`). Cookie `SameSite=strict` que obliga a servir desde el mismo dominio que el SIF. El prefijo de la API está fijo.

Cómo:

1. **Pasar `multiplika_conta_ui` a Mantine 8** (cambio pequeño; se prueba en la propia app de contabilidad antes de tocar la GD).
2. **Separar las pantallas en un paquete** que use tanto la app de contabilidad como la GD. Una sola copia del código: si se arregla el diario, queda arreglado en los dos sitios. El paquete tiene un componente raíz "embebido" sin login, sin `AppShell` y sin selector de empresa, que recibe el cliente de API, la empresa, el ejercicio y el nivel. La app de contabilidad sigue siendo la de siempre envolviéndolo con su login y su marco.
3. **Cliente de API configurable**: hoy el prefijo `/apisif/v1` está fijo. En la GD apunta al proxy del punto siguiente.
4. **Proxy en el servidor de la GD**: `POST /v1/proyectos/{id}/conta/{ruta}` reenvía al SIF con la sesión del usuario (fase 2) y el `id_obligado` de la empresa elegida. Solo deja pasar rutas `contabilidad/*`. Deja pasar las descargas (Excel, PDF) tal cual. Así no importa la cookie `SameSite`, la contraseña del SIF nunca llega al navegador y el usuario no entra dos veces.
5. **Carga diferida**: las pantallas de contabilidad (unas 19.500 líneas) solo se descargan al abrir el apartado. Quien no lo use no nota que el panel pese más.
6. Selector de ejercicio en la cabecera del apartado y, en modo asesoría, también de empresa, con las empresas de `empresas_contables_gd`. En modo empresa no hay selector de empresa.

Las escrituras desde estas pantallas (crear asientos a mano) las hace el usuario, no la IA, con su propio nivel del SIF. Eso no contradice "la IA solo propone".

**[COMPROBAR]** cómo se comparte el paquete entre los dos repos (dependencia npm desde git con etiqueta, o workspace). Se decide al empezar la fase.

**[COMPROBAR]** la pantalla "Accesos" de contabilidad, sin empezar. Dentro de la GD probablemente no se enseña.

### Qué hace falta de la API del SIF (revisado el 2026-10-10)

Ya funciona y no hay que tocar nada:

- Login con usuario y contraseña desde un servidor (`/usuarios/login`). La cookie `SameSite=strict` solo afecta a los navegadores, no al servidor de la GD.
- Empresa en cada petición: `id_obligado` en el cuerpo, en JSON y en subidas de ficheros (`obligado_del_cuerpo`), declarado en la base de todos los modelos (`ModeloPeticionConta`). No hace falta conmutar.
- `/contabilidad/sesion/empresas` con NIF y nivel (sirve para comprobar el permiso y rellenar la lista de empresas contables).
- Renovación sola del token durante una semana (`jwt_middleware.py`, `JWT_RENOVAR_MINUTOS`). El proxy tiene que guardar la cookie nueva que llegue en cada respuesta y volver a entrar si llega un 401.

Se pide al SIF:

1. **Ruta de empresas dentro de `contabilidad/*`.** La interfaz usa `/obligados/listar`, que es de otro módulo, en la pantalla de activar la contabilidad (`pages/empresa/PantallaActivar.tsx`). O se ofrece lo mismo bajo `/contabilidad/...` o esa pantalla no se enseña dentro de la GD. Así el proxy solo deja pasar `contabilidad/*` y no se abre nada más del SIF.
2. **Marca de origen en el registro del SIF** (opcional): aceptar una cabecera tipo `X-Origen: gd` para que en el registro de actividad del SIF se vea que la acción vino desde la GD. El usuario ya es el suyo, así que la autoría es correcta igualmente.
3. **Más adelante, una clave de servicio para contabilidad**: hoy las api_key solo valen para Veri\*Factu. Una clave por usuario limitada a `contabilidad/*` evitaría guardar su contraseña personal y no se rompería al cambiarla. No bloquea nada.
4. **Paginación en diario y mayor** para la fase 3 (la IA no puede recibir miles de líneas). **[COMPROBAR]** qué ofrecen hoy.
5. **No romper la API sin avisar**: la GD llevará una versión fija de las pantallas. Si cambia un endpoint, hay que subir a la vez la versión nueva de las pantallas en la GD. Los tipos generados desde el OpenAPI (`npm run api:types`) avisan al compilar.

## Más adelante (sin fecha)

- La IA crea asientos como borrador en el SIF (decisión del usuario: más adelante).
- Comparar los ratios de la empresa con los de su sector y tamaño usando la base de ratios sectoriales del Banco de España (ver [fuentes.md](fuentes.md)).
- Calendario fiscal por empresa con avisos de los modelos que le tocan (303, 111, 130...).
- Contabilidad de quien no usa el SIF: importar sumas y saldos desde Excel, como ya hace el CRM con las facturas, para que el análisis financiero funcione igual.

## Pendientes del usuario

- ~~¿Apartado activable por proyecto o en todos?~~ Decidido: activable, solo en las GD que lo usen.
- ~~¿Quién revisa los temas?~~ Decidido: los revisa otro agente de IA de otra plataforma. Ver [fuentes.md](fuentes.md).
- ~~Orden de la fase 5 respecto a la 4~~ Decidido: la 4 (la IA propone) antes que la 5 (pantallas dentro de la GD); mientras, la contabilidad se usa en su propia web.
