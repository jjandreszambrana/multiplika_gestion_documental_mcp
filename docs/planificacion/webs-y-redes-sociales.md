# Webs, bases de datos y redes sociales desde la GD

Plan de estudio e incorporación, 2026-10-06. **Las 6 fases implementadas el mismo día** (ver docs/gestion-documental.md → "Webs y redes sociales", "… fase 2", "… SEO" y "… fases 4, 5 y 6"; ahí está lo que cambió respecto a este plan), probadas en local (fase 2 también contra un WordPress real) y sin desplegar. Nace de una clienta que quiere que la IA le gestione la web (WordPress o hecha a medida), su base de datos, el SEO y el GEO, la seguridad (hackeos y spam) y, por extensión, las redes sociales.

Las 9 decisiones de partida las tomó el usuario el 2026-10-06 (ver "Decisiones tomadas" al final); van ya incorporadas en cada apartado. Lo marcado **[DECIDIR]** sigue siendo del usuario y lo marcado **[COMPROBAR]** hay que verificarlo (en la documentación oficial, con una prueba real o en los servidores) antes de empezar esa fase. Los precios y las condiciones de las APIs de terceros cambian a menudo: ningún dato de este plan sobre precios o permisos vale sin pasar antes por la fase 0.

## Cambios respecto a este plan al implementar la fase 1

- No hay tabla `gd_activos_ajustes`: los ajustes van en una columna JSON de `gd_activos_digitales`, con el catálogo y los valores por defecto en el código. Igual de ampliable y una tabla menos.
- No hay tabla `gd_comprobaciones` ni `gd_resultados_comprobacion` todavía: llegan con la fase 2.
- El nivel de permiso solo lo sube un administrador desde el panel; la IA puede bajarlo.
- De los ajustes solo existen los que ya hacen algo (caducidad de propuestas y días que se guarda la copia de cada cambio).

## Cambios respecto a este plan al implementar la fase 2

- El conector propio va en la fase 2 (copias, integridad, errores y actualizaciones lo necesitan). Usa la contraseña de aplicación de un administrador, no una clave propia: no abre nada que un administrador no tenga ya.
- Destino remoto de copias en la v1: solo SFTP. S3, Google Drive o Dropbox, cuando un cliente lo pida.
- `gd_comprobaciones` + `gd_resultados_comprobacion` como estaban previstas; además `gd_vigilancia_resumenes` y `gd_cache_vulnerabilidades`.
- Vulnerabilidades con WPScan (credencial «wpscan» del cliente); Wordfence o Patchstack quedan como alternativa enchufable.
- Cloudflare: comprobación y nivel de seguridad; sin probar contra una cuenta real.
- La restauración de una copia es una propuesta más, y se puede deshacer (vuelve a la copia que se hace justo antes).

## Cambios respecto a este plan al implementar la fase 3

- Search Console con una cuenta de servicio de Multiplika (el cliente solo añade un correo), no OAuth por cliente. Google Analytics queda para más adelante (mismo mecanismo).
- Los datos de Google no se guardan: se consultan en vivo (Google guarda 16 meses). Solo se guardan las auditorías propias y sus hallazgos.
- PageSpeed necesita en la práctica una clave de API de Google (sin ella apenas deja consultas).
- Escribir el título y la descripción para Google va por el conector (Yoast, Rank Math, SEOPress; si no hay plugin de SEO, los pone el conector).
- Herramientas de pago (Semrush, Ahrefs, DataForSEO): no incluidas; se enchufarían como otra fuente junto a `_mod_google.py`.

## Cambios respecto a este plan al implementar las fases 4, 5 y 6

- Bases de datos: los cambios son estructurados (tabla, valores, condiciones de igualdad), nunca SQL libre, y se aplican fila a fila por clave primaria.
- Redes: intermediario = Ayrshare; directo = solo Facebook e Instagram (Meta) de momento. Las imágenes van por un enlace público temporal propio.
- Reseñas de Google: no incluidas (solo comentarios de publicaciones).
- GEO: Claude con la clave de la empresa; ChatGPT, Gemini y Perplexity con la del cliente. Robots, llms.txt y datos estructurados por el conector 1.3.
- Webs a medida: archivos por SFTP o Git; sin copias de seguridad propias.
- Shopify, PrestaShop y Wix: pendientes de que un cliente lo pida.

## Qué es esto

