---
id: 10242
titulo: "Seguros sociales y su pago"
resumen: "Cómo se liquidan y pagan cada mes las cuotas de la Seguridad Social (476), cómo se compensa la incapacidad temporal en pago delegado (471) y qué recargos hay por pagar tarde, con asientos de ejemplo."
palabras_clave: [seguros sociales, seguridad social, cuotas, TGSS, liquidación directa, pago delegado, incapacidad temporal, recargo, 476, 471, 642, 572]
aplica_a: [pgc_normal, pgc_pymes, microempresas, autonomos]
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/grupo4-2      # PGC, quinta parte, grupo 4 (cuentas 471 y 476)
  - BOE-A-2007-19884/grupo6-2      # PGC, quinta parte, grupo 6 (cuenta 642, 678)
  - BOE-A-2007-19966/grupo4-2      # PGC PYMES, quinta parte, grupo 4
  - BOE-A-2015-11724/a22           # LGSS, art. 22: sistemas de liquidación de cuotas
  - BOE-A-2015-11724/a29           # LGSS, art. 29: plazos de transmisión y compensación de prestaciones
  - BOE-A-2015-11724/a30           # LGSS, art. 30: recargos por ingreso fuera de plazo
  - BOE-A-2004-11836/a56           # Reglamento General de Recaudación de la Seguridad Social, art. 56: plazo de ingreso
  - BOE-A-2014-12328/a15           # Ley del Impuesto sobre Sociedades, art. 15: gastos no deducibles
otras_fuentes: []
relacionados: [10241, 10245, 10251, 10862, 11111]
consultas_sif: ["mayor:476", "mayor:471", "mayor:642", "mayor:572"]
---

## En pocas palabras

Cada mes la empresa debe a la Seguridad Social la cuota obrera que ha retenido en la nómina y su propia cuota patronal, las dos en la 476. Esa deuda se paga dentro del mes siguiente. Si la empresa ha adelantado al trabajador prestaciones de incapacidad temporal por cuenta de la Seguridad Social (pago delegado), las tiene en la 471 y las descuenta de lo que paga. Pagar fuera de plazo genera recargos del 10 % al 35 %.

## Cuándo se aplica

En todas las empresas y autónomos con trabajadores en el Régimen General. La cuota del propio autónomo en el RETA funciona distinto: se carga en cuenta dentro del mismo mes al que corresponde (art. 56.1.b del Reglamento General de Recaudación), así que normalmente no llega a quedar pendiente en la 476. La de los administradores y socios con control se trata en el tema 10245.

## Cómo se aplica

**Cómo se liquida.** Las cuotas del Régimen General se calculan por el Sistema de Liquidación Directa: la Tesorería General de la Seguridad Social (TGSS) calcula la cotización de cada trabajador con los datos que le envía la empresa (LGSS, art. 22.1.b). La empresa, o su asesoría, debe pedir ese cálculo hasta el **penúltimo día natural** del plazo de ingreso (LGSS, art. 29.2).

**Plazo de pago.** Las cuotas "se ingresarán dentro del mes siguiente al que corresponda su devengo" (Reglamento General de Recaudación, art. 56.1). Las de octubre se pagan como tarde el 30 de noviembre, normalmente por cargo en cuenta.

**Recargos por pagar tarde** (LGSS, art. 30, redacción vigente desde 2018):

| Situación | Recargo |
| --- | --- |
| Liquidación enviada en plazo, pago en el primer mes siguiente al vencimiento | 10 % |
| Liquidación enviada en plazo, pago a partir del segundo mes | 20 % |
| Liquidación no enviada en plazo, pago antes de que acabe el plazo de la reclamación | 20 % |
| Liquidación no enviada en plazo, pago después | 35 % |

**Asiento 1. Pago delegado de incapacidad temporal en la nómina.** En octubre la empresa paga a un trabajador de baja 300,00 € de prestación que corresponde a la Seguridad Social. No es sueldo: según el PGC, la 471 "se cargará por las prestaciones a cargo de la Seguridad Social".

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 471 Organismos de la Seguridad Social, deudores | 300,00 | |
| 465 Remuneraciones pendientes de pago | | 300,00 |
| **Total** | **300,00** | **300,00** |

