# Sumas y saldos y estados contables

Dos pantallas del apartado `Informes`, nivel `consulta`: `Sumas y saldos` y
`Estados contables`, esta última con el balance de situación y la cuenta de
pérdidas y ganancias en sendas pestañas. Van juntas aquí porque comparten casi
todo: el mismo botón de ayuda, la misma manera de pedir un periodo y el mismo
criterio con los borradores.

**No calculan nada.** Los saldos, los totales y el resultado los da la API ya
hechos, y en positivo: al pasivo y a los ingresos les da la vuelta ella al
componer el informe. La interfaz no cambia ningún signo ni acumula ninguna
columna.

Junto al título de las dos va el botón de ayuda con la clave **`informes`**, la
misma del mayor: es una sola ayuda para todos los informes, no una por pantalla.

## Lo común a las dos

- **Se consulta a propósito.** Se elige el filtro y se pulsa `Ver`; hasta
  entonces la pantalla dice `Elige la fecha y pulsa Ver.` (en sumas y saldos,
  `Elige cómo agrupar y pulsa Ver.`). Un informe de un ejercicio entero no se
  lanza solo al entrar.
- **El filtro se recuerda por usuario**, igual que las columnas del diario. Al
  volver a la pantalla están puestos los valores de la última vez, pero **no se
  consulta sola**: hay que pulsar `Ver`.
- `Incluir borradores` decide si los asientos que aún no han entrado en el libro
  suman. **Va desmarcado de entrada** en las dos, al revés que en el mayor: un
  balance se manda fuera, y ahí lo que no está confirmado no cuenta salvo que se
  pida a propósito.
- Mientras llega lo nuevo, **lo de antes se queda puesto**. La tabla no se vacía
  ni pierde el sitio por el que se iba.
- Si la llamada falla, sale un aviso rojo con el texto de la API y **no una
  tabla vacía**: `No se pudo cargar el balance` y
  `No se pudieron cargar los estados contables`.
- El icono de la hoja de cálculo verde baja el Excel. **Lo arma la API**, no el
  navegador; el porqué está en `../planificacion/decisiones.md`.

## Sumas y saldos

En `Informes → Sumas y saldos`. Lo que se ha movido en cada cuenta y cómo queda.

Filtro: `Agrupar por`, `Cuenta desde`, `Cuenta hasta`, `Desde`, `Hasta`,
`Incluir borradores` y `Ver`.

`Agrupar por` tiene cuatro posiciones, que son los dígitos por los que se junta:
`Grupo`, `Subgrupo`, `Cuenta de mayor` y `Subcuenta`. **Entra por cuenta de
mayor**, que es como se mira habitualmente: grupo y subgrupo son para el
resumen, subcuenta para el detalle.

Las dos casillas de cuenta son las mismas del resto del programa, con el punto
como comodín: `43.` se rellena con ceros hasta el ancho de la empresa.

Columnas: `Cuenta`, `Título`, `Saldo anterior`, `Debe`, `Haber` y `Saldo`. La
única que crece es el título; el resto van a lo suyo, y los importes pegados a
la derecha y en monospace.

**El debe y el haber son los del periodo pedido, no acumulados.** Lo que la
cuenta traía al empezar va en `Saldo anterior`, en su propia columna. Sin acotar
fechas el periodo es el ejercicio entero, así que el saldo anterior sale a cero.

Debajo, `Total debe`, `Total haber` y cuántas líneas hay. Los dan la API y el
recuento de la propia lista.

Sin resultados, la tabla dice `No hay movimientos con ese filtro.` Es distinto
de no haber podido cargar, que sale en rojo arriba.

El Excel baja **lo mismo que se está viendo**: el nivel de agrupación, el rango
de cuentas, el periodo y los borradores. El fichero se llama
`sumas_y_saldos_<ejercicio>_<fecha y hora>.xlsx`.

## Estados contables

En `Informes → Estados contables`. El balance de situación y la cuenta de
pérdidas y ganancias, **en dos pestañas de la misma pantalla**.

Estuvieron sueltos, uno por sección del menú, hasta el 01/09/2026. Se juntaron
porque el Excel de los dos es **el mismo fichero**: dos pantallas bajando lo
mismo con nombres distintos era una trampa, y el filtro es idéntico en los dos.

Filtro, arriba y común a las dos pestañas: `A fecha`, `Incluir borradores` y
`Ver`. `A fecha` en blanco es el ejercicio entero.

`Ver` **pide los dos a la vez**. Cambiar de pestaña no lanza ninguna consulta ni
espera a nada: lo que se ve ya está traído.

### La pestaña `Balance de situación`

Cómo está la empresa a una fecha. Se pinta en **dos columnas, lado a lado**, que
es como se imprime: `Activo` a la izquierda y `Patrimonio neto y pasivo` a la
derecha, cada una con su total, `Total activo` y
`Total patrimonio neto y pasivo`.

Los epígrafes llegan **en el orden en que se imprimen** y con el nodo del que
cuelgan, pero sin su profundidad: la sangría se calcula siguiendo la cadena de
padres y **el orden no se toca**, porque el que manda es el del papel. Los dos
primeros niveles van en negrita; a partir de ahí es detalle y se lee en fino.