La GD pasa a ser también el **centro de mando de la presencia digital** de la empresa: sus webs, sus bases de datos, sus redes sociales y lo que se dice de ella en Google y en las IAs. La IA puede consultar, proponer y, con permiso, cambiar cosas. La GD guarda el inventario, las claves, el historial de cambios, los avisos y los informes.

Ejemplos de lo que tiene que poder hacer al final:

- "Publica esta noticia en la web con esta foto, y mañana a las 10:00 súbela también a Instagram y Facebook."
- "¿Qué páginas de la web han perdido visitas desde Google este mes y por qué?"
- "Revisa la ficha del producto 45: el título es demasiado largo para Google y le falta la descripción. Propón cómo arreglarlo." → la IA enseña el antes/después → el usuario confirma → se aplica.
- "¿Salimos cuando alguien le pregunta a ChatGPT por una asesoría de seguridad alimentaria en Sevilla?"
- Lunes a las 8:00, sin que nadie lo pida: "El plugin Contact Form 7 de tu web tiene un fallo de seguridad conocido; hay una actualización. El certificado de la web caduca en 12 días. Hay 340 comentarios de spam retenidos."
- "¿Cuántos pedidos hubo en septiembre y cuál fue el producto más vendido?" (consulta a la base de datos de la tienda).

## Tres formas de manejarlo, con las mismas reglas

Todo tiene que poder hacerse desde **tres sitios** (usuario, 2026-10-06):

1. **La IA del cliente por su suscripción** (Claude Desktop, Claude Code u otra IA compatible), conectada a la GD por MCP.
2. **El chat de IA integrado en el panel de la GD**, que usa la clave de API de IA de la propia empresa.
3. **Las pantallas del panel de la GD**, sin IA: formularios, listas y botones.

Cómo se consigue sin hacer tres veces el trabajo:

- Toda la lógica (conectar con WordPress, preparar un cambio, guardar la copia, aplicarlo, deshacerlo) vive **una sola vez** en `database/modelos/`, como el resto de la GD.
- Las herramientas MCP llaman a esa lógica, y con ellas quedan cubiertas las vías 1 y 2, porque el chat del panel ya funciona como un cliente MCP más (ver `panel_cliente/chat_ia.py`).
- Las pantallas del panel llaman a la misma lógica por sus propios endpoints (vía 3).
- **El freno de "vista previa → confirmar" es el mismo para las tres vías y lo pone el servidor**: un cambio se hace en dos pasos, *proponer* (devuelve el antes/después y un número de propuesta) y *aplicar* (con ese número). La propuesta queda guardada, así que se puede proponer desde la IA y aprobar desde el panel, o al revés. Esto no depende de que el cliente de IA pida o no permiso antes de usar una herramienta: hay IAs que lo piden y otras que no.
- Nada de esto requiere que la IA esté presente: un usuario que solo use el panel tiene que poder dar de alta una web, ver las alertas, aprobar publicaciones, deshacer un cambio y cambiar cualquier ajuste.

## Principios (valen para todas las fases)

1. **Nada cambia sin vista previa.** Todo cambio sigue el mismo camino: la IA prepara el cambio → se enseña el antes y el después → una persona confirma → se guarda una copia de lo que había → se aplica → se comprueba que ha ido bien → se apunta en el registro. Este camino lo impone el servidor, no las instrucciones a la IA (mismo criterio que los frenos de los scripts en [programaciones](programaciones-avisos-y-notificaciones.md)).
2. **Niveles de permiso por conexión**, elegidos por el usuario para cada web, base de datos o red:
   - *Solo lectura*: consulta, nunca cambia.
   - *Proponer*: prepara cambios, pero solo se aplican desde el panel por una persona.
   - *Aplicar con confirmación*: la IA aplica después de que el usuario diga "sí" en la conversación.
   - *Autónomo acotado*: solo para tareas pequeñas y enumeradas (por ejemplo, mandar a la papelera comentarios marcados como spam), siempre con registro.
   Por defecto, todo en *solo lectura*.
