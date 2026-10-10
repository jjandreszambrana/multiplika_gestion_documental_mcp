# Decisiones

Un bloque por decisión, por orden de fecha. No se reescriben: si algo cambia,
se añade una decisión nueva que anula la anterior.

## 25/08/2026 — Mantine se queda en la rama 7

**Contexto:** hacía falta una librería de componentes y una rejilla de datos
para las pantallas de listado, que son casi todas.
**Decisión:** Mantine 7.17.8 con mantine-react-table 2.0.0-beta.9.
**Alternativas descartadas:** Mantine 8 y 9, porque mantine-react-table v2 pide
`@mantine/core: ^7.9` y no hay versión compatible con Mantine 8 o superior. La
rejilla manda. Handsontable, PrimeReact y AG Grid Enterprise quedan fuera por
licencia.
**Quién decidió:** asistente, comprobando las dependencias declaradas.
**Reversible:** caro. Cambiar de rejilla obliga a rehacer todos los listados.

## 25/08/2026 — TypeScript se queda en la versión 5

**Contexto:** el arranque de Vite instaló TypeScript 6 y la instalación falló.
**Decisión:** fijar TypeScript 5.9.
**Alternativas descartadas:** forzar la instalación con `--legacy-peer-deps`,
que deja el generador de tipos en un estado no probado.
**Quién decidió:** asistente. `openapi-typescript` declara `typescript: ^5.x`.
**Reversible:** sí, cuando el generador admita la versión 6.

## 25/08/2026 — El generador de tipos pasa por un script propio

**Contexto:** el OpenAPI de la API trae una referencia `#/$defs/…` en el
endpoint `/facturas_emitidas/obtener`, ajeno a contabilidad, que no es válida
en el documento raíz y aborta la generación de tipos.
**Decisión:** `scripts/api-types.mjs` descarga el documento, reescribe esa
referencia y avisa por consola de lo que ha reparado.
**Alternativas descartadas:** generar los tipos solo de las rutas de
contabilidad, que escondería el problema y dejaría fuera lo que se necesite
después.
**Quién decidió:** asistente.
**Reversible:** sí. Es un fallo del backend: cuando se corrija, el script sobra
y se vuelve a la llamada directa.

## 25/08/2026 — El apaño de la empresa activa vive en el cliente HTTP

**Contexto:** el backend pierde la empresa activa cada vez que renueva el
token, así que la contabilidad empieza a responder 409 tras cinco minutos de
inactividad.
**Decisión:** guardar el id de la empresa en `localStorage` y, ante un 409 en
una ruta de contabilidad, reconmutar y reintentar la petición una sola vez.
Todo dentro de `src/api/cliente.ts`.
**Alternativas descartadas:** manejarlo en cada pantalla, que lo repartiría por
todo el proyecto y sería imposible de quitar después.
**Quién decidió:** usuario, siguiendo lo que ya recomendaba la guía de la API.
**Reversible:** sí, y es lo que hay que hacer: se borra de un sitio cuando el
backend arrastre el claim al renovar.

## 25/08/2026 — Se empieza por los maestros, aunque estén bloqueados

**Contexto:** la prioridad del usuario es organizar el plan contable y sus
relaciones con las tablas de gestión. La API no tiene ningún endpoint para eso.
**Decisión:** la primera versión utilizable son los maestros, y antes de
construirla se escribe la especificación de los endpoints que faltan para
pasársela al backend (fase 2). Mientras tanto se hace el armazón (fase 1), que
no depende de ellos.
**Alternativas descartadas:** empezar por los informes de consulta, que están
enteros en la API y se podrían hacer ya, pero no es lo que hace falta primero.
Resolver los maestros leyendo la base de datos desde el frontend queda fuera:
este proyecto no lleva lógica de negocio.
**Quién decidió:** usuario.
**Reversible:** sí. Si el backend no aborda los maestros, se reordena el plan y
se empieza por la fase 4.

## 25/08/2026 — La planificación vive en docs/planificacion

**Contexto:** dónde guardar el plan y el registro de decisiones.
**Decisión:** `docs/planificacion/`. `CLAUDE.md` se queda en la raíz, porque es
lo que se lee en cada sesión.
**Quién decidió:** usuario.
**Reversible:** sí.

## 25/08/2026 — Los maestros dejan de estar bloqueados y el plan se reordena

**Contexto:** el plan se escribió cuando la API no tenía plan contable, terceros
ni ejercicios, y la fase 2 era escribir la especificación de esos endpoints para
el backend. El mismo día el backend los añadió: 53 endpoints, verificados contra
el OpenAPI desplegado.
**Decisión:** se borra la fase de especificación. Las fases quedan: armazón,
plan contable, terceros —y ahí termina la primera versión utilizable—, consulta,
entrada de asientos, contabilizar, fiscal, inmovilizado, ejercicios y cierre, y
accesos.
**Alternativas descartadas:** dejar el plan como estaba y descubrir el desfase a
mitad de camino.
**Quién decidió:** asistente, al comprobar que el OpenAPI ya traía los endpoints.
**Reversible:** sí.

## 25/08/2026 — El buscador de cuenta se filtra en el navegador

**Contexto:** la entrada de asientos necesita buscar cuenta mientras se teclea.
**Decisión:** cargar `/plan/auxiliares` entero al abrir la pantalla y filtrar en
local. Es lo que la propia API recomienda: viene sin paginar a propósito porque
un plan real ronda las pocas centenas de cuentas de apuntes.
**Alternativas descartadas:** una llamada por cada tecla, más lenta y con más
carga para el servidor.
**Quién decidió:** asistente, siguiendo la guía de la API.
**Reversible:** sí, si algún plan resulta ser mucho mayor de lo previsto.

## 25/08/2026 — El proxy de desarrollo retoca la cookie de sesión

**Contexto:** el login respondía 200 pero la siguiente petición daba 401 y la
aplicación volvía al login. La API marca la cookie `Secure` y con su dominio,
porque hacia ella la conexión es HTTPS, y el navegador la descartaba al estar la
aplicación servida por `http://localhost`.
**Decisión:** en el hook `proxyRes` del proxy de Vite se le quitan `Secure` y
`Domain` a las cookies que devuelve la API. Solo afecta al servidor de
desarrollo.
**Alternativas descartadas:** servir el desarrollo por HTTPS con un certificado
propio, que obliga a cada persona del equipo a instalarlo y a mantenerlo.
**Quién decidió:** asistente, tras descartar que fuese un fallo del código.
**Reversible:** sí, y desaparece solo el día que el desarrollo se sirva por
HTTPS desde el mismo dominio.

## 25/08/2026 — El punto de un código de cuenta se expande en el frontend

