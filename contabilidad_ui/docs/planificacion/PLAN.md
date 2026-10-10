# UI de contabilidad — Multiplika SIF

Actualizado: 02/09/2026

## Dónde estamos

Doce fases. **Están hechas la 1, 2, 3, 4, 6, 7 y 9**, y las que quedan van
por aquí:

- **Fase 5 — Entrada de asientos:** el editor está hecho. Falta corregir el
  concepto y el documento de un apunte ya confirmado, elegir un tercero en vez
  de teclear su cuenta, y que Enter avance de campo.
- **Fase 8 — Fiscal:** hecha la pantalla de IVA y retenciones. Falta el modelo
  303, que espera a que el backend mande los rótulos de las casillas y el
  identificador de las facturas.
- **Fase 10 — Ejercicios, cierre y configuración:** hechas las tres pantallas.
  Faltan `origen_terceros`, que merece la suya, y renumerar los asientos.
- **Fase 11 — Accesos:** sin empezar. Está en el menú y no lleva a ninguna
  parte.
- **Fase 12 — Importar:** falta el historial de importaciones y deshacer una.

Fuera de las fases, dos cosas que conviene decidir pronto: **la sección elegida
se pierde al recargar** —no hay direcciones propias— y **nada comprueba el
código al subirlo a GitHub**.

## Problema

La contabilidad de Multiplika SIF está entera en la API, pero no hay ninguna
pantalla para usarla. Hoy el plan contable, los terceros y sus equivalencias
con las tablas de gestión solo se tocan entrando directamente en la base de
datos. Eso lo hace una persona, despacio y con riesgo.

## Primera versión utilizable

Un contable entra, elige la empresa correcta y **mantiene el plan contable y
los terceros de esa empresa sin entrar en base de datos**: ve el plan, busca
una cuenta, da de alta subcuentas y revisa a qué cliente o proveedor de gestión
corresponde cada una.

### Fuera de alcance (por ahora)

- Entrada manual de asientos.
- Informes y modelos fiscales.
- Inmovilizado, ejercicios y cierre.
- Pantalla de accesos.
- Exportar nada a PDF ni a Excel: la API devuelve datos, no ficheros.
- Cualquier módulo que no sea contabilidad (facturación, cobros, pedidos).

Nada de esto se descarta: está más abajo, en las fases. Lo que se descarta es
meterlo en la primera versión.

*Esa primera versión se pasó hace tiempo: de esta lista solo siguen sin hacerse
los modelos fiscales, la pantalla de accesos y el PDF. Se deja escrita porque
explica por qué el orden de las fases es el que es.*

## Criterio de éxito

Dar de alta la subcuenta de un cliente nuevo y dejarla enlazada con su ficha
de gestión, sin abrir la base de datos y sin salir de la aplicación, en menos
de un minuto.

## Fases

Cada fase termina en algo que se puede enseñar funcionando.

### Fase 1 — Armazón — hecho, salvo lo anotado

Entrar, saber quién eres y en qué empresa estás.

- Pantalla de login (usuario y contraseña). **Hecho.**
- Arranque: `/usuarios/me` → `/contabilidad/sesion/empresas` → selector de
  empresa si hay varias, entrada directa si solo hay una. **Hecho.**
- Cabecera permanente con el nombre y el NIF de la empresa activa. **Hecho.**
- Selector de ejercicio, con `/ejercicios/listar`. El ejercicio elegido viaja
  en casi todas las llamadas del módulo. **Hecho.**
- Navegación lateral, con las secciones filtradas por nivel. **Hecho.**
- Manejo de los errores de sesión: 401 a login, 409 al selector, 403 escondido.
  **Hecho.**
- Activar la contabilidad de una empresa, para superadministrador,
  administrador y asesoría. **Hecho.** Es la puerta de entrada cuando ninguna
  empresa tiene contabilidad todavía.

Queda pendiente de esta fase:

- ~~Confirmar la forma de `/usuarios/me`.~~ **Resuelto el 27/08/2026.** El
  backend añadió `POST /contabilidad/sesion/me`, que devuelve lo mismo con la
  respuesta declarada, así que `Usuario` sale ya de los tipos generados y no de
  la guía. `/usuarios/me` se queda intacto porque lo usa toda la aplicación.
  Diferencia única: el nuevo no devuelve `api_key`, que aquí no se usaba.
- Decidir si hace falta un enrutador cuando la primera pantalla real necesite
  enlace propio. Hoy la sección elegida se pierde al recargar.

### Fase 2 — Plan contable — hecha

- Listado con búsqueda a la vez por código y por título, montando el árbol con
  el campo `nivel` que ya viene en la respuesta. **Hecho.**
