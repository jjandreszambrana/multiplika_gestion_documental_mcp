---
id: 10521
titulo: "Distribución del resultado: reservas legal y voluntarias, dividendos"
resumen: "Cómo aplicar el beneficio aprobado por la junta: reserva legal (10 % hasta el 20 % del capital), compensación de pérdidas, reservas voluntarias, remanente y dividendos (526, 557), con los límites de la Ley de Sociedades de Capital, la retención y un asiento de ejemplo."
palabras_clave: [aplicación del resultado, distribución de beneficios, reserva legal, reservas voluntarias, remanente, dividendos, dividendo a cuenta, 129, 112, 113, 120, 526, 557, 4751, modelo 123]
aplica_a: [pgc_normal, pgc_pymes, microempresas]
vigente_desde: 2016-06-17
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/grupo1-2      # PGC, quinta parte, grupo 1 (112, 113, 120, 121, 129)
  - BOE-A-2007-19884/grupo5-2      # PGC, quinta parte, grupo 5 (526, 557)
  - BOE-A-2010-10544/a4            # LSC, art. 4: reserva legal reforzada en SL con capital inferior a 3.000 €
  - BOE-A-2010-10544/a273          # LSC, art. 273: aplicación del resultado
  - BOE-A-2010-10544/a274          # LSC, art. 274: reserva legal
  - BOE-A-2010-10544/a276          # LSC, art. 276: momento y forma del pago del dividendo
  - BOE-A-2010-10544/a277          # LSC, art. 277: cantidades a cuenta de dividendos
  - BOE-A-2019-3422/ar-3           # Resolución ICAC 5-3-2019, art. 3.5: beneficio distribuible
  - BOE-A-2019-3422/ar-28          # Resolución ICAC 5-3-2019, art. 28: aplicación del resultado
  - BOE-A-2006-20764/a101          # Ley del IRPF, art. 101.4: retención del 19 % en capital mobiliario
  - BOE-A-2014-12328/a15           # Ley del IS, art. 15.a: retribución de fondos propios no deducible
otras_fuentes: []
relacionados: [10522, 10523, 10714, 10731, 10611, 10262]
consultas_sif: ["mayor:129", "mayor:112", "mayor:113", "mayor:120", "mayor:526", "mayor:557", "balance"]
---

## En pocas palabras

El resultado del año queda en la **129** hasta que la junta general decide su destino al aprobar las cuentas. Con el beneficio, por este orden: se compensan las pérdidas anteriores si el patrimonio neto es menor que el capital, se dota la **reserva legal** (10 % del beneficio hasta que alcance el 20 % del capital) y el resto se reparte como dividendo (**526**), se lleva a reservas voluntarias (**113**) o queda como remanente (**120**). El dividendo se paga con retención.

## Cuándo se aplica

Cada año, en la junta que aprueba las cuentas (tema 10731). El acuerdo se contabiliza en la fecha de la junta, no al cierre del ejercicio. Si hay pérdidas, la junta decide cómo compensarlas (tema 10522).

Límites al reparto de dividendos (LSC, arts. 273 y 274, y Resolución del ICAC de 5 de marzo de 2019, arts. 3.5 y 28):

1. **Reserva legal**: un 10 % del beneficio del ejercicio, hasta que llegue al menos al 20 % del capital (art. 274.1). En una SL con capital inferior a 3.000 €, al menos el 20 % del beneficio hasta que reserva legal y capital sumen 3.000 € (art. 4.1).
2. **Pérdidas anteriores**: si dejan el patrimonio neto por debajo del capital, el beneficio se destina primero a compensarlas (art. 273.2), antes de dotar la reserva legal (Resolución, art. 28.3).
3. **Patrimonio neto tras el reparto**: solo pueden repartirse dividendos con cargo al beneficio del ejercicio o a reservas de libre disposición si el patrimonio neto no es, ni queda tras el reparto, inferior al capital social. Para este cálculo no cuentan los beneficios imputados directamente al patrimonio neto, como las subvenciones (art. 273.2).
4. **I+D activado**: no se puede repartir mientras las reservas disponibles no cubran como mínimo los gastos de investigación y desarrollo que figuren en el activo (art. 273.3).
5. Las previsiones de los estatutos.

La prima de emisión y las aportaciones de socios de la 118 son distribuibles en los mismos términos que las reservas de libre disposición (Resolución, art. 3.5).

## Cómo se contabiliza

Cuentas (quinta parte del PGC):

