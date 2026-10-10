---
id: 10413
titulo: "Pólizas de crédito"
resumen: "Cómo contabilizar una póliza o cuenta de crédito: disposiciones y reintegros en la 5201, liquidación de intereses y comisiones, presentación en el balance y por qué no debe llevarse como una cuenta bancaria en negativo."
palabras_clave: [póliza de crédito, cuenta de crédito, crédito dispuesto, límite, comisión de no disponibilidad, intereses, 5201, 170, 6623, 669, 572]
aplica_a: [pgc_normal, pgc_pymes, microempresas, autonomos]
vigente_desde: 2008-01-01
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/A9            # PGC, NRV 9.ª Instrumentos financieros (pasivos a coste amortizado)
  - BOE-A-2007-19884/grupo5-2      # PGC, quinta parte, grupo 5 (5201, 527, 572)
  - BOE-A-2007-19884/grupo1-2      # PGC, quinta parte, grupo 1 (subgrupo 17, cuenta 170)
  - BOE-A-2007-19884/grupo6-2      # PGC, quinta parte, grupo 6 (626, 662, 669)
  - BOE-A-2007-19966/A9            # PGC PYMES, NRV 9.ª Pasivos financieros
  - BOE-A-2014-12328/a16           # Ley del IS, art. 16: límite a los gastos financieros
  - BOE-A-1992-28740/a20           # Ley del IVA, art. 20.Uno.18.º: exención de créditos
otras_fuentes: []
relacionados: [10411, 10251, 10252, 10712, 11011, 11021]
consultas_sif: ["mayor:5201", "mayor:572", "mayor:6623", "mayor:669", "sumas_y_saldos"]
---

## En pocas palabras

Una póliza de crédito es un límite de dinero que el banco pone a disposición de la empresa y del que esta dispone y devuelve cuando quiere. Lo que se deba en cada momento es una deuda con el banco y va en la **5201 Deudas a corto plazo por crédito dispuesto**, no en la cuenta del banco con saldo negativo. Los intereses se pagan solo por lo dispuesto (6623); las comisiones por lo no dispuesto y por apertura son otros gastos financieros.

## Cuándo se aplica

Cuando el contrato fija un límite (por ejemplo, 50.000 €), un plazo de vigencia y un tipo de interés sobre el saldo dispuesto, y la empresa puede usar y reponer el dinero libremente dentro de ese límite. Suele funcionar como una cuenta corriente con su propio número y extracto.

No es una póliza de crédito:

- Un **préstamo** con cuadro de amortización y cuotas fijas (tema 10411).
- Un **descubierto** puntual en la cuenta corriente sin contrato de crédito: también es una deuda con el banco y se reclasifica al cierre a la 5200 o a la 5201, pero no tiene límite pactado.
- Las líneas de descuento de efectos o de *factoring*, que van en la 5208 y la 5209.

## Cómo se contabiliza

La deuda es un **pasivo financiero a coste amortizado** (NRV 9.ª del PGC, apartado 3.1; NRV 9.ª del PGC PYMES). La quinta parte del PGC define el movimiento de la **5201**: se abona por las cantidades dispuestas y por los gastos financieros que se cargan en la propia póliza, y se carga por las cancelaciones totales o parciales.

Cuentas habituales:

- **5201 Deudas a corto plazo por crédito dispuesto**: saldo dispuesto.
- **170 Deudas a largo plazo con entidades de crédito**: si la póliza vence a más de un año desde el cierre, el saldo dispuesto se presenta a largo plazo (definición del subgrupo 17). Lo habitual es que la póliza sea anual y vaya a corto.
- **6623 Intereses de deudas con entidades de crédito**: intereses sobre el saldo dispuesto.
- **669 Otros gastos financieros**: comisión de no disponibilidad y otras comisiones ligadas a la financiación. En el PGC normal, la comisión de apertura forma parte de los costes de transacción de la deuda; en la práctica, con pólizas anuales el efecto de repartirla es pequeño. En el PGC PYMES puede llevarse directamente a gasto (NRV 9.ª, apartado 2.1.1).
- **626 Servicios bancarios y similares**: solo servicios bancarios que no sean gastos financieros (por ejemplo, el mantenimiento de una cuenta). No es la cuenta de los intereses ni de las comisiones de la póliza.

