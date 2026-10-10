# Inmovilizado

Sección `Inmovilizado`, suelta en el menú. Nivel `consulta` para verlo.

Los bienes que la empresa compró para usarlos durante años y se van llevando a
gasto poco a poco.

Junto al título va el botón de ayuda, con la ayuda del módulo que escribe y
sirve el backend (`amortizaciones`). Aquí no se copia ni una línea: si una regla
cambia, cambia allí y se ve el mismo día.

Ver el listado y la ficha es nivel `consulta`. Las cinco acciones —alta,
corrección, las dos bajas y la dotación— son nivel `apuntes` y **se esconden**
para quien no lo tiene: no se enseñan apagadas.

## Listado

Título `Inmovilizado` y, a su derecha, el filtro con dos opciones:

- `Solo los que se amortizan` — por defecto.
- `Todos, incluidos los dados de baja`

Un bien **nunca se borra**: la baja pone `estado = 0` y la fila se queda en la
tabla. Por eso el filtro es lo primero que se ve.

**Las mejoras no van sueltas: cuelgan de su bien** y el bien se despliega para
verlas, con la marca `Mejora`. En un bien con mejoras, las columnas de valor,
amortizado y pendiente enseñan **el conjunto**, que es el número del inventario.
Una mejora solo aparece suelta cuando su bien no está en esa consulta —el bien
de baja mirando solo los activos—, y entonces el estado lo dice:
`Mejora de un bien que no está en esta lista`. Antes suelta que escondida.

| Columna | Qué es |
|---|---|
| `Descripción` | Qué es el bien. Es la única que crece |
| `Compra` | La fecha de la factura con la que entró |
| `Valor` | Lo que costó |
| `Amortizado` | Lo ya llevado a gasto en asientos |
| `Pendiente` | Lo que queda por llevar a gasto, **descontado el valor residual** |
| `% anual` | A qué ritmo se amortiza |
| `Cuota anual` | Lo que le tocaría en un año entero al ritmo de hoy |
| `Última dotación` | El mes por el que va amortizado, `mm/aaaa`. Vacío si nunca |
| `Estado` | `En uso`, o `Baja dd/mm/aaaa` con su fecha |

`Pendiente` **no es lo mismo que el valor neto contable** cuando el bien tiene
valor residual, y es el que dice cuánta vida le queda. Por eso está en el
listado y el valor neto no.

Los cinco totales —amortizado, valor neto, pendiente, cuota anual y último
periodo dotado— **los calcula el backend** y llegan en `/inmovilizado/listar`.
Aquí no se calcula ningún importe: sería lógica contable en el cliente, y
habría que adivinar el prorrateo del primer y del último año.

El listado **no pagina**: la API devuelve todos los bienes de una vez.

## Ficha del bien

Se abre pinchando la fila. Título `Ficha del bien`.

Arriba, la descripción —con la marca `Mejora` si lo es— y sus datos: `Compra`,
`Se amortiza desde`, `Valor`, `Valor residual`, `% anual`, `Amortizado`,
`Pendiente` y `Cuota anual`. `Ya amortizado al entrar` solo cuando no es cero:
en el caso normal sería una línea sin información. Si el bien tiene mejoras,
tres datos más:
`Valor con mejoras`, `Amortizado con mejoras` y `Valor neto con mejoras`; si no
las tiene no se enseñan, porque serían los mismos de al lado. Luego la tabla
`Mejoras`, con una fila por mejora. Debajo,
las tres cuentas donde el programa apunta el bien: `Cuenta del activo`,
`Cuenta de amortización` y `Cuenta de gasto`.

Si el bien ha tenido alguna corrección de valor, al final va `Correcciones`, con
fecha, concepto, importe y asiento. Va **aparte del cuadro** porque no son
dotaciones.

Después, `Cuadro de amortización`: una fila por mes dotado, con `Periodo`,
`Importe` y `Asiento`. El número de asiento es lo que permite ir del importe a
su apunte en el diario. Si no hay ninguna,
`Este bien todavía no se ha amortizado ningún mes.`