3. **Todo cambio se puede deshacer** mientras exista la copia (tabla `gd_cambios_externos`, ver modelo de datos). Si no se puede guardar copia, el cambio no se hace.
4. **Las claves nunca salen de la GD**: viven cifradas en las credenciales que ya existen (`gd_credenciales` + `gd_credenciales_campos`, con OAuth ya resuelto para el correo de Microsoft 365). La IA nunca ve una contraseña; las herramientas la usan por dentro.
5. **Los invitados no tocan nada de esto**, ni siquiera para leer (mismo criterio que el correo).
6. **Ser honestos con lo que hace cada pieza**: la IA vigila, avisa, propone y ejecuta; la protección contra ataques en tiempo real la da un escudo (Cloudflare o un plugin de seguridad), que la GD configura y vigila, pero que no sustituye.

## Fase 0 — Estudio (antes de escribir código)

El resultado de esta fase es un documento de conclusiones en esta misma carpeta y la lista de [DECIDIR] contestados. Cada punto lleva su prueba concreta.

### 0.1 La clienta y su caso real

- Qué web tiene (WordPress, WooCommerce, otra plataforma o hecha a medida), dónde está alojada, si tiene acceso SSH o solo panel tipo cPanel/Plesk, qué base de datos usa y si admite conexiones desde fuera.
- Qué redes usa y cuáles le importan de verdad (no es lo mismo Instagram + Google Business que LinkedIn + X).
- **Decidido**: cada empresa gestiona **sus propias** webs y redes, y puede tener varias (por ejemplo, la web corporativa, la tienda online y un blog). Cada web o cuenta se puede relacionar, **si se quiere**, con una entidad de la GD (por ejemplo, la web de una marca o una delegación), pero no es obligatorio. No se diseña como herramienta de agencia.
- Cuánto está dispuesta a pagar al mes y qué servicios de terceros ya paga (Yoast Premium, Wordfence, Metricool, Semrush…).

### 0.2 WordPress

Montar un WordPress de pruebas (local con Docker) con WooCommerce, Yoast y Rank Math, y comprobar uno a uno:

- **[COMPROBAR]** Qué permite la API oficial de WordPress con una contraseña de aplicación: entradas, páginas, medios, comentarios, usuarios, menús, ajustes, plugins (listar, activar, actualizar) y temas.
- **[COMPROBAR]** Si se pueden **escribir** los datos de SEO de Yoast y de Rank Math (título SEO, meta descripción, palabra clave) por la API, o si solo se pueden leer. Si no se puede, hace falta el conector propio (0.4).
- **[COMPROBAR]** WooCommerce: productos, pedidos, clientes, cupones e informes con su API (clave y secreto propios de WooCommerce).
- **[COMPROBAR]** Qué hostings habituales bloquean la API o las contraseñas de aplicación (algunos plugins de seguridad lo hacen).

### 0.3 Webs hechas a medida

- **Con repositorio de código (Git)**: la IA trabaja en una rama, el cambio se revisa y se publica por el sistema de despliegue de la web. Es lo más seguro: todo queda guardado y se deshace solo.
- **Sin repositorio, solo SFTP/SSH**: la IA descarga el archivo, guarda copia, sube el cambio y comprueba que la web sigue respondiendo. Más frágil.
- **[COMPROBAR]** Si conviene montar una copia de la web de pruebas (staging) antes de tocar la real, y quién paga ese espacio.
- **Decidido**: se contemplan **WordPress y webs a medida**. En el orden de fases, WordPress va primero porque es más seguro y sirve para probar todo el sistema de propuestas, copias y deshacer; las webs a medida se apoyan después en ese mismo sistema.

### 0.4 Conector propio instalado en la web del cliente

Muchas cosas no se pueden hacer por la API estándar: comprobar que los archivos del núcleo de WordPress no han sido modificados por un hacker, hacer copias de seguridad, leer la base de datos sin abrirla a Internet, ver los registros de errores, escribir los campos de SEO de algunos plugins.

La solución habitual es un **plugin propio ("Multiplika Conector")** que el cliente instala en su WordPress, que solo atiende peticiones firmadas desde la GD y que hace esas tareas. Para webs a medida sería un pequeño archivo PHP o un programa equivalente.

- Ventaja: se puede hacer todo y sin abrir la base de datos al exterior.
- Coste: hay que mantenerlo (actualizaciones de WordPress, PHP 7 y 8), es una pieza más que puede fallar o tener un agujero de seguridad, y el cliente tiene que instalarlo.
- **Decidido**: **se hace el conector propio**. En esta fase se define qué hace exactamente, cómo se firman las peticiones, cómo se actualiza a sí mismo y cómo se instala en una web a medida. Todo lo que se pueda hacer por la API estándar se sigue haciendo por ella; el conector cubre lo que falta. Debe ser opcional: una web sin conector funciona, solo que con menos cosas (sin copias, sin comprobar archivos, sin base de datos si no admite conexión remota), y el panel lo dice claramente.

