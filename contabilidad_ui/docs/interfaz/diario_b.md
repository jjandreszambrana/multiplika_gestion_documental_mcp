# Diario B y equivalencias

En el menú, bajo `Diario → Diario B y equivalencias`. Pedido por el SIF en
[5.31] el 16-10-2026. **Solo aparece si el SIF lo tiene**: al entrar se pregunta
a `/diario_b/listar` y, si la ruta no existe (404), la entrada no sale. Hoy solo
lo tiene sif.icomase.com.

Una pantalla con tres pestañas: las dos primeras, mantenimiento directo de una
tabla de la empresa; la tercera, sumas y saldos del diario B. Se entra en la última
pestaña usada en la empresa, y cada pestaña se monta al abrirla y se queda como
se dejó (ver «Las pantallas se quedan como se dejaron» en `transversal.md`). Las rutas, cuerpos y respuestas, en el apartado 17 septies de la guía
de la API. Los tipos están escritos a mano en `src/api/diarioB.ts` porque
`types.ts` sale del OpenAPI de facturae, que aún no los tiene.

## Diario B

**No mueve saldos, no comprueba que el asiento cuadre y no pasa por el diario
oficial.** Lo dice un aviso en el formulario.

- Filtros: Ejercicio (de entrada, el de la cabecera), Asiento, Cuenta que empieza
  por, Desde, Hasta y Ver (Todas / Del libro / Borradores). Lo tecleado espera
  400 ms antes de pedir.
- Paginado en el servidor, de 100 en 100.
- Columnas: ejercicio, asiento, fecha, cuenta, concepto, documento, debe, haber.
- Formulario: ejercicio, asiento, fecha, cuenta (con el comodín del punto),
  concepto, documento, debe, haber, diario y «En el libro (si no, queda como
  borrador)». Al editar se manda solo lo que cambia.
- Fuera del formulario, a propósito: obra, tipo de IVA, documento de origen,
  programa externo y grupo de borrador. Se conservan al editar porque no se
  mandan.
- Ver, nivel `consulta`. Crear, cambiar y borrar, nivel `apuntes`: sin él, los
  botones no salen (el SIF pedía apagarlos; aquí se esconden, como en el resto).

## Equivalencias de cuentas

Cuenta de origen → cuenta de destino, con sus títulos y observaciones. **No es
el cambio de plan contable** de `/equivalencias`.

- Buscador «Buscar por cuenta o título». Paginado igual.
- Casilla «Solo sin cuenta de destino», junto al buscador: deja solo las que el
  usuario llama «deshermanadas», sin cuenta de destino. El SIF no filtra por
  eso: marcada, se traen todas las que cumplen el buscador (tandas de mil) y se
  filtra y pagina en el navegador; desmarcada, pagina el SIF como siempre. Se
  recuerda por usuario y empresa. Una deshermanada llega sin el campo de la
  cuenta de destino: se normaliza a vacío al recibirla (`normalizarEquivalencia`).
- Columna «Flag» entre «Título de destino» y «Observaciones»: una marca verde si
  vale 1 y nada si vale 0. Es una marca de sí o no que pidió el usuario sin decir
  para qué ([5.33]), así que no lleva ningún texto que le dé significado. Solo
  existe en el SIF de Icomase; si el SIF no la manda, cuenta como 0.
- Formulario con los cinco campos y la casilla «Flag»; las dos cuentas,
  obligatorias. Junto a la cuenta de destino, una lupa («Buscar en el plan…»)
  abre «Buscar la cuenta de destino», el mismo buscador del plan del SIF que
  «Asignar…» en sumas y saldos (`BuscadorDelPlan.tsx`). Al elegir con «Elegir»
  se rellenan la cuenta y el título de destino y se marca Flag, que luego se
  puede desmarcar a mano. Al editar, Flag se manda solo si cambia, como el resto.
