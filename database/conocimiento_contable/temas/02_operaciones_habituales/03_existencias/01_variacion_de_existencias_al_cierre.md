---
id: 10231
titulo: "Variación de existencias al cierre"
resumen: "Cómo se registran al cierre las existencias iniciales y finales (grupo 3 contra 610-612 y 710-713), por qué el saldo de la 610 sube o baja el gasto, y cómo se dota y revierte el deterioro de existencias (39, 693, 793), con asientos de ejemplo."
palabras_clave: [variación de existencias, inventario, cierre, "300", "310", "350", "610", "611", "712", "390", "693", "793", consumo de mercaderías]
aplica_a: [pgc_normal, pgc_pymes, microempresas]
vigente_desde: 2008-01-01
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/grupo3-2
  - BOE-A-2007-19884/grupo6-2
  - BOE-A-2007-19884/grupo7-2
  - BOE-A-2007-19884/A10
  - BOE-A-2007-19966/A12
  - BOE-A-2014-12328/a13
otras_fuentes: []
relacionados: [10211, 10221, 10222, 10711, 10714, 10722, 10924]
consultas_sif: ["mayor:300", "mayor:310", "mayor:350", "mayor:610", "mayor:611", "mayor:712", "mayor:390", "sumas_y_saldos"]
---

## En pocas palabras

Durante el año las compras se cargan en la 600 y las cuentas de existencias (grupo 3) no se tocan. Al cierre se hace el inventario y se sustituye el valor de las existencias iniciales por el de las finales. La diferencia va a la cuenta de variación de existencias (610 para mercaderías, 611 materias primas, 612 otros aprovisionamientos; 710 a 713 para productos fabricados). Así el gasto del año no son las compras, sino lo **consumido**: compras más existencias iniciales menos existencias finales.

## Cuándo se aplica

En el cierre de cada ejercicio (y en los cierres intermedios si la empresa los hace) de toda empresa con existencias: comercios, industrias, empresas de servicios con trabajos en curso. El PGC dice que las cuentas 300 a 369 "solamente funcionarán con motivo del cierre del ejercicio".

Las mercaderías en camino que ya son de la empresa según el contrato (por ejemplo, compradas en origen) también se incluyen en las existencias finales.

## Cómo se contabiliza

**1. Existencias de mercaderías.** Existencias iniciales: 20.000 €. Inventario a 31 de diciembre: 25.000 €.

Se da de baja el inventario inicial:

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 610 Variación de existencias de mercaderías | 20.000,00 | |
| 300 Mercaderías | | 20.000,00 |
| **Total** | **20.000,00** | **20.000,00** |

Se da de alta el inventario final:

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 300 Mercaderías | 25.000,00 | |
| 610 Variación de existencias de mercaderías | | 25.000,00 |
| **Total** | **25.000,00** | **25.000,00** |

La 610 queda con 5.000 € de saldo acreedor: el almacén ha crecido y ese importe de compras no se ha consumido, así que el gasto del año baja en 5.000 €. Si las compras netas fueron 100.000 €, el consumo de mercaderías es 95.000 €. Si el inventario hubiera bajado, la 610 quedaría con saldo deudor y aumentaría el gasto.

**2. Productos terminados y en curso.** En una fábrica, el mismo juego se hace con la 350 (productos terminados) o la 330 (en curso) contra la 712 o la 710. Estas cuentas están en el grupo 7: un aumento del inventario de productos se ve como un ingreso, porque refleja la producción del año que no se ha vendido todavía.

**3. Valoración del inventario.** Se valora a coste: precio de adquisición (factura menos descuentos, más portes y aranceles) o coste de producción (materiales, mano de obra directa y la parte de costes indirectos que corresponde a una actividad normal). Si los artículos son intercambiables, por precio medio ponderado o FIFO; el mismo método para existencias de naturaleza similar (NRV 10.ª del PGC; 12.ª del PGC PYMES).

**4. Deterioro.** Si el valor neto realizable (lo que se obtendría al vender, menos los costes de terminar y vender) es menor que el coste, hay que reconocer la pérdida. Supongamos que un lote de 4.000 € de coste solo se puede vender por 2.500 € netos:

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 693 Pérdidas por deterioro de existencias | 1.500,00 | |
| 390 Deterioro de valor de las mercaderías | | 1.500,00 |
| **Total** | **1.500,00** | **1.500,00** |

Al cierre siguiente se revierte el deterioro anterior (cargo a la 390, abono a la 793 Reversión del deterioro de existencias) y se dota el nuevo si sigue siendo necesario. No se deterioran las materias primas si los productos en que se van a usar se venderán por encima de su coste.

## Fiscalidad relacionada

- **Impuesto sobre Sociedades**: la variación de existencias forma parte del resultado contable, del que parte la base imponible. El deterioro de existencias no está entre los deterioros no deducibles del art. 13 de la Ley 27/2014, por lo que en general sigue el criterio contable; debe poder justificarse con el inventario y el cálculo del valor neto realizable.
- **IVA**: el inventario no tiene efecto. Sí pueden tenerlo las retiradas de existencias para uso particular del socio o del titular, que pueden ser autoconsumo gravado.

## Errores frecuentes

- No hacer el asiento de existencias y dejar en el balance el inventario del año anterior: el resultado sale mal en la diferencia entre ambos inventarios.
- Invertir los asientos (cargar la 610 por las finales), lo que duplica el error.
- Valorar el inventario a precio de venta.
- Hacer un solo asiento por la diferencia neta: el resultado es correcto, pero se pierde el detalle y los programas de cuentas anuales suelen esperar los dos movimientos.
- Usar la 610 para productos fabricados (va en la 71) o la 712 para mercaderías.
- Dotar el deterioro directamente contra la 300 en lugar de usar la 390.
- Inventarios hechos "de memoria" sin listado firmado por artículo, cantidad y coste.

## Qué revisar en la contabilidad

- El saldo de las 300 a 369 al cierre debe coincidir con el listado de inventario valorado.
- El saldo de apertura de la 300 de este año debe ser el saldo de cierre del anterior.
- Calcular el margen bruto con y sin variación de existencias: un salto brusco entre años suele indicar un inventario mal valorado (tema 10924, periodo medio de almacén).
- Existencias sin movimiento en más de un año: candidatas a deterioro.
- La 390 debe revertirse cada año; un saldo que no cambia nunca indica que no se revisa.

## Fuentes

- PGC, quinta parte, grupo 3: cuentas 300 a 369 y subgrupo 39 (BOE-A-2007-19884/grupo3-2).
- PGC, quinta parte, grupo 6: cuentas 610 a 612 y 693 (BOE-A-2007-19884/grupo6-2); grupo 7: cuentas 710 a 713 y 793 (BOE-A-2007-19884/grupo7-2).
- PGC, NRV 10.ª Existencias (BOE-A-2007-19884/A10); PGC PYMES, NRV 12.ª (BOE-A-2007-19966/A12).
- Ley 27/2014 del Impuesto sobre Sociedades, art. 13 (correcciones de valor).