**Contexto:** en contabilidad se teclea `431.10` para decir `431000010`; el
punto es un comodín que se rellena con ceros hasta el ancho de cuenta de la
empresa. La API no ofrece esa expansión.
**Decisión:** resolverlo en el frontend, en `src/lib/cuenta.ts`, con tests, y
tomando el ancho de `/plan/preferencias` en vez de fijar un 9 en el código.
**Alternativas descartadas:** pedir un endpoint al backend, que obligaría a una
llamada por cada campo de cuenta que se rellena; y fijar el ancho a 9, que
rompería en cualquier empresa con otro ancho.
**Quién decidió:** usuario, indicando la convención.
**Reversible:** sí, está en un solo fichero.

**Nota:** es una comodidad de tecleo, no un cálculo contable, así que no
contradice la regla de no meter lógica de negocio en el frontend. Quien valida
si la cuenta existe y si el código es correcto sigue siendo la API.

## 25/08/2026 — La configuración contable se pide una vez, en el armazón

**Contexto:** el backend añadió `/configuracion/obtener`, que trae el ancho de
cuenta, el plan vigente, los diarios y lo que falta por configurar. La pantalla
del plan pedía el ancho por su cuenta a `/plan/preferencias`, una vez por visita.
**Decisión:** pedirla una sola vez al entrar y al conmutar de empresa, guardarla
en el estado del armazón y pasar el ancho como propiedad a las pantallas. Se
retira `/plan/preferencias` del cliente por quedar sin uso.
**Alternativas descartadas:** que cada pantalla pida lo suyo, que multiplica
llamadas y deja el ancho pudiendo diferir entre dos pantallas abiertas.
**Quién decidió:** usuario, sobre la recomendación del apartado 14.1 de la guía.
**Reversible:** sí.

## 25/08/2026 — Los datos del obligado se leen con cuidado, no se dan por buenos

**Contexto:** la pantalla de activar contabilidad necesita listar las empresas,
y eso está en `/obligados/listar`, de otro módulo. Su respuesta viene sin tipar
en el OpenAPI: `registros: object[]`.
**Decisión:** leer cada fila con comprobaciones de tipo en vez de declarar una
forma inventada. `id` y `NombreRazon` están confirmados porque aparecen como
filtros del propio endpoint; `NIF` no, así que si no viene se muestra vacío. Si
el listado falla entero, la pantalla ofrece escribir el número a mano.
**Alternativas descartadas:** declarar una interfaz con los campos supuestos, que
rompería en cuanto uno no se llamase así.
**Quién decidió:** asistente. Lo suyo es que el backend tipe esa respuesta.
**Reversible:** sí, y conviene: cuando `/obligados/listar` esté tipado, se
regeneran los tipos y se borra la lectura defensiva.

## 25/08/2026 — Se retira el apaño del 409, ya arreglado en el backend

**Contexto:** el backend perdía el claim `conta_id_obligado` al renovar el token,
así que la contabilidad empezaba a responder 409 tras cinco minutos de
inactividad. El frontend lo tapaba guardando la empresa en `localStorage` y
reconmutando ante un 409.
**Decisión:** borrado. La renovación parte ahora del token viejo y conserva la
empresa activa. `src/api/empresaActiva.ts` desaparece y el cliente HTTP se queda
sin reintentos, como manda la regla del proyecto.
**Alternativas descartadas:** dejarlo «por si acaso», que es como los apaños se
vuelven permanentes y esconden la próxima regresión.
**Quién decidió:** asistente, sobre el apartado 17 de la guía.
**Reversible:** sí, está en el historial. Si vuelven los 409 espontáneos es una
regresión del backend y hay que avisar allí, no volver a parchear aquí.

## 25/08/2026 — El mantenimiento del plan vive en la misma pantalla, en un menú por fila

**Contexto:** la fase 2 pedía crear cuentas de estructura, renombrar, cambiar el
carácter, ocultar, retirar y borrar. Son seis operaciones de nivel `cierre` sobre
una cuenta que el usuario ya tiene delante en el listado.
**Decisión:** un menú de acciones en cada fila, montado solo con nivel `cierre`
(la columna entera no existe para los demás, no se pinta apagada), y el campo
`origen` decide qué entradas salen: una cuenta común se renombra u oculta, una
propia se retira o se borra. Crear cuenta de estructura es un botón de cabecera,
separado de «Nueva subcuenta», que sigue siendo de nivel `apuntes`.
**Alternativas descartadas:** una pantalla aparte de mantenimiento, que obligaría
a buscar la cuenta dos veces; y enseñar todas las acciones dejando que la API
conteste 400, que convierte el mensaje del backend en la única guía.
**Quién decidió:** asistente, sobre el apartado 10 de la guía.
**Reversible:** sí.

**Nota:** antes de confirmar ocultar, retirar o borrar se pide `/plan/obtener`
para enseñar cuántos apuntes y cuántas subcuentas tiene. Es información, no
validación: quien decide si la operación se puede hacer sigue siendo la API.

## 25/08/2026 — Deshacer un ocultar o un retirar necesita un cambio en la API

**Contexto:** `/plan/visibilidad` y `/plan/estado` sirven para las dos
direcciones, pero `CuentaPlan` no dice si una cuenta está oculta o retirada y
`/plan/listar` no tiene un filtro para incluirlas. Una cuenta apartada
desaparece del listado.
**Decisión:** implementar solo el sentido de apartar, dejar las funciones del
cliente listas para el sentido contrario y anotarlo como pendiente de backend.
No se inventa una pantalla de «apartadas» que no se puede alimentar.
**Alternativas descartadas:** deducir el estado por ausencia, comparando dos
listados, que es lógica de negocio en el frontend y además frágil.
**Quién decidió:** asistente. Hay que pedir al backend el estado en `CuentaPlan`
y un «incluir apartadas» en `/plan/listar`.
**Reversible:** sí, es añadir la acción cuando el dato llegue.

## 25/08/2026 — Un solo aspecto para todas las rejillas

**Contexto:** la tabla del plan se fue ajustando a mano hasta quedar cómoda:
densidad `xs`, cabecera fija con scroll solo en las filas, y el ancho repartido
dando el sobrante al título en vez de dejar columnas anchas medio vacías.
**Decisión:** eso deja de ser de la pantalla del plan y pasa a ser del programa.
Las opciones comunes viven en `src/components/tabla.ts` y toda rejilla nueva
parte de ahí; los anchos se declaran por columna, con `grow: false` en las
cortas y `grow: true` en la única de texto largo.
**Alternativas descartadas:** repetir la configuración en cada pantalla, que es
como dos listados del mismo programa acaban con dos aspectos distintos.
**Quién decidió:** usuario, sobre el resultado en la pantalla del plan.
**Reversible:** sí, es un fichero.

**Nota sobre la altura de fila:** va apretada a propósito —densidad `xs` y 4px
de relleno vertical—, que es lo que se espera de un programa contable. La
condición es encoger a la vez lo que va dentro de la fila: `ActionIcon
size="sm"` y `Badge size="xs"`. Bajando el relleno a 2px sin tocar los
controles, la celda recorta el botón de acciones y desaparece de la pantalla.

## 25/08/2026 — El alta de cuenta se teclea entera y la pantalla enseña dónde encaja

