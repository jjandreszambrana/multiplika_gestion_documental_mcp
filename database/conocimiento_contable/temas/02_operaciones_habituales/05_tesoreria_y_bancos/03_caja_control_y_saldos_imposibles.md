---
id: 10253
titulo: "Caja: control y saldos imposibles"
resumen: "Cómo llevar la cuenta 570, hacer arqueos, detectar y corregir saldos de caja negativos o inverosímiles, y el límite de 1.000 € para pagos en efectivo con empresarios."
palabras_clave: [caja, efectivo, arqueo, saldo acreedor, caja negativa, descuadre, límite pagos en efectivo, 1.000 euros, 570, 571, 659]
aplica_a: [pgc_normal, pgc_pymes, microempresas, esfl, autonomos]
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/grupo5-2      # PGC, quinta parte, grupo 5 (cuentas 570/571)
  - BOE-A-2007-19966/grupo5-2      # PGC PYMES, quinta parte, grupo 5
  - BOE-A-2007-19884/grupo6-2      # PGC, quinta parte, grupo 6 (cuentas 659 y 678)
  - BOE-A-2007-19884/A3            # PGC, marco conceptual, 3.º Principios contables (no compensación)
  - BOE-A-1885-6627/art25          # Código de Comercio, art. 25: contabilidad ordenada y cronológica
  - BOE-A-1885-6627/art29          # Código de Comercio, art. 29: orden de fechas y corrección de errores
  - BOE-A-2012-13416/a7            # Ley 7/2012, art. 7: limitación de pagos en efectivo
otras_fuentes: []
relacionados: [10215, 10251, 10254, 10532, 11111, 11113]
consultas_sif: ["mayor:570", "mayor:571", "mayor:659", "sumas_y_saldos"]
---

## En pocas palabras

La cuenta 570 refleja el dinero en efectivo que hay en la empresa. Nunca puede tener saldo acreedor (negativo): no se puede sacar de la caja más dinero del que hay. Si la contabilidad lo muestra, hay cobros sin registrar, pagos anotados antes de tiempo o pagos que en realidad salieron del banco o del bolsillo del socio. También es sospechoso un saldo deudor muy alto y estable que no se corresponde con el efectivo real.

## Cuándo se aplica

En cualquier negocio que cobre o pague en efectivo, sobre todo en comercio minorista, hostelería y autónomos. El PGC define la caja como "disponibilidades de medios líquidos en caja", que se cargan a la entrada y se abonan a la salida, y la sitúa en el activo corriente. El Código de Comercio exige un seguimiento cronológico de las operaciones, por orden de fechas (arts. 25 y 29): el saldo de caja tiene que ser posible día a día, no solo al cierre.

## Cómo se aplica

**Organización mínima**

- Una subcuenta de la 570 por cada caja física (tienda, oficina, caja de gastos menores). La 571 para moneda extranjera.
- Libro o registro de caja con fecha, concepto, justificante, entrada, salida y saldo.
- Arqueo (recuento físico del efectivo) periódico, firmado por quien lo hace, comparado con el saldo de la 570 ese día.
- Los ingresos de efectivo en el banco se contabilizan como traspaso 572 / 570, no como cobro nuevo.

**Límite de pagos en efectivo.** No se pueden pagar en efectivo las operaciones en las que alguna de las partes actúe como empresario o profesional por un importe "igual o superior a 1.000 euros" (Ley 7/2012, art. 7, en la redacción vigente desde el 11 de julio de 2021). Se suman los pagos en que se fraccione una misma operación. Pagador y receptor responden solidariamente, y la sanción es del 25 % de lo pagado en efectivo. Hay que conservar durante cinco años los justificantes de los pagos hechos por otros medios.

**Causas típicas de un saldo acreedor**

