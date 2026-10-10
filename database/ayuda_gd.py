"""Texto de ayuda para el cliente — cómo funciona la Gestión Documental.
Fuente única, reutilizada por la tool MCP `obtener_ayuda_gd()` (para que
la IA lo explique en conversación) y por el panel (pantalla "Ayuda" y
`GET /v1/ayuda[/{seccion}]`), vía el mismo import relativo
`..database.ayuda_gd` que ya usan `modelos` y `dependencias` — así llega
igual a los dos árboles de despliegue, el de las herramientas MCP y el del
panel (ver docs/gestion-documental.md).

Va por partes, en el mismo orden que el menú del panel: se entrega el
índice y el usuario pide la parte que le interese. Es ayuda para el
usuario y solo se sirve a petición — no entra en el contexto de arranque
de la IA; lo que la IA necesita para trabajar va en los docstrings de las
tools."""

SECCIONES_AYUDA_GD = [
    {
        "id": "primeros-pasos",
        "titulo": "Primeros pasos",
        "resumen": "Qué es la gestión documental, las dos formas de usarla y qué puede hacer cada usuario.",
        "markdown": """\
Un archivo de los documentos y datos de tu empresa que consultas y \
mantienes de dos formas:

- **Hablando con tu IA** (Claude Desktop, Claude Code o ChatGPT, \
  conectada con una clave de este proyecto — ver "Conectar tu IA"). Se lo \
  pides por conversación y ella hace el resto: guardar, buscar, corregir, \
  enviar... Cuando hacen falta datos que solo tú puedes decidir (tipo, \
  nombre, fecha...), te enseña un pequeño formulario, si tu aplicación lo \
  soporta.
- **Desde el panel web**, con tu usuario y contraseña de empresa: ver y \
  buscar, editar a mano, subir archivos, gestionar entidades, grupos, \
  reglas... y un chat con la IA dentro del propio panel (ver "Chat con la \
  IA").

El menú del panel sigue el mismo orden que esta ayuda: primero lo del día \
a día (documentos, notificaciones, bloc de notas, seguimiento, avisos \
programados, tipos, estilos de informe, registros de datos, reglas, \
grupos, entidades, scripts, webs y redes, actividad, chat) y, en "Administración", lo \
que solo ve el administrador.

### Qué puede hacer cada usuario

- **Administrador**: todo, incluida la parte de "Administración" \
  (usuarios, claves, credenciales, cuenta de correo...).
- **Operador**: lee y cambia documentos y datos, pero no ve \
  "Administración".
- **Invitado**: solo lectura. No puede cambiar nada ni ve la actividad, \
  y no se le puede encargar nada en el seguimiento.

Un usuario puede tener un rol distinto en cada proyecto de tu empresa. Las \
claves de la IA también llevan permiso: "lectura y escritura" o "solo \
lectura".""",
    },
    {
        "id": "conectar-ia",
        "titulo": "Conectar tu IA",
        "resumen": "Cómo conectar Claude Desktop, Claude Code o ChatGPT, y qué hacer si no conecta.",
        "markdown": """\
Necesitas dos cosas:

- **La dirección del servidor**: la de tu panel terminada en `/mcp` (por \
  ejemplo `https://mcp.tuempresa.com/mcp`). Sale en el panel, pantalla \
  "API keys", o te la da quien te dio de alta.
- **Tu clave**: la emite el administrador en "API keys". Se ve una sola \
  vez al crearla; nunca la compartas ni la pegues en un sitio público. \
  Puede ser "de todos" o a nombre de una persona: con una a tu nombre, la \
  IA ve también lo tuyo, como tus notas privadas del bloc de notas.

### Claude Desktop

1. `Configuración` → `Conectores` → `Añadir conector personalizado`.
2. Pega la dirección del servidor en el campo de la URL.
3. En "Autenticación", Claude suele marcar por defecto **"Iniciar sesión \
   ahora"**. Cámbialo a mano a **"Sin inicio de sesión"** — si no, Claude \
   intenta un registro que este servidor no usa y falla con un error de \
   "no se pudo registrar con el servicio de inicio de sesión", aunque \
   hayas rellenado bien lo de abajo.
4. En "cabecera personalizada" (custom header), el nombre es exactamente \
   `x-api-key` y el valor, tu clave.
5. Guarda. Algunas versiones piden además encender el conector con un \
   interruptor junto al mensaje, en cada conversación.

### Claude Code (línea de comandos)

Ejecuta, sustituyendo la dirección y `TU_CLAVE`:

```
claude mcp add --transport http gestion-documental https://mcp.tuempresa.com/mcp --header "x-api-key: TU_CLAVE"
```

### ChatGPT

1. Activa el **modo desarrollador**: `Configuración` → `Conectores` (o \
   `Apps y conectores`) → `Avanzado` → `Developer mode`.
2. `Conectores` → `Crear` (o `Añadir conector personalizado`).
3. Pon un nombre reconocible, pega la dirección en la URL y, en \
   autenticación, elige clave de API o cabecera personalizada: nombre \
   `x-api-key`, valor tu clave.
4. Guarda y actívalo en la conversación donde quieras usarlo.

Sin el modo desarrollador, puede que los formularios (nombre, tipo, \
fecha...) no salgan y tengas que dictarle esos datos por chat.

### Si algo no encaja

- **"API key inválida" o "unauthorized"**: revisa que no sobre un espacio \
  al copiar la clave y que la cabecera sea exactamente `x-api-key` (con \
  guion, en minúsculas). Si sigue sin ir, puede que la clave esté \
  revocada: pide una nueva.
- **Tu IA lee pero no puede guardar ni cambiar nada**: tu clave es de solo \
  lectura. El administrador puede emitirte otra de lectura y escritura.
- **Conecta pero no ve las herramientas**: comprueba que el conector está \
  encendido en esa conversación; en varios clientes hay que activarlo cada \
  vez.
- **Tienes más de un proyecto conectado**: ponle a cada conector un nombre \
  que diga para qué es (no "Conector 1"). Las herramientas se llaman igual \
  en todos y el nombre del conector es la única forma de distinguirlos.""",
    },
    {
        "id": "documentos",
        "titulo": "Documentos: guardar, buscar y corregir",
        "resumen": "Guardar un documento, normativas, borradores, buscar, corregir o editar, PDF, archivar y borrar.",
        "markdown": """\
### Guardar un documento

Le dices a tu IA que lo guarde (lo pegas o se lo adjuntas). Antes, te \
enseña un formulario para rellenar:

- **Tipo de documento** (factura, contrato, normativa...). Reutiliza uno \
  del catálogo si encaja o crea uno nuevo (ver "Tipos de documento").
- **Nombre o referencia corta** para encontrarlo después.
- **Si es una versión nueva** de un documento que ya tenías, o uno \
  distinto. Las versiones anteriores quedan en el histórico, no se pierden.
- **La fecha del propio documento** (no la de hoy).
- **Si tiene fecha de caducidad** (contratos, certificados...).
- **Si todo su histórico debe quedar buscable**, o solo la última versión \
  (lo normal).

La IA lo convierte a texto (markdown) y lo guarda: ese texto es lo que se \
busca y lo que manda. Si el documento viene de la cola de pendientes (ver \
"Documentos pendientes"), el archivo original (PDF, foto...) también queda \
guardado y se puede descargar desde la ficha.

También puedes darlo de alta tú desde el panel, botón "Nuevo documento": \
pegas o escribes el texto, rellenas los mismos datos y, si quieres, \
adjuntas el PDF original.

### Borradores

Si un documento llega incompleto (faltan páginas, aún se está revisando), \
dile a tu IA que lo guarde como **borrador**: mientras lo sea, cada \
corrección sustituye al borrador en vez de crear una versión nueva. Cuando \
esté listo, pídele que lo confirme.

### Normativas y leyes

Al guardar una normativa puedes indicar:

- **Ámbito**: nacional, autonómica, privada... (opcional, sirve para \
  organizarlas).
- **Fuente**: si viene de una dirección web pública (p.ej. el BOE), queda \
  como referencia, aunque lo que manda es siempre el texto guardado.

Cuando una normativa se sustituye por otra, es una versión nueva del mismo \
documento.

### Buscar y preguntar

Pregúntale a tu IA en lenguaje normal ("¿qué dice el contrato con Acme \
sobre el plazo de entrega?"): busca en tus documentos, responde citando de \
cuál lo saca y puede traer el documento entero si un fragmento no basta. En \
el panel, pantalla "Documentos", buscas por contenido y filtras por tipo o \
fecha.

La búsqueda es por palabras. Se puede pasar a búsqueda **por significado** \
(encuentra "despido" aunque el documento diga "extinción del contrato"): \
tiene un coste por documento y necesita una clave de un proveedor de IA \
configurada para tu empresa. Pídeselo a quien te dio de alta.

### Corregir un error

- **Por conversación**: si la IA leyó mal algo (un importe, una fecha...), \
  díselo y lo corrige sin volver a subir el documento. El texto que generó \
  la primera vez nunca se pierde.
- **Desde el panel**: botón "Editar" en la ficha del documento. Puedes \
  guardar a medias y seguir luego; los cambios solo cuentan cuando pulsas \
  "Confirmar". En "Historial" ves quién cambió qué y cuándo, y puedes \
  volver a una versión anterior.

Si el tipo de documento tiene un formato o normativa que cumplir y el \
documento no lo cumple, la ficha lo avisa en rojo (ver "Tipos de \
documento").

### Descargar en PDF

Botón "PDF..." en la ficha: descarga el documento con el mismo formato que \
se ve en pantalla (títulos, negritas, tablas...), para imprimir o mandarlo \
fuera. Para informes que redacta la IA, ver "Estilos de informe".

### Estado de seguimiento

Arriba de cada documento, junto a su nombre, está su estado de \
seguimiento (Sin estado, Pendiente, En curso, Realizado o Aplazado) y \
quién se encarga. Pulsa la etiqueta para cambiarlo. Ver "Seguimiento".

### Archivar y borrar

Un documento que ya no aplica (anulado, subido por error) se **archiva**: \
deja de salir en búsquedas pero no se borra, y se puede desarchivar cuando \
quieras. Desde la ficha o pidiéndoselo a tu IA.

Para **borrarlo para siempre**, primero archívalo y luego bórralo. Se borra \
todo: versiones, archivo original y comentarios, sin vuelta atrás. Un \
documento que ya se ha enviado por correo no se puede borrar: se queda \
archivado como constancia.""",
    },
    {
        "id": "documentos-pendientes",
        "titulo": "Documentos pendientes",
        "resumen": "Subir muchos archivos de golpe o recibirlos por correo, y procesarlos después con la IA.",
        "markdown": """\
Dos formas de meter documentos sin estar hablando con tu IA en ese momento:

- **Subida en bloque desde el panel**: botón "Subir documentos", en \
  "Documentos". Arrastras o eliges varios archivos (PDF o foto), puedes \
  quitar alguno antes de confirmar, y ves lo que ya tienes en cola.
- **Reenviándolos a la cuenta de correo del proyecto** (si está \
  configurada, ver "Administración") — se recogen solos.

Quedan **pendientes**: aún no están guardados porque nadie ha contestado \
las preguntas de siempre (tipo, nombre...). El menú muestra cuántos hay. \
La próxima vez que hables con tu IA, te avisa y los procesa contigo.

Antes de procesarlos, en el panel puedes ver una **vista previa** del texto \
(sale al momento y no cuesta nada; si es un escaneo, se lee con \
reconocimiento de texto) y, si quieres, un borrador ordenado por la IA. \
También puedes descartar lo que no haga falta.

Un archivo de la cola también puede servir de respaldo de un registro de \
datos (ver "Registros de datos"): dile a tu IA para qué registro es.""",
    },
    {
        "id": "comentarios-incidencias",
        "titulo": "Comentarios e incidencias",
        "resumen": "Comentarios, observaciones e incidencias sobre un documento, con responsable y aviso por email.",
        "markdown": """\
Sobre cualquier documento puedes dejar comentarios, anotaciones, \
observaciones o abrir una incidencia — pídeselo a tu IA o hazlo en la \
pestaña "Comentarios e incidencias" de la ficha. Cada uno guarda quién lo \
abrió y, si quieres, a quién se asigna (texto libre, no tiene que ser un \
usuario del panel) y su email.

Una incidencia se **resuelve** indicando cómo se solucionó, y queda \
enlazada a esa solución. También puedes relacionar unos con otros (p.ej. \
"este comentario es sobre esa incidencia").

Van sobre el documento, no sobre una versión: si subes una versión nueva, \
siguen ahí.

**Estado de seguimiento**: cada comentario o incidencia tiene también su \
etiqueta de estado (Pendiente, En curso, Realizado, Aplazado), con su \
propio encargado, que sí es un usuario del panel. Ojo, no es lo mismo que \
el "Responsable" de texto libre de arriba: ese sirve para el aviso de \
incidencias por email y puede ser alguien de fuera. Ver "Seguimiento".

**Aviso por email**: si el responsable tiene email, le llega a él; si no, \
llega al correo de avisos del proyecto (el mismo de "Avisos de \
caducidad"). Un aviso por asignación, no uno diario; si la reasignas o le \
añades el email, vuelve a avisar.""",
    },
    {
        "id": "enviar",
        "titulo": "Enviar comunicaciones por email",
        "resumen": "Usar un documento como plantilla con variables y mandarlo a varias entidades, ahora o programado.",
        "markdown": """\
Cualquier documento puede servir de plantilla: escribe variables con dos \
llaves, como `{{nombre}}` o `{{importe}}`, y desde la pestaña "Enviar" de \
la ficha eliges a qué entidades mandarlo — una a una, o de golpe las que ya \
estén vinculadas a ese documento.

- Las variables que coinciden con un dato de la entidad se rellenan solas.
- El resto las escribes tú una vez, con el mismo valor para todas las \
  entidades de ese envío.
- Antes de mandar ves una vista previa con todo sustituido.

Se puede mandar ya o **programar** para una fecha y hora, y sale solo. Un \
envío programado se puede cancelar mientras no llegue su hora, y uno que \
falle (un buzón que lo rechaza) se puede reintentar. El correo sale con el \
formato del documento (títulos, negritas...).

### Ejemplo de plantilla

No hay que activar nada: coges cualquier documento y escribes las \
variables, sin espacios ni tildes en el nombre. Por ejemplo, \
"Recordatorio de pago pendiente":

```
Estimado/a {{nombre}},

Le recordamos que tiene pendiente el pago de **{{importe}}**, con
fecha límite el {{fecha_limite}}.

Un saludo.
```

`{{nombre}}` se rellena solo; `{{importe}}` y `{{fecha_limite}}` los \
escribes tú. Si tres clientes deben importes distintos, hace falta un envío \
por importe: de momento no hay un valor distinto por entidad dentro del \
mismo envío.

Las variables que se rellenan solas se llaman exactamente como los campos \
de la ficha de la entidad: `nombre`, `tipo`, `direccion`, `localidad`, \
`provincia`, `codigo_postal`, `pais`, `telefono`, `email`, \
`observaciones`, `codigo`.

### Qué hace falta

- **La cuenta de correo del proyecto** (ver "Administración"). Sin ella, \
  el envío queda "fallido" con el motivo "No hay cuenta de correo \
  configurada".
- **El email de cada entidad**. Si a una le falta, solo esa queda \
  "fallida"; las demás salen igual.""",
    },
    {
        "id": "compartir",
        "titulo": "Compartir un documento por enlace",
        "resumen": "Mandar un documento a alguien de fuera con un enlace que caduca.",
        "markdown": """\
Para mandar un documento a alguien de fuera (un cliente, un inspector...) \
sin darle acceso a tu gestión documental, crea un enlace desde la pestaña \
"Compartir" de la ficha o pidiéndoselo a tu IA. Quien lo abre, sin cuenta, \
descarga el documento en PDF y, si lo eliges, también el archivo original.

- **Caduca** a los 7, 30 o 90 días; lo puedes anular antes.
- **Queda fijo**: si corriges el documento después, el enlace sigue dando \
  lo que compartiste. Para mandar lo corregido, crea otro enlace.
- **Cómo llega**: copias el enlace y lo mandas tú, o escribes el email del \
  destinatario y sale solo desde la cuenta de correo del proyecto.
- **Quien tenga el enlace puede descargar**: no lo publiques en sitios \
  abiertos. En la pestaña ves cuántas veces se ha descargado.

Un documento archivado no se puede compartir.""",
    },
    {
        "id": "caducidades",
        "titulo": "Fechas de caducidad",
        "resumen": "Saber qué va a caducar y recibir un aviso por email.",
        "markdown": """\
Si un documento tiene fecha de caducidad, pregúntale a tu IA qué tienes \
por caducar ("¿qué caduca en los próximos 30 días?").

Si el administrador pone un correo en "Avisos de caducidad", cada día se \
revisa y llega **un solo email** por documento cuando esté a punto de \
caducar (no uno cada día). El mismo aviso incluye los certificados \
digitales que vayan a caducar.""",
    },
    {
        "id": "avisos-programados",
        "titulo": "Avisos programados y notificaciones",
        "resumen": "Recordatorios para una fecha o que se repiten, para las personas que elijas.",
        "markdown": """\
Un aviso programado es un recordatorio que llega a las personas que \
elijas en un momento concreto ("el 15 de octubre a las 9:00") o de forma \
repetida (todos los días, algunos días de la semana, una vez al mes o al \
año). Se puede enlazar con uno o varios documentos.

- **Cómo crearlo**: en "Avisos programados" o en la pestaña "Avisos" de un \
documento. También puedes pedírselo a tu IA: "recuérdale a Ana cada lunes \
a las 8 que revise las temperaturas".
- **Cómo llega**: siempre en "Notificaciones" del panel (el número rojo \
del menú son las que no has leído) y, si lo marcas, también por email \
desde la cuenta de correo del proyecto.
- **Tareas con "Hecho"**: si marcas que hay que confirmarlo, el aviso lleva \
un botón "Hecho" y se vuelve a recordar cada pocos días hasta que alguien \
lo pulse. Tú eliges cuántas veces como mucho, o que no pare hasta que se \
pulse. Basta con que lo pulse una de las personas avisadas.
- **Pausar**: deja de avisar sin borrarlo. Al reanudarlo, lo que tocaba \
mientras estuvo pausado no se manda de golpe.

Las horas son de Madrid. En la ficha de cada aviso ves cuándo avisó, a \
quién le llegó y si falló algún email.

En "Notificaciones" también te llegan:

- **El resumen diario de seguimiento**, cada mañana a las 8:00, con lo \
pendiente y en curso que te toca. Púlsalo para ir a "Seguimiento".
- **El fin de un aplazamiento**: al aplazar algo en el seguimiento se crea \
solo un aviso programado ("Vuelve a estar pendiente: ..."). Lo verás \
también en "Avisos programados".""",
    },
    {
        "id": "bloc-notas",
        "titulo": "Bloc de notas",
        "resumen": "Notas de reuniones, llamadas o ideas, enlazables con otras notas, documentos y registros.",
        "markdown": """\
El bloc de notas es para lo que apuntas tú: lo que se habló en una \
reunión, una llamada, una idea. Cada nota tiene fecha y hora, título, \
una descripción corta, el texto y etiquetas para encontrarla luego.

- **Enlaces**: una nota se enlaza con otras notas, con documentos y con \
registros de datos. El enlace se ve desde los dos lados: en la ficha de \
un documento, la pestaña "Bloc de notas" enseña sus notas.
- **Quién la ve**: lo eliges al escribirla. "Solo yo", "Algunas personas" \
(las que elijas) o "Todos" los del proyecto. Cambiarlo, archivarla o \
borrarla solo lo puede hacer quien la escribió; el texto lo puede cambiar \
cualquiera que la vea.
- **Color**: puedes darle a una nota un color (rojo, naranja, amarillo, \
verde, azul, morado, rosa o gris) para distinguirla de un vistazo y \
filtrar por él.
- **Fijar y archivar**: una nota fijada sale la primera. Archivarla la \
quita de la lista sin borrarla.
- **Estado de seguimiento**: debajo del título, pulsa la etiqueta para \
marcarla como Pendiente, En curso, Realizado o Aplazado y elegir quién se \
encarga (tiene que poder ver la nota). En la lista se ve el estado de cada \
una. Ver "Seguimiento".
- **Recordatorio**: desde la nota, "Nuevo recordatorio" crea un aviso \
programado. Si borras la nota, se borra también su recordatorio.
- **Con tu IA**: "apunta que el proveedor baja un 5 % en enero", "¿qué \
anoté de la reunión con Frutas García?". Ojo: con una clave "de todos", \
la IA solo ve y crea notas para todos. Para que vea tus notas privadas, \
pide al administrador una clave a tu nombre.""",
    },
    {
        "id": "seguimiento",
        "titulo": "Seguimiento",
        "resumen": "Estado (pendiente, en curso, realizado, aplazado) de notas y documentos, y resumen diario.",
        "markdown": """\
El seguimiento sirve para no perder de vista lo que hay que hacer. A una \
nota del bloc, a un documento o a un comentario o incidencia de un \
documento le puedes poner un estado:

- **Pendiente**, **En curso** o **Realizado**.
- **Aplazado**: eliges hasta cuándo. Ese día llega un aviso y vuelve solo \
a pendiente.
- **Sin estado**: lo normal. Lo que no tiene estado no entra en el \
seguimiento.

Para cambiarlo, pulsa la etiqueta del estado (en la ficha de la nota, \
arriba del documento o en cada comentario). Ahí eliges también **quién se \
encarga**.

**Resumen diario**: cada mañana a las 8:00 te llega, en Notificaciones y \
por email, lo pendiente y en curso que tienes encargado, más lo que no \
tiene a nadie. Si no tienes nada, no te llega nada.

**Quién se encarga**: un usuario del proyecto (no un invitado). Si no \
eliges a nadie, el resumen les llega a todos. El aviso del aplazado le \
llega a quien se encarga o, si no hay nadie, a quien lo aplazó.

Lo archivado no entra en el resumen. Si quitas el estado ("Sin estado"), \
sale del seguimiento.

En el menú, **Seguimiento** lo enseña todo junto, con filtros (estado, \
tipo, "Lo que llevo yo", "Sin nadie encargado"). Pulsa una fila para \
abrir la nota o el documento. Con tu IA: \
"¿qué tengo pendiente?", "pon en curso el plan APPCC", "aplaza lo de \
Envases Sur hasta el lunes".""",
    },
    {
        "id": "ventas",
        "titulo": "CRM",
        "resumen": "Personas de contacto, embudo de ventas con oportunidades e historial de cada cliente.",
        "markdown": """\
El **CRM** (gestión de clientes y ventas) lleva cada posible venta \
desde el primer contacto hasta que se gana o se pierde.

**Oportunidades**: cada posible venta ("Reforma oficinas, 12.000 €"), de \
una entidad, con su importe sin impuestos, la etapa en que está, la fecha \
prevista de cierre, quién la lleva y de dónde vino (web, recomendación...). \
En el menú, **CRM** las enseña en un tablero con una columna por etapa: \
arrastra una tarjeta a otra columna para cambiarla de etapa. Arriba ves lo \
que hay en el embudo y lo ponderado por la probabilidad de cada etapa.

**Ganar o perder**: suelta la tarjeta en «Ganada» o «Perdida». Al perderla \
se pregunta el motivo (precio, plazo...), que sirve luego para ver por qué \
se pierden ventas. Si se vuelve a mover a una etapa abierta, se reabre.

**Próximo paso**: lo siguiente que hay que hacer y cuándo ("Llamar para \
cerrar la visita", el jueves). Ese día, y mientras una oportunidad abierta \
no tenga ninguno, sale en el resumen de las 8:00 de quien la lleva (si no \
la lleva nadie, en el de todos). Así no se queda ninguna parada.

**Etapas**: por defecto Contacto (10 %), Propuesta (30 %), Negociación \
(60 %), Ganada y Perdida. El botón **Etapas** deja renombrarlas, \
reordenarlas, añadir otras y cambiar la probabilidad. Una etapa con \
oportunidades no se puede quitar.

**Ficha de la entidad**: además de sus documentos y notas del bloc, enseña \
sus **personas de contacto** (nombre, cargo, email, teléfono; una puede \
ser la principal), sus **oportunidades** y un **historial** con todo lo \
que ha pasado: documentos, notas, envíos, oportunidades y cambios de etapa.

**Facturación (conexión con el ERP)**: el botón **Conexión con el ERP** \
del CRM trae los clientes, las facturas y lo pendiente de cobro del \
programa de facturación, y la ficha de cada entidad enseña lo facturado \
este año y el anterior, lo que debe y sus últimas facturas. Dos formas:

- **Multiplika SIF**: se guarda en Credenciales el usuario y la \
contraseña de la empresa en SIF y se conecta. Cada noche se sincroniza \
sola; también con «Sincronizar ahora». Solo se lee: no se cambia nada en \
SIF. Si un día falla (p.ej. cambiaron la contraseña), llega un aviso a la \
campanita.
- **Importar desde Excel**, para cualquier otro programa: se exporta de \
él el listado de clientes, de facturas o de cobros (.xlsx o .csv) y se \
sube. La primera vez se propone qué columna es cada dato y una vista \
previa dice cuántos se crearán, cuántos se actualizarán y qué filas \
fallan; se recuerda para la próxima. Volver a subir el mismo listado no \
duplica. Con «Son todos mis clientes», los que falten se marcan como baja \
(no se borran).

Los clientes se cruzan por su código del ERP, por NIF o por el nombre \
exacto. Una factura de un cliente que no existe lo da de alta si trae NIF.

A una oportunidad se le pueden enlazar documentos (el presupuesto, la \
propuesta). Con tu IA: "¿qué tenemos abierto este mes?", "crea una \
oportunidad de 4.500 € para García", "pasa lo de García a negociación", \
"prepárame la reunión con García", "¿por qué hemos perdido ventas este \
año?", "¿cuánto nos debe García?", "importa este Excel de facturas".""",
    },
    {
        "id": "asesor-contable",
        "titulo": "Asesor contable",
        "resumen": "Biblioteca contable y fiscal que consulta la IA antes de responder; se activa por gestión documental.",
        "markdown": """\
Con el **asesor contable** activado, la IA trabaja como asesor contable, \
fiscal y financiero: antes de responder una duda consulta una biblioteca \
de temas propia (plan contable, IVA, Impuesto sobre Sociedades, cierre, \
análisis financiero, trabajo de asesoría...), escrita a partir de la \
normativa oficial (BOE, ICAC, Agencia Tributaria) y con ejemplos de \
asientos. Cita el tema y la norma en que se apoya.

- **Activarlo**: el administrador, en "Asesor contable", con el \
  interruptor de arriba. Sin activar, ni sale en el menú ni la IA lo usa.
- **Consultar la biblioteca**: en la misma pantalla, por el índice o con \
  el buscador. En cada tema se pueden abrir las normas que cita, con su \
  texto literal del BOE.
- **Vuestras reglas**: si en vuestra empresa o asesoría hacéis algo de una \
  forma concreta (p.ej. "los gastos de vehículo se imputan al 50 %"), \
  ponedlo en "Reglas de la IA": la IA lo aplica, y si contradice la norma \
  os lo advierte.

Lo que propone la IA (un asiento, una corrección) es siempre una \
propuesta para que la valide el contable. Un tema todavía no revisado se \
avisa al usarlo.""",
    },
    {
        "id": "tipos-documento",
        "titulo": "Tipos de documento",
        "resumen": "El catálogo de tipos, y el formato o normativa que debe cumplir cada uno.",
        "markdown": """\
El catálogo es una lista de **sugerencias**, no una lista cerrada: al \
guardar se puede usar cualquier tipo, esté o no. Sirve para que la IA \
reutilice uno existente en vez de crear variantes ("Factura" y \
"facturas"). Un tipo nuevo se añade solo al guardar el primer documento de \
ese tipo.

En la pantalla "Tipos de documento" cualquier usuario puede añadir tipos. \
El administrador además puede corregirlos o borrarlos (borrar uno no \
afecta a los documentos que ya lo usan) y definir para cada tipo:

- **Formato requerido**: cómo debe estar hecho (p.ej. qué datos lleva una \
  factura).
- **Normativa aplicable**: qué reglamento debe cumplir.

Si un tipo tiene esto definido, la IA lo comprueba al guardar y, si el \
documento no cumple, lo anota: la ficha lo muestra en rojo. Al corregirlo, \
la IA quita el aviso cuando ya cumple.""",
    },
    {
        "id": "estilos-informe",
        "titulo": "Estilos de informe",
        "resumen": "Informes en PDF que redacta la IA, con tu logo y tus instrucciones.",
        "markdown": """\
Pídele a tu IA un informe y te lo genera en PDF con el contenido que ella \
redacte, usando uno de tus **estilos**: cómo debe construirse ese tipo de \
informe y qué imágenes fijas lleva (logo, cabecera...).

Los estilos se ven y editan en la pantalla "Estilos de informe". También \
puedes pedirle a tu IA que cree uno, cambie sus instrucciones o le suba \
imágenes (desde una dirección web o un archivo a su alcance). Y si tienes \
un documento que explica cómo se hace un tipo de informe, dile que lo \
asigne a ese estilo: lo leerá como guía cada vez que redacte uno.

Para descargar en PDF un documento ya guardado, tal cual, usa el botón \
"PDF..." de su ficha.""",
    },
    {
        "id": "registros",
        "titulo": "Registros de datos",
        "resumen": "Anotar datos que se repiten con la misma forma (temperaturas, partes...) y sacar resúmenes.",
        "markdown": """\
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
es conforme o no, unas observaciones, y a qué entidad se refiere. Por eso \
puedes pedirle a tu IA cosas como "enséñame los registros no conformes de \
septiembre" o "la temperatura media de la cámara 2 la semana pasada" sin que \
tenga que leerlos uno a uno.

En el panel, pantalla "Registros de datos", ves las anotaciones y los \
modelos, y puedes anotar a mano: el formulario sale del propio modelo.

Un registro se puede **vincular a uno o varios documentos** (el certificado \
de calibración del termómetro, el procedimiento de limpieza...), y un mismo \
documento a varios registros. Se hace al anotarlo o después, por \
conversación o desde el panel; en la ficha del documento ves sus registros.

Para guardar **el archivo del que salen los datos** (la foto del parte, el \
PDF del análisis), súbelo al panel con "Subir documentos" (o que llegue por \
correo) y dile a tu IA que es para ese registro: lo coge de la cola sin que \
el archivo tenga que pasar por la conversación, que saldría mucho más caro.""",
    },
    {
        "id": "reglas",
        "titulo": "Reglas de la IA",
        "resumen": "Dejar escrito cómo quieres que trabaje tu IA, para no repetirlo en cada conversación.",
        "markdown": """\
Puedes dejarle escritas **reglas de comportamiento**: el correo de contacto \
de la empresa, en qué idioma se redacta, cómo se calcula algo que hacéis \
siempre igual, qué lleva cierto tipo de boletín... Así no lo repites en \
cada conversación.

Cada regla lleva un **nombre** que no se repite (p.ej. \
"boletines_replicas") y una **categoría** (p.ej. "datos_empresa", \
"correo", "boletines"), y puede ser **global** o no:

- **Global**: tu IA la recibe al empezar cualquier conversación. Para lo \
  que hace falta casi siempre, como el correo de contacto.
- **No global**: tu IA la carga sola justo antes de una tarea de esa \
  categoría. Para lo que solo importa en un trabajo concreto.

El nombre sirve para enlazarlas: una regla global puede decir "antes de \
redactar un boletín carga boletines_replicas y boletines_firma", y la IA \
va a buscar esas dos solo cuando toca. Si renombras una regla a la que otra \
se refiere, cámbialo también en el texto de la otra.

Lo global viaja en todas las conversaciones y cuesta en cada una, así que \
conviene que sea corto. En la pantalla "Reglas de la IA" puedes crearlas, \
editarlas, desactivarlas sin borrarlas y ver cuánto ocupan las globales. \
También se lo puedes pedir a tu IA (`crear_regla_gd`, \
`actualizar_regla_gd`...).

Si tu gestión documental consulta a una central (ver "GDs enlazadas"), \
heredas también sus reglas; cuando una tuya diga lo contrario, manda la \
tuya. Una regla **reservada** no se comparte con las gestiones \
documentales que te consultan a ti.""",
    },
    {
        "id": "grupos",
        "titulo": "Grupos",
        "resumen": "Juntar documentos que sirven a un mismo fin (una auditoría, un expediente...).",
        "markdown": """\
Un grupo junta documentos que sirven a un mismo fin (una auditoría, un \
expediente...) y lleva un nombre y una descripción de para qué es. Créalo \
en la pantalla "Grupos" o pidiéndoselo a tu IA.

No hace falta que todos los documentos estén en un grupo, y uno puede \
estar en varios a la vez.""",
    },
    {
        "id": "entidades",
        "titulo": "Entidades",
        "resumen": "Clientes, proveedores, empleados... y su relación con los documentos.",
        "markdown": """\
Clientes, proveedores, empleados... con una ficha sencilla: nombre, tipo, \
dirección, localidad, provincia, código postal, país, teléfono, email, \
observaciones y un código propio (por si quieres cruzarlo con tu programa \
de gestión). Se dan de alta en la pantalla "Entidades" o pidiéndoselo a tu \
IA.

Una entidad se relaciona con los documentos que le afectan (p.ej. el \
cliente de una factura), con tantos como haga falta, y un documento puede \
tener varias entidades. En la ficha de la entidad ves sus documentos y los \
envíos que se le han hecho.

Los datos de la entidad son los que rellenan solos las plantillas de \
correo (ver "Enviar comunicaciones por email"), y a una entidad se le \
pueden asociar certificados digitales (ver "Administración").""",
    },
    {
        "id": "scripts",
        "titulo": "Scripts",
        "resumen": "Programas que tu IA guarda para reutilizarlos en tareas parecidas.",
        "markdown": """\
Cuando tu IA escribe un programa para una tarea puntual (una copia de \
seguridad, un informe a medida, pasar datos de un sitio a otro...), puede \
guardarlo para no escribirlo de cero la próxima vez. No tienes que hacer \
nada: tu IA busca primero si ya tiene algo parecido.

En la pantalla "Scripts" ves el código y puedes cambiar el título, la \
descripción, el lenguaje y las etiquetas. El código en sí solo lo cambia \
tu IA.

Un script se puede relacionar con los documentos para los que se escribió \
o en los que se usó, desde la ficha del documento o desde la del script.""",
    },
    {
        "id": "webs-y-redes",
        "titulo": "Webs y redes",
        "resumen": "Webs, bases de datos y redes sociales desde la IA o el panel: cambios con vista previa y deshacer, vigilancia, copias, SEO, GEO y publicaciones.",
        "markdown": """\
En "Webs y redes" están las webs, redes sociales y bases de datos de tu \
empresa. De momento la gestión documental se conecta con **WordPress** \
(también WooCommerce): ver y editar entradas y páginas, moderar \
comentarios, subir fotos de tus documentos a la web y consultar plugins y \
usuarios. El resto de plataformas se pueden apuntar en la lista para \
tenerlo todo en un sitio, y se irán conectando más adelante.

### Dar de alta tu web

1. En tu WordPress, entra en Usuarios → tu perfil → **Contraseñas de \
   aplicación**, escribe un nombre (p. ej. "Gestión documental") y copia la \
   contraseña que te da. No uses tu contraseña normal: esta se puede anular \
   en cualquier momento sin afectar a nada más.
2. En la gestión documental, un administrador la guarda en \
   Administración → Credenciales (usuario = tu usuario de WordPress, valor = \
   esa contraseña).
3. En "Webs y redes" → Añadir: nombre, dirección de la web y esa \
   credencial. Pulsa "Probar conexión".

También se lo puedes pedir a tu IA.

### Qué puede hacer la IA

Lo decide un administrador en cada web:

- **Solo lectura**: consultar, nada más (así nace toda web nueva).
- **Proponer**: la IA prepara cambios, pero solo se aprueban en el panel.
- **Aplicar confirmando**: la IA los aplica cuando le dices que sí.
- **Autónomo acotado**: además, hace sola tareas pequeñas (de momento, \
  moderar comentarios, p. ej. mandar el spam a la papelera).

La IA puede bajar este permiso si se lo pides, pero nunca subirlo.

### Cómo se hace un cambio

Ningún cambio llega a la web sin pasar por aquí: se prepara una \
**propuesta** con cómo estaba y cómo quedará → alguien la aprueba (en la \
conversación con la IA o con el botón "Aplicar en la web") → se aplica → \
se comprueba que la web sigue funcionando. Puedes pedirlo a la IA y \
aprobarlo luego en el panel, o al revés.

Antes de aplicar se vuelve a mirar la web: si alguien la ha cambiado \
entretanto, no se toca nada y hay que volver a proponerlo. Una propuesta \
sin aprobar caduca a los 7 días (se puede cambiar en los ajustes de cada \
web).

### Deshacer

En la pestaña "Cambios" de cada web está todo lo propuesto y hecho. Un \
cambio aplicado se puede **deshacer**: una edición vuelve a su texto \
anterior, una entrada nueva va a la papelera de WordPress, una foto subida \
se borra. Si después alguien volvió a tocar lo mismo, no se deshace, para \
no pisarlo. La copia de cada cambio se guarda 365 días (se puede cambiar); \
pasado ese plazo queda el resumen, pero ya no se puede deshacer.

### Vigilancia

Cada web se comprueba sola cada cierto tiempo: que responde, el \
certificado (candado), la caducidad del dominio, las protecciones básicas \
del servidor, archivos que no deberían verse desde fuera, administradores \
nuevos, plugins con fallos de seguridad conocidos y comentarios \
pendientes. Si algo **grave** falla (la web se cae, aparece un \
administrador que nadie conoce, un archivo con contraseñas a la vista...) \
avisa en el momento por notificación y correo a quienes pueden editar; lo \
demás llega en el **resumen de los lunes**. Para buscar fallos de \
seguridad conocidos en los plugins hace falta una credencial llamada \
«wpscan» con tu token de WPScan (tienen un plan gratuito).

### El conector de Multiplika (opcional)

Es un plugin de WordPress que se descarga desde la pestaña "Vigilancia" \
de la web. Con él, además: copias de seguridad, aviso si alguien modifica \
los archivos de WordPress (señal de hackeo), errores graves de la web y \
actualizar plugins y temas. Solo atiende a usuarios administradores, así \
que la credencial de la web tiene que ser de un administrador.

### Copias de seguridad

Se activan en "Datos y ajustes": cada cuántas horas, cuántas se guardan en \
el propio servidor de la web y, si quieres, en un servidor remoto tuyo \
(SFTP). Nunca se guardan en servidores de Multiplika. Se vigila el espacio \
libre y, si no cabe una copia, se borra la más antigua (si lo permites) o \
se avisa. Si solo guardas copias en el propio servidor, ten en cuenta que \
si el servidor se estropea o lo hackean se pierden la web y las copias a \
la vez. Restaurar una copia es un cambio más (vista previa, aprobar, y se \
puede deshacer).

### Actualizaciones

En los ajustes eliges entre **solo avisar** o **actualizar \
automáticamente**: se hace una copia, se actualiza, se comprueba que la \
web sigue bien y, si no, se vuelve a la copia y se avisa. Puedes excluir \
plugins concretos (p. ej. la tienda) para que de esos solo avise.

### SEO: salir mejor en Google

En la pestaña "SEO" de cada web:

- **Google**: visitas que llegan desde Google, veces que sale, posición \
  media, páginas y búsquedas que más traen, comparado con el periodo \
  anterior. Para verlo, añade en tu Search Console (Configuración → \
  Usuarios y permisos) el correo que te indica el panel, con permiso \
  restringido.
- **Velocidad**: la puntuación de Google para móvil y ordenador y lo que \
  más la aceleraría.
- **Auditoría**: la gestión documental recorre tu web como Google cada \
  semana y lista lo que conviene mejorar (páginas sin descripción, títulos \
  repetidos, enlaces rotos, imágenes sin texto alternativo...), **primero \
  lo que afecta a las páginas que más visitas traen**. Cada problema se \
  puede arreglar (el título y la descripción para Google, con vista \
  previa y deshacer), convertir en tarea del seguimiento o ignorar.
- **Informe mensual**: el día 1 se guarda en tus documentos el informe del \
  mes anterior (visitas, búsquedas, cambios hechos y su efecto, lo que \
  falta por arreglar), listo para sacarlo en PDF con tu estilo.

### Salir en las respuestas de las IAs (GEO)

En la pestaña "SEO", añade las preguntas que haría un cliente real a una IA \
(«mejor laboratorio de análisis de alimentos en Sevilla»). Una vez al mes \
se le preguntan a las IAs disponibles (Claude con la clave de tu empresa; \
ChatGPT, Gemini o Perplexity si das de alta su clave como credencial \
«openai», «gemini» o «perplexity») y se ve en cuántas respuestas sale tu \
empresa y qué competidores salen. Cada pregunta cuesta una consulta a cada \
IA. Con el conector, ahí mismo decides qué robots de IA pueden leer tu web \
y el texto de /llms.txt; tu IA puede preparar los datos estructurados de \
tu empresa.

### Bases de datos

Da de alta la base de datos de tu tienda o programa como «Base de datos» \
(MySQL o PostgreSQL), conectando directamente, por un túnel SSH o, si es \
la de tu WordPress, a través del conector. Puedes preguntarle a tu IA \
(«¿cuántos pedidos hubo en septiembre por provincia?») y guardar las \
preguntas útiles para ejecutarlas tú con un botón. Las consultas nunca \
cambian nada. Para cambiar datos, tu IA prepara el cambio (qué filas y cómo \
quedan), se aprueba y se puede deshacer; nunca se cambian más filas de las \
del ajuste «Filas como máximo» ni la estructura de las tablas.

### Redes sociales

Da de alta cada red (Facebook, Instagram, LinkedIn, Google Business...) en \
"Webs y redes". En "Calendario de publicaciones" preparas lo que sale \
(texto, fotos de tus documentos, fecha): nada se publica sin aprobarlo, y \
lo aprobado sale solo a su hora. Ves las métricas, los comentarios (tu IA \
puede proponer la respuesta) y puedes retirar lo publicado. Se conecta por \
un servicio intermediario (Ayrshare) o, para Facebook e Instagram, \
directamente con una aplicación de Meta tuya; la pestaña de cada red \
explica los pasos.

### Webs hechas a medida

Si tu web no es WordPress, se conecta a sus archivos por SFTP o a su \
repositorio Git. La vigilancia, el SEO y el GEO funcionan igual; los \
cambios en archivos (por ejemplo robots.txt o una página) se proponen con \
vista previa y se deshacen igual que el resto. Por Git, cada cambio es un \
commit.

### Cloudflare

Si tu web usa Cloudflare, pon en los ajustes una credencial con su token \
de API: se vigila que el escudo esté bien puesto y, si la web sufre un \
ataque, se puede activar el modo «estoy siendo atacado» (y quitarlo \
después) como cualquier otro cambio.

Todo queda también en "Actividad". Los invitados no ven esta parte.""",
    },
    {
        "id": "actividad",
        "titulo": "Actividad: quién cambió qué y cuándo",
        "resumen": "El historial de cambios del proyecto y de cada documento.",
        "markdown": """\
Todo cambio que sale bien queda apuntado con su fecha, quién lo hizo, \
desde dónde (tu IA con su clave, el chat del panel o un botón del panel) y \
sobre qué: guardar, corregir, archivar, borrar, enviar, crear reglas o \
scripts, etc. Las consultas y búsquedas no se apuntan, y nunca se guardan \
contraseñas, valores de credenciales ni archivos. Lo que tenga más de un \
año se borra solo.

Puedes preguntarle a tu IA "¿quién archivó la factura 1234?", "¿qué se \
cambió ayer?" o "¿qué ha hecho Ana esta semana?". En el panel está la \
pantalla "Actividad", con filtros por persona, fechas y origen, y cada \
documento tiene su pestaña "Actividad". Lo ve cualquier usuario menos los \
invitados, y las claves de solo lectura tampoco pueden consultarlo.

Cuando el cambio viene de tu IA, se sabe qué **clave** usó, no qué persona \
había detrás: si varias personas comparten clave, no se distinguen. Para \
saber con exactitud quién hizo cada cosa, que cada persona tenga su propia \
clave con su nombre.""",
    },
    {
        "id": "chat",
        "titulo": "Chat con la IA",
        "resumen": "Hablar con la IA en un panel a la derecha, sin conectar nada y sin perder la conversación al moverte.",
        "markdown": """\
"Chat con la IA", en el menú, abre un panel a la derecha: es como hablar \
con tu IA conectada, pero sin salir del panel ni configurar nada. \
Pregúntale por tus documentos, entidades, registros o comentarios, y \
pídele que haga cosas.

- **Se queda a mano**: puedes moverte por el resto del panel con el chat \
  abierto, y la conversación sigue igual. Vuelve a pinchar en "Chat con la \
  IA" (o en la X) para ocultarlo; al abrirlo de nuevo está donde lo \
  dejaste. Arrastrando su borde izquierdo lo haces más ancho o más \
  estrecho, y se recuerda para la próxima vez. En el móvil ocupa toda la \
  pantalla.

- **Lo que cambia datos te lo pregunta antes** (guardar, archivar, \
  enviar...): no lo hace hasta que lo confirmas. Las consultas las hace \
  sola.
- **Varias conversaciones**, cada una con su título (se lo pones tú o sale \
  del primer mensaje). Puedes renombrarlas y borrarlas; borrar es para \
  siempre.
- Las conversaciones sin uso en **6 meses** se borran solas.
- Un invitado también puede usarlo, pero solo para consultar.

Para que funcione, tu empresa necesita tener configurada su propia clave de \
IA (su uso se paga aparte, según lo que se use). Si el chat dice que no hay \
clave, pídeselo a quien te dio de alta.""",
    },
    {
        "id": "administracion",
        "titulo": "Administración",
        "resumen": "Contexto de negocio, usuarios, claves, avisos, cuenta de correo y certificados (solo administrador).",
        "markdown": """\
Esta parte del menú solo la ve el administrador.

### Contexto de negocio

Lo que la IA lee en cuanto se conecta: a qué se dedica tu empresa y cómo \
quieres que se comporte contigo (tono, prioridades, cosas a evitar). \
Cuanto más claro, mejor te ayuda. Para instrucciones de tareas concretas, \
mejor "Reglas de la IA".

### Usuarios

Quién entra al panel y con qué rol (administrador, operador o invitado, \
ver "Primeros pasos"). El rol es por proyecto.

### API keys

Las claves para conectar una IA (ver "Conectar tu IA"). Cada una lleva un \
nombre que no se repite (pon el de la persona o el uso, p.ej. "Claude \
Desktop de Juan") y un permiso: lectura y escritura, solo lectura, o "GD \
enlazada" (para otra gestión documental que consulta esta). La clave solo \
se ve al crearla; si se pierde, se emite otra y se revoca la vieja.

### Avisos de caducidad

El correo al que llega el aviso de documentos y certificados por caducar, \
y el de incidencias sin responsable con email. Vacío = sin avisos.

### Cuenta de correo

La cuenta propia de tu empresa (no una compartida) con la que salen los \
avisos, los envíos a entidades y los enlaces compartidos, y a la que se \
reenvían documentos para la cola de pendientes. Hace falta la dirección, \
la contraseña y los datos del servidor de correo (te los da quien os \
gestione el correo). La contraseña se guarda cifrada.

### Certificados

Certificados digitales de tus entidades (.p12/.pfx o .cer/.pem). El \
archivo y su contraseña se guardan cifrados; los datos del certificado \
(titular, NIF, emisor, fechas) se leen solos al subirlo. Cada descarga \
queda apuntada con quién y cuándo. Para renovar uno, se sube el nuevo; no \
se sobrescribe el anterior. Entran en el aviso de caducidad.""",
    },
    {
        "id": "credenciales-correo",
        "titulo": "Credenciales y buzones de correo",
        "resumen": "Contraseñas de otros servicios para la IA, y leer y ordenar un buzón.",
        "markdown": """\
### Credenciales

Usuario y contraseña (o clave) de otros servicios con los que tu IA tiene \
que conectar. Se guardan cifradas: la IA ve el nombre, para qué sirve y el \
usuario, **nunca la contraseña**. Se editan y borran en la pantalla \
"Credenciales"; darlas de alta también se lo puedes pedir a tu IA, que te \
enseña un formulario (así la contraseña no queda escrita en la \
conversación).

### Leer y ordenar un buzón

Tu IA puede entrar en cualquier cuenta de correo dada de alta como \
credencial (usuario = la dirección, contraseña = la del buzón). Le dices \
cuál ("mira el correo de Facturación") y puede ver las carpetas, buscar \
correos (remitente, asunto, fechas o solo no leídos), leer uno con sus \
adjuntos, marcarlos como leídos o no, moverlos de carpeta y pasar un \
adjunto a la cola de pendientes. Leer un correo no lo marca como leído, \
salvo que se lo pidas.

- **Gmail**: usa una "contraseña de aplicación" (se crea en tu cuenta de \
  Google → Seguridad), no tu contraseña normal.
- **Microsoft 365 / Outlook de empresa**: no admite contraseña. Tu \
  informático tiene que registrar una aplicación en Microsoft Entra con \
  acceso IMAP y añadir a la credencial, en el bloque "Avanzado", los campos \
  `tenant_id`, `client_id` y `client_secret`.
- **Otros proveedores**: normalmente basta con dirección y contraseña. Si \
  el servidor no es `imap.<tu dominio>` ni `mail.<tu dominio>`, añade en \
  "Avanzado" el campo `imap_host` (y `imap_port` / `imap_seguridad` si no \
  es el 993 con SSL).""",
    },
    {
        "id": "copias-seguridad",
        "titulo": "Copias de seguridad",
        "resumen": "Copias de toda la base: hacerlas, cifrarlas, descargarlas, programarlas y volver a una.",
        "markdown": """\
En la pantalla "Copias de seguridad" (solo administradores) se hacen copias \
de todo lo que hay en tu gestión documental: documentos, archivos \
originales, entidades, notas, ajustes...

- **Contraseña de las copias**: se pone una vez (mínimo 12 caracteres; \
  mejor una frase de varias palabras) y se guarda cifrada en el almacén de \
  credenciales, sin volver a enseñarse. Apúntala en un sitio seguro: los \
  archivos descargados (.7z) solo se abren con ella, con 7-Zip o WinRAR.
- **Hacer una copia ahora** y **descargarla**: se puede en cuanto las \
  copias estén programadas y la contraseña guardada; va siempre cifrada.
- **Programarlas por periodos**: cada periodo es diario, de algunos días \
  de la semana o de un día al mes, a la hora que elijas, y guarda sus \
  propias copias: las N últimas o las de los últimos N días. Por ejemplo: \
  diaria guardando 7, semanal guardando 10 y mensual guardando 12. Lo que \
  sobra se borra solo. Se pueden cifrar también.
- **Guardarlas además en otro servidor** (SFTP), con una credencial que \
  tenga usuario, contraseña y un campo `host`.
- **Volver a una copia**: todo lo de ahora se sustituye por lo de esa \
  copia. Antes se guarda sola una copia del estado actual, por si hay que \
  deshacerlo.

La IA no puede hacer ni restaurar copias: solo se hace desde esta pantalla.""",
    },
    {
        "id": "gds-enlazadas",
        "titulo": "GDs enlazadas",
        "resumen": "Consultar una gestión documental central (p.ej. tu asesoría) y aprender de las que te consultan.",
        "markdown": """\
Tu gestión documental puede enlazarse con otra que haga de **central** \
(por ejemplo, la base de conocimiento de tu asesoría). Cuando preguntas \
algo que no está en tus documentos, tu IA consulta también la central \
(`consultar_gds_enlazadas_gd`) y te dice de dónde sale cada dato; si un \
fragmento no basta, pide el documento completo \
(`obtener_documento_enlazado_gd`). La central solo se lee, nunca se \
cambia. Si tampoco lo resuelve, tu IA lo anota \
(`anotar_pregunta_pendiente_enlazada_gd`) para que su responsable lo cubra. \
Con `listar_enlaces_gd` ves con qué GDs estás enlazado, y con \
`listar_herramientas_enlace_gd` compruebas que un enlace sigue vivo.

Si tu GD hace de central para otras:

- Lo que marques como **reservado** (botón "Reservar" en la ficha del \
  documento, o `marcar_reservado_gd`) no sale nunca hacia ellas.
- Las preguntas que no supiste responder quedan en "Preguntas pendientes" \
  (`listar_preguntas_pendientes_gd` / `resolver_pregunta_pendiente_gd`).
- Puedes **aprender** de las GDs que te consultan: se trae una copia sin \
  nombres ni datos que identifiquen a nadie, y una persona la revisa y \
  aprueba antes de guardarla.
- En "Uso y coste" ves cuánto consulta cada una, por si repercutes el \
  coste.

Todo esto (enlazar, preguntas, aprendizajes, uso) está en la pantalla "GDs \
enlazadas". Enlazar es un solo paso: la GD que consulta pega la dirección y \
la clave que le dio la central, y el enlace queda hecho en los dos \
sentidos. Una central puede a su vez consultar a otra (cliente → asesoría \
→ sector).""",
    },
]

_POR_ID = {s["id"]: s for s in SECCIONES_AYUDA_GD}


def texto_seccion(seccion: dict) -> str:
    return f"## {seccion['titulo']}\n\n{seccion['markdown']}"


def obtener_seccion(id_seccion: str) -> dict | None:
    return _POR_ID.get(id_seccion)


def indice_ayuda() -> list[dict]:
    return [{"id": s["id"], "titulo": s["titulo"], "resumen": s["resumen"]} for s in SECCIONES_AYUDA_GD]