**Contexto:** había dos botones, «Nueva cuenta» y «Nueva subcuenta», que salían
de que la API tiene dos endpoints con permisos distintos. En pantalla no se
entendía la diferencia, y el alta de subcuenta pedía «cuenta de la que cuelga»,
que es una forma de preguntar que no usa ningún contable.
**Decisión:** dos formularios, pero contados por lo que hace el usuario, no por
el endpoint. En los dos se teclea el número entero en una sola casilla y debajo
va apareciendo el grupo, el subgrupo y la cuenta de mayor de los que colgará,
con sus títulos, para ver dónde queda antes de crearla. El de grupos, subgrupos
y cuentas de mayor no admite más de cuatro dígitos ni otra cosa que dígitos.
**Alternativas descartadas:** un único formulario con un desplegable de tipo,
que obliga a decidir algo que el propio número ya dice.
**Quién decidió:** usuario.
**Reversible:** sí.

**Nota:** `/plan/crear_subcuenta` exige `raiz`, y ya no se pregunta. Se manda la
cuenta existente más honda de la que cuelga el código tecleado, que es la que
la pantalla acaba de enseñar. No es una validación: quien comprueba que el
código encaja bajo esa raíz sigue siendo la API. Los escalones se leen con
`/plan/obtener` uno por uno, y un 404 se pinta como «no existe todavía», no
como un fallo.

## 25/08/2026 — El plan entero se trae de fondo y vive en memoria

**Contexto:** al teclear un número de cuenta, la pantalla enseña de qué grupo,
subgrupo y cuenta de mayor cuelga. Eso se resolvía con una llamada por escalón
y una espera de 300 ms por tecleo: correcto, pero se nota.
**Decisión:** al entrar en la empresa se trae el plan completo de fondo
(`/plan/listar` paginado de 2000 en 2000) y se guarda en memoria, en
`src/components/PlanEnMemoria.tsx`. Los escalones salen de ahí, al instante y
sin llamadas. Se vuelve a traer al cambiar de ejercicio y después de cada alta,
cambio o borrado; al conmutar de empresa el armazón se remonta entero.
Si la precarga falla, se sigue preguntando al servidor cuenta a cuenta, así que
la pantalla nunca se queda sin saber dónde encaja el código.
**Alternativas descartadas:** cachear solo lo ya consultado, que deja la primera
vez de cada cuenta igual de lenta.
**Quién decidió:** usuario: la agilidad es premisa del programa.
**Reversible:** sí.

**Nota sobre el tamaño:** una cuenta son código y título, unos 60 bytes. Un plan
real ronda las pocas centenas de cuentas y 5000 no llegan a 300 KB. El listado
de la pantalla se sigue pidiendo paginado al servidor: quien decide qué casa con
una búsqueda es la API, no el navegador.

## 25/08/2026 — La revisión del cuadre se hace de fondo y avisa sin interrumpir

**Contexto:** la revisión con gestión (`/sincronizacion/revisar`) solo lee, pero
hacerla cada poco sería ruido, y no hacerla nunca deja al contable descubriendo
el problema al contabilizar.
**Decisión:** se lanza una vez al entrar en la empresa, de fondo, y vive en
`src/components/CuadreEnMemoria.tsx`. Si todo cuadra, el usuario no se entera de
nada; si no, el menú enseña un número junto a «Enlace con gestión». Se rehace al
conmutar de empresa, al pulsar «Volver a revisar» y después de crear las cuentas
que faltaban. Sin temporizadores.
**Alternativas descartadas:** un aviso modal al entrar, que interrumpe para algo
que casi nunca es urgente; y revisar cada pocos minutos, que es tráfico
constante para un dato que cambia poco.
**Quién decidió:** usuario, que además recordó que el traspaso crea solas las
cuentas que falten, así que esto es información, no un bloqueo.
**Reversible:** sí.

**Pendiente de backend:** una huella barata para saber si algo cambió sin volver
a pedir la revisión entera. Bastaría un `COUNT(*)` más un `MAX(fecha)` de los
maestros implicados, devuelto como un sello que el cliente compara. Si se hace
genérico —un sello por plan contable, maestros de gestión y terceros— sirve
también para refrescar el plan que el frontend guarda en memoria.

## 25/08/2026 — Nada de rellenar cuentas de series y proveedores en bloque

**Contexto:** la API ofrece `proponer_cuentas_series` y
`proponer_cuentas_proveedores`, que ponen una cuenta a todas las series o a
todos los proveedores que no la tengan. Se implementaron con simulación previa y
confirmación expresa.
**Decisión:** retirados. Qué cuenta de ingresos lleva cada serie y qué cuenta de
gasto lleva cada proveedor es criterio del contable, y aplicar un mismo número a
todos deja el plan lleno de imputaciones que no dicen nada. Lo que hace falta es
una pantalla que liste series y proveedores y deje rellenar el que falte, uno a
uno.
**Alternativas descartadas:** dejar la operación masiva «para salir del paso»,
que es exactamente el atajo que ensucia el plan y luego nadie revisa.
**Quién decidió:** usuario, que es quien conoce el oficio.
**Reversible:** sí, está en el historial, pero no procede.

**Bloqueado:** hace falta pedir al backend el listado y el endpoint para fijar la
cuenta de una serie y de un proveedor concretos. Anotado en `pendientes.md`.

## 26/08/2026 — El enlace con gestión pasa de informar a dejar trabajar

**Contexto:** el backend añadió `/cuentas_maestros`, que es justo lo que faltaba:
listar las fichas de cada maestro de facturación con su cuenta contable, filtrar
las que la tienen sin poner y escribirla ficha a ficha, comprobando que la cuenta
exista en el plan y admita apuntes.
**Decisión:** la sección deja de ser una lista de avisos y pasa a ser la pantalla
de trabajo: se elige el maestro, se buscan las fichas, y se cambia la cuenta de
la que haga falta. La lista de maestros y sus campos la manda el servidor, así
que un maestro nuevo aparece solo. El resumen de lo que falta en el plan queda
en una línea, con su botón de dar de alta al lado.
**Alternativas descartadas:** mantener las dos pantallas, la de revisión y la de
trabajo, que obliga a ir y venir para lo mismo.
**Quién decidió:** usuario.
**Reversible:** sí.

**Nota:** de cada cuenta se enseñan tres cosas juntas —la escrita, la que se
heredaría si estuviera vacía y si existe en el plan—, porque un código tecleado
que no está dado de alta parece una cuenta y no lo es. Al guardar se ofrece
darla de alta de camino; si se desmarca, la API para y lo dice.

## 26/08/2026 — «Maestro» en las pantallas, «familia» solo hacia la API