## Cuando algo falla

- Lista vacía: `Esta empresa no tiene ningún bien de inmovilizado.`
- Fallo de carga: `No se pudo cargar el inmovilizado`, con el texto del error.
- Fallo al abrir la ficha: `No se pudo cargar la ficha del bien`.

Nunca se enseña una tabla vacía como si no hubiera datos.

## Las tres acciones de un bien

Van en un menú al final de la fila, no en botones sueltos: sus rótulos no caben,
y **no se acortan a propósito**, porque las dos bajas se confunden con facilidad
y el nombre es lo único que las distingue. Un bien ya dado de baja no las
enseña: no hay nada que hacerle.

### Nuevo bien… y Corregir…

Es el mismo formulario. `Descripción`, `Valor`, `Porcentaje anual` y
`Se amortiza desde` son obligatorios; `Fecha de compra`, `Valor residual` y las
tres cuentas, no. Debajo de las cuentas:
`Si las dejas vacías se usan las de la configuración de la empresa.`

El alta **no hace ningún asiento**: solo apunta el bien para que entre en las
dotaciones.

Las tres casillas de cuenta son las mismas que la configuración: se busca por
número y por título sobre el plan que ya está en memoria, el punto se rellena
con ceros al salir del campo, y si la cuenta no existe la última opción la da de
alta sin salir del formulario. Las de importe y el porcentaje **no admiten
letras**: lo que no sea un número o un separador decimal no llega a escribirse.

Al corregir, si el bien **ya tiene meses dotados**, cuatro campos salen
bloqueados —`Valor`, `Se amortiza desde` y las cuentas del activo y de
amortización acumulada— con el aviso que explica por qué. La API los rechaza con
un 400; se bloquean antes para no dejar teclear algo que se va a perder. El
porcentaje y el valor residual sí se cambian: solo afectan a lo que queda.

`Ya amortizado al entrar` es para el bien que **viene de otra contabilidad**: lo
que llevaba amortizado al entrar en este programa, para que la amortización siga
desde ahí en vez de volver a empezar. Se deja vacío en un bien comprado nuevo.
Debajo: `Solo para bienes que vienen de otra contabilidad. No genera ningún
asiento: los saldos ya vienen en el asiento de apertura.`

Sin ese dato, un bien que llega con 18.000 de 30.000 amortizados **se amortizaba
entero otra vez**, y no lo notaba nadie hasta que el saldo de la cuenta 28 no
cuadraba con la suma de las fichas. La fecha de inicio puede ser la original, de
hace años: el cálculo de la cuota no cuenta meses desde ella, solo mira si el
bien estaba en uso y cuánto queda.

`Tipo de bien` es un desplegable con la tabla del artículo 12.1.a) de la Ley del
Impuesto sobre Sociedades, que sirve `/inmovilizado/tabla_amortizacion`. Elegir
uno **rellena el porcentaje**; se puede cambiar después y se puede no elegir
ninguno. Debajo va el texto de advertencia que manda la API, tal cual.

`Es un bien usado`, al lado, es para el de **segunda mano**. Un bien usado no
arrastra nada: entra por lo que se paga y se amortiza desde cero. Lo único
distinto es el ritmo, y marcarla hace que el desplegable proponga **el doble**,
que es lo que permite el artículo 4.3 del Reglamento del Impuesto sobre
Sociedades. El número doblado lo da la API, aquí no se multiplica nada. Con la
casilla marcada, el texto de debajo pasa a ser la regla de los usados, que
incluye la excepción de los edificios de menos de diez años.

La otra vía del reglamento —el coeficiente normal sobre el precio de cuando era
nuevo— no se calcula, porque hace falta un dato que nadie tiene: quien la use
teclea el porcentaje a mano.

Si el porcentaje tecleado pasa del máximo de ese tipo, se **avisa y se deja
seguir**: amortizar más deprisa no es un error, es una diferencia que se ajusta
en el impuesto. Ni la pantalla ni la API lo rechazan.