### 0.5 Bases de datos

- **[COMPROBAR]** Cuántos hostings de los clientes permiten conexión remota a MySQL/MariaDB. Si no, alternativas: túnel por SSH o el conector propio (0.4).
- Diseñar el usuario de base de datos que debe crear el cliente: uno de **solo lectura** siempre, y uno de escritura solo si lo pide.
- **[COMPROBAR]** Cómo calcular **antes** de un cambio qué filas se van a tocar (ejecutar la misma condición como consulta), guardar esas filas como copia, y aplicar el cambio en una transacción que se anula sola si toca más filas de las previstas.
- Límites duros en el servidor: no se permiten cambios de estructura (borrar o crear tablas, columnas) salvo permiso explícito; tope de filas por cambio (por ejemplo 100); tope de tiempo por consulta (por ejemplo 30 s).

### 0.6 SEO

Fuentes de datos a probar, de la más barata a la más cara:

- **Google Search Console** (gratis, OAuth): consultas por las que sale la web, clics, impresiones, posición media, páginas indexadas y errores. **[COMPROBAR]** límites de uso y qué hace falta para que el cliente nos dé acceso.
- **PageSpeed Insights** (gratis con clave): velocidad y Core Web Vitals por página.
- **Google Analytics 4** (gratis, OAuth): visitas, origen, conversiones.
- **Bing Webmaster Tools** (gratis): importa porque ChatGPT busca en Bing. **[COMPROBAR]** si sigue siendo así.
- **Auditoría propia**: recorrer la web (como hace Google) y sacar títulos, descripciones, encabezados, imágenes sin texto alternativo, enlaces rotos, redirecciones, sitemap, robots.txt, datos estructurados (schema.org) y contenido duplicado. Lo hacemos nosotros, sin coste por uso, pero gasta máquina. **[COMPROBAR]** cuánta memoria y tiempo gasta recorrer una web de 500 páginas.
- **Posiciones por palabra clave con detalle y competencia** (DataForSEO, Semrush, Ahrefs…): de pago.
- **Decidido**: se empieza **solo con lo gratuito**, pero el diseño deja la puerta abierta a herramientas de pago. Cada fuente de datos de SEO es una pieza que se enchufa (con su credencial, lo que sabe dar y su coste) sin tocar el resto, de forma que añadir Semrush más adelante sea dar de alta su clave y poco más.

### 0.7 GEO (salir en las respuestas de las IAs)

Es un campo nuevo y la medición es aproximada; hay que contárselo así al cliente.

- **Lo que se puede hacer sobre la web**: datos estructurados (empresa, negocio local, preguntas frecuentes, productos, autores), archivo `llms.txt`, contenido que responda preguntas concretas con datos citables, páginas de autor y de "quiénes somos" sólidas, mismos nombre/dirección/teléfono en todas partes, ficha de Google Business completa y reseñas.
- **Qué robots de IA pueden leer la web** (GPTBot, ClaudeBot, PerplexityBot, Google-Extended…) en `robots.txt`. **Decidido**: lo decide el cliente **en cada una de sus webs**, robot a robot, desde el panel o pidiéndoselo a la IA. La GD le explica qué implica cada opción (si los bloquea, es difícil salir en las respuestas de esa IA) y aplica el cambio como cualquier otro, con vista previa y deshacer.
- **Cómo medirlo**: una lista de 20–50 preguntas que haría un cliente real ("mejor asesoría laboral en Jerez", "qué empresa de análisis de alimentos hay en Huelva") que se hacen cada mes a varias IAs por su API (Claude, ChatGPT, Gemini, Perplexity), apuntando si la marca sale, en qué posición, si enlazan la web y qué competidores salen. **[COMPROBAR]** coste real: con 50 preguntas × 4 IAs × 1 vez al mes son 200 consultas al mes por cliente; hay que calcular cuánto cuestan con búsqueda web activada. **[COMPROBAR]** si hay herramientas de terceros que ya lo hagan a buen precio y nos compense integrarlas en vez de hacerlo nosotros.

### 0.8 Seguridad y spam