**Contexto:** `/cuentas_maestros` llama `familia` al identificador de cada
maestro de facturación (`emisores`, `receptores`, `series`…). Trasladado tal cual
al código y a la conversación, se confunde con las familias de artículos de
gestión, que son otra cosa y también aparecen en este programa.
**Decisión:** `familia` se queda encerrada en `src/api/`, que es donde se arma el
cuerpo de la petición y se leen las respuestas. De ahí hacia dentro —props,
variables, comentarios y cualquier texto de pantalla— se dice maestro. El
identificador, cuando hace falta pasarlo, es `idMaestro`.
**Alternativas descartadas:** renombrarlo también en la capa de datos, que
obligaría a traducir de ida y vuelta en cada llamada para no ganar nada.
**Quién decidió:** usuario.
**Reversible:** sí.

**Nota:** en pantalla el término no llegaba a salir nunca. El desplegable pone
«Fichas de» y las opciones son Proveedores, Clientes, Series de venta…, tal como
las titula el servidor.

## 26/08/2026 — La cuenta que se propone la compone el servidor

**Contexto:** al asignar la cuenta de una ficha, el formulario salía en blanco y
había que teclear el número entero. Componerlo —raíz más el código de la ficha, o
más su id— es criterio contable, así que se pidió al backend en vez de resolverlo
aquí.
**Decisión:** el backend añadió `/cuentas_maestros/sugerir`, que dice qué cuenta
le tocaría a una ficha **sin escribir nada**. Se llama al abrir el diálogo y lo
que devuelve en `sugerencia` se pasa tal cual a `/fijar`. Aquí no se compone
ningún número de cuenta, ni se rellena con ceros, ni se adivina una raíz.
**Alternativas descartadas:** montar el número en el frontend a partir del código
del cliente, que es la regla 1 al revés; y `/terceros/resolver`, que sí devuelve
la cuenta de un cliente pero la crea al vuelo y va por el id de gestión.
**Quién decidió:** usuario, y el backend lo resolvió el mismo día.
**Reversible:** sí.

**Lo que hay que respetar al usarlo:** `origen` dice de dónde sale el número y se
enseña, porque una cuenta propuesta que el contable no entiende no la va a
aceptar. `ocupada_por` avisa de que ese número ya lo usa otra ficha del mismo
maestro, y `existe_en_el_plan` de que habrá que marcar `crear_en_plan`. Cuando no
hay criterio, la sugerencia viene vacía y `motivo` explica por qué: se muestra el
motivo y se deja la casilla en blanco. **Donde el servidor no inventa un número,
aquí tampoco.**

## 26/08/2026 — Proveedores y acreedores se separan, y la cascada la lleva el servidor

**Contexto:** el backend atendió lo que se le pidió por la mañana y de paso
partió en dos el maestro de emisores: proveedor de bienes bajo la raíz 400 y
acreedor por prestación de servicios bajo la 410, con una columna nueva
`tipo_tercero` en la ficha y una raíz nueva `cuentasapagar_acreedores` en la
configuración. Además, `emisores` gana una casilla, `cuenta`, la del propio
tercero.
**Decisión:** aquí no se toca nada. La lista de casillas de cada maestro la manda
`/cuentas_maestros/familias`, así que la casilla nueva sale sola; `tipo_tercero`
ya viaja dentro de `detalle` y se ve en el listado; y la raíz nueva aparecerá en
`cuentas_sin_poner` cuando falte, que es lo que la pantalla de avisos pinta.
Solo hubo que regenerar los tipos.
**Alternativas descartadas:** escribir en el frontend qué campos tiene cada
maestro, que es lo que hace que una columna nueva del backend obligue a tocar
la interfaz.
**Quién decidió:** el backend, y aquí se comprueba que no arrastra trabajo.
**Reversible:** no aplica.

**Lo que sí condiciona lo que venga:** `tipo_tercero` se mantiene en el maestro
de emisores, **no** en contabilidad; `/cuentas_maestros` solo toca columnas de
cuenta, así que la pantalla del enlace no debe ofrecer cambiarlo. Y la cascada
que propone la cuenta —la de la ficha, si no el código, si no el id— es **lo que
se ofrece en pantalla**, no lo que el motor asigna al contabilizar: eso lo lleva
`/terceros` con `modo_cuenta_cliente` y `modo_cuenta_proveedor`, y mientras la
propuesta no se acepte, las dos pueden no coincidir.

## 26/08/2026 — La cuenta de un tercero se asigna en un solo sitio

**Contexto:** la cuenta de un cliente o un proveedor vivía en dos sitios —la
casilla de su ficha de gestión y la tabla de terceros de contabilidad, que es la
que lee el motor— y `/cuentas_maestros/fijar` solo escribía la primera. El motor
acababa componiendo otro número al contabilizar la primera factura. Se pidió al
backend y se resolvió el mismo día (`42690d5..d9a09b6`).
**Decisión:** cuando la casilla es la del propio tercero —`cliente` en
`receptores`, `cuenta` en `emisores`— `fijar` escribe la ficha y crea la
equivalencia en la misma transacción, y lo dice en `enlazado_en_terceros`. Si el
enlace no se puede, no se escribe nada y sale un 400 con su texto. `fijar_varias`
sigue la misma regla.
**Alternativas descartadas:** sacar esas dos casillas de «Enlace con gestión» y
llevarlas a una pantalla de terceros propia. Habría dejado la pantalla limpia
pero obligando al contable a conocer los dos sitios, que era justo el problema.
**Quién decidió:** usuario, y el backend lo implementó.
**Reversible:** no procede.

**Lo que hay que respetar en la pantalla:**

- **Vaciar la casilla NO deshace el enlace.** La cuenta puede tener apuntes y
  borrar la equivalencia los dejaría sin dueño. Desenlazar sigue siendo cosa de
  la pantalla de terceros. El texto «Vaciar una casilla elimina la cuenta
  asignada» del diálogo ya no cuenta toda la verdad para estas dos casillas.
- **No hace falta advertir de que la propuesta puede no coincidir** con lo que
  asigne el motor. Ya no puede pasar: el motor mira primero si el tercero tiene
  subcuenta y, si la tiene, la usa.
- `modo_cuenta_cliente` y `modo_cuenta_proveedor` gobiernan **solo** lo que se
  crea solo al contabilizar, para los terceros que nadie ha asignado. El modo
  `manual` deja de ser incómodo, porque el enlace ya se hace desde esta pantalla.
- En modo `codigo`, una cuenta asignada a mano manda sobre la que compondría el
  código. Es lo correcto, pero para ese tercero se rompe la idea de que el
  número de cuenta y el de la ficha dicen lo mismo. Si alguna pantalla promete
  esa correspondencia, tiene que contemplar la excepción.


## 26/08/2026 — Terceros no es una pantalla: es una pestaña del enlace