| Causa | Corrección |
| --- | --- |
| Cobros en efectivo de clientes o ventas de mostrador sin registrar | Registrar las ventas o cobros con su fecha |
| Pagos contabilizados por caja que salieron del banco | Reclasificar contra la 572 |
| Gastos pagados por el socio o el autónomo con su dinero | Llevarlos a la 551 o 550, no a la 570 |
| Pagos anotados en una fecha anterior a la real | Corregir la fecha |
| Ingresos en banco contabilizados dos veces | Anular el duplicado |

**Ejemplo.** El mayor de la 570 de la tienda muestra un saldo de −640,00 € a 15 de marzo. Revisando el registro de caja se ve que (a) las ventas en efectivo del 10 al 14 de marzo (726,00 € con IVA) no se contabilizaron y (b) un pago de 150,00 € a un proveedor anotado por caja se hizo por transferencia. Tras corregir, el saldo queda en 236,00 € (−640,00 + 726,00 + 150,00), y el arqueo da 216,00 €: faltan 20,00 € sin justificar.

Asiento de corrección (15/03):

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 570 Caja, euros (ventas 726,00 + pago reclasificado 150,00) | 876,00 | |
| 700 Ventas de mercaderías | | 600,00 |
| 477 Hacienda Pública, IVA repercutido | | 126,00 |
| 572 Bancos e instituciones de crédito c/c vista, euros | | 150,00 |
| 659 Otras pérdidas en gestión corriente | 20,00 | |
| 570 Caja, euros (faltante del arqueo) | | 20,00 |
| **Total** | **896,00** | **896,00** |

La 570 queda en 216,00 €, igual que el arqueo. El faltante se registra aparte y no restándolo del cargo, por el principio de no compensación (PGC, marco conceptual, 3.º). En la práctica suelen hacerse tres asientos separados (ventas, reclasificación del pago y faltante), lo que deja más claro cada causa.

Un faltante pequeño y habitual va a la 659. La 678 (gastos excepcionales) es para importes excepcionales y significativos. Un **sobrante** no se lleva a ingresos sin más: casi siempre es una venta o un cobro sin registrar y hay que averiguar cuál.

## Fiscalidad relacionada

- Las ventas que aparecen al corregir un saldo negativo devengan IVA en su fecha y entran en el trimestre que corresponda. Si ese trimestre ya se declaró, hay que presentar una autoliquidación complementaria.
- Una caja negativa es un indicio claro de ingresos no registrados y puede llevar a la Administración a regularizar ventas no declaradas en una comprobación.
- Los pagos que superan el límite de 1.000 € en efectivo se sancionan con independencia de que el gasto sea real y deducible.

## Errores frecuentes

- Usar la 570 como cuenta puente para todo lo que no tiene justificante.
- Corregir el saldo negativo con un único asiento al cierre contra la 551 o la 129 (resultado), sin buscar la causa.
- No registrar las ventas diarias de mostrador o registrarlas por el importe ingresado en el banco.
- Saldo de caja de varios miles de euros durante todo el año en un negocio que ingresa el efectivo a diario.
- Pagos en efectivo a proveedores de 1.000 € o más, o fraccionados para no llegar.

## Qué revisar en la contabilidad

- Saldo diario de cada subcuenta de la 570: ningún día puede ser acreedor (no basta mirar el saldo a fin de mes).
- Saldo de la 570 frente a la facturación en efectivo: un saldo muy alto y fijo indica salidas no registradas.
- Pagos de la 570 por importe igual o superior a 1.000 €, o varios pagos al mismo proveedor el mismo día.
- Que los ingresos de efectivo en el banco tengan contrapartida 570 y no 700.
- Movimientos en la 659 por descuadres repetidos.

## Fuentes

- PGC (RD 1514/2007) y PGC PYMES (RD 1515/2007), quinta parte, grupo 5: cuentas 570/571; grupo 6: cuentas 659 y 678.
- PGC, marco conceptual, 3.º Principios contables: no compensación.
- Código de Comercio, arts. 25 y 29.
- Ley 7/2012, de 29 de octubre, art. 7 (limitación de pagos en efectivo).