Si la tabla no se puede traer, el desplegable no sale y el porcentaje se teclea
a mano: el formulario sigue funcionando.

### Añadir mejora…

`Una mejora se amortiza aparte, con su propio valor y su propio ritmo. Sale de
los libros el día que salga el bien.`

Es el mismo formulario, colgando del bien. **No se ofrece sobre una mejora**: la
cadena tiene dos niveles y la API no admite mejoras de mejoras. Tampoco sobre un
bien dado de baja.

El porqué de que una mejora sea otra ficha y no un cambio de valor está en
`../planificacion/decisiones.md`.

### Corregir el valor…

Para el bien que costó 3.000 y se dio de alta con 30.000 **cuando ya se ha
dotado**. Solo aparece si tiene meses dotados: sin ellos el valor se cambia en
`Corregir…` sin más, porque no hay nada dotado que deshacer.

`Se ha amortizado sobre un valor equivocado, así que hay gasto de más o de menos
en el libro. Al corregirlo se hace un asiento por la diferencia.`

Se teclea el `Valor correcto` y **se ensaya**: `Ver cómo quedaría` enseña
`Amortizado en los libros`, `Amortizado correcto` y la diferencia, rotulada
`Se dotó de más` o `Se dotó de menos` **según lo dice la API**, no según una
resta hecha aquí. `Corregir` está apagado hasta ver el ensayo, y se vuelve a
apagar si se cambia el valor.

Al pie: `El cuadro de amortización no cambia: cada línea es un asiento que se
hizo. La corrección se apunta aparte.` Eso es lo que explica que lo amortizado
no cuadre con la suma del cuadro.

La corrección **no toca la cuenta del activo**: si el bien vino de una factura,
ahí el importe siempre estuvo bien y lo que mentía era la ficha. Si el activo
también entró mal, eso es otro error y se arregla con otro asiento.

### Dejar de amortizar…

`El bien deja de aparecer en las dotaciones. Los libros no se tocan.` Solo pide
la fecha de baja.

Si el bien ya tiene meses amortizados, aviso en amarillo: seguirá figurando en
los libros y esta opción es para el alta equivocada que nunca llegó a dotarse.
Para sacarlo de los libros está la otra.

Si tiene mejoras: `Sus mejoras también dejan de amortizarse.`

### Dar de baja y sacar de los libros…

`Hace el asiento que quita el bien y su amortización acumulada, y lleva la
diferencia a beneficio o a pérdida.`

Pide la fecha de baja, el importe de la venta —cero si se tira— y la cuenta
donde entra el dinero, que es obligatoria solo si hay venta. Al pie:
`El IVA no va en este asiento: la venta se factura aparte y esa factura genera
el suyo.`

**Primero se ensaya.** `Ver cómo quedaría` llama con `simular`. Si el bien tiene
mejoras, encima del resumen sale `Sale de los libros`, con una fila por ficha
—descripción, valor, amortizado y lo que le queda— y la marca `Mejora` en las
que lo son: el asiento se las lleva todas y el resultado se calcula **sobre el
conjunto**. Después, el resumen: valor, amortizado, valor neto, importe de la venta y el resultado, con
su rótulo —`Beneficio` o `Pérdida`— **decidido por la API**, no por una resta
hecha aquí. `Dar de baja` está apagado hasta haber visto el ensayo, y se vuelve
a apagar si se cambia cualquier casilla: lo que se vio ya no valdría.

## Dotar la amortización…

Botón arriba, junto al título. `Dotar la amortización de un mes`.

El ejercicio es el del selector de la cabecera y solo se elige el mes. **La
dotación es siempre de un mes**: la amortización es un gasto de cada periodo, y
meterla entera en un asiento de diciembre falsearía los meses.

