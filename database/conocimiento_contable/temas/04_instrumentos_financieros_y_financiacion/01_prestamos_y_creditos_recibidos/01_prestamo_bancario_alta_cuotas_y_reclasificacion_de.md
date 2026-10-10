---
id: 10411
titulo: "Préstamo bancario: alta, cuotas y reclasificación del corto plazo"
resumen: "Cómo registrar un préstamo bancario recibido (170 y 5200), sus cuotas de capital e intereses (6623) y el traspaso al cierre de la parte que vence en los doce meses siguientes, con asiento de ejemplo."
palabras_clave: [préstamo bancario, cuadro de amortización, cuota, intereses, corto plazo, reclasificación, coste amortizado, 170, 5200, 527, 6623, 572]
aplica_a: [pgc_normal, pgc_pymes, microempresas, autonomos]
vigente_desde: 2008-01-01
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/A9            # PGC, NRV 9.ª Instrumentos financieros (pasivos a coste amortizado)
  - BOE-A-2007-19884/grupo1-2      # PGC, quinta parte, grupo 1 (subgrupo 17, cuenta 170)
  - BOE-A-2007-19884/grupo5-2      # PGC, quinta parte, grupo 5 (5200, 527)
  - BOE-A-2007-19884/grupo6-2      # PGC, quinta parte, grupo 6 (662, 669)
  - BOE-A-2007-19966/A9            # PGC PYMES, NRV 9.ª Pasivos financieros
  - BOE-A-2019-3422/ar-6           # Resolución ICAC 5-3-2019, art. 6: costes de transacción
  - BOE-A-2014-12328/a16           # Ley del IS, art. 16: límite a los gastos financieros
  - BOE-A-1992-28740/a20           # Ley del IVA, art. 20.Uno.18.º: exención de préstamos
  - BOE-A-1993-25359/a45           # TRLITPAJD, art. 45.I.B.15: exención de préstamos en TPO
otras_fuentes: []
relacionados: [10413, 10252, 10321, 10712, 10714, 11021]
consultas_sif: ["mayor:170", "mayor:5200", "mayor:527", "mayor:6623", "sumas_y_saldos"]
---

## En pocas palabras

Un préstamo bancario es una deuda que se registra por el importe recibido. La parte que se devuelve en más de un año va en la 170 y la que vence en los doce meses siguientes en la 5200. Cada cuota se divide en capital, que reduce la deuda, e intereses, que son gasto (6623). Al cierre se traspasa de la 170 a la 5200 el capital que vence el año siguiente.

## Cuándo se aplica

Cuando una entidad de crédito entrega a la empresa una cantidad fija que se devuelve en cuotas según un cuadro de amortización. Si lo que se firma es un límite del que se dispone y se devuelve a voluntad, es una póliza de crédito (tema 10413). Si el banco financia un bien concreto con opción de compra, es un leasing (tema 10321).

Si el prestamista no es una entidad de crédito se usan la 171 y la 521; si es una parte vinculada (por ejemplo, un socio), las del subgrupo 16 y 51 o la cuenta corriente del tema 10532.

## Cómo se contabiliza

El PGC clasifica estos préstamos como **pasivos financieros a coste amortizado** (NRV 9.ª, apartado 3.1). Se valoran al principio por lo recibido menos los costes de transacción (comisión de apertura, notario), y después los intereses se imputan con el **tipo de interés efectivo**: el que iguala lo recibido con todos los pagos futuros. Si no hay comisiones, coincide con el tipo del contrato.

Las comisiones y gastos de formalización:

- **PGC normal**: reducen el valor inicial de la deuda y se van imputando como gasto financiero durante la vida del préstamo a través del tipo efectivo (lo desarrolla el tema de coste amortizado, 4.1.2).
- **PGC PYMES y microempresas**: pueden llevarse directamente a la cuenta de pérdidas y ganancias el día de la firma (NRV 9.ª del PGC PYMES, apartado 2.1.1, y art. 6.1 de la Resolución del ICAC de 5 de marzo de 2019), normalmente a la 669 Otros gastos financieros.

Cuentas que intervienen (quinta parte del PGC):

- **170 Deudas a largo plazo con entidades de crédito**: se abona al formalizar por el importe recibido menos los costes de transacción.
- **5200 Préstamos a corto plazo de entidades de crédito**: la parte con vencimiento no superior a un año. La definición del subgrupo 17 obliga a traspasar a corto la parte de la deuda a largo que vence a corto.
- **527 Intereses a corto plazo de deudas con entidades de crédito**: intereses devengados y no pagados al cierre.
- **6623 Intereses de deudas con entidades de crédito**: el gasto por intereses.

**Ejemplo.** El 1 de enero de 2026 el banco concede un préstamo de 60.000 € a 5 años, al 4 % anual, con cuota anual constante (sistema francés) de 13.477,63 € que se paga cada 31 de diciembre. Sin comisiones. Cuadro de los dos primeros años:

| Año | Cuota | Intereses | Capital | Pendiente |
| --- | --- | --- | --- | --- |
| 2026 | 13.477,63 | 2.400,00 | 11.077,63 | 48.922,37 |
| 2027 | 13.477,63 | 1.956,89 | 11.520,73 | 37.401,64 |

1 de enero de 2026, alta del préstamo. El capital de la primera cuota ya vence en menos de un año:

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 572 Bancos e instituciones de crédito c/c vista, euros | 60.000,00 | |
| 170 Deudas a largo plazo con entidades de crédito | | 48.922,37 |
| 5200 Préstamos a corto plazo de entidades de crédito | | 11.077,63 |
| **Total** | **60.000,00** | **60.000,00** |

31 de diciembre de 2026, pago de la primera cuota:

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 5200 Préstamos a corto plazo de entidades de crédito | 11.077,63 | |
| 6623 Intereses de deudas con entidades de crédito | 2.400,00 | |
| 572 Bancos e instituciones de crédito c/c vista, euros | | 13.477,63 |
| **Total** | **13.477,63** | **13.477,63** |

31 de diciembre de 2026, reclasificación del capital que vence en 2027:

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 170 Deudas a largo plazo con entidades de crédito | 11.520,73 | |
| 5200 Préstamos a corto plazo de entidades de crédito | | 11.520,73 |
| **Total** | **11.520,73** | **11.520,73** |

Tras estos asientos, la 170 queda en 37.401,64 € y la 5200 en 11.520,73 €: entre las dos suman los 48.922,37 € pendientes del cuadro.

Con cuotas mensuales el mecanismo es el mismo: cada mes se carga la 5200 por el capital y la 6623 por el interés, y al cierre se traspasa a la 5200 el capital de las doce cuotas siguientes. Si la última cuota pagada no coincide con el cierre, los intereses devengados desde esa fecha se registran con cargo a la 6623 y abono a la 527.

## Fiscalidad relacionada

- **IVA**: la concesión de préstamos y las operaciones de gestión que hace el propio prestamista están exentas (Ley del IVA, art. 20.Uno.18.º, letras c y d). Las comisiones de apertura o estudio no llevan IVA.
- **Transmisiones Patrimoniales**: los préstamos están exentos (TRLITPAJD, art. 45.I.B.15). Los hipotecarios formalizados en escritura tienen su propio régimen en Actos Jurídicos Documentados, que no se trata aquí.
- **Impuesto sobre Sociedades**: los intereses son deducibles, pero los gastos financieros netos tienen un límite del 30 % del beneficio operativo; en todo caso se deducen hasta 1 millón de euros al año (Ley 27/2014, art. 16.1, redacción vigente en 2026). Para la mayoría de pymes el millón hace que el límite no se note.

## Errores frecuentes

- Contabilizar la cuota entera como gasto, o entera contra la deuda. Hay que separar capital e intereses con el cuadro del banco.
- Registrar todo el préstamo en la 170 y no reclasificar nunca: el balance muestra un fondo de maniobra mejor del real.
- Registrar todo en la 5200 aunque venza a cinco años.
- Llevar el préstamo como una cuenta bancaria más (572 en negativo).
- No registrar la comisión de apertura, o en el PGC normal llevarla a gasto de golpe.
- No contabilizar los intereses devengados y no pagados al cierre.

## Qué revisar en la contabilidad

- La suma de la 170 y la 5200 de cada préstamo debe coincidir con el capital pendiente del cuadro de amortización y del certificado del banco al cierre.
- La 5200 debe recoger exactamente el capital que vence en los doce meses siguientes.
- La 6623 del año debe cuadrar con la suma de los intereses del cuadro en ese periodo.
- Ninguna subcuenta de la 170 o la 5200 debe tener saldo deudor.
- Un préstamo que se terminó de pagar debe tener las subcuentas a cero.

## Fuentes

- PGC (RD 1514/2007), NRV 9.ª Instrumentos financieros, apartado 3.1 "Pasivos financieros a coste amortizado", y quinta parte: subgrupo 17 y cuenta 170, cuentas 5200 y 527, cuentas 662 y 669.
- PGC PYMES (RD 1515/2007), NRV 9.ª Pasivos financieros, apartado 2.1.1: los costes de transacción "podrán registrarse en la cuenta de pérdidas y ganancias en el momento de su reconocimiento inicial".
- Resolución del ICAC de 5 de marzo de 2019, art. 6.1.
- Ley 27/2014 del Impuesto sobre Sociedades, art. 16.1.
- Ley 37/1992 del IVA, art. 20.Uno.18.º.
- RDL 1/1993, Texto refundido del ITPAJD, art. 45.I.B.15.
