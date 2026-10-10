---
id: 10252
titulo: "Comisiones, intereses y gastos bancarios"
resumen: "En qué cuenta va cada cargo y abono del banco (626, 662, 665, 669, 769, 473), su IVA y el límite de gastos financieros del Impuesto sobre Sociedades, con asientos de ejemplo."
palabras_clave: [comisiones bancarias, intereses, gastos financieros, ingresos financieros, retención intereses, 626, 662, 6623, 665, 669, 769, 473]
aplica_a: [pgc_normal, pgc_pymes, microempresas, esfl, autonomos]
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/grupo6-2      # PGC, quinta parte, grupo 6 (626, 662, 665, 669)
  - BOE-A-2007-19884/grupo6        # PGC, cuarta parte, grupo 6 (subcuenta 6623)
  - BOE-A-2007-19884/grupo7-2      # PGC, quinta parte, grupo 7 (762, 769)
  - BOE-A-2007-19884/grupo4-2      # PGC, quinta parte, grupo 4 (473)
  - BOE-A-2007-19884/grupo5-2      # PGC, quinta parte, grupo 5 (5200, 5201)
  - BOE-A-2007-19966/grupo6-2      # PGC PYMES, quinta parte, grupo 6
  - BOE-A-2007-19966/grupo7-2      # PGC PYMES, quinta parte, grupo 7
  - BOE-A-1992-28740/a20           # Ley del IVA, art. 20.Uno.18.º: exención de operaciones financieras
  - BOE-A-2014-12328/a16           # Ley del Impuesto sobre Sociedades, art. 16: límite de gastos financieros
  - BOE-A-2014-12328/a128          # Ley del Impuesto sobre Sociedades, art. 128: retenciones (19 %)
  - BOE-A-2006-20764/a101          # Ley del IRPF, art. 101.4: retención del capital mobiliario (19 %)
otras_fuentes: []
relacionados: [10251, 10262, 10411, 10413, 10611, 10712, 10821, 10912]
consultas_sif: ["mayor:626", "mayor:662", "mayor:669", "mayor:769", "mayor:473"]
---

## En pocas palabras

Lo que el banco cobra por un servicio (mantenimiento, transferencias, tarjetas, avales) es un servicio exterior: cuenta **626**. Lo que cobra por prestar dinero (intereses de préstamos, pólizas y descubiertos) es gasto financiero: cuenta **662** (subcuenta 6623 para entidades de crédito). Los intereses que el banco paga a la empresa son ingreso financiero (**769**) y llevan normalmente una retención del 19 % que va a la **473**.

## Cuándo se aplica

En cada conciliación bancaria (tema 10251), para todos los cargos y abonos del extracto que no son pagos a proveedores ni cobros de clientes.

## Cómo se contabiliza

**Qué cuenta usar** (quinta parte del PGC y del PGC PYMES):

| Concepto del extracto | Cuenta |
| --- | --- |
| Comisión de mantenimiento, administración, transferencias, cuota de tarjeta, comisión por aval | 626 Servicios bancarios y similares |
| Intereses del préstamo, de la póliza de crédito o del descubierto | 662 Intereses de deudas (6623 con entidades de crédito) |
| Intereses por descuento de efectos y factoring | 665 Intereses por descuento de efectos y operaciones de factoring |
| Otros gastos de naturaleza financiera; seguros de riesgos financieros | 669 Otros gastos financieros |
| Intereses cobrados de cuentas y depósitos | 769 Otros ingresos financieros |
| Retención practicada por el banco sobre esos intereses | 473 Hacienda Pública, retenciones y pagos a cuenta |

La 626 recoge los servicios bancarios "que no tengan la consideración de gastos financieros". El criterio es qué se paga: un servicio (626) o el uso del dinero (66).

**Comisiones de apertura y estudio de un préstamo.** No van a la 626. El PGC dice que el préstamo se registra "por el importe recibido, minorado en los costes de la transacción", y que esos costes se llevan a gasto financiero (662) a lo largo de la vida del préstamo. Ver tema 10411.

