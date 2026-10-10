---
id: 10712
titulo: "Periodificaciones: gastos e ingresos anticipados (480, 485) y devengados"
resumen: "Cómo imputar al ejercicio correcto los gastos e ingresos pagados o cobrados por adelantado (480, 485, 567, 568) y los ya devengados sin factura (4009, 4109, 4309, 527), con asientos de ejemplo al cierre y en la apertura."
palabras_clave: [periodificación, devengo, gastos anticipados, ingresos anticipados, 480, 485, 567, 568, 4009, 4109, 4309, 527, facturas pendientes de recibir]
aplica_a: [pgc_normal, pgc_pymes, microempresas]
vigente_desde: 2008-01-01
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/A3
  - BOE-A-2007-19884/grupo4
  - BOE-A-2007-19884/grupo4-2
  - BOE-A-2007-19884/grupo5-2
  - BOE-A-2014-12328/a11
  - BOE-A-1992-28740/a75
relacionados: [10711, 10714, 10212, 10252, 10261, 10411, 10821]
consultas_sif: ["mayor:480", "mayor:485", "mayor:567", "mayor:568", "mayor:4009", "mayor:4109", "mayor:4309", "mayor:527", "mayor:625", "mayor:628"]
---

## En pocas palabras

El principio de devengo obliga a llevar cada gasto e ingreso al ejercicio al que corresponde, no al del pago o la factura. Al cierre se corrigen dos situaciones: lo **contabilizado este año que es del siguiente** (gasto anticipado, cuenta 480; ingreso anticipado, cuenta 485) y lo **que es de este año pero aún no se ha contabilizado** porque falta la factura o el vencimiento (gastos e ingresos devengados).

## Cuándo se aplica

- **480 Gastos anticipados**: primas de seguro, cuotas anuales, mantenimientos o alquileres pagados por adelantado que cubren meses del año siguiente.
- **485 Ingresos anticipados**: cuotas, alquileres o servicios cobrados o facturados por adelantado.
- **567 / 568**: lo mismo, pero solo para intereses pagados o cobrados por anticipado.
- **Gastos devengados sin factura**: suministros, servicios o compras de diciembre cuya factura llega en enero (4009 Proveedores, facturas pendientes de recibir o de formalizar; 4109 Acreedores por prestaciones de servicios, facturas pendientes de recibir o de formalizar).
- **Ingresos devengados sin facturar**: trabajos hechos y no facturados a la fecha de cierre (4309 Clientes, facturas pendientes de formalizar).
- **Intereses devengados no vencidos** de préstamos (527 Intereses a corto plazo de deudas con entidades de crédito, con cargo a la 662).

Solo merece la pena periodificar importes significativos o recurrentes. Un gasto pequeño que se repite igual cada año no altera la imagen fiel.

## Cómo se contabiliza

Según la quinta parte del PGC, la 480 se carga al cierre con abono a las cuentas del grupo 6 que recogieron el gasto, y se abona al principio del ejercicio siguiente con cargo al grupo 6. La 485 funciona al revés con el grupo 7. Las dos figuran en el activo y el pasivo corriente, respectivamente.

### Ejemplo 1. Seguro pagado por anticipado

El 1 de octubre de 2026 la empresa paga 1.200 € por la póliza anual del local (1 de octubre a 30 de septiembre). Se contabilizó entero en la 625. A 31 de diciembre solo corresponden a 2026 tres meses (300 €); los nueve restantes (900 €) son de 2027.

Al cierre (31-12-2026):

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 480 Gastos anticipados | 900,00 | |
| 625 Primas de seguros | | 900,00 |
| **Total** | **900,00** | **900,00** |

En la apertura (1-1-2027) se hace el asiento contrario: 625 al Debe y 480 al Haber por 900 €.

### Ejemplo 2. Alquiler cobrado por anticipado

Un arrendador factura y cobra el 15 de diciembre de 2026 el alquiler de enero de 2027: 2.000 € de base. El ingreso se registró en la 752. Al cierre se pasa a 485:

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 752 Ingresos por arrendamientos | 2.000,00 | |
| 485 Ingresos anticipados | | 2.000,00 |
| **Total** | **2.000,00** | **2.000,00** |

El 1 de enero se revierte (485 al Debe, 752 al Haber).

### Ejemplo 3. Gasto devengado sin factura

La luz de diciembre de 2026 (estimada en 610 € de base) se facturará en enero. Al cierre:

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 628 Suministros | 610,00 | |
| 4109 Acreedores por prestaciones de servicios, facturas pendientes de recibir o de formalizar | | 610,00 |
| **Total** | **610,00** | **610,00** |

Cuando llegue la factura se carga la 4109 por 610 €, se registra el IVA soportado y se abona la 410 por el total. Si la factura definitiva difiere de la estimación, la diferencia va a la 628 del ejercicio nuevo.

### Ejemplo 4. Intereses devengados de un préstamo

La cuota del préstamo vence el 31 de enero de 2027 e incluye 615 € de intereses del periodo 1 de noviembre a 31 de enero. Corresponden a 2026 dos de los tres meses: 410 €.

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 662 Intereses de deudas | 410,00 | |
| 527 Intereses a corto plazo de deudas con entidades de crédito | | 410,00 |
| **Total** | **410,00** | **410,00** |

Al pagar la cuota en enero se cancela la 527 y solo los 205 € restantes van a la 662 de 2027.

## Fiscalidad relacionada

- **Impuesto sobre Sociedades**: los ingresos y gastos se imputan al periodo en que se devengan según la normativa contable (Ley 27/2014, art. 11.1). Una periodificación bien hecha no genera ajuste fiscal.
- **IVA**: la periodificación contable no cambia el devengo del IVA. En los pagos anticipados el IVA se devenga al cobrar (Ley 37/1992, art. 75.Dos), así que en el ejemplo 2 el IVA se repercute en diciembre aunque el ingreso sea de enero. En el ejemplo 3 no hay IVA soportado hasta tener la factura.

## Errores frecuentes

- Usar la 480 o la 485 durante el año en lugar de solo al cierre, y olvidarse de revertirlas en la apertura.
- Periodificar intereses en 480/485 en lugar de en 567/568.
- Registrar el IVA en el asiento de gasto devengado sin factura.
- No revisar al año siguiente que la 4009 o la 4109 han quedado a cero al llegar las facturas: se arrastran saldos antiguos.
- Periodificar la factura entera de un proveedor cuando solo una parte es del año siguiente.

## Qué revisar en la contabilidad

- 480, 485, 567 y 568 solo tienen movimientos en el asiento de cierre y en el de apertura.
- El saldo de 4009, 4109 y 4309 a mitad del ejercicio siguiente debería ser cero o muy pequeño; un saldo que se mantiene indica estimaciones no regularizadas.
- Gastos anuales (seguros, mantenimientos) con fecha de pago en el último trimestre: comprobar si hay apunte en 480.
- Préstamos con cuota que no vence a 31 de diciembre: comprobar si hay apunte en 527.
- Comparar la 628 o la 625 mes a mes: un mes sin gasto en diciembre suele indicar una factura no periodificada.

## Fuentes

- PGC (RD 1514/2007), primera parte, apartado 3.º.2 Devengo.
- PGC, cuarta parte, grupo 4 (subcuentas 4009, 4109 y 4309) y quinta parte, grupo 4 (cuentas 480 y 485) y grupo 5 (cuentas 527, 567 y 568).
- Ley 27/2014, del Impuesto sobre Sociedades, art. 11.1.
- Ley 37/1992, del IVA, art. 75 (devengo; apartado Dos, pagos anticipados).
