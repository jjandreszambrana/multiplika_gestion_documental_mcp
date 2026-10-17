# Diario B y equivalencias

En el menú, bajo `Diario → Diario B y equivalencias`. Pedido por el SIF en
[5.31] el 16-10-2026. **Solo aparece si el SIF lo tiene**: al entrar se pregunta
a `/diario_b/listar` y, si la ruta no existe (404), la entrada no sale. Hoy solo
lo tiene sif.icomase.com.

Una pantalla con tres pestañas: las dos primeras, mantenimiento directo de una
tabla de la empresa; la tercera, sumas y saldos del diario B. Las rutas, cuerpos y respuestas, en el apartado 17 septies de la guía
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
- Formulario con los cinco campos; las dos cuentas, obligatorias.
- Ver, `consulta`. Crear, cambiar y borrar, `cierre`.

## Sumas y saldos

Con el formato del Excel del cliente. El SIF no tiene este informe para el
diario B: al pulsar Ver se trae el ejercicio entero de la cabecera (tandas de
mil) y se suma en el navegador con decimal.js (`sumasDiarioB.ts`, con test).

- Filtros: Agrupar por (Grupo / Subgrupo / Cuenta de mayor / Subcuenta, entra
  por Subcuenta), Desde, Hasta, Ver (Todas / Del libro / Borradores), «Aplicar
  equivalencias de cuentas» y «Sin regularización ni cierre», las dos
  desmarcadas.
- Columnas: Cuenta, Descripción; **Periodo**: Saldo inicial, Debe, Haber;
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
- No salen cuentas sin importes. Debe, haber y saldo inicial totales son los
  mismos en cualquier nivel.
- Sin Excel: el de sumas y saldos lo genera el SIF y no sirve para el diario B.

En las tres, el `detail` de un 400 se enseña tal cual.