- **129 Resultado del ejercicio**: se carga al aplicar el beneficio.
- **112 Reserva legal** y **113 Reservas voluntarias**: se abonan con cargo a la 129.
- **120 Remanente**: beneficio no aplicado a nada concreto.
- **526 Dividendo activo a pagar**: deuda con los socios desde el acuerdo. Se carga por la retención (con abono a la 4751) y por el pago.
- **557 Dividendo activo a cuenta**: dividendo acordado antes de aprobar las cuentas. Resta en los fondos propios y se cancela contra la 129 cuando la junta aplica el resultado.

**Ejemplo.** SL con capital de 30.000 €, reserva legal de 4.000 € y beneficio de 2025 de 50.000 €, sin pérdidas anteriores. Socios personas físicas. La junta de junio de 2026 acuerda repartir 30.000 € de dividendo.

Reserva legal: el 10 % sería 5.000 €, pero solo faltan 2.000 € para llegar al 20 % del capital (6.000 €), así que se dotan 2.000 €. El resto, 18.000 €, a reservas voluntarias.

Acuerdo de la junta:

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 129 Resultado del ejercicio | 50.000,00 | |
| 112 Reserva legal | | 2.000,00 |
| 113 Reservas voluntarias | | 18.000,00 |
| 526 Dividendo activo a pagar | | 30.000,00 |
| **Total** | **50.000,00** | **50.000,00** |

Pago con retención del 19 % (30.000 × 19 % = 5.700 €):

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 526 Dividendo activo a pagar | 30.000,00 | |
| 4751 Hacienda Pública, acreedora por retenciones practicadas | | 5.700,00 |
| 572 Bancos e instituciones de crédito c/c vista, euros | | 24.300,00 |
| **Total** | **30.000,00** | **30.000,00** |

Comprobación del límite del punto 3: tras el reparto, los fondos propios son 30.000 + 6.000 + 18.000 = 54.000 € (más las reservas voluntarias que hubiera), por encima del capital de 30.000 €.

**Dividendo a cuenta.** Puede acordarlo la junta o los administradores si formulan un estado contable que demuestre liquidez suficiente y el importe no supera el resultado desde el último cierre, menos pérdidas anteriores, dotaciones obligatorias a reservas y el impuesto estimado (LSC, art. 277). Asientos: al acordarlo, 557 a 526; al pagarlo, 526 a 4751 y 572; al aprobar las cuentas, la 129 se carga por el total y la 557 se abona por lo ya repartido a cuenta.

**Plazo de pago.** Si la junta no dice nada, el dividendo es pagadero desde el día siguiente al acuerdo, y en todo caso debe pagarse en un máximo de doce meses (LSC, art. 276).

## Fiscalidad relacionada

- **Retención**: el 19 % sobre el dividendo íntegro pagado a socios personas físicas (Ley del IRPF, art. 101.4, redacción vigente en 2026). Se ingresa con el modelo 123 y se resume en el 193. Para socios que son sociedades, la retención y sus excepciones están en el Reglamento del Impuesto sobre Sociedades; revisar cada caso.
- **Impuesto sobre Sociedades de la sociedad que reparte**: el dividendo no es gasto deducible, porque retribuye fondos propios (Ley 27/2014, art. 15.a).

## Errores frecuentes

- Contabilizar la aplicación del resultado al 31 de diciembre, antes de la junta.
- Olvidar la reserva legal o seguir dotándola cuando ya alcanza el 20 % del capital.
- Repartir dividendos con pérdidas anteriores sin compensar que dejan el patrimonio neto por debajo del capital.
- Repartir con cargo a subvenciones de la 130 o a otros ajustes del patrimonio neto.
- Pagar el dividendo sin retener, o llevar la retención a la 473 en lugar de la 4751.
- Dejar la 557 con saldo después de aprobar las cuentas.

## Qué revisar en la contabilidad

- Tras la junta, la 129 del ejercicio anterior debe quedar a cero.
- La 112 no debe ser inferior al 20 % de la 100 si en años anteriores hubo beneficio suficiente para dotarla.
- Cada cargo en la 526 por pago debe ir acompañado de un abono en la 4751 por la retención.
- La 526 no debe tener saldo de dividendos acordados hace más de doce meses.
- Si hay saldo en la 121, comprobar que no se han repartido dividendos indebidamente.

## Fuentes

- RDL 1/2010, Ley de Sociedades de Capital, arts. 4.1, 273, 274, 276 y 277.
- Resolución del ICAC de 5 de marzo de 2019, arts. 3.5 y 28.
- PGC (RD 1514/2007), quinta parte: cuentas 112, 113, 120, 121, 129, 526 y 557.
- Ley 35/2006 del IRPF, art. 101.4.
- Ley 27/2014 del Impuesto sobre Sociedades, art. 15.a.