**Asiento 1. Cargos del mes.** Comisión de mantenimiento de 15,00 € e intereses del descubierto de 40,00 €:

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 626 Servicios bancarios y similares | 15,00 | |
| 6623 Intereses de deudas con entidades de crédito | 40,00 | |
| 572 Bancos e instituciones de crédito c/c vista, euros | | 55,00 |
| **Total** | **55,00** | **55,00** |

**Asiento 2. Liquidación de intereses de un depósito.** Intereses brutos de 100,00 € con retención del 19 % (19,00 €), y el banco abona 81,00 €:

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 572 Bancos e instituciones de crédito c/c vista, euros | 81,00 | |
| 473 Hacienda Pública, retenciones y pagos a cuenta | 19,00 | |
| 769 Otros ingresos financieros | | 100,00 |
| **Total** | **100,00** | **100,00** |

El ingreso va por el **bruto**, no por lo que llega al banco. La 473 se descuenta después de la cuota del Impuesto sobre Sociedades o del IRPF (tema 10262).

Si los intereses se devengan en un ejercicio y se liquidan en el siguiente (por ejemplo, una liquidación trimestral de póliza a 31 de enero), al cierre se registra la parte devengada hasta el 31 de diciembre (tema 10712).

## Fiscalidad relacionada

- **IVA.** Están exentos los depósitos y cuentas corrientes y "las demás operaciones relacionadas con los mismos, incluidos los servicios de cobro o pago prestados por el depositario en favor del depositante", y también la concesión de préstamos y créditos (Ley del IVA, art. 20.Uno.18.º a y c). Por eso la mayoría de comisiones no llevan IVA y la 472 no se mueve. La exención **no** alcanza a los servicios de gestión de cobro de créditos, letras y recibos ni a los servicios al cedente en el factoring (salvo el anticipo de fondos). Si el banco emite factura con IVA por esos servicios, el IVA es soportado deducible con las reglas generales.
- **Retenciones sobre intereses.** El porcentaje es del 19 % en el Impuesto sobre Sociedades (Ley 27/2014, art. 128.6.a) y en el IRPF para el capital mobiliario (Ley 35/2006, art. 101.4), según la normativa vigente en 2026.
- **Límite de gastos financieros.** En el Impuesto sobre Sociedades, los gastos financieros netos (gastos menos ingresos financieros) son deducibles hasta el 30 % del beneficio operativo, pero siempre lo son hasta 1 millón de euros al año (Ley 27/2014, art. 16.1). En la mayoría de pymes no hay ajuste. El exceso se puede deducir en ejercicios siguientes.

## Errores frecuentes

- Llevar todo lo del banco a la 626, intereses incluidos. Infla los servicios exteriores, baja los gastos financieros y falsea el resultado de explotación y el EBITDA (tema 10912).
- Registrar los intereses cobrados por el neto y olvidar la 473: se pierde la retención en el impuesto.
- Contabilizar con IVA comisiones que están exentas.
- Cargar la comisión de apertura de un préstamo directamente a la 626 en el PGC normal o PYMES.
- Registrar los intereses de un préstamo mezclados con la amortización del capital, todo contra la 520 o la 170.

## Qué revisar en la contabilidad

- Que la 626 no tenga importes grandes y redondos que parezcan intereses o cuotas de préstamo.
- Que la 662 sea razonable frente a la deuda bancaria media (170 + 520) y su tipo de interés.
- Que cada abono en la 769 por intereses bancarios lleve su 473 del 19 % (salvo que el banco no haya retenido).
- Que el total de la 473 por intereses cuadre con el certificado de retenciones anual del banco.
- Que la 472 no recoja IVA de comisiones bancarias exentas.

## Fuentes

- PGC (RD 1514/2007), quinta parte: grupo 6, cuentas 626, 662, 665 y 669; grupo 7, cuentas 762 y 769; grupo 4, cuenta 473; grupo 5, cuentas 5200 y 5201. Cuarta parte, grupo 6: subcuenta 6623. Mismo contenido en el PGC PYMES (RD 1515/2007).
- Ley 37/1992 del IVA, art. 20.Uno.18.º
- Ley 27/2014 del Impuesto sobre Sociedades, arts. 16 y 128.6.
- Ley 35/2006 del IRPF, art. 101.4.