- **Vigilancia que podemos hacer nosotros** (sin coste por uso): que la web responde (cada 5 minutos), caducidad del certificado y del dominio, cabeceras de seguridad, archivos que no deberían verse desde fuera (`.env`, `.git`, copias `.sql`), usuarios administradores nuevos, cambios en archivos del núcleo (necesita SSH o el conector), si Google la marca como peligrosa (Safe Browsing).
- **Fallos de seguridad conocidos de plugins y temas**: cruzar las versiones instaladas con una base de datos de vulnerabilidades. **[COMPROBAR]** condiciones y precio de WPScan, Wordfence Intelligence y Patchstack.
- **Escudo**: Cloudflare (gratis en lo básico) delante de la web. La GD puede consultar los ataques bloqueados y, con permiso, activar el modo "estoy siendo atacado" o bloquear un país o una IP. **[COMPROBAR]** qué permite su API con el plan gratuito.
- **Spam**: comentarios (Akismet o similar), formularios (Cloudflare Turnstile o reCAPTCHA) y registros de usuarios falsos. La IA puede revisar lo retenido y limpiar.
- **Copias de seguridad**. **Decidido**: las dos opciones, y cada una **se activa o desactiva por web**:
  - *Vigilar*: comprobar que el cliente tiene copias hechas por otros medios (de su hosting o de un plugin) y avisar si la última tiene más de N días (N configurable).
  - *Hacerlas*: el conector propio hace la copia y la guarda **donde configure el cliente** (usuario, 2026-10-06), no en servidores nuestros:
    - **En el propio servidor de la web**, si tiene espacio libre.
    - **En un servidor o almacenamiento remoto** del cliente, si no lo tiene o si lo prefiere. **[COMPROBAR]** qué destinos admitir en la primera versión (otro servidor por SFTP, almacenamiento compatible S3, Google Drive, Dropbox…); las claves de acceso van en las credenciales cifradas de la GD.
    - **La GD guarda y enseña el espacio**: libre en cada destino, lo que ocupa cada copia y cuántas caben con el ritmo configurado. Avisa antes de que se llene (por ejemplo, "quedan 3 GB, al ritmo actual da para 6 días más") y, si no cabe una copia nueva, borra la más antigua solo si el cliente lo ha permitido; si no, avisa y no la hace.
    - **Advertencia que se muestra al elegir solo el propio servidor**: si el servidor se estropea o lo hackean, se pierden la web y las copias a la vez. Se recomienda tener también un destino remoto, aunque sea con menos copias (por ejemplo, 30 diarias en el servidor y 4 semanales fuera).
    - **[COMPROBAR]** cómo medir el espacio libre en hostings compartidos, donde el límite lo pone el plan contratado y no el disco real.
    - Antes de dar por terminada esta parte, **probar de verdad a restaurar una copia** (es una prueba nuestra durante el desarrollo, no algo que tenga que hacer el cliente): una copia que nunca se ha restaurado no vale.
- **Actualizaciones**. **Decidido**: lo decide el cliente **por web** entre *solo avisar* y *actualizar automáticamente* (con copia previa, comprobación de que la web sigue bien y vuelta atrás si no). **[COMPROBAR]** si la elección debe poder hacerse también por plugin (por ejemplo, actualizar todo automáticamente salvo la tienda).

### 0.9 Redes sociales

Aquí está el mayor obstáculo, y es administrativo, no técnico: para publicar en nombre de otros, cada red exige registrar una aplicación y pasar una revisión.

| Red | Qué hay que estudiar |
|---|---|
| Facebook e Instagram (Meta) | **[COMPROBAR]** revisión de la aplicación por Meta, verificación de empresa, permisos para publicar, leer métricas y responder comentarios y mensajes. Instagram solo cuentas profesionales. |
| Google Business Profile | **[COMPROBAR]** solicitud de acceso a la API; publicaciones, reseñas y responderlas. Muy importante para negocios locales y para el GEO. |
| LinkedIn (páginas de empresa) | **[COMPROBAR]** acceso a la API de gestión de comunidades, que requiere aprobación. |
| X (Twitter) | **[COMPROBAR]** la API es de pago; precio actual. |
| TikTok | **[COMPROBAR]** API de publicación y su auditoría. |
| YouTube | **[COMPROBAR]** cuota de la API para subir vídeos. |

Dos caminos:

- **Directo**: nosotros registramos la aplicación en cada red. Sin coste por uso, pero meses de trámites, revisiones que pueden denegar y mantenimiento cuando cambian las APIs.
- **Intermediario**: un servicio con una única API para todas las redes (Ayrshare, Metricool, Buffer y similares). Se paga por cliente o por perfil, pero funciona en días. **[COMPROBAR]** precios y qué permite cada uno (publicar, métricas, comentarios, mensajes).
- **Decidido**: **las dos**, y el cliente elige para cada cuenta cuál usar. La GD habla con las redes a través de una pieza intermedia propia con las mismas operaciones para todas (publicar, programar, leer métricas, leer y responder comentarios), y por detrás puede usar un intermediario o la conexión directa. Así el calendario, las aprobaciones y los informes son iguales vayan por donde vayan.
- **No se adelanta ningún trámite** (usuario, 2026-10-06): nada de esto se pide hasta que esté implementado y un cliente vaya a usarlo. Cuando un cliente active la conexión directa con una red, **la GD le muestra en ese momento** las advertencias (plazos de revisión, que pueden denegarla, cuenta profesional obligatoria…) y los pasos a dar, guiados uno a uno, igual que ya se hace con la cuenta de Microsoft 365 del correo. Mientras no la tenga, puede usar el intermediario. A quien no use esta parte de la GD no se le enseña nada.
- **[COMPROBAR]** si cada red permite que **el propio cliente** registre su aplicación para gestionar solo sus propias páginas sin pasar la revisión completa (en Meta, por ejemplo, una aplicación en "modo desarrollo" en la que el administrador de la página es también administrador de la aplicación). Si es así, la conexión directa no depende de ningún trámite nuestro.

### 0.10 Legal

- **[COMPROBAR]** Al leer la base de datos de un cliente (pedidos, clientes) tratamos datos personales: hace falta contrato de encargado de tratamiento (RGPD) y revisar qué guardamos. Regla de partida: el registro de cambios guarda **qué** se cambió, pero las copias de filas con datos personales se borran a los N días. **Decidido**: los plazos **son configurables** por el cliente (copias con datos personales, copias de seguridad, histórico de resultados). **[COMPROBAR]** valores por defecto razonables con criterio legal; propuesta de partida: 30 días para copias con datos personales y 2 años para el histórico de resultados.
- **[COMPROBAR]** Condiciones de uso de cada red social sobre publicación automatizada y uso de IA.
- **[COMPROBAR]** Responsabilidad si un cambio de la IA rompe la web o la tienda: qué ponemos en el contrato.

### 0.11 Máquina

- **[COMPROBAR]** Las tareas pesadas (recorrer webs, comprobar velocidad, consultas a IAs para GEO) no caben en mcp-d, que ya va justo de memoria (ver [buzón de sugerencias](buzon-de-sugerencias.md)). Valorar un servidor de trabajos aparte, compartido por todos los clientes, que haga esas tareas por la noche y deje los resultados en la base de cada proyecto.

## Modelo de datos (borrador, se ajusta tras la fase 0)

Todo en la base Postgres de cada proyecto, siguiendo los criterios de siempre (identificadores numéricos, sin depender de nombres editables; nombres de índice con prefijo de la tabla).