- **Una cuenta de destino solo puede serlo de una equivalencia.** En el
  buscador (aquí y en «Asignar…» de sumas y saldos) las subcuentas que ya son
  destino de otra salen apagadas, no se pueden elegir y dicen «Ya asignada a
  17000003» (la cuenta de origen de la que ya tiene). Se compara tal cual y por
  `claveSubcuenta` (10000001 = 100000001). La equivalencia que se edita no
  cuenta. Si se teclea a mano un destino ya usado, al guardar la casilla dice
  «Ya asignada a …» y no se guarda; solo se mira si el destino ha cambiado, para
  que una repetida de antes no impida tocar lo demás. Las equivalencias se
  traen todas al abrir el diálogo; si eso falla, un aviso lo dice y decide el
  SIF al guardar. La comprobación está en `datosEquivalencia.ts`, con test.
- Ver, `consulta`. Crear, cambiar y borrar, `cierre`.

En las dos rejillas: cada fila lleva un lápiz («Cambiar…», abre el formulario)
y una papelera («Borrar…», pide confirmación), y se puede marcar una fila
pulsándola: queda en azul, como en el diario; solo una a la vez, y pulsarla otra
vez la desmarca. Con una fila marcada salen arriba, junto a «Nueva…», «Cambiar…»
y «Borrar…» para esa fila. Los iconos y los botones siguen el nivel de cada
tabla (sin él no salen). La marca se pierde si la fila deja de estar en la
página (otro filtro, otra página o al borrarla). Lo común está en
`filaMarcada.tsx`.

## Sumas y saldos

Con el formato del Excel del cliente. El SIF no tiene este informe para el
diario B: al pulsar Ver se trae el ejercicio entero de la cabecera (tandas de
mil) y se suma en el navegador con decimal.js (`sumasDiarioB.ts`, con test).

- Filtros: Agrupar por (Grupo / Subgrupo / Cuenta de mayor / Subcuenta, entra
  por Subcuenta), Desde, Hasta, Ver (Todas / Del libro / Borradores) y el botón
  «Opciones…», junto a Ver.
- «Opciones…» abre una ventana con cuatro casillas, desmarcadas de fábrica:
  «Aplicar equivalencias de cuentas», «Solo cuentas sin equivalencia», «Sin
  regularización ni cierre» y «No mostrar las cuentas sin saldo» (la de
  «Mostrar la descripción…» se quitó el 18-10-2026: la descripción sale
  siempre; si quedó guardada, se ignora). Se aplica al cerrarla, de
  cualquier manera (como el filtro del diario); si ya hay algo calculado, se
  rehace. Se recuerdan por usuario y empresa.
- Columnas: Cuenta, Descripción (aplicando equivalencias y por Subcuenta, entre
  las dos va «Origen / Destino»); **Periodo**: Saldo inicial, Debe, Haber;
  **Acumulados**: Debe, Haber, Saldo deudor, Saldo acreedor. Fila de totales
  fija abajo en todas.
- La apertura, la regularización y el cierre los reconoce el programa por lo que
  hace cada asiento, para cualquier empresa: apertura = primer asiento, del
  primer día, solo con cuentas de balance; regularización = solo grupos 6 y 7
  contra la 129; cierre = último asiento, del último día, que deja a cero el
  90 % o más de las cuentas que toca. Si una línea trae APERTURA, REGULARIZA o
  CIERRE en `diario`, manda la marca.
- Por subcuenta, una cuenta más corta (la apertura y el cierre suelen venir en
  4 cifras, p. ej. 1130) se completa con ceros hasta subcuenta (11300000).
- Saldo inicial: debe − haber de la apertura y de las líneas anteriores a
  Desde. Con signo, en rojo si es negativo.
- Periodo: las líneas entre Desde y Hasta (sin fechas, el ejercicio), sin las
  APERTURA. Las posteriores a Hasta no entran. Con alguna fecha puesta, una
  línea sin fecha no se puede situar y no entra.