- Alta de subcuenta bajo una raíz: la rutina diaria, nivel `apuntes`. **Hecho.**
- Mantenimiento del plan (crear cuentas de estructura, renombrar, cambiar el
  carácter, ocultar, retirar, borrar): nivel `cierre`, escondido para quien no
  lo tenga. **Hecho.**
- El campo `origen` decide los botones: sobre una cuenta del PGC (`comun`) solo
  se puede renombrar u ocultar; borrar y retirar son solo de las propias.
  **Hecho.**
- El ancho de cuenta llega como propiedad desde la configuración del armazón,
  que se pide una vez al entrar. **Hecho.**
- Recuperar una cuenta oculta o retirada: la casilla «Ver también las ocultas»
  las trae al listado, marcadas, y desde su menú se vuelven a mostrar o se
  reactivan. **Hecho el 27/08/2026**, en cuanto el backend añadió
  `incluir_apartadas` y los campos `oculta` y `estado`.

### Fase 3 — Terceros — hecha

- Listado de la equivalencia entre subcuenta y cliente o proveedor. **Hecho**,
  como pestaña «Terceros contables» de Enlace con gestión: no es pantalla
  propia, porque la otra mitad la hacía ya esa sección.
- Clientes y proveedores de gestión que aún no tienen subcuenta. **Hecho** por
  ese lado: son las fichas con la cuenta sin asignar.
- Enlazar a mano una cuenta existente (nivel `cierre`). **Hecho** por ese mismo
  lado, con `Asignar…`, que escribe la ficha y la equivalencia a la vez.
  `/terceros/enlazar` no se usa: dejaría la ficha vacía.
- Elegir cómo numera la empresa las cuentas de clientes y proveedores
  (`modo_cuenta_cliente` y `modo_cuenta_proveedor`: correlativo, por código de
  la ficha, o manual). **Hecho el 27/08/2026**, y va en la pantalla de
  configuración contable, no en la de terceros. Es una preferencia de cada
  empresa, no una decisión del programa, y con el modo `codigo` el traspaso se
  para en vez de inventar un número.

`razon` y `cif` son los del momento del alta y no se refrescan: es a propósito,
para que un asiento antiguo se imprima con el nombre que el tercero tenía
entonces. No hay ningún "sincronizar" y no hay que inventarlo.

**Aquí termina la primera versión utilizable.**

### Fase 4 — Consulta — hecha el 01/09/2026

Diario, mayor por cuenta, sumas y saldos, balance, pérdidas y ganancias, y el
listado y detalle de asientos. Todo en solo lectura.

#### El mayor — hecho el 30/08/2026

En `Informes → Mayor`, y también en modal desde el diario y desde una línea del
asiento que se está tecleando. Está en `docs/interfaz/mayor.md`.

Se trae entero, sin paginar. Marca los borradores igual que el diario, enseña el
saldo con ellos y sin ellos, suma lo que se marque y deja corregir un borrador
sin salir de ahí.

#### Descargar en Excel — hecho el 30/08/2026

Decidido que **lo genera el backend**, no el navegador; el porqué está en
`decisiones.md`. `/informes/excel` es un solo camino para todos los informes: se
dice cuál y se mandan sus parámetros.

Puesto en el mayor y en el diario. El del diario acepta **los mismos filtros que
la pantalla**, así que baja lo que se está viendo y no el ejercicio entero.

#### Sumas y saldos — hecho el 30/08/2026

En `Informes → Sumas y saldos`. Los cuatro niveles de agrupación, rango de
cuentas, rango de fechas y Excel.

**El debe y el haber son los del periodo pedido**, no acumulados: lo que la
cuenta traía al empezar va en su propia columna. Los borradores **no entran de
entrada**, al revés que en el mayor, porque un balance se manda fuera.

El filtro se recuerda por usuario, igual que las columnas del diario, y el mayor
también: al entrar sale ya consultada la última cuenta que se miró. En el mayor
abierto **en modal** no se recuerda nada y se entra con el ejercicio entero: ahí
se mira de pasada, y salir con un trimestre viejo puesto sin haberlo pedido sería
peligroso.

#### Balance de situación — hecho el 30/08/2026

En `Informes → Balance de situación`. El backend avisó ese mismo día de que se
lee ya en positivo, de que cuadra con una resta y de que **activo y pasivo no
son iguales hasta el cierre** —la diferencia es el resultado del ejercicio—, y
eso es justo lo que la pantalla explica, con el resultado del ejercicio a la
vista.

#### Pérdidas y ganancias — hecho el 01/09/2026