**Contexto:** recién hecha la pantalla de terceros se vio que su mitad de
trabajo era la misma que ya hacía «Enlace con gestión»: los mismos clientes y
proveedores sin cuenta, y un `Enlazar…` peor que el `Asignar…` de allí, porque
`/terceros/enlazar` exige que la cuenta exista, no propone número y **no
escribe la casilla de la ficha**, que es volver a dejar el dato en dos sitios.
**Decisión:** «Terceros» desaparece del menú. Su listado —qué subcuenta tiene
cada cliente y cada proveedor, buscando por número de cuenta, con la razón y el
NIF del momento del alta— pasa a ser la pestaña «Terceros contables» de
«Enlace con gestión». Se borran la pestaña de los que no tienen cuenta, el
botón y su diálogo. Enlazar se hace en un solo sitio.
**Alternativas descartadas:** dejar las dos pantallas y explicar la diferencia,
que es pedirle al contable que sepa cuál de los dos caminos escribe las dos
cosas.
**Quién decidió:** usuario, que lo vio antes de que se notara en el uso.
**Reversible:** sí.

**Nota:** de `/terceros` solo se usa `listar`. `enlazar` y `sin_enlazar` quedan
sin usar y así está anotado en `src/api/terceros.ts`, para que no se vuelvan a
montar sin querer; `resolver` es de la entrada de asientos.

## 26/08/2026 — El enlace con gestión se abre desde el plan contable

**Contexto:** el plan es donde se pasa el rato, y el enlace con gestión es lo
que se consulta mientras se está en él. Tenerlo en otra sección del menú obliga
a salir y volver.
**Decisión:** el plan gana un botón `Enlace con gestión…` que abre esa pantalla
entera en un modal ancho, con sus pestañas dentro. La sección sale del menú
lateral, y con ella el contador de cuentas que faltaban, que pasa al propio
botón. Al cerrar el modal se recarga el plan, porque desde dentro se pueden
haber dado de alta cuentas.
**Alternativas descartadas:** una acción por fila que abriera solo la ficha del
tercero de esa subcuenta, que es más fina pero deja fuera el resto de maestros
—series, tipos de IVA, medios de pago— que no cuelgan de ninguna cuenta de
tercero.
**Quién decidió:** usuario, avisado de que quedan dos modales encajados:
`Asignar…` abre otro diálogo encima del grande.
**Reversible:** sí; la pantalla sigue siendo un componente suelto y volver a
darle sección es una línea en `secciones.ts`.

## 26/08/2026 — La pantalla de terceros consulta y enlaza, y no deshace

**Contexto:** la equivalencia entre subcuenta y cliente o proveedor solo se
podía mirar entrando en la base de datos. La API tiene cinco endpoints —
`listar`, `obtener`, `sin_enlazar`, `resolver` y `enlazar`— y ninguno más.
**Decisión:** dos pestañas. «Con subcuenta» lista los terceros que ya la
tienen, con filtro por clase y buscador por cuenta, razón social o NIF. «Sin
subcuenta» lista los de gestión que aún no la tienen y ofrece `Enlazar…` fila a
fila, solo con nivel `cierre`. El diálogo pide una subcuenta que ya exista y
enseña su título del plan que está en memoria, para saber si es la que se
quería antes de atarla; si no la encuentra lo dice, pero no impide enviar:
quien decide si la cuenta vale es la API.
**Alternativas descartadas:** volver a ofrecer aquí la asignación de la cuenta
de un tercero, que es lo que ya hace «Enlace con gestión» escribiendo la ficha
y la equivalencia a la vez; partir el camino en dos otra vez era el problema
que se cerró esta misma mañana.
**Quién decidió:** usuario, que dejó el criterio a este lado.
**Reversible:** sí.

**Sustituida el mismo día** por las dos entradas de arriba: la pantalla quedó
en una pestaña y el enlace a mano se retiró. Lo que sigue valiendo de aquí:

- **No hay desenlazar, y por eso no hay botón.** La entrada del 26/08 sobre la
  cuenta de un tercero decía que desenlazar era cosa de esta pantalla; con los
  endpoints de hoy no se puede. Anotado en `pendientes.md`.
- Por lo mismo, `Enlazar…` solo sale en la pestaña de los que no tienen cuenta:
  `enlazar` se niega con 400 si el tercero ya está enlazado, así que ofrecerlo
  en la otra pestaña sería ofrecer un error.
- **`/terceros/resolver` no se usa aquí.** Devuelve la cuenta de un tercero,
  pero la crea si no existe: no vale para mirar. Es de la entrada de asientos.
- El listado no lleva ejercicio, porque los terceros no son de un ejercicio.
  El plan que se consulta para enseñar el título de la cuenta sí lo es.

## 26/08/2026 — Los títulos de las cuentas de configuración los escribe el backend

**Contexto:** los avisos de configuración pintaban el nombre de la columna,
así que al contable le salía «cuentasapagar_acreedores». La salida rápida era
un diccionario de nombres en el frontend, que obliga a tocar la interfaz cada
vez que el backend añade una cuenta: la gallina otra vez.
**Decisión:** se pidió al backend y lo resolvió el mismo día. `avisos[]` gana
`titulo`, y `cuentas_sin_poner` **deja de ser una lista de cadenas** y pasa a
tener la misma forma —`campo`, `titulo`, `aviso`—, así que las obligatorias
también dicen qué se rompe sin cada una. Aquí solo hubo que regenerar los tipos
y pintar `titulo` en vez de `campo`.
**Alternativas descartadas:** el diccionario en el frontend; y una lista
hermana de títulos en vez de romper `cuentas_sin_poner`, que el backend
descartó porque dos listas en paralelo acaban divergiendo.
**Quién decidió:** usuario, que vio el problema en pantalla; el backend eligió
cómo romperlo.
**Reversible:** no procede.

**Lo que hay que respetar:** `campo` es el nombre de la columna y solo vale
para mandarlo a `/configuracion/fijar_cuentas`. **Lo que se enseña es
`titulo`.** El texto sale de donde se declara la cuenta, no del OpenAPI, y hay
pruebas en el backend que fallan si alguien añade una cuenta configurable sin
título o sin decir qué se rompe sin ella.

## 26/08/2026 — El menú habla como el contable: «Diario» y «Traspasos»

**Contexto:** las secciones se llamaban por el endpoint que hay detrás —
«Asientos» y «Contabilizar»— y no por lo que el contable hace en ellas.
**Decisión:** en el menú ponen «Diario» y «Traspasos». Los identificadores
internos (`asientos`, `contabilizar`) no se tocan: son los nombres de las rutas
de la API. La posición en el menú se queda como estaba.
**Quién decidió:** usuario.
**Reversible:** sí, es una línea en `secciones.ts`.

**Lo que hay que respetar al montarlas:** el Diario es **la ventana principal
de la contabilidad**, no una pantalla más: es donde se gestionan los diarios,
se apunta y se corrige. El libro diario de imprimir es otra cosa y vive en
Informes (`/informes/diario`), con sus totales de periodo. Traspasos es pasar a
asientos las facturas de gestión, más los reintentos y las anulaciones.

## 26/08/2026 — Un asiento confirmado no se toca, y el manual pasa por borrador