Conviene una subcuenta de la 5201 por póliza (5201000001 Póliza Banco A, etc.) para conciliar cada una con su extracto, igual que una cuenta bancaria (tema 10251).

**Ejemplo.** Póliza de 50.000 € con un 5 % anual sobre lo dispuesto y una comisión trimestral de no disponibilidad del 0,10 % sobre el saldo medio no dispuesto. En el trimestre la empresa dispone de 30.000 € y los mantiene todo el periodo.

Disposición de 30.000 € pasándolos a la cuenta corriente:

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 572 Bancos e instituciones de crédito c/c vista, euros | 30.000,00 | |
| 5201 Deudas a corto plazo por crédito dispuesto | | 30.000,00 |
| **Total** | **30.000,00** | **30.000,00** |

Liquidación trimestral que el banco carga en la propia póliza: intereses 30.000 × 5 % × 3/12 = 375,00 €; comisión 20.000 × 0,10 % = 20,00 €:

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 6623 Intereses de deudas con entidades de crédito | 375,00 | |
| 669 Otros gastos financieros | 20,00 | |
| 5201 Deudas a corto plazo por crédito dispuesto | | 395,00 |
| **Total** | **395,00** | **395,00** |

Un cliente paga 10.000 € directamente en la póliza:

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 5201 Deudas a corto plazo por crédito dispuesto | 10.000,00 | |
| 430 Clientes | | 10.000,00 |
| **Total** | **10.000,00** | **10.000,00** |

Saldo acreedor de la 5201 tras los tres asientos: 30.000 + 395 − 10.000 = 20.395 €, que debe coincidir con el extracto de la póliza.

Si al cierre la última liquidación de intereses no coincide con el 31 de diciembre, los intereses devengados desde la última liquidación se registran con cargo a la 6623 y abono a la 527.

## Fiscalidad relacionada

- **IVA**: la concesión de créditos y su gestión por el propio prestamista están exentas (Ley del IVA, art. 20.Uno.18.º, letras c y d). Las comisiones de la póliza no llevan IVA.
- **Impuesto sobre Sociedades**: los intereses y comisiones financieras son deducibles con el límite general de gastos financieros netos (30 % del beneficio operativo, con un mínimo deducible de 1 millón de euros al año; Ley 27/2014, art. 16.1, redacción vigente en 2026).

## Errores frecuentes

- Llevar la póliza en la 572 con saldo acreedor. El balance muestra menos tesorería y menos deuda de las reales, y los ratios de liquidez salen mal.
- Registrar la póliza por el límite concedido. Solo se contabiliza lo dispuesto; el límite no dispuesto no es deuda, aunque conviene informarlo en la memoria.
- Contabilizar los intereses en la 626, o mezclar intereses y comisiones en una sola cuenta sin poder separarlos.
- No registrar las liquidaciones que el banco carga en la póliza: el saldo contable deja de cuadrar con el extracto.
- Mantener a corto plazo una póliza renovada a varios años, o a largo plazo una que vence en meses.

## Qué revisar en la contabilidad

- Cada subcuenta de la 5201 debe cuadrar al cierre de cada mes con el extracto de su póliza.
- La 5201 no puede tener saldo deudor (sería un saldo a favor de la empresa) ni un saldo acreedor mayor que el límite contratado más los intereses del último periodo.
- Ninguna subcuenta de la 572 debe tener saldo acreedor al cierre; si lo tiene, revisar si es una póliza mal clasificada o un descubierto.
- La 6623 de cada trimestre debe ser coherente con el saldo medio dispuesto por el tipo pactado.

## Fuentes

- PGC (RD 1514/2007), NRV 9.ª, apartado 3.1, y quinta parte: cuentas 5201 ("Deudas por cantidades dispuestas en póliza de crédito"), 527, 170, 626, 662 y 669.
- PGC PYMES (RD 1515/2007), NRV 9.ª Pasivos financieros, apartados 2.1.1 y 2.1.2.
- Ley 27/2014 del Impuesto sobre Sociedades, art. 16.1.
- Ley 37/1992 del IVA, art. 20.Uno.18.º.