Nació como pantalla propia y **ese mismo día se juntó con el balance**: son las
dos pestañas de `Informes → Estados contables`, con un solo filtro de fecha de
corte y de borradores, una sola consulta que trae las dos y una sola descarga.

El motivo de juntarlas es el Excel. `/informes/excel` solo admite `mayor`,
`libro_diario`, `sumas_y_saldos` y `balance`, y este último **ya trae las dos
hojas**: dos pantallas bajando el mismo fichero con nombres distintos era una
trampa. El fichero se llama ahora `balance_pyg_<fecha y hora>.xlsx`.

**El detalle de cuentas**, pedido y resuelto el mismo día (`[4.12]` y `[4.13]`
del intercambio, que con eso se cerró y abrió la ronda 5): un desplegable de
tres posiciones cuelga de cada epígrafe sus cuentas de mayor y, si se pide, sus
subcuentas. La API manda también la sangría (`nivel`) y qué va en negrita
(`agrupa`), así que se borró el cálculo que hacía la pantalla. El Excel admite
el mismo detalle y sale con negrita y sangría.

Con esto la fase queda cerrada. Los informes están en
`docs/interfaz/balances.md`.

#### El diario enseña también los borradores — hecho el 27/08/2026

Decidido el 27/08/2026. Un asiento en borrador no está escondido: sale en el
diario como uno más, y la pantalla dice a las claras que todavía no ha entrado.

- Una columna **Borrador** lo marca fila a fila.
- Las filas de borrador van **de otro color** que las confirmadas.
- Filtro de tres posiciones: **todas / borradores / confirmadas**, para que el
  contable enseñe u oculte unas u otras según lo que esté haciendo.

**Resuelto en la API el 27/08/2026 y desplegado.** `/asientos/listar` acepta
`incluir`: `confirmadas` (el valor por defecto), `borradores` o `todas`, y el
`total` y la paginación cuentan según eso. Cada fila trae `es_borrador`, `clave`,
`id_borrador` y `linea`.

- **La clave de fila es `clave`, no `pase`:** un borrador no tiene `pase` ni
  número de asiento hasta que se confirma.
- Un borrador llega con `asiento: 0`. En esa columna va un hueco o la palabra
  Borrador; **nunca el `id_borrador`**, que el contable leería como número de
  asiento.
- Dentro del mismo día salen primero los confirmados, por número, y después los
  borradores. Un borrador **sin fecha** se va al final y **queda fuera si se
  filtra por fechas**: para verlos, `incluir=borradores` sin fechas.
- El filtro de `cuenta` mira también dentro de las líneas del borrador.
- Con `todas`, `offset + limit` no puede pasar de 20.000: mezclar obliga a
  recorrer desde el principio. Pasarse da un 400 que pide afinar el filtro.

#### Pie con las sumas y el descuadre — hecho el 27/08/2026

También del 27/08/2026. Abajo, fijo, tres bloques de debe, haber y descuadre:

1. **Seleccionados** — las filas marcadas con su casilla. Era «esta página»
   hasta que se quitó la paginación, esa misma tarde.
2. **Esta consulta** — todo lo que cumple el filtro, no solo la página.
3. **El ejercicio** — entero.

Se calculan **en segundo plano**: aparecen cuando estén y mientras tanto no
bloquean nada. El contable no espera a que salga una suma para seguir.

La suma de la página se hace aquí, porque es el total de una columna que se está
viendo (la excepción de la regla 1, y con decimal.js). Las otras dos las da
**`POST /contabilidad/asientos/totales`**, desplegado el 27/08/2026: mismo cuerpo
que el listado sin paginación, y devuelve `consulta` y `ejercicio`, cada uno con
`debe`, `haber`, `diferencia` y `apuntes`.

- **Se le pasa el mismo `incluir` que al listado.** Si la pantalla enseña las dos
  cosas y las sumas van solo con las confirmadas, el contable verá un diario que
  no cuadra.
- `ejercicio` ignora `cuenta`, `desde` y `hasta`: es el ejercicio entero.
- Si no se manda ejercicio, ese alcance llega a `null` y en pantalla se deja
  vacío.

### Fase 5 — Entrada de asientos — empezada

Ya no está bloqueada: el buscador de cuenta se alimenta de `/plan/auxiliares`,
que viene entero y se filtra en el navegador, y elegir un cliente en vez de un
número de cuenta lo resuelve `/terceros/resolver`.

Incluye borrar y rehacer (los asientos no se editan) y la corrección de
concepto y documento. Entrada sin ratón: tabulación correcta y Enter para
avanzar.

#### El editor de asientos — hecho el 30/08/2026

