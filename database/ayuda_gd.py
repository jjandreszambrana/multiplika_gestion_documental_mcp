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
Desktop o Claude Code, conectado con tu clave de este proyecto). Todo se \
lo dices a tu IA por conversación y ella hace el resto — al guardar un \
documento o dar de alta una credencial, te enseña además un pequeño \
formulario para los datos que solo tú puedes rellenar (si tu aplicación \
lo soporta). El panel web es para consultar, buscar y alguna gestión \
más — guardar y corregir documentos siempre es por conversación con tu IA.

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

## El panel web

Desde el panel (con tu usuario y contraseña de empresa) puedes:

- Ver y buscar tus documentos (por contenido, tipo o fecha).
- Ver el detalle de uno: tipo, ámbito, fechas, si fue corregido a mano, \
  la fuente si la tiene, y el texto completo.
- Archivar / desarchivar.
- Subir documentos en bloque a la cola de pendientes.
- Editar o borrar credenciales de otros servicios ya creadas, estilos \
  de informe, tu cuenta de correo, avisos de caducidad, usuarios del \
  proyecto y claves de API — todo eso es gestión desde el panel, no por \
  conversación. Dar de alta una credencial nueva también se lo puedes \
  pedir a tu IA (te enseña el mismo formulario), si prefieres no salir \
  de la conversación.

## Una cosa importante

Guardar y corregir documentos es **siempre por conversación con tu IA**, \
nunca desde el panel — así es tu IA quien decide cómo interpretar y \
guardar cada documento; el formulario solo pide los datos que tú debes \
decidir, no cambia quién lleva la conversación.
"""