**Contexto:** al montar el editor de asientos se pidió al backend lo que
faltaba: borrador con confirmación, y mantenimiento de diarios con los tres
reservados —apertura, cierre y regularización— fuera del alcance del usuario.
Lo entregó el mismo día, en diez endpoints.
**Decisión:** un asiento manual se teclea siempre como borrador y solo entra en
el libro al confirmarlo, que es cuando coge número. Y **una vez dentro no se
edita ni se borra**: `/asientos/eliminar` existe en la API y no se usa ni se
ofrece en ninguna pantalla. Lo que ya entró se arregla con un asiento nuevo.
**Alternativas descartadas:** ofrecer borrar y rehacer, que es lo que la API
permite y lo que este proyecto daba por bueno hasta hoy.
**Quién decidió:** usuario, que lleva cuarenta años llevando libros.
**Reversible:** no procede.

**Lo que hay que respetar en la pantalla:**

- `Confirmar…` va **discreto y apartado** del botón que se pulsa a diario, y
  pregunta antes: es la única acción del editor sin vuelta atrás. El botón
  principal es `Guardar borrador`.
- El botón se apaga mientras la diferencia entre debe y haber no sea cero. El
  cuadre se suma en pantalla con decimal.js —es la excepción de la regla 1— y
  **es solo un aviso**: quien decide si un asiento cuadra es el servidor al
  confirmarlo, que llama a la misma función que el motor de facturas.
- Guardar un borrador **no valida nada de fondo**, a propósito: se puede
  guardar descuadrado, sin fecha o con cuentas que no existen. La pantalla no
  debe impedirlo.
- Un borrador **no tiene número de asiento**. En su sitio va «Sin número hasta
  confirmarlo», porque el correlativo del diario no admite huecos.
- Los diarios reservados se reconocen por `reservado`, **nunca por el nombre**.
  Para el desplegable de un asiento manual se pide `incluir_reservados: false`.

**Pendiente de decidir:** si un asiento confirmado sale mal, hoy se arregla
metiendo el contraasiento a mano. Falta decidir si la aplicación lo genera.

## 27/08/2026 — Quién ha entrado se pregunta a `/contabilidad/sesion/me`

`GET /usuarios/me` no declara su respuesta en el OpenAPI, así que `Usuario`
estaba escrito a mano desde la guía. El backend no lo toca a propósito: en
cuanto se le declara la respuesta, FastAPI deja de enviar en silencio cualquier
campo que se olvide, y ese endpoint lo llama toda la aplicación al arrancar, no
solo contabilidad.

En su lugar hay `POST /contabilidad/sesion/me` (cuerpo `{}`, sin exigir nivel),
que devuelve lo mismo envuelto igual en `{"user": {…}}` y con el esquema
declarado. Los datos salen de la misma función, no de una copia.

Consecuencias en este repositorio:

- `Usuario` es `components['schemas']['ModeloUsuarioSesion']`, generado.
- Casi todos sus campos son opcionales de verdad: dependen del rol. Solo
  `id_rol` viene siempre, y por eso `puedeActivarContabilidad` comprueba que no
  sea nulo antes de mirarlo.
- Trae también `conta_id_obligado`, la empresa de contabilidad activa.
- **No devuelve `api_key`**, que aquí no se usaba.
- Ya no queda ninguna llamada GET: `pedirGet` se ha eliminado de
  `src/api/cliente.ts` porque `/usuarios/me` era su único uso. Todo es POST.

## 27/08/2026 — Cuentas apartadas del plan: cómo se muestran y se recuperan

`/plan/listar` acepta `incluir_apartadas` y `CuentaPlan` trae `oculta` y
`estado`, los dos enteros: `oculta` 1 escondida / 0 visible, `estado` 1 activa /
0 retirada.

- **Se decide por `oculta` y `estado`, nunca por `origen`.** Ocultar una cuenta
  del PGC crea por dentro una fila propia de la empresa que tapa a la común, así
  que llega con `origen: "propia"` y `oculta: 1`. Mirando `origen` se le
  ofrecería «Reactivar», que es la acción de la otra mitad.
- La casilla «Ver también las ocultas» solo se ofrece con nivel `cierre`, que
  es el que puede apartarlas y recuperarlas.
- Sobre una cuenta apartada el menú **solo** ofrece recuperarla. Renombrarla,
  volver a apartarla o borrarla no tienen sentido mientras esté fuera.
- Los dos diálogos de recuperar no piden el detalle: `/plan/obtener` da 404
  mientras la cuenta está apartada. El recuento de apuntes y subcuentas sigue
  saliendo en ocultar, retirar y borrar, que es donde explica la negativa.
- La copia del plan en memoria se sigue pidiendo **sin** las apartadas: de ahí
  salen los escalones que se ofrecen al teclear una cuenta, y una cuenta
  apartada no se ofrece.

## 27/08/2026 — El diario enseña los borradores, y sus sumas

Un asiento en borrador no se esconde del diario: sale como uno más, marcado, y
el contable elige con «Mostrar» si quiere ver todas, solo borradores o solo
confirmadas. Lo resolvió el backend en `/asientos/listar` con `incluir`, que es
lo que evita mezclar dos listados con paginaciones distintas aquí.

- **La clave de fila es `clave`, no `pase`.** Un borrador no tiene `pase` ni
  número de asiento hasta que se confirma.
- En «Asiento» y en «Pase», un borrador enseña un guion. **Nunca el
  `id_borrador`:** se leería como un número de asiento y no lo es.
- La fila de borrador va con fondo distinto, además de la marca en «Estado».
- Un borrador **sin fecha** queda fuera si se filtra por fechas: el servidor no
  sabe dónde cae. Se ven pidiendo solo borradores sin filtro de fechas.
- Con «Todas», `offset + limit` no puede pasar de 20.000; pasarse da un 400 que
  explica que hay que afinar el filtro, y se muestra tal cual.

Del pie de sumas, lo que condiciona el código:

- La suma de la página se hace aquí (`sumarPagina`, con test): es el total de
  una columna a la vista, la excepción de la regla 1.
- La de la consulta y la del ejercicio las da `/asientos/totales`, **con el
  mismo `incluir` que el listado**. Con uno distinto, las cifras del pie no
  cuadran con lo que el contable tiene delante.
- Se piden **en segundo plano**, en su propio efecto: no dependen de la página y
  tardan más, así que no hacen esperar al listado. Mientras tanto el pie dice
  «Calculando…».
- Si no se pide ejercicio, ese alcance llega nulo y el bloque dice «No aplica».

## 27/08/2026 — El importador se adelanta, y `/importador/subir` no es JSON

La fase del importador se sube al principio el mismo día que se planifica: sin
datos no se puede probar nada, y meterlos a mano no es una opción. Se estrena
con el plan, porque sin cuentas no se pueden meter apuntes.

- **`/importador/subir` es la única llamada de la API que no lleva cuerpo
  JSON**: es `multipart/form-data`, porque viaja un archivo. `enviarFormulario`
  en `src/api/cliente.ts` es su único uso. **La cabecera del tipo la pone el
  navegador**: si se pone a mano falta la frontera entre las partes y el
  servidor no puede leer el archivo.