| Tabla | Para qué |
|---|---|
| `gd_activos_digitales` | El inventario: cada web, dominio, base de datos, cuenta de red social, ficha de Google Business, propiedad de Search Console… Tipo, nombre, dirección, plataforma (WordPress, WooCommerce, a medida, Instagram…), nivel de permiso (los 4 niveles de los principios), credencial asociada, entidad asociada **opcional**, si tiene instalado el conector propio, cómo se conecta (para redes: intermediario o directo) y estado (activo, pausado, error de conexión). |
| `gd_activos_ajustes` | Las elecciones del cliente por cada activo: robots de IA permitidos, copias (vigilar / hacerlas / ambas / ninguna, cada cuánto, destinos y cuántas se guardan en cada uno, y si se puede borrar la más antigua cuando falta espacio), actualizaciones (avisar / automáticas), plazos de conservación. Se guardan aparte para poder añadir ajustes nuevos sin tocar el inventario. |
| `gd_cambios_externos` | Cada cambio hecho fuera de la GD, desde que se **propone** hasta que se aplica o se deshace: activo, qué se cambia (una entrada, una fila, un archivo, un ajuste), contenido **antes** y **después**, estado (propuesto, aprobado, aplicado, rechazado, caducado, fallido, deshecho), por qué vía se propuso y por cuál se aprobó (IA por suscripción, chat del panel, pantalla del panel), quién, cuándo y el resultado de la comprobación posterior. Es la pieza que hace posible el "proponer → aprobar" común a las tres vías, el deshacer y el informe mensual. |
| `gd_comprobaciones` | Cada vigilancia programada (disponibilidad, certificado, dominio, vulnerabilidades, spam, auditoría SEO, medición GEO) con su frecuencia y su último resultado. Se apoya en las programaciones y notificaciones que ya existen. |
| `gd_resultados_comprobacion` | El histórico de resultados, para ver la evolución (por ejemplo, la posición media en Google mes a mes). Se borra pasado el plazo que configure el cliente. |
| `gd_publicaciones` | Calendario editorial: texto, imágenes (documentos de la GD), redes de destino, fecha prevista, estado (borrador, pendiente de aprobar, aprobada, publicada, error), enlace a la publicación y métricas. |
| `gd_preguntas_geo` | Las preguntas de seguimiento del GEO y, por cada medición, qué IA, si salió la marca, en qué posición y qué competidores salieron. |

Lo que ya existe y se reaprovecha: credenciales (claves), entidades (clientes finales de una agencia), documentos (imágenes, textos, informes), programaciones y notificaciones (vigilancias y avisos), seguimiento (tareas que salen de una auditoría), reglas (voz de marca, cosas que nunca se pueden tocar), estilos (informes en PDF con el logo) y actividad (quién hizo qué). Las herramientas nuevas que cambien datos hay que añadirlas a `ACCIONES_MCP` / `ACCIONES_PANEL`, o no quedarán registradas.

## Fases de implementación (orden propuesto)

Cada fase se puede vender y usar sola. El orden pone primero lo más útil con menos riesgo.

### Fase 1 — Inventario y WordPress (lectura y contenido)

- Inventario de activos digitales y sus ajustes, en el panel y por MCP, con entidad opcional.
- El sistema de propuestas (`gd_cambios_externos`): proponer, aprobar desde cualquiera de las tres vías, aplicar, deshacer. Es la base de todas las fases siguientes.
- Conexión a WordPress con contraseña de aplicación, con una prueba de conexión al darlo de alta.
- Leer: entradas, páginas, medios, comentarios, plugins y versiones, usuarios.
- Cambiar con el camino de los principios (vista previa → confirmar → copia → aplicar → comprobar → registro): crear y editar entradas y páginas, subir imágenes desde documentos de la GD, moderar comentarios.
- Deshacer desde el panel ("Cambios en la web" → botón Deshacer).
- Reglas de marca: "nunca toques la página de Aviso legal", "escribe siempre de usted".
- **Prueba de salida**: con el WordPress de pruebas, crear, editar y deshacer 20 cambios distintos sin perder nada, repartidos entre las tres vías (proponer desde Claude Desktop y aprobar en el panel, todo desde el chat del panel, todo desde las pantallas); luego, con la web de la clienta en solo lectura durante una semana.

### Fase 2 — Vigilancia y seguridad

- Disponibilidad, certificado, dominio, cabeceras, archivos expuestos, Safe Browsing.
- Conector propio para WordPress, primera versión: comprobar archivos modificados, usuarios administradores, registro de errores y copias de seguridad.
- Copias: vigilar y/o hacerlas en los destinos del cliente (propio servidor y/o remoto), con control de espacio y una restauración de prueba real antes de darlo por bueno.
- Plugins y temas con fallos conocidos, y actualizaciones (avisar o automáticas, según elija el cliente en cada web).
- Spam de comentarios: revisión y limpieza (primera tarea candidata a *autónomo acotado*).
- Cloudflare: estado y acciones básicas, si el cliente lo tiene.
- Resumen semanal en la campanita y por correo; alertas inmediatas solo para lo grave (web caída, Google la marca como peligrosa, administrador nuevo).
- **Prueba de salida**: provocar a propósito cada alerta en el WordPress de pruebas (apagarlo, instalar un plugin vulnerable antiguo, crear un administrador) y ver que llega el aviso correcto.

### Fase 3 — SEO