- Acumulados: lo del saldo inicial más el periodo, debe y haber por separado;
  de ahí los saldos deudor y acreedor.
- «Sin regularización ni cierre» quita de todo el cálculo las REGULARIZA y
  CIERRE.
- Equivalencias: la línea cuya cuenta es exactamente una cuenta de origen se
  suma en su destino, antes de agrupar. Descripción: la de destino de la
  equivalencia o la del plan en memoria para ese código; vacía si no se conoce.
- «Solo cuentas sin equivalencia» deja en el cálculo solo las líneas cuya cuenta
  no es la de origen de ninguna equivalencia (comparada como al aplicarlas: tal
  cual o completada con ceros). Para saberlo se traen las equivalencias aunque
  no se apliquen. Vale con cualquier agrupación y con el resto de opciones; el
  saldo inicial y los totales salen solo de las líneas que entran. Marcada junto
  con «Aplicar equivalencias» da lo mismo que sin aplicarlas, y no se impide.
- Descripción, siempre. Al pulsar Ver se traen también el plan entero del SIF
  (apartadas incluidas) y todas las equivalencias. Por subcuenta, de lo primero
  que haya: (1) aplicando equivalencias, el título de destino; (2) sin
  aplicarlas, el título de origen de su equivalencia hermanada; (3) el plan, por
  el código tal cual o casándolo con `claveSubcuenta` (10000001 = 100000001); si
  la fila es de Destino, con la cuenta de destino; (4) el de su cuenta de mayor
  de 4 y luego de 3 cifras; (5) vacío. Agrupando por grupo, subgrupo o cuenta de
  mayor, la del plan para ese código. Si no se pueden traer el plan o las
  equivalencias (cuando ninguna opción las necesita), el balance sale igual y
  un aviso amarillo dice «Puede faltar alguna descripción: …».
- «Origen / Destino»: con «Aplicar equivalencias de cuentas» y por Subcuenta,
  una marca discreta en cada fila: «Destino» si sale de una equivalencia
  hermanada (se suma en su destino), «Origen» si es la cuenta del diario B tal
  cual. Si en una fila se juntan las dos, Destino, y su descripción es la del
  destino. Una deshermanada no cuenta como equivalencia. Sin aplicar
  equivalencias o con otra agrupación, la columna no sale.
- Con «Aplicar equivalencias de cuentas» y agrupando por Subcuenta, quien tiene
  nivel `cierre` ve una columna «Equivalencia» con «Asignar…» en las filas que
  no se han sumado por ninguna equivalencia. Abre «Asignar equivalencia»: la
  cuenta del diario B y un buscador «Buscar por cuenta o título» sobre el plan
  del SIF (`/plan/listar` con `texto`, solo subcuentas, como el buscador de la
  pantalla del plan). Entra ya buscando la subcuenta del plan que casa con la
  suya aunque tenga otra longitud (`claveSubcuenta`: 10000001 = 100000001) y,
  si no hay, su descripción. Se marca una fila y «Crear equivalencia» la da de
  alta: origen, la cuenta tal como viene en las líneas (si en la fila se
  juntaron varias formas, la que más líneas tiene) con su descripción; destino,
  la elegida con su título, y Flag marcada. Después se rehace el balance y la fila pasa a su
  destino. Un error del SIF (una equivalencia que ya existe) se enseña tal cual.
- «No mostrar las cuentas sin saldo» quita las filas con saldo deudor y
  acreedor a cero. Los totales siguen siendo los de todas las líneas que entran,
  y una nota bajo la tabla dice cuántas cuentas se han ocultado.
- No salen cuentas sin importes. Debe, haber y saldo inicial totales son los
  mismos en cualquier nivel.
- Sin Excel: el de sumas y saldos lo genera el SIF y no sirve para el diario B.

En las tres, el `detail` de un 400 se enseña tal cual.