- `mapeo` y `opciones` llegan como objetos libres. Se pasan a texto en un único
  punto (`src/api/importador.ts`) en vez de repartir comprobaciones de tipo por
  los componentes.
- Una opción vacía **no se manda**: significa «detéctalo tú», no «déjalo en
  blanco». El separador y la codificación los detecta el servidor.
- La lista de campos de cada destino la da el servidor, así que el editor del
  modelo no lleva ningún campo escrito a mano y no hay que tocarlo si el backend
  añade uno.
- **El emparejamiento vive en el modelo, no en la importación.** Se intentó al
  revés —emparejar columnas en cada importación— y el usuario lo rechazó el
  mismo día: lo que quiere es definir el modelo una vez y luego elegir modelo,
  elegir archivo y adelante. El destino de un modelo **no se puede cambiar**
  una vez creado, porque la API no lo admite al editar.
- El emparejamiento admite **el número de columna** además del nombre, contando
  desde 1 (pedido y añadido el 27/08/2026). El servidor **busca primero por
  nombre** y solo interpreta el número si ninguna columna se llama así. Para
  pintar el desplegable se usa `mapeo_columnas`, que trae los números ya
  traducidos a nombres; `mapeo` es lo que se mandó tal cual.
- **`filas_a_saltar` y `sin_cabecera` no son lo mismo:** la primera tira filas
  del principio (membretes) y la cabecera se busca después; la segunda dice que
  el archivo no titula sus columnas, que pasan a llamarse `columna_1`,
  `columna_2`… Se pueden usar a la vez. Las dos se mandan siempre, porque su
  valor por defecto es una decisión, no una ausencia.
- Mapear una columna que el archivo no trae ya no pasa desapercibido: sale en
  `avisos` al subir y da 400 al ensayar.
- **El ensayo no se puede saltar**: el botón de importar está apagado hasta que
  hay informe. Y una importación solo se hace una vez, así que también se apaga
  después.
- El nivel depende del destino: el plan pide `cierre` y los otros dos,
  `apuntes`. La sección del menú se enseña desde `apuntes`.

## Un apunte confirmado no se modifica, y el motivo es la norma (27/08/2026)

Se planteó poner un botón de editar en el diario. Al mirar qué permite la **ley
antifraude** (Ley 11/2021, artículo 29.2.j de la LGT) la respuesta fue que el
programa tiene que garantizar la inalterabilidad de los registros, y que lo
perseguido es justo el software que deja cambiar asientos o borrar movimientos;
la sanción es de 50.000 € por ejercicio. El **Código de Comercio** (artículo 29)
dice además que un error se salva con un asiento nuevo, no corrigiendo el
anterior.

- **No hay botón de editar ni de borrar sobre una fila confirmada**, y no se
  añade aunque la API lo permita. Un borrador sí se rehace entero: todavía no es
  un registro del libro.
- Se pidió al backend en `[1.5]` que lo niegue también él: una regla que solo
  vive en la pantalla no es una regla. Afecta a `/asientos/editar_texto` y a
  `/asientos/eliminar` sobre apuntes contabilizados.
- Queda **pendiente de confirmar con el asesor** si corregir solo el concepto y
  el documento de un apunte confirmado, dejando rastro, es admisible; y si la
  renumeración previa al cierre plantea algún problema. Hasta que conteste, no
  se ofrece ninguna de las dos cosas.

## El diario no se pagina, y las sumas son de lo seleccionado (27/08/2026)

- **Fuera la paginación.** Un asiento tiene varias líneas y la paginación lo
  partía entre dos páginas, que es lo único que no se puede hacer con un
  asiento. Se piden todos los apuntes del filtro, por tandas de 500 —el tope de
  la API—, enseñando lo que va llegando y diciendo cuánto falta. Las filas se
  virtualizan.
- **La primera fila del pie ya no es la página, sino lo seleccionado.** Cada
  fila lleva casilla y el pie suma lo marcado, que es lo que se pide de verdad:
  cuadrar un grupo de apuntes a mano. Sigue siendo la excepción de la regla 1
  —total de una columna a la vista, con decimal.js—; la consulta y el ejercicio
  los da el servidor.
- La selección se quita al cambiar el filtro: sumar filas que ya no se ven daría
  un total que no corresponde con nada de la pantalla.

## El diario se abre por un día, no por el ejercicio entero (28/08/2026)

Sin filtro puesto, el diario enseña un solo día:

- Si el ejercicio elegido es el del año en curso, el día de hoy.
- Si no lo es, su **último día**, que sale del campo `cierre` de
  `/ejercicios/listar`. No se compone un 31 de diciembre a mano: hay ejercicios
  que no son el año natural, y ese campo ya dice cuál es el último día.

**Por qué:** abrir por el ejercicio completo trae miles de apuntes que nadie
está mirando, y el listado no se pagina (ver «El diario no se pagina»). Un día
concreto es lo que se consulta al entrar, y el resto se pide con el filtro.

Al lado del filtro hay una casilla de día suelta: elegir una fecha ahí sustituye
el rango `Desde`/`Hasta` del diálogo, que es lo que se hace veinte veces al día.

## Los once filtros del diario, y por qué van en un diálogo (28/08/2026)

El filtro salió de la pantalla y vive en `DialogoFiltro`: ocupaba una franja
fija de alto que se mira una vez y estorba el resto del rato. Se aplica al
cerrar de cualquier forma —el botón, la equis o Escape—, para que no haya manera
de creer que se ha filtrado y no.

Junto al título hay dos cosas más: la casilla de día, que pisa el rango de
fechas, y una línea que dice qué se está viendo, para no tener que abrir el
diálogo para saberlo.

Pedidos al backend en [1.7] y desplegados el mismo día: `diario`, `concepto`,
`documento`, `asiento_desde`, `asiento_hasta`, `importe_desde` e
`importe_hasta`. `/asientos/listar` y `/asientos/totales` aceptan los mismos, y
por eso la pantalla les manda **el mismo objeto**: si se separasen, el pie de
sumas diría una cifra distinta de lo que se ve.

Detalles que condicionan el código:

- Una clave vacía **no viaja**. Mandarla daría un 422, que es un fallo nuestro.
- Los importes se teclean en español y se mandan como cadena decimal
  (`importeParaApi`). Lo que no se puede interpretar se queda vacío en vez de
  viajar mal.
- `concepto` y `documento` buscan `%` y `_` tal cual: no se escapa nada.
- La suma del **ejercicio entero** de `/asientos/totales` ignora todo el filtro
  salvo `incluir`. Está rotulada como del ejercicio, no del filtro.
- No hay filtro por tercero, y no se pidió: `razon` y `cif` son los del momento
  del alta, así que daría resultados raros.

## El cuadre del traspaso lo exige la API, y se decidió a pesar del backend (28/08/2026)