- Search Console y PageSpeed (y Analytics si se decide).
- Auditoría propia de la web, con resultados priorizados ("estas 12 páginas no tienen meta descripción y reciben el 40 % de las visitas").
- La IA propone las correcciones y se aplican por el conector de la fase 1.
- Los hallazgos se convierten en tareas de seguimiento.
- Informe mensual en PDF con el estilo del cliente: clics, posiciones, qué se ha cambiado y qué efecto ha tenido.

### Fase 4 — Base de datos

- Conexión directa si el hosting la admite (o por túnel SSH); si no, a través del conector propio.
- Solo lectura primero: preguntas en lenguaje normal ("pedidos de septiembre por provincia") traducidas a consultas, con tope de tiempo y de filas. Desde el panel sin IA: consultas guardadas que se ejecutan con un botón.
- Escritura después, con los frenos de 0.5: vista previa de filas afectadas, copia, transacción con tope y deshacer.
- WooCommerce por su API antes que por la base de datos directa, siempre que la API alcance.

### Fase 5 — Redes sociales

- Pieza intermedia común a todas las redes; primero por intermediario, y la conexión directa de cada red según vayan saliendo las revisiones.
- Calendario editorial en el panel (vista mes y semana).
- Borradores creados por la IA a partir de documentos o noticias de la web ("convierte esta entrada del blog en un carrusel de Instagram y un post de LinkedIn").
- Circuito de aprobación: borrador → aprobado por una persona → publicado a la hora prevista (por las programaciones).
- Métricas de cada publicación y resumen mensual.
- Más adelante: leer y responder comentarios y reseñas de Google (con propuesta de la IA y confirmación).

### Fase 6 — GEO y ampliaciones

- Medición GEO mensual con las preguntas del cliente e informe de evolución.
- Mejoras sobre la web orientadas a GEO (datos estructurados, `llms.txt`, preguntas frecuentes) aplicadas por el conector.
- Webs a medida: por Git cuando la web lo tenga y por SFTP/SSH cuando no, con su versión del conector propio.
- Otras plataformas (Shopify, PrestaShop, Wix) según los clientes que lo pidan.

## Riesgos principales

- **Romper la web de un cliente.** Freno: niveles de permiso, copia previa obligatoria, comprobación posterior automática (si la web deja de responder tras el cambio, se avisa al momento y se ofrece deshacer) y empezar siempre en solo lectura.
- **Que roben las claves de muchas webs a la vez.** Las credenciales ya van cifradas; además, pedir siempre a los clientes usuarios con el mínimo permiso (un usuario "Editor" de WordPress, no "Administrador", salvo para la parte de seguridad y plugins).
- **Trámites de las redes sociales** que se alarguen meses o se denieguen. Freno: el intermediario sigue disponible mientras tanto, y la GD avisa al cliente de esto antes de que empiece.
- **Prometer de más en GEO.** La medición es aproximada y las IAs cambian sus respuestas de un día para otro; vender tendencias, no posiciones exactas.
- **Coste por uso** (IAs para GEO, herramientas de SEO de pago, intermediario de redes). Calcular el coste por cliente en la fase 0 y repercutirlo en el precio.
- **Carga de máquina** en mcp-d. Ver 0.11.

## Decisiones tomadas (usuario, 2026-10-06)

1. **Para quién**: cada empresa gestiona sus propias webs y redes, pueden ser varias, y cada una se puede relacionar opcionalmente con una entidad.
2. **Tipo de web**: WordPress y webs a medida.
3. **Conector propio** instalado en la web: sí (opcional por web).
4. **SEO**: se empieza con herramientas gratuitas, dejando preparada la entrada de herramientas de pago.
5. **Robots de IA**: lo decide el cliente en cada web.
6. **Copias de seguridad**: vigilar y hacerlas, cada cosa activable por web; se guardan donde configure el cliente (su propio servidor si hay espacio, o uno remoto), con control del espacio disponible.
7. **Actualizaciones**: el cliente elige por web entre avisar o actualizar automáticamente.
8. **Redes sociales**: intermediario y conexión directa; el cliente elige por cuenta.
9. **Plazos de conservación**: configurables.
10. **Tres vías**: todo se maneja desde la IA por suscripción (MCP), desde el chat del panel y desde las pantallas del panel, con el mismo freno de "proponer → aprobar".

## [DECIDIR] que quedan

Ninguno por ahora. Las copias se guardan en espacio del cliente, así que no hay coste nuestro que repercutir.
