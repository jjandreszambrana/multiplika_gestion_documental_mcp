"""Texto de ayuda para el cliente — cómo funciona la Gestión Documental.
Fuente única, reutilizada por la tool MCP `obtener_ayuda_gd()` (para que
la IA lo explique en conversación) y por el panel (pantalla "Ayuda"), vía
el mismo import relativo `..database.ayuda_gd` que ya usan `modelos` y
`dependencias` — así llega igual a los dos árboles de despliegue, el de
las herramientas MCP y el del panel (ver docs/gestion-documental.md)."""

TEXTO_AYUDA_GD = """\
# Cómo funciona la Gestión Documental

## Qué es esto

Un archivo de tus documentos que consultas hablando con tu IA (Claude \
Desktop, Claude Code o ChatGPT, conectado con tu clave de este proyecto). \
Todo se lo dices a tu IA por conversación y ella hace el resto — al \
guardar un documento o dar de alta una credencial, te enseña además un \
pequeño formulario para los datos que solo tú puedes rellenar (si tu \
aplicación lo soporta). El panel web es para consultar, buscar y alguna \
gestión más — guardar y corregir documentos siempre es por conversación \
con tu IA.

## Cómo conectar tu IA

Necesitas dos cosas: la dirección del servidor, `https://mcp-d.multiplika.net/mcp`, \
y tu clave de proyecto (te la ha dado quien te dio de alta — nunca la \
compartas ni la pegues en un sitio público).

### Claude Desktop

1. `Configuración` → `Conectores` → `Añadir conector personalizado`.
2. Pega la dirección del servidor en el campo de la URL.
3. En "Autenticación", Claude suele marcar por defecto **"Iniciar sesión \
   ahora"**. Cámbialo a mano a **"Sin inicio de sesión"** — si lo dejas \
   en "Iniciar sesión ahora", Claude intenta un registro que este \
   servidor no usa y falla con un error de "no se pudo registrar con el \
   servicio de inicio de sesión", aunque hayas rellenado bien lo de abajo.
4. Busca "cabecera personalizada" (custom header) — ya visible tras \
   elegir "Sin inicio de sesión". El nombre de la cabecera es exactamente \
   `x-api-key`, y el valor es tu clave.
5. Guarda. Algunas versiones de Claude Desktop piden además encender el \
   conector con un interruptor junto al mensaje, en cada conversación.

### Claude Code (línea de comandos)

Ejecuta, sustituyendo `TU_CLAVE`:

```
claude mcp add --transport http gestion-documental https://mcp-d.multiplika.net/mcp --header "x-api-key: TU_CLAVE"
```

### ChatGPT

1. Hace falta activar el **modo desarrollador**: `Configuración` → \
   `Conectores` (o `Apps y conectores`) → `Avanzado` → activa \
   `Developer mode` / `Modo desarrollador`.
2. `Conectores` → `Crear` (o `Añadir conector personalizado`).
3. Pon un nombre reconocible, pega la dirección del servidor en la URL, \
   y en autenticación elige la opción de clave de API o cabecera \
   personalizada — el nombre exacto es `x-api-key` y el valor tu clave.
4. Guarda y actívalo para la conversación donde quieras usarlo.

Aviso: en ChatGPT, además de conectar, hace falta que el "modo \
desarrollador" esté activo para que los formularios (nombre, tipo, \
fecha...) al guardar un documento funcionen igual que en Claude — sin \
él, puede que tengas que dictarle esos datos a la IA por chat en vez de \
rellenar un formulario.

### Si algo no encaja

- **"API key inválida" o "unauthorized"**: revisa que no haya un espacio \
  de más al copiar la clave, y que el nombre de la cabecera sea \
  exactamente `x-api-key` (con guion, en minúsculas). Si sigue sin ir, \
  puede que la clave esté revocada — pide una nueva a quien te dio de \
  alta.
- **Tu IA lee pero no puede guardar ni cambiar nada**: tu clave es \
  de solo lectura. Quien te dio de alta te puede emitir otra con \
  permiso de lectura y escritura.
- **Conecta pero no ve las herramientas**: comprueba que el conector \
  está encendido para esa conversación en concreto — en varios clientes \
  hay que activarlo cada vez, no queda encendido para siempre.
- **Tienes más de un proyecto conectado a la vez**: puedes tener varios \
  conectados juntos, cada uno con su propia clave. Ponle a cada uno un \
  nombre que deje claro para qué es (no "Conector 1", "Conector 2") — \
  las herramientas de los dos se llaman igual, y el nombre del conector \
  es la única forma de distinguirlos a simple vista.

## Guardar un documento

Le dices a tu IA que guarde el documento (lo pegas o se lo adjuntas). \
Antes de guardarlo, siempre te enseña un formulario para rellenar:

- **Tipo de documento** (factura, contrato, normativa...). Reutiliza uno \
  ya existente si encaja, o crea uno nuevo sin que tengas que darlo de \
  alta en ningún sitio antes.
- **Nombre o referencia corta** para identificarlo después.
- **Si es una versión nueva** de un documento que ya tenías guardado, o \
  uno distinto.
- **La fecha del propio documento** (no la de hoy).
- **Si tiene fecha de caducidad** (contratos, certificados...).
- **Si todo su histórico debe quedar buscable**, o solo la última \
  versión (lo normal).

La IA convierte el documento a texto (markdown) y lo guarda. El fichero \
original que le diste (PDF, foto...) no se conserva — solo el texto que \
generó la IA.

### Documentos con normativa o ley

Si guardas una normativa (una ley, un reglamento...), puedes indicarle a \
la IA:

- **Ámbito**: nacional, autonómica, privada... (opcional, sirve para \
  organizarlas).
- **Fuente**: si la leíste de una URL pública (p.ej. del BOE), dísela — \
  queda guardada como referencia para volver a consultarla, aunque el \
  texto guardado es siempre lo que manda.

Cuando una normativa se sustituye por otra, es una nueva versión del \
mismo documento: la versión anterior queda en el histórico, no se \
pierde.

## Documentos que llegan sin que tú estés delante

Dos formas de meter documentos en la cola sin hablar con tu IA en ese \
momento:

- **Subida masiva desde el panel**: botón "Subir documentos...", arriba \
  del listado. Se abre una ventana donde arrastras o eliges varios \
  ficheros a la vez (PDF o foto) — se pueden ir añadiendo de uno en uno \
  o todos juntos, y quitar alguno antes de confirmar. Ahí mismo ves lo \
  que ya tienes en cola y puedes descartar algo que no haga falta.
- **Reenviándolos a tu cuenta de correo** (si la tienes configurada en \
  el panel) — tu IA los recoge de ahí sola.

En los dos casos quedan **pendientes**: no se guardan todavía, porque \
nadie ha respondido a las preguntas de siempre (tipo, nombre...). La \
próxima vez que hables con tu IA, ella te avisa de lo que tienes en cola \
y lo procesa contigo.

## Preguntar y buscar

Le preguntas a tu IA en lenguaje normal ("¿qué dice el contrato con \
Acme sobre el plazo de entrega?") y ella busca en tus documentos, te \
responde citando de cuál lo saca, y puede traerte el documento completo \
si un fragmento no basta.

## Corregir un error de lectura

Si la IA leyó mal algo al guardar el documento (un importe, una fecha...) \
se lo dices y lo corrige, sin tener que volver a subir el documento. El \
texto original que generó la primera vez nunca se pierde, por si hiciera \
falta compararlo.

## Comentarios e incidencias

Sobre cualquier documento puedes dejar comentarios, anotaciones, \
observaciones o abrir una incidencia — pídeselo a tu IA o hazlo desde el \
panel, en la ficha del documento. Cada uno queda con quién lo abrió y, si \
quieres, a quién se le asigna (responsable en texto libre, no hace falta \
que sea un usuario dado de alta) y, opcionalmente, su email — si lo \
pones, el aviso de incidencias (más abajo) le escribe a él directamente.

Una incidencia se puede resolver más adelante, indicando cómo se \
solucionó — queda enlazada a ella, sin perder el rastro de qué la cerró. \
Comentarios, anotaciones e incidencias también se pueden relacionar entre \
sí (p.ej. "este comentario es sobre esa incidencia").

Todo esto se guarda sobre el documento, no sobre una versión concreta: si \
más adelante subes una versión nueva, comentarios e incidencias anteriores \
siguen ahí, disponibles igual que antes.

Si el responsable tiene email, el aviso le llega directo a él. Si no, y \
configuras en el panel un correo de aviso (el mismo de "Fechas de \
caducidad", más abajo), te avisa a ti — un aviso por asignación, no todos \
los días mientras siga abierta. Si más adelante se la reasignas a otra \
persona (o le añades el email que le faltaba), vuelve a avisar.

## Grupos de documentos

Puedes crear grupos para juntar documentos que sirven a un mismo fin (una \
auditoría, un expediente...) — pídeselo a tu IA o hazlo desde el panel, \
pantalla "Grupos". Un grupo lleva un nombre y una descripción de para qué \
sirve. No hace falta que todos los documentos estén en un grupo, y un \
mismo documento puede estar en varios a la vez.

## Entidades

Puedes dar de alta clientes, proveedores, empleados... con una ficha \
mínima (nombre, tipo, dirección, localidad, provincia, código postal, \
país, teléfono, email, observaciones y un código propio si lo quieres \
vincular con tu ERP) — pídeselo a tu IA o hazlo desde el panel, pantalla \
"Entidades". Una entidad se puede relacionar con cualquier documento (por \
ejemplo, el cliente de una factura), y puede estar relacionada con varios \
documentos a la vez, igual que un documento puede tener varias entidades \
relacionadas.

## Comunicaciones y envíos por email

Cualquier documento puede usarse como plantilla de una comunicación: \
escribe variables dentro del texto con dos llaves, por ejemplo \
`{{nombre}}` o `{{importe}}`, y desde la pestaña "Enviar" de ese \
documento eliges a qué entidades mandárselo — buscándolas una a una, o \
de golpe con el botón para añadir las que ya tengas vinculadas a ese \
documento (ver "Entidades", más arriba). Las variables que coincidan \
con un dato de la entidad (nombre, email, dirección, teléfono...) se \
rellenan solas; el resto las escribes tú una vez, con el mismo valor \
para todas las entidades de ese envío. Antes de mandarlo ves una vista \
previa con las variables ya sustituidas.

Puedes mandarlo ya mismo, o programarlo para una fecha y hora concretas \
— en ese caso se manda solo, sin que tengas que estar delante. Un envío \
programado se puede cancelar mientras no haya llegado su hora, y uno que \
falle (por ejemplo, un buzón que rechaza el correo) se puede reintentar. \
El correo se manda con el formato del documento (títulos, negritas...), \
no como texto plano.

### Cómo escribir la plantilla, con un ejemplo

No hay que activar nada especial: coges un documento cualquiera (uno que \
ya tuvieras, o uno nuevo que guardes solo para esto — el tipo de \
documento da igual) y escribes las variables donde quieras, con dos \
llaves alrededor del nombre, sin espacios ni tildes en ese nombre. Por \
ejemplo, para un recordatorio de pago:

**Nombre del documento**: `Recordatorio de pago pendiente`

**Contenido**:

```
Estimado/a {{nombre}},

Le recordamos que tiene pendiente el pago de **{{importe}}**, con
fecha límite el {{fecha_limite}}.

Puede realizar el ingreso en la cuenta que ya tiene, indicando su
nombre como concepto.

Un saludo.
```

Al abrir la pestaña "Enviar" de ese documento, `{{nombre}}` sale como \
variable que se rellena sola (es un dato de la entidad); `{{importe}}` \
y `{{fecha_limite}}` salen como variables que escribes tú, una vez para \
todas las entidades que elijas en ese envío. Si tres clientes deben \
importes distintos, hace falta un envío por cada importe distinto — de \
momento no hay forma de poner un valor diferente por entidad dentro del \
mismo envío.

Las variables que se rellenan solas, si las usas, tienen que llamarse \
exactamente así: `nombre`, `tipo`, `direccion`, `localidad`, \
`provincia`, `codigo_postal`, `pais`, `telefono`, `email`, \
`observaciones`, `codigo` — los mismos campos de la ficha de la \
entidad. Cualquier otro nombre que uses (`importe`, `fecha_limite`, \
`asunto_reunion`...) lo escribes tú al crear el envío.

### Qué hace falta tener configurado

Dos cosas, las dos desde el panel (no por chat):

- **Tu cuenta de correo**, pantalla "Cuenta de correo" (solo el \
  administrador la ve) — es la misma que ya usas para los avisos de \
  caducidad/incidencias y para recibir documentos por email, así que si \
  ya la tenías puesta no hay que tocar nada. Si no, hace falta la \
  dirección, la contraseña y el servidor SMTP (host, puerto y tipo de \
  seguridad) — te lo da quien os gestione el correo. Sin esto, un envío \
  se queda en "fallido" con el motivo "No hay cuenta de correo \
  configurada".
- **El email de cada entidad**, pantalla "Entidades" — un envío va \
  siempre a la dirección que tenga guardada la entidad en ese momento. \
  Una entidad sin email tampoco bloquea el envío a las demás: se queda \
  en "fallido" con el motivo, y las demás salen igual.

## Archivar y desarchivar

Un documento que ya no aplica (anulado, subido por error) se puede \
archivar, desde el panel — deja de salir en búsquedas pero no se borra, \
y se puede recuperar en cualquier momento.

## Fechas de caducidad

Si un documento tiene fecha de caducidad, puedes preguntarle a tu IA qué \
tienes por caducar. Si además configuras en el panel un correo de aviso, \
recibes un email cuando algo esté a punto de caducar (un solo aviso por \
documento, no uno todos los días).

## Generar informes en PDF

Le puedes pedir a tu IA que te genere un informe (con el contenido que \
ella misma redacte) como PDF, usando alguno de los estilos que tengas \
dados de alta en el panel (con tu logo y tus imágenes fijas).

También puedes pedirle a tu IA que cree un estilo nuevo o cambie sus \
instrucciones, y subirle imágenes fijas (logo, plantilla) si las tiene \
en una dirección web o en un archivo al alcance de tu IA. Y si tienes \
un documento que explica cómo se elabora un tipo de informe, le puedes \
decir a tu IA que lo asigne a ese estilo: cuando vaya a redactar un \
informe de ese tipo, lo leerá como guía.

Además, cualquier documento ya guardado se puede descargar tal cual en \
PDF — botón "Descargar PDF" en la ficha del documento, en el panel — \
con el mismo formato con el que se ve en pantalla (títulos, negritas, \
tablas...), pensado para imprimir o mandarlo fuera de aquí.

## Scripts reutilizables

Cuando tu IA escribe un script para una tarea puntual (un backup, un \
informe hecho a medida, una migración de datos...), puede guardarlo \
para no tener que escribirlo de cero la próxima vez que le pidas algo \
parecido. Tú no tienes que hacer nada para esto — lo gestiona tu IA \
sola, buscando primero si ya tiene algo parecido antes de escribir uno \
nuevo. Desde el panel, pantalla "Scripts", puedes ver el código (con \
colores según el lenguaje) y editar el título, la descripción, el \
lenguaje y las etiquetas — el código en sí solo lo cambia tu IA, no se \
puede tocar desde el panel.

Un script se puede relacionar con el documento para el que se escribió \
o en el que se usó, igual que las entidades — desde la ficha del \
documento o desde la ficha del script, y un mismo script puede estar \
relacionado con varios documentos a la vez.

## Registros de datos

Aparte de los documentos, puedes anotar **datos que se repiten con la misma \
forma**: las temperaturas de las cámaras, el parte de limpieza de cada día, \
los resultados de un análisis, el control de una recepción de mercancía. No \
son documentos (no hay un PDF que interpretar) ni comentarios sobre un \
documento: son datos, y por eso se pueden buscar, filtrar y hacer medias con \
ellos.

Cada tipo de anotación tiene un **modelo**, que dice qué campos lleva y cómo \
tienen que ser: qué valores puede tomar cada uno, entre qué límites es \
correcto y cuáles son obligatorios. El modelo lo construye tu IA hablando \
contigo ("¿qué apuntas cada vez en ese parte?", "¿entre qué temperaturas es \
correcto?") y te lo enseña antes de crearlo. A partir de ahí, cada vez que \
le dictes una anotación, la comprueba contra el modelo: si algo no encaja \
—falta un campo, una temperatura se sale del límite, una cámara no existe— \
no lo guarda y te dice qué falla. Así lo guardado siempre es correcto.

**Un modelo con anotaciones no se cambia nunca.** Si hace falta añadir o \
quitar un campo, tu IA crea una versión nueva del modelo, con el motivo del \
cambio, y la anterior se retira: deja de admitir anotaciones nuevas, pero \
las suyas siguen ahí. Así siempre se puede saber qué forma tenía ese parte \
el día que se rellenó, que es lo que se mira en una auditoría.

Cada anotación lleva además, fuera del modelo, la fecha y la hora a la que \
se refiere (que no tiene por qué ser cuándo la anotas), quién la anotó, si \
es conforme o no, unas observaciones, y a qué entidad o documento se \
refiere. Por eso puedes pedirle a tu IA cosas como "enséñame los registros \
no conformes de septiembre" o "la temperatura media de la cámara 2 la semana \
pasada" sin que tenga que leerlos uno a uno.

## Reglas: cómo quieres que trabaje tu IA

Aparte de los documentos, puedes dejarle escritas **reglas de \
comportamiento**: el correo de contacto de la empresa, en qué idioma se \
redacta, cómo se calcula algo que hacéis siempre igual, qué hay que \
incluir en cierto tipo de boletín... Así no tienes que repetirlo en cada \
conversación.

Cada regla lleva un **nombre** que no se repite (por ejemplo \
"boletines_replicas") y una **categoría** (por ejemplo "datos_empresa", \
"correo", "boletines"), y puede ser **global** o no:

- **Global**: tu IA la recibe al empezar cualquier conversación. Para lo \
  que hace falta casi siempre, como el correo de contacto.
- **No global**: tu IA la carga sola justo antes de la tarea de esa \
  categoría. Para lo que solo importa en un tipo de trabajo concreto, \
  como el detalle de cómo se monta un boletín.

El nombre sirve para enlazar unas con otras: una regla global puede decir \
en su texto "antes de redactar un boletín carga boletines_replicas y \
boletines_firma", y tu IA va a buscar esas dos por su nombre solo cuando \
toca. Así la global hace de índice y el detalle no ocupa sitio en las \
conversaciones donde no hace falta. Si renombras una regla a la que otra \
se refiere, acuérdate de cambiarlo también en el texto de esa otra.

La diferencia es el coste: lo global viaja en todas las conversaciones, \
así que conviene que sea corto. En el panel, pantalla "Reglas de la IA", \
puedes crearlas, editarlas, desactivarlas sin borrarlas y ver \
aproximadamente cuántos tokens ocupan las globales. También puedes \
pedírselo a tu IA en conversación (`crear_regla_gd`, \
`actualizar_regla_gd`...). Si tu GD consulta a una central, heredas \
también sus reglas; cuando una tuya diga lo contrario, manda la tuya. Una \
regla marcada como **reservada** no se comparte con las gestiones \
documentales que te consultan.

## GDs enlazadas: consultar una central y aprender de tus clientes

Tu gestión documental puede enlazarse con otra que haga de central \
(por ejemplo, la base de conocimiento de tu asesoría). Cuando preguntas \
algo que no está en tus documentos, tu IA consulta también la central \
(`consultar_gds_enlazadas_gd`) y te dice de dónde sale cada dato; si un \
fragmento no basta, puede pedir el documento completo \
(`obtener_documento_enlazado_gd`). Tú solo lees la central, nunca la \
cambias. Si la central tampoco lo resuelve, tu IA se lo anota \
(`anotar_pregunta_pendiente_enlazada_gd`) para que su responsable lo cubra.
Para ver con qué GDs estás enlazado usa `listar_enlaces_gd`, y para \
comprobar que un enlace sigue vivo y qué te deja pedir esa GD, \
`listar_herramientas_enlace_gd`.

Si tu GD hace de central para otras, lo que marques como **reservado** \
(`marcar_reservado_gd`, o el botón "Reservar" en la ficha del documento) \
no sale nunca hacia ellas. Las preguntas que no supiste responder quedan \
en "Preguntas pendientes" (`listar_preguntas_pendientes_gd` / \
`resolver_pregunta_pendiente_gd`). Enlazar, aspirar aprendizajes de las \
GDs que te consultan (siempre con una copia sin nombres ni datos \
identificativos, revisada y aprobada por una persona) y ver el uso que \
hace cada una se gestiona desde el panel, pantalla "GDs enlazadas".

## Leer y ordenar un buzón de correo

Tu IA puede entrar en cualquier cuenta de correo que tengas dada de alta \
como credencial: usuario = la dirección de correo, contraseña = la del \
buzón. Le dices qué credencial usar ("mira el correo de Facturación") y \
puede ver las carpetas, buscar correos (por remitente, asunto, fechas o \
solo los no leídos), leer uno con sus adjuntos, marcarlos como leídos o \
no leídos, moverlos a otra carpeta y pasar un adjunto a la cola de \
documentos pendientes. Leer un correo no lo marca como leído: solo si se \
lo pides.

- **Gmail**: en lugar de tu contraseña normal usa una "contraseña de \
  aplicación" (se crea en tu cuenta de Google → Seguridad).
- **Microsoft 365 / Outlook de empresa**: no admite contraseña. Tu \
  informático tiene que registrar una aplicación en Microsoft Entra con \
  permiso de acceso IMAP y añadir a la credencial, desde el panel \
  (bloque "Avanzado"), los campos `tenant_id`, `client_id` y `client_secret`.
- **Otros proveedores**: normalmente basta con dirección y contraseña. Si \
  el servidor no es `imap.<tu dominio>`, añade desde el panel, en \
  "Avanzado", el campo \
  `imap_host` (y `imap_port` / `imap_seguridad` si no es el 993 con SSL).

## El panel web

Desde el panel (con tu usuario y contraseña de empresa) puedes:

- Ver y buscar tus documentos (por contenido, tipo o fecha).
- Ver el detalle de uno: tipo, ámbito, fechas, si fue corregido a mano, \
  la fuente si la tiene, y el texto completo.
- Archivar / desarchivar.
- Subir documentos en bloque a la cola de pendientes.
- Ver los scripts que tu IA ha guardado y editar su título, descripción, \
  lenguaje y etiquetas (el código no se puede editar desde aquí).
- Escribir y gestionar las reglas de comportamiento de tu IA, y ver lo \
  que pesan las globales.
- Editar o borrar credenciales de otros servicios ya creadas, tu cuenta \
  de correo, avisos de caducidad, usuarios del proyecto y claves de API — todo eso es gestión desde el panel, no por \
  conversación. Dar de alta una credencial nueva también se lo puedes \
  pedir a tu IA (te enseña el mismo formulario), si prefieres no salir \
  de la conversación.

## Una cosa importante

Guardar y corregir documentos es **siempre por conversación con tu IA**, \
nunca desde el panel — así es tu IA quien decide cómo interpretar y \
guardar cada documento; el formulario solo pide los datos que tú debes \
decidir, no cambia quién lleva la conversación.
"""