Dentro del diario, no como pantalla aparte, porque se teclea mirando lo que ya
hay. Un asiento manual **pasa siempre por borrador**: se guarda las veces que
haga falta y solo al confirmarlo entra en el libro y coge número. Está en
`docs/interfaz/diario.md`.

La casilla de cuenta busca en el plan que ya está en memoria, por número y por
título, y da de alta la que no exista sin salir del asiento. El concepto y el
documento se heredan de la línea de encima. El descuadre se ve mientras se
teclea, pero **quien decide si un asiento cuadra es el servidor**.

Van con esto la lista de borradores sin confirmar y el traspaso de apuntes de un
borrador a otro, que lo hace la API en una sola operación.

#### Queda de esta fase

- **Corregir el concepto y el documento de un apunte ya confirmado**
  (`/asientos/editar_texto`). Es lo único que se puede tocar de un asiento que
  entró en el libro, y hoy no hay por dónde hacerlo.
- **Elegir un cliente o un proveedor en vez de teclear su número de cuenta**
  (`/terceros/resolver`). Hoy el buscador solo entiende cuentas.
- **Enter para avanzar de campo.** El tabulador va en el orden correcto, pero
  Enter no hace nada dentro del editor, y es la regla 7 del proyecto.

### Fase 6 — Enlace con gestión — hecha

Va **antes** de contabilizar, porque es lo que evita lanzar un trimestre entero
y encontrarse doscientas facturas apartadas.

- `/sincronizacion/revisar`: qué cuentas apuntan los maestros de facturación y
  no existen en el plan. Distinguir las familias con `usa_el_motor: false`, que
  no explican ningún problema y rellenarlas no cambia nada. **Hecho.** La
  revisión se lanza de fondo al entrar en la empresa y el menú enseña cuántas
  cuentas faltan; no se repite sola.
- `/sincronizacion/crear_cuentas`: darlas de alta. Simula por defecto. **Hecho**,
  con la lista de lo que se va a crear antes de confirmar.
- `/sincronizacion/comprobar_traspaso`: antes de contabilizar un periodo. Si
  devuelve `se_puede_traspasar: false`, se apaga el botón de contabilizar y se
  enseña la lista de causas. **Retirado el 28/08/2026**, ver el final de la fase.
- `/sincronizacion/proponer_cuentas_series` y `proponer_cuentas_proveedores`:
  **descartados.** Aplican un mismo criterio a todas las series o a todos los
  proveedores, y qué cuenta lleva cada uno lo decide el contable.
- La sección se abre desde el plan contable, con el botón `Enlace con gestión…`
  y su contador de cuentas que faltan; ya no está en el menú lateral.
- **Cuentas de los maestros** (`/cuentas_maestros`, añadido el 26/08/2026):
  listado de las fichas de cada maestro con su cuenta, filtro por las que la
  tienen sin poner, y cambio ficha a ficha, dando de alta en el plan la cuenta
  que no exista. **Hecho.** Es lo que sustituye al relleno en bloque.
- `/cuentas_maestros/sugerir` (añadido el 26/08/2026): qué cuenta le tocaría a
  una ficha, sin escribir nada. **Hecho**, y para todos los maestros: el diálogo
  de asignar se abre con el número propuesto en las casillas que estén en
  blanco, diciendo de dónde sale (`origen`), y avisa si esa cuenta ya la usa
  otra ficha (`ocupada_por`) o si habrá que darla de alta en el plan
  (`existe_en_el_plan`). Lo que la ficha ya tenía no se pisa. Donde no hay
  criterio, la casilla se queda vacía con el `motivo` debajo.
  Qué maestros se quedan hoy sin propuesta está en `pendientes.md`.
- Queda de este apartado la parte de facturas recibidas sin asiento
  (`/cuentas_maestros/facturas`, `fijar_factura` y `fijar_facturas`), que va con
  la pantalla de contabilizar.

`/sincronizacion/comprobar_traspaso` se montó y **se retiró el 28/08/2026**:
anunciaba que nada frenaba el traspaso justo al lado de una lista donde no
entraba ninguna factura. Lo que frena a cada una se ve ahora en su propia fila,
en la pantalla de contabilizar. Con eso, la fase queda cerrada. Lo pendiente de
backend está en `pendientes.md`.

### Fase 7 — Contabilizar facturas — hecha el 29/08/2026

Contabilizar un periodo, pendientes de contabilizar con su motivo, reintentar
pendientes, anulaciones pendientes y revertirlas.