(La 465 se cancela al pagar la nómina, igual que el resto del líquido.)

**Asiento 2. Pago de los seguros sociales de octubre (noviembre).** La 476 tiene 773,00 € (130,00 de cuota obrera y 643,00 de cuota patronal, ver tema 10241). La liquidación descuenta los 300,00 € de pago delegado, y la empresa paga 473,00 €.

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 476 Organismos de la Seguridad Social, acreedores | 773,00 | |
| 471 Organismos de la Seguridad Social, deudores | | 300,00 |
| 572 Bancos e instituciones de crédito c/c vista, euros | | 473,00 |
| **Total** | **773,00** | **773,00** |

La compensación solo se puede hacer si la liquidación se envió en plazo (LGSS, art. 29.5). Si no, la empresa paga la cuota entera y reclama lo adelantado aparte; la 471 queda pendiente hasta que se cobre.

**Asiento 3. Pago con recargo.** Si las cuotas de octubre (773,00 €, sin compensación) se pagan en diciembre habiendo enviado la liquidación en plazo, el recargo es del 10 %: 77,30 €.

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 476 Organismos de la Seguridad Social, acreedores | 773,00 | |
| 678 Gastos excepcionales (subcuenta de recargos) | 77,30 | |
| 572 Bancos e instituciones de crédito c/c vista, euros | | 850,30 |
| **Total** | **850,30** | **850,30** |

El recargo no se carga a la 642, que es solo para las cuotas devengadas. El PGC no tiene una cuenta propia para recargos; el PGC cita en la 678 "sanciones y multas". Se recomienda una subcuenta separada para poder identificarlos.

**Bonificaciones y reducciones.** La TGSS las aplica en la propia liquidación y reducen lo que se paga. El gasto de la 642 debe cuadrar con la cuota que resulta de la liquidación. Si se quiere separar el importe bonificado, se usa una subcuenta.

## Fiscalidad relacionada

- Las cuotas patronales de la 642 son gasto deducible en el Impuesto sobre Sociedades y en el IRPF del empresario.
- El art. 15.c de la Ley del Impuesto sobre Sociedades no admite como gasto "las multas y sanciones penales y administrativas, los recargos del período ejecutivo y el recargo por declaración extemporánea sin requerimiento previo". Si los recargos de la Seguridad Social entran o no en esa lista debe confirmarlo un profesional, a la vista de la doctrina de la Dirección General de Tributos.

## Errores frecuentes

- Contabilizar el pago de la Seguridad Social como gasto (642) en el momento del pago, además del asiento de devengo: el gasto queda duplicado y la 476 con saldo deudor.
- Pagar la liquidación con compensación de incapacidad temporal y cargar la 476 solo por lo pagado, con lo que queda un saldo de 476 que no existe y una 471 que no baja.
- Cargar la prestación de pago delegado en la 640 como si fuera sueldo.
- Juntar el recargo con la cuota en la 642.
- No contabilizar la cuota de diciembre en el ejercicio, porque se paga en enero.

## Qué revisar en la contabilidad

- Saldo de la 476 a fin de mes = liquidación de ese mes (cuota obrera + patronal). Si es mayor, hay meses sin pagar; si es deudor, hay pagos duplicados o compensaciones mal registradas.
- Cada cargo bancario de la TGSS (572) tiene su asiento contra la 476 por el mismo importe del recibo de liquidación.
- La 471 vuelve a cero cada mes cuando hay compensación. Un saldo antiguo indica prestaciones que no se han recuperado.
- La 678 (o la subcuenta de recargos) con movimientos repetidos indica pagos fuera de plazo que hay que comentar con el cliente.

## Fuentes

- PGC (RD 1514/2007) y PGC PYMES (RD 1515/2007), quinta parte, grupo 4: cuentas 471 y 476; grupo 6: cuentas 642 y 678.
- Texto refundido de la Ley General de la Seguridad Social (RDL 8/2015), arts. 22, 29 y 30.
- Reglamento General de Recaudación de la Seguridad Social (RD 1415/2004), art. 56.
- Ley 27/2014 del Impuesto sobre Sociedades, art. 15.c.