Debajo, `Resultado del ejercicio`.

**Activo y pasivo no cuadran hasta que se cierra el ejercicio, y eso es lo
normal.** Cuando de verdad no coinciden sale este aviso, en azul y tal cual:

> El activo y el pasivo no cuadran hasta que se cierra el ejercicio, y eso es lo
> normal: el beneficio todavía está repartido entre las cuentas de gastos e
> ingresos, que no forman parte del balance. Por eso la diferencia entre los dos
> es justo el resultado del ejercicio.

Con el ejercicio ya cerrado los dos totales son iguales y **el aviso no
aparece**: repetirlo cuando no pasa nada enseña a no leerlo.

El balance **cuadra con una resta**, no con una suma: `total activo − total
pasivo` es el resultado del ejercicio, porque el pasivo llega ya en positivo.

### La pestaña `Pérdidas y ganancias`

Qué ha ganado o perdido la empresa hasta esa misma fecha. Una sola columna de
epígrafes sangrados igual que los del balance, bajo el encabezado
`Cuenta de pérdidas y ganancias`, y como última línea `Resultado del ejercicio`.

Debajo, en gris:

> Un resultado positivo es beneficio; negativo, pérdida.

Está escrito porque el signo de un informe contable no es evidente, y en esta
pestaña no hay dos columnas que lo aclaren.

### Las dos descargas

Dos iconos, y **cada uno trae los dos estados**: da igual en qué pestaña se esté
al pulsar. Quien lo manda a la gestoría manda los dos.

- **La hoja de cálculo verde**, el Excel, con **dos hojas**: en una sola no se
  leen porque no comparten columnas. Rótulo: `Descargar en Excel. Trae las dos
  hojas: el balance y la cuenta de pérdidas y ganancias.`
- **El icono rojo de PDF**, un **solo documento**, cada estado empezando en su
  página y con su cabecera. Rótulo: `Descargar en PDF. Trae los dos, cada uno en
  su página: el balance y la cuenta de pérdidas y ganancias.`

**El Excel es para trabajar el fichero; el PDF es para guardarlo y mandarlo.**
Un balance a fecha de corte se archiva tal y como quedó ese día, y una hoja de
cálculo que cualquiera puede tocar no sirve para eso.

Los dos van con **el filtro que se está viendo**, detalle incluido, así que el
fichero dice lo mismo que la pantalla. Se llaman
`balance_pyg_<fecha y hora>.xlsx` y `balance_pyg_<fecha y hora>.pdf`; ver **Los
ficheros que se bajan** en `transversal.md`.

Lo que lleva escrito el PDF, y lo escribe la API entera: el nombre y el NIF de
la empresa, el ejercicio, la fecha de corte —o `Al cierre del ejercicio` si no
se acotó—, **si cuenta o no los borradores, dicho en los dos casos**, el nivel
de detalle, la cabecera repetida en cada página y el número de página al pie.
Aquí no se compone nada de eso.

En la API los dos informes se piden como `balance`, que es como se llama allí,
aunque traigan los dos. `/informes/pdf` **hoy solo admite ese**; el mayor, el
diario y sumas y saldos entrarán por el mismo camino cuando se pidan.

Un aviso del backend que conviene conocer antes de que alguien lo tome por un
fallo: **el balance del PGC son unas 200 líneas salgan o no a cero**, porque es
el formato oficial con el que se presenta. El PDF son cinco páginas largas. Si
alguna vez hace falta un balance que se salte los epígrafes vacíos, hay que
pedirlo: no es algo que decida la pantalla.

### El detalle de cuentas

Un desplegable `Detalle`, junto a la fecha, con tres posiciones:

- `Solo epígrafes` — el balance tal y como se presenta. **Es como entra.**
- `Con cuentas de mayor` — debajo de cada epígrafe, las cuentas que lo componen.
- `Con cuentas y subcuentas` — además, debajo de cada cuenta, sus subcuentas.

Vale para las dos pestañas a la vez y **va también en la descarga**, así que el
Excel dice lo mismo que se está viendo.

Lo decide todo la API, y eso importa al portar:

- Las cuentas llegan como **más filas de la misma lista**, con `padre`
  apuntando al epígrafe del que cuelgan y detrás de él. No hay que reordenar
  nada.
- **`nivel` da la sangría** ya calculada, y **`agrupa` dice qué va en negrita**:
  las filas de las que cuelga alguna otra. Hasta el 01/09/2026 la interfaz
  calculaba la profundidad recorriendo la cadena de padres y ponía en negrita
  los dos primeros niveles; las dos cosas se borraron en cuanto la API las dio.
- **Las cuentas sin saldo no salen.** Es criterio del backend, no un filtro de
  la pantalla: un balance con doscientas líneas a cero no se lee.
- Una cuenta **nunca aparece bajo un epígrafe al que no ha sumado**, y su
  importe lleva el mismo signo que el epígrafe de encima.

En pantalla, las filas de detalle llevan **el código delante del título**, en
monospace: `430 Clientes`. Los epígrafes no, porque no son ninguna cuenta; se
distinguen por que `cuenta` llega vacía.