Son dos secciones del menú, bajo `Traspasos`: `Facturas emitidas` y
`Facturas recibidas`. Un tipo por pantalla, porque lo que hay que arreglar en
cada uno no se parece en nada. Se elige el mes o el ejercicio entero, se ve lo
que queda por contabilizar con **el motivo en la propia fila**, y desde ahí se
contabiliza, se reintenta lo que quedó pendiente y se revierten las
anulaciones.

Lo que frena a una factura se resuelve sin salir de la pantalla: la cuenta que
le falta a un cliente o a un proveedor, la de la serie, y la ficha del bien
cuando la factura la pide.

Está en `docs/interfaz/traspasos.md`.

### Fase 8 — Fiscal — a medias

#### IVA y retenciones — hecho el 02/09/2026

`Fiscal → IVA y retenciones`: el resumen de IVA del periodo, las retenciones
practicadas y el cuadre con facturación, en tres pestañas con un solo filtro.
Está en `docs/interfaz/fiscal.md`.

El periodo se recuerda por usuario porque en ningún sitio consta si una empresa
declara por meses o por trimestres.

#### Modelo 303 — pendiente del backend

La API lo prepara desde el 01/09/2026 (`/contabilidad/declaraciones`), pero no
se puede pintar todavía: **las casillas llegan sin rótulo** —solo el número y el
importe— y **las facturas de los avisos vienen identificadas solo por un id
interno**, sin número ni tercero, que es justo la lista que se enseña ante un
requerimiento de Hacienda. Los datos que trae, campo a campo, y las siete
decisiones que hay encima de la mesa, en `docs/planificacion/fiscal_303.md`.

### Fase 9 — Inmovilizado — hecha el 29/08/2026

Listado, alta, baja, baja con asiento y dotación de amortización.

El 29/08/2026 el backend cerró los cuatro huecos que impedían montarla
(petición [3.7] del intercambio): el listado trae ya lo amortizado, el valor
neto, lo pendiente descontando el residual, la cuota anual y el último mes
dotado; hay `/inmovilizado/obtener` con el cuadro de amortización del bien;
`dotar` y `baja_con_asiento` admiten `simular`; y existe `/inmovilizado/editar`.

Dos avisos de esa respuesta que condicionan la pantalla:

- **Un bien no se borra nunca**, ni lo va a poder hacer: las dos bajas ponen
  `estado = 0` y la fila se queda. Son dos botones, no tres.
- `saltados`, en la dotación, cuenta ahora **todos los que no entran**, no solo
  los ya dotados. No se puede rotular como «ya dotados».

#### Listado y ficha — hecho el 29/08/2026

Solo lectura, nivel `consulta`. El listado con los cinco totales y el filtro de
activos o todos, y la ficha del bien con su cuadro de amortización, que lleva al
asiento de cada dotación. Está en `docs/interfaz/inmovilizado.md`.

#### Las cinco acciones — hechas el 29/08/2026

Alta, corregir, las dos bajas y dotar, todo nivel `apuntes` y escondido para
quien no lo tiene. Las dos que hacen asiento —la baja con asiento y la
dotación— se ensayan antes con `simular` y no dejan aceptar hasta haberlo visto.

Al corregir, los cuatro campos que la API rechaza con dotaciones hechas salen
bloqueados con el aviso que explica por qué, en vez de dejar teclear algo que se
va a perder.

La dotación es siempre de un mes; el backend deja abierta la puerta a una sola
llamada que haga los doce, pero hoy serían doce llamadas y doce asientos, que es
lo correcto.

#### Mejoras y tabla de la LIS — hechas el 29/08/2026

El backend resolvió esa misma tarde dos de los tres puntos del [3.8]:

- **La tabla del artículo 12.1.a) de la LIS**, en
  `/inmovilizado/tabla_amortizacion`, contrastada con el BOE fila a fila. El
  alta trae un desplegable de tipo de bien que rellena el porcentaje, con la
  advertencia que manda la API y un aviso si se pasa del máximo. **Avisa y deja
  seguir**: amortizar distinto de la tabla no es un error.
- **Las mejoras como ficha encadenada.** No hay campo «es mejora»:
  `id_bien_padre` a cero es un bien y con un id es una mejora de ese bien, y la
  respuesta trae `es_mejora` ya resuelto. La cadena tiene **dos niveles**: no se
  admiten mejoras de mejoras. El listado las cuelga de su bien y las dos bajas
  arrastran la cadena, con `se_dan_de_baja` visible ya al simular.

#### El alta desde la factura — hecha el 29/08/2026

Lo que evita el olvido, y con eso la fase 9 queda cerrada. Tres caminos que
comparten el mismo formulario:

- **Traspaso de recibidas**: la factura de un bien no se contabiliza sola y su
  fila ofrece crear la ficha, con las tres respuestas. La ficha y el asiento de
  esa factura, en una sola llamada.