`Ver qué se dotaría` enseña dos listas: `Se amortizan`, con el importe de cada
bien y el total, y `No entran`, con el motivo de cada uno **tal y como lo manda
la API**. Si la primera sale vacía,
`Aquí no hay ningún bien que amortizar en ese mes.` y `Dotar` no se activa.

Ojo con el contador de saltados: cuenta **todos los que no entran**, no solo los
ya dotados. No se puede rotular como «ya dotados».

## Al cambiar algo

Cualquier acción rehace el listado entero, porque los totales de todas las filas
pueden haber cambiado: una dotación toca a la vez todos los bienes.

## La ficha nace de la factura

Es lo que evita el olvido. Hasta que existió, la ficha había que acordarse de
teclearla después, y el bien que no la tiene **no se amortiza nunca** sin que
nadie se entere hasta que el balance no cuadra.

### Desde el traspaso de facturas recibidas

La factura cuyo gasto va a una cuenta de inmovilizado **no se contabiliza sola**:
el traspaso la aparta con su motivo. En su fila sale `Crear la ficha del bien…`.

Qué factura lo pide **lo dice la API**, con `pide_ficha_de_bien`, calculado con
la misma regla que el traspaso y **antes de intentar contabilizar**. Aquí no se
interpreta ningún texto de motivo: el día que cambiara una coma, el botón
desaparecería en silencio.

El diálogo enseña proveedor, importe y la cuenta que dispara el aviso, y pide
elegir entre `Es un bien nuevo`, `Es una mejora de otro bien` —y de cuál— o
`No es un bien`, que pide el motivo y **no vuelve a preguntar por esa factura**.

En las dos primeras sale el formulario de siempre.
`El valor sale de la base de la factura, sin IVA.` El porcentaje y la fecha de
entrada en uso **los pone una persona**: de una línea de factura no se deduce el
tipo de bien, y una máquina puede tardar semanas en instalarse.

`Guardar y contabilizar` hace la ficha y el asiento de esa factura **en una sola
llamada**, y solo el de esa: arreglar una no dispara los asientos de las demás.
Si la ficha se crea pero la factura aún no puede contabilizarse, se enseña el
motivo que manda la API en vez de dar por hecho que fue bien.

### Desde la entrada de asientos

Al **confirmar** un asiento que ha metido algo en una cuenta de inmovilizado sin
ficha, sale el aviso. **Después de confirmar, nunca mientras se teclea**:
interrumpir a quien está metiendo líneas con el teclado es la forma más rápida
de que acabe ignorando el aviso.

`Ahora no` lo deja para luego —queda en «Bienes sin ficha»—, `No es un bien` lo
descarta con su motivo y `Crear la ficha…` abre el formulario con lo que el
apunte ya sabe: el concepto, el importe y la cuenta. Aquí **no hay factura**, así
que la ficha nace sin enlace a ningún documento, que es lo correcto porque no lo
hay, y el aviso se calla con `marcar_revisado`.

Si la consulta falla no se enseña nada: es un aviso de cortesía y no puede
estorbar el trabajo del diario.

## Bienes sin ficha

Sección propia, dentro de Inmovilizado. Nivel `consulta` para verla, `apuntes`
para resolverla.

`Apuntes en cuentas de inmovilizado que no tienen ficha de bien. Mientras no la
tengan, no se amortizan.` Columnas: `Fecha`, `Asiento`, `Cuenta`, `Concepto`,
`Documento` e `Importe`, y por fila `Crear la ficha…` y `No es un bien…`.

Es lo que cubre el agujero: **todo lo que se contabilizó antes de que la ficha
naciera de la factura**, más los asientos hechos a mano y lo que se dejó para
luego. Va sin filtros a propósito —son los que quedan— y la lista se vacía sola
según se resuelven.

Cuando no queda nada:
`Todo revisado: no hay ningún apunte de inmovilizado sin ficha.`

El descarte **se recuerda**: el motivo queda guardado y ese apunte no vuelve a
preguntar. Sin eso, el aviso acabaría siendo ruido que se ignora.
