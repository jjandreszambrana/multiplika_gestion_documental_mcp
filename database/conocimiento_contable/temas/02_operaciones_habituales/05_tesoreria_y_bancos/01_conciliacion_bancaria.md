---
id: 10251
titulo: "Conciliación bancaria"
resumen: "Cómo comparar el saldo de la cuenta 572 con el extracto del banco, clasificar las diferencias (temporales o que exigen asiento) y contabilizar los ajustes, con ejemplo numérico."
palabras_clave: [conciliación bancaria, extracto bancario, 572, partidas en conciliación, cheques pendientes, comisiones, cobros sin identificar, 555, 626, descubierto]
aplica_a: [pgc_normal, pgc_pymes, microempresas, esfl, autonomos]
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/grupo5-2      # PGC, quinta parte, grupo 5 (cuentas 555 y 572)
  - BOE-A-2007-19966/grupo5-2      # PGC PYMES, quinta parte, grupo 5
  - BOE-A-2007-19884/grupo6-2      # PGC, quinta parte, grupo 6 (cuenta 626)
  - BOE-A-1885-6627/art25          # Código de Comercio, art. 25: contabilidad ordenada
  - BOE-A-1885-6627/art29          # Código de Comercio, art. 29: errores y omisiones
  - BOE-A-1992-28740/a20           # Ley del IVA, art. 20.Uno.18.º: exención de servicios financieros
otras_fuentes: []
relacionados: [10252, 10253, 10254, 10413, 11111, 11113]
consultas_sif: ["mayor:572", "mayor:555", "mayor:626", "sumas_y_saldos"]
---

## En pocas palabras

Conciliar es comprobar que el saldo de cada cuenta bancaria en la contabilidad (572) explica el saldo del extracto a la misma fecha. Las diferencias son de dos tipos: las que solo son de fechas (el banco o la empresa todavía no lo ha registrado) y las que exigen un asiento porque la contabilidad no recoge algo que ya pasó en el banco. Se hace al menos una vez al mes y siempre al cierre.

## Cuándo se aplica

En cualquier empresa, autónomo o entidad que lleve cuentas bancarias en el subgrupo 57. El PGC exige que en la 572 figuren los saldos "a favor de la empresa" en cuentas corrientes a la vista, y que los descubiertos bancarios figuren "en todo caso en el pasivo corriente del balance". El Código de Comercio pide una contabilidad ordenada y que los errores u omisiones se salven en cuanto se adviertan (arts. 25 y 29). La conciliación es la forma práctica de cumplirlo con los bancos.

## Cómo se aplica

**Paso 1. Misma fecha y misma cuenta.** Una subcuenta de la 572 por cada cuenta bancaria (por ejemplo, 5720001 para el banco A). Se toma el saldo contable y el del extracto al último día del mes.

**Paso 2. Puntear.** Se marcan los movimientos que están en los dos lados por el mismo importe. Lo que queda sin marcar son las partidas en conciliación.

**Paso 3. Clasificar lo que queda.**

| Diferencia | Ejemplo | ¿Asiento? |
| --- | --- | --- |
| Está en contabilidad y no en el banco | Transferencia o cheque emitido que el banco carga días después | No; se vigila que aparezca el mes siguiente |
| Está en el banco y no en contabilidad, con justificante | Comisión, recibo domiciliado, cobro de un cliente | Sí, con la cuenta que corresponda |
| Está en el banco y no se sabe qué es | Ingreso sin concepto | Sí, en la 555 mientras se aclara (tema 10254) |
| Error de importe en un asiento | Se contabilizó 1.250 en vez de 1.520 | Sí, corrección |

**Paso 4. Cuadrar.** El saldo contable ajustado debe ser igual al saldo del banco ajustado por las partidas temporales. Si no cuadra, falta algo por encontrar: no se fuerza con un asiento "de cuadre".

**Ejemplo (30 de septiembre)**

- Saldo contable de la 5720001: 12.000,00 €.
- Saldo del extracto: 14.720,00 €.

Partidas sin puntear:

1. Transferencia a un proveedor contabilizada el día 30 que el banco carga el 1 de octubre: 2.000,00 €. Temporal.
2. Comisión de mantenimiento cargada por el banco, sin contabilizar: 30,00 €.
3. Cobro de una factura del cliente X, abonado por el banco, sin contabilizar: 500,00 €.
4. Ingreso sin concepto ni ordenante claro: 250,00 €.

Comprobación:

| | Contabilidad | Banco |
| --- | --- | --- |
| Saldo a 30/09 | 12.000,00 | 14.720,00 |
| − Transferencia pendiente de cargo | | −2.000,00 |
| − Comisión | −30,00 | |
| + Cobro del cliente X | +500,00 | |
| + Ingreso sin identificar | +250,00 | |
| **Saldo conciliado** | **12.720,00** | **12.720,00** |

Asiento de ajuste (30/09):

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 626 Servicios bancarios y similares | 30,00 | |
| 572 Bancos e instituciones de crédito c/c vista, euros | 720,00 | |
| 430 Clientes | | 500,00 |
| 555 Partidas pendientes de aplicación | | 250,00 |
| **Total** | **750,00** | **750,00** |

(El cargo neto de 720,00 € en la 572 es el resultado de +500,00 + 250,00 − 30,00.) La transferencia de 2.000,00 € no lleva asiento; si en octubre no aparece en el extracto, hay que averiguar por qué.

**Saldo acreedor.** Si una cuenta bancaria tiene saldo contable acreedor porque el banco permite descubierto, al cierre ese saldo se presenta en el pasivo corriente. Si el banco no admite descubierto y la contabilidad muestra saldo acreedor, el error está en la contabilidad: faltan cobros o hay pagos duplicados.

## Fiscalidad relacionada

- La mayoría de las comisiones bancarias por cuentas corrientes y cobros o pagos del depositante están exentas de IVA (Ley del IVA, art. 20.Uno.18.º a). La exención no alcanza a los servicios de gestión de cobro de créditos, letras de cambio y recibos, que pueden llevar IVA (tema 10252).
- Un cobro de cliente o un ingreso que se queda sin contabilizar puede ser un ingreso no declarado. La conciliación es la primera defensa ante una comprobación.

## Errores frecuentes

- Conciliar solo al cierre del año. Los errores de enero aparecen en diciembre y ya no hay justificantes a mano.
- Usar una sola 572 para varias cuentas bancarias, con lo que la conciliación es imposible.
- Cuadrar con un asiento contra la 555, la 678 o la 778 sin saber qué es la diferencia.
- Dar por buenas partidas temporales que llevan meses sin aparecer en el extracto (cheques caducados, transferencias devueltas).
- Contabilizar las remesas de recibos por el neto, sin separar las comisiones ni las devoluciones.

## Qué revisar en la contabilidad

- Para cada subcuenta de la 572, saldo a fin de mes frente al saldo del extracto (o del fichero Norma 43) a la misma fecha.
- Partidas en conciliación con más de 30 días de antigüedad.
- Subcuentas de la 572 con saldo acreedor en algún momento del mes.
- Saldo de la 555 a fin de mes: todo lo que entró ahí por la conciliación tiene que tener dueño antes del cierre.
- Que los cargos de comisiones del extracto (626) aparezcan todos los meses: un mes sin comisiones suele ser un mes sin conciliar.

## Fuentes

- PGC (RD 1514/2007) y PGC PYMES (RD 1515/2007), quinta parte, grupo 5: cuentas 555 y 572/573/574/575; grupo 6: cuenta 626.
- Código de Comercio, arts. 25 y 29.
- Ley 37/1992 del IVA, art. 20.Uno.18.º a).