- **Entrada de asientos**: el aviso sale **al confirmar**, nunca al teclear.
- **«Bienes sin ficha»**, sección nueva: el repaso de todo lo que entró antes de
  que esto existiera, que era el agujero que más preocupaba.

Qué factura lo pide lo dice `pide_ficha_de_bien`, no un texto de motivo. El
descarte se recuerda y no vuelve a preguntar.

### Fase 10 — Ejercicios, cierre y configuración — empezada

Además de lo de abajo, la pantalla de configuración contable: cuentas por
defecto y diario por defecto, con `/configuracion/fijar_cuentas`, nivel
`cierre`. Hecha, ver más abajo: los avisos de lo que falta se ven y se arreglan
desde la propia aplicación.

Desde el 26/08/2026 hay una raíz más: `cuentasapagar_acreedores` (410), para los
acreedores por prestación de servicios, aparte de `cuentasapagar` (400) para los
proveedores de bienes. Nace vacía en las empresas que ya existían, y mientras lo
esté un acreedor se numera bajo la raíz de proveedores. La pantalla tiene que
dejar ponerla.

Ahí van también `modo_cuenta_cliente` y `modo_cuenta_proveedor`, que deciden
cómo numera la empresa las subcuentas de sus terceros: `correlativo` (raíz más
el primer número libre), `codigo` (raíz más el código de la ficha) o `manual`.
Se leen en `/configuracion/obtener` y se cambian en el mismo `fijar_cuentas`.
Existen en la API desde el 25/08/2026 y están en la pantalla de configuración
desde el 27/08/2026. Con `codigo`, si el número no se puede componer el traspaso
se para y explica por qué; conviene que la pantalla lo advierta al elegirlo.


Abrir ejercicio, bloquear y desbloquear, deshabilitar y reabrir un periodo ya
presentado, regularizar, cerrar y asiento de apertura. Nivel `cierre`.

Los cuatro bloqueos no son lo mismo y la pantalla tiene que distinguirlos:
`cerrado` es definitivo y no se levanta; `bloqueado` es reversible; `cerrando`
lo pone y lo quita el propio proceso de cierre; `deshabilitado` es de un
periodo, no del ejercicio, y significa que ese trimestre ya se presentó.

#### Pantalla de configuración — hecha, salvo `origen_terceros`

En Utilidades, nivel `cierre`. Hoy tiene el diario por defecto y los dos modos
de numeración de las cuentas de terceros (`modo_cuenta_cliente` y
`modo_cuenta_proveedor`), que hasta ahora no se veían en ninguna pantalla, más
un bloque de solo lectura con el plan vigente, el ancho de cuenta y los
ejercicios abiertos. Se guarda con `/configuracion/fijar_cuentas`, que devuelve
la configuración entera y con eso se rehace la copia del armazón.

**Las quince cuentas por defecto también están**, desde que el backend añadió
`/configuracion/campos` ese mismo día: rótulo, grupo, si es obligatoria y qué
deja de funcionar sin ella, todo suyo. La pantalla las pinta en el orden y con
los grupos que llegan, marca las obligatorias con asterisco y pone el aviso
debajo de cada casilla. El punto sigue siendo comodín al teclear una cuenta.

Queda de esta pantalla **`origen_terceros`**, que va aparte a propósito:
cambiarlo mueve las cuentas de sitio y devuelve qué se movió y qué no. Merece su
pantalla y su confirmación, no una casilla más.

#### Cierre de ejercicio — hecho el 30/08/2026

Sección propia `Cierre de ejercicio`, nivel `cierre`. Regularizar, cerrar el
ejercicio y abrir el siguiente, en cuatro pasos que se ven en la misma
pantalla: qué impide cerrar, preparar, revisar lo que va a entrar y confirmar.

**Los dos asientos nacen como borradores**, así que preparar no cierra nada,
deja seguir apuntando y se puede deshacer. Por eso deshacer no es ninguna
excepción a la regla de que un asiento confirmado no se toca: ninguno llegó a
entrar en el libro. Confirmar sí es definitivo, y la pantalla lo dice antes.

`/cierre/cerrar` y `/cierre/abrir`, que lo hacen de una vez y sin vuelta atrás,
existen y **aquí no se usan**.

Los asientos a medias no bloquean el cierre si se pide, pero siguen saliendo en
la lista de lo que queda por hacer, y mientras quede alguno confirmar se niega.

Está en `docs/interfaz/cierre.md`.

#### Renumerar los asientos por fecha — pendiente

