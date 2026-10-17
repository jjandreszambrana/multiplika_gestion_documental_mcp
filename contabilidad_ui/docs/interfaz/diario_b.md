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

Del ejercicio de la cabecera, con Desde/Hasta opcionales, Ver (Todas / Del libro / Borradores) y «Aplicar equivalencias de cuentas» (desmarcada: si se marca, la línea cuya cuenta es exactamente una cuenta de origen se suma en su destino, con el título de destino). El SIF no tiene este informe para el diario B: al pulsar Ver se traen todas las líneas (tandas de mil) y se suman en el navegador con decimal.js (`sumasDiarioB.ts`, con test). Columnas Cuenta, Título (de la equivalencia o del plan en memoria; vacío si no se conoce), Suma debe, Suma haber, Saldo deudor, Saldo acreedor, y fila de totales fija abajo. No salen cuentas sin debe ni haber. Sin Excel: el de sumas y saldos lo genera el SIF y no sirve para el diario B.

En las tres, el `detail` de un 400 se enseña tal cual.