Traspasar apuntes de un borrador a otro se hace desde el diario: se marcan
filas, se elige destino —uno que ya existe o uno nuevo— y lo mueve
`/asientos/borrador/traspasar`, todo o nada en una sola operación.

**Si lo que se traspasa no cuadra, la API lo rechaza con un 400** y su texto se
enseña tal cual. El backend propuso lo contrario —avisar y dejar seguir,
argumentando que partir un asiento en dos pasa por un momento en que ninguno de
los dos cuadra—; el usuario mantuvo su decisión conociendo ese motivo, y el
backend lo implementó.

Aquí no se suma nada para dejar o no dejar traspasar: sería una regla contable
en el frontend. Lo demás lo decidió el backend: el origen puede quedar
descuadrado o vacío y no se tira, nivel `apuntes`, y mezclar ejercicios se
rechaza.

## Los eliminados guardan el número que tenían, no el de ahora (28/08/2026)

Al renumerar, los asientos del libro cambian de número y los ya borrados
conservan el suyo, así que ese número puede corresponder hoy a otro asiento. Se
decidió no renumerar el archivo, porque falsearía lo que pasó. La columna se
rotula **«Asiento al borrarse»** para que nadie lo lea como el número actual.

## Una mejora de inmovilizado es otra ficha, no un cambio de valor (29/08/2026)

Cuando a un bien se le mete una ampliación o una mejora encima —un motor nuevo
en una furgoneta—, contablemente **suma al valor del bien**: lo que se lleva a
gasto directo es la reparación, que solo lo conserva.

Cómo se guarda **no** es sumar al valor de la ficha, sino **crear otra ficha en
`mcon_inmovilizado`, marcada como mejora y encadenada a la del bien, que se
amortiza por su cuenta**: con su valor, su porcentaje y su fecha de entrada en
uso. Pedido al backend en `prompts/historico/3_intercambio.md` [3.8].

Tres motivos, y el primero es el que decidió:

- **No hay que tocar el valor de ningún bien ni recalcular nada hacia atrás.**
  Lo ya dotado se dotó sobre lo que el bien valía entonces y está bien. La
  protección del backend —`valor_adquisicion` no se cambia con amortizaciones
  hechas— se queda puesta, en vez de levantarla, que era la otra salida.
- **La mejora casi nunca dura lo mismo que el bien**, y se instala meses después
  de comprarlo. Con ficha propia cada uno va a su ritmo.
- La dotación del mes no cambia de forma: cada ficha aporta su cuota.

**Lo que se complica, y hay que vigilar: la baja arrastra la cadena.** Vender la
furgoneta tiene que sacar de los libros la furgoneta y sus mejoras, en el mismo
asiento. Si se olvida, quedan trozos amortizándose solos y no lo nota nadie.

En el listado la mejora **no es una fila suelta**: cuelga de su bien, y el bien
enseña el valor con sus mejoras dentro. Si no, el inventario deja de leerse.

Aparte queda **corregir un valor mal tecleado**, que no es lo mismo: ahí lo ya
dotado está mal, no bien, y por eso no puede ser el mismo camino.

## La ficha del bien se enlaza a la factura, no al apunte (29/08/2026)

Se planteó enlazarla al `pase` del apunte del diario. Se eligió la factura del
SIF (`ref_tipo` y `ref_id`) por dos razones: es el justificante, que es lo que
hay que enseñar cuando se pregunta de dónde salió el bien; y es lo estable,
porque un asiento puede salir del libro y el `pase` se queda apuntando a algo
que ya no existe. El `pase` vale como atajo al apunte, no como el vínculo.

Esos dos campos **los rellena el traspaso, no la persona**, así que no van en el
formulario de alta a mano: no hay forma de explicárselos a un contable que está
tecleando un bien.

## Los porcentajes de amortización se proponen, no se imponen (29/08/2026)

La tabla es la del **artículo 12.1.a) de la Ley 27/2014, del Impuesto sobre
Sociedades** (BOE-A-2014-12328). El PGC no trae ninguna tabla: solo dice que se
amortice según la vida útil.

Por eso la tabla **propone** el porcentaje en el alta y **avisa** si se pasa del
máximo, pero no lo impone y no rechaza nada:

- Los coeficientes son un **máximo fiscal**, no una obligación: se puede
  amortizar más despacio.
- **Es una tabla fiscal, no contable.** Contablemente manda la vida útil real
  del bien. Lo normal es que coincidan; si no, no es un error, es una diferencia
  que se ajusta en el impuesto.

La tabla vive en el backend y aquí se lee. No se copia al frontend: sería una
regla contable en el cliente.

## Los informes se exportan desde el backend, no desde el navegador (30/08/2026)

Estaba anotado como decisión pendiente. Se decidió **pedir el fichero a la API**,
empezando por el mayor (`prompts/4_intercambio.md` [4.1]).

Tres motivos:

- **La API ya genera Excel** en facturación —emitidas, recibidas y anuladas—, así
  que el fichero sale con la misma pinta que los demás del programa.
- Detrás del mayor vienen sumas y saldos, balance y pérdidas y ganancias, y los
  cuatro van a querer lo mismo. Hacerlo aquí obliga a meter una librería y a
  **duplicar el formateo español**, que hoy vive en un único sitio; cuatro
  informes después son dos sitios donde se puede escribir un importe distinto
  del que se ve en pantalla.
- El navegador no tiene siempre los datos completos: el mayor se pide entero,
  pero en tandas de mil.

Descartado generar un CSV en el cliente salvo como apaño temporal.

## El modelo 303 va aparte de los resúmenes fiscales (02/09/2026)

Los tres resúmenes —IVA del periodo, retenciones y cuadre con facturación— se
juntaron en una pantalla de pestañas porque comparten filtro exacto: ejercicio y
periodo. El **303 se queda fuera de esa pantalla** y tendrá la suya.

El motivo no es de sitio, es de significado. Los tres resúmenes son consultas
vivas: contestan con lo que hay hoy en los libros. El 303 es un documento
guardado, con su fecha de cálculo y su estado, y **dice lo que había el día que
se preparó**, aunque desde entonces se hayan corregido facturas. Ponerlos bajo
el mismo filtro invitaría a compararlos como si tuvieran que coincidir, y no
tienen por qué.

## El 303 no se pinta hasta que el backend mande dos cosas (02/09/2026)

La API prepara el 303 desde el 01/09/2026, pero la pantalla no se hace todavía:

- **Las casillas llegan sin rótulo**, solo el número y el importe. Escribir aquí
  los treinta y tantos rótulos del impreso sería duplicar contenido oficial del
  modelo en dos sitios, y el día que la AEAT lo cambie habría que acordarse de
  los dos.
- **Las facturas de los avisos y del detalle de una casilla vienen
  identificadas solo por su id interno**, sin número, fecha ni tercero. Esa es
  justo la lista que se enseña ante un requerimiento de Hacienda.

Los datos que trae la API, campo a campo, están en `fiscal_303.md`.