`POST /asientos/renumerar`, nivel `cierre`, añadido por el backend el
27/08/2026. Ordena los asientos del ejercicio por fecha y reparte los números
del 1 al último; los borradores entran también. Es lo que se hace antes de
cerrar, y es lo que hace que un borrador pueda nacer ya con número sin dejar
huecos. Va con la pantalla de ejercicios cuando se aborde el cierre.

- `simular` viene a `true`: la pantalla enseña los cambios antes de lanzarlo,
  porque el contable puede tener números anotados en papel.
- Si `periodos_presentados` no viene vacío, hay que avisar: el libro de esos
  periodos se imprimirá con otros números.

#### Pantalla de ejercicios — hecha el 27/08/2026

La sección «Ejercicios» del menú, dentro de Utilidades, nivel `cierre`. Estuvo
suelta y como «Ejercicios y cierre» hasta el 27/08/2026, cuando el usuario la
bajó a Utilidades y dejó «Cierre de ejercicio» como sección propia, todavía sin
pantalla. Listado con el estado
de cada ejercicio y sus dos contadores de apuntes, los doce periodos del que se
elija, y tres acciones: abrir un ejercicio nuevo
(`/empresa/abrir_ejercicio`, sin `tipo_pgc`: lo hereda de la empresa), bloquear
y desbloquear (`/ejercicios/bloquear`), y cerrar o reabrir un periodo
(`/ejercicios/periodo`).

- Un ejercicio cerrado no enseña ninguna acción: el cierre no se levanta
  quitando el bloqueo y la API responde 400.
- La lista es la misma que alimenta el selector de la cabecera, así que se pide
  una sola vez en el armazón y se rehace ahí después de cada cambio.
- El diálogo de abrir avisa de que el ejercicio nace vacío: los saldos del
  anterior los trae el asiento de apertura, que todavía no está.

Cerrar el ejercicio y el asiento de apertura se dejaron fuera de esta pantalla
a propósito el 27/08/2026: son irreversibles y piden su propia confirmación.
**Tienen sección propia desde el 30/08/2026**, más arriba. Para avisar antes de
intentarlo, `/ejercicios/listar` trae `apuntes_en_borrador`, y el cierre se
niega mientras quede alguno.

### Fase 11 — Accesos — pendiente

Conceder y revocar acceso a la contabilidad de una empresa. Nivel `admin`.
Revocar no borra: las filas revocadas siguen llegando en el listado y hay que
filtrarlas al pintar.

### Fase 12 — Importar desde CSV y Excel — empezada

**Adelantada el 27/08/2026, el mismo día que se planificó.** El motivo lo puso
el usuario: sin datos no se puede probar nada, y meterlos a mano no es una
opción. Se estrena con el plan, porque sin cuentas no se pueden meter apuntes.

La API la tiene desde el 27/08/2026, desplegada y con tablas creadas (apartado
17 bis de la guía). Trae tres cosas: cuentas del plan, apuntes del diario y
bienes de inmovilizado.

Son **dos pantallas, y ese es el punto**: los modelos se definen una vez y la
importación no se ata a ninguno.

- **Modelos de importación**: nombre, qué se importa, cómo se lee el archivo
  (separador, codificación, filas de membrete que saltar, si trae fila de
  títulos, qué hacer si el dato ya existe) y qué columna es cada dato. La lista
  de datos la da `/importador/campos`, así que no hay ningún campo escrito a
  mano. El **destino no se puede cambiar** una vez creado: la API no lo admite
  al editar.
- **Importar datos**: se elige el modelo, se elige el archivo, se comprueba y
  se importa. Aquí no se empareja nada.

Emparejar admite el **número de columna** además del título, que es lo que hace
que un modelo valga para cualquier archivo con ese mismo orden, aunque no traiga
fila de títulos.

La comprobación previa no se puede saltar: el botón de importar está apagado
hasta que hay informe, y también después, porque un archivo solo entra una vez.

Queda de esta fase: el historial de importaciones y deshacer una importación.

**El ejercicio no se manda, y se avisa si no coincide.** Hasta el 27/08/2026 la
pantalla mandaba el del selector de la cabecera, que *fuerza* el destino: un
archivo de 2025 entró entero en 2026 sin decir nada. Ahora cada asiento va al
ejercicio de su fecha, y con el informe del ensayo delante —que ya dice a cuál
iría cada uno— la pantalla avisa en amarillo si el archivo no es del ejercicio
que se está mirando. Es un aviso, no un impedimento: el botón de importar sigue
activo. El backend, por su parte, hizo que forzar el ejercicio aparte los
asientos cuya fecha no cae dentro, así que ya no puede estropear un año.

El circuito son cuatro pasos y **el de ensayar no es opcional**:

    subir → (previsualizar) → ensayar → importar

`/importador/ensayar` recorre el mismo camino que la importación de verdad pero
no escribe nada, y devuelve el mismo informe. Se enseña ese informe antes del
botón de importar: es lo que evita meter mil apuntes mal de un clic.

Lo que la pantalla tiene que decir sí o sí, antes de importar:

- **Los asientos entran como borrador** salvo que el archivo traiga una columna
  `contabilizar` con un sí claro (`1`, `S`, `SI`, `X`, `TRUE`). Quien sube un
  histórico lo busca en el diario y se lo encuentra en borradores.
- **El número de asiento del archivo no se conserva**: chocaría con lo que ya
  hay. Cada asiento coge número nuevo y la correspondencia viene en la
  respuesta y en `/importador/detalle`, también para los que quedan en borrador
  (27/08/2026).

Detalles que condicionan el código:

- **`/importador/subir` es la única llamada que no es JSON**: es
  `multipart/form-data`, con `mapeo` y `opciones` como JSON dentro de campos de
  texto. Máximo 20 MB. Rompe la regla de «todo es POST con cuerpo JSON» y
  `src/api/cliente.ts` tendrá que admitirlo.
- Separador y codificación se detectan solos y se pueden corregir. Recomendar
  la barra vertical a quien genere los archivos: casi nunca sale dentro de un
  texto. `faltan_obligatorios` es lo que apaga el botón de ensayar.
- En el informe, las incidencias con `aviso: true` **no impiden la entrada**:
  se pintan distinto de los rechazos o el usuario creerá que ha perdido filas
  que sí están. Los campos `asientos_*` solo vienen con destino diario.
- `/importador/campos` da los campos mapeables de cada destino, con cuál es
  obligatorio y qué significa: la pantalla de mapeo se construye sola.
- Plantillas de mapeo con nombre, para no volver a explicar el mismo archivo
  cada mes. Historial con `/importador/listar` y `/importador/detalle`.
- `/importador/deshacer` quita lo que trajo una importación, nivel `cierre`. Lo
  que ya no se puede tocar se queda y viene en `pendientes` con su motivo.
- Niveles: subir, ensayar e importar piden `apuntes`, salvo destino `plan`, que
  pide `cierre`. Ver y consultar, `consulta`.
- Cada cuenta, apunte y bien traen `id_importacion` y `fecha_importacion`, por
  si interesa enseñar de dónde salió un dato.

**Pendiente con el backend:** al montarla, decirle si el informe basta para
pintar la pantalla y si falta algún campo mapeable en alguno de los tres
destinos.

## Riesgos y desconocidos

- **Sin diarios ni cambio de ancho de cuenta por API.** El ancho necesitaría
  una migración, no un endpoint, y de diarios solo existe el `GEN`.
- **Casos que hoy no se contabilizan** y aparecen como pendientes: facturas
  rectificativas, recargo de equivalencia soportado, anticipos, operaciones
  intracomunitarias, inversión del sujeto pasivo y criterio de caja. Afecta a
  la fase 6.
- **Sin auditoría ni apuntes borrados por API.** Las tablas se llenan, pero no
  se pueden consultar. Si alguien pregunta "quién borró este asiento", hoy no
  hay respuesta desde la aplicación.
- **Los informes salen a Excel, pero no a PDF.** El Excel lo genera el backend
  desde el 30/08/2026 (`/informes/excel`) y está en el mayor, el diario, sumas y
  saldos y el balance. El PDF **se pidió el 01/09/2026 para los estados
  contables** (`[5.1]` del intercambio); el mayor, el diario y sumas y saldos
  quedan para después, cuando se vea el resultado del primero.
- **La aplicación crecerá a otros módulos.** La navegación de la fase 1 se hace
  contando con ello; el resto de pantallas no debería tener que cambiar.
- **No hay direcciones propias.** La URL no cambia al moverse por el programa,
  así que recargar devuelve al principio, el botón de atrás no sirve y no se
  puede mandar a nadie el enlace de un asiento. Cuanto más crece la aplicación,
  más cuesta ponerlo; la decisión está abierta desde la fase 1.
- **Nada comprueba el código al subirlo a GitHub.** `scripts/desplegar.sh`
  pasa los tests antes de subir al servidor, así que una versión rota no llega
  a producción; pero un `git push` no comprueba nada. El repositorio está en
  GitHub desde el 31/08/2026 y ahí se pueden lanzar solos en cada subida.
- **Todo se descarga de una vez.** La aplicación compilada va en un solo fichero
  de algo más de un mega, sin partir. La primera carga lo nota.
