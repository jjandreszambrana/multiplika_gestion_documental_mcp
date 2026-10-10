---
id: 10222
titulo: "Descuentos, rappels y devoluciones de ventas"
resumen: "Cómo registrar descuentos en factura, pronto pago fuera de factura (706), devoluciones (708) y rappels (709) concedidos a clientes, la provisión por devoluciones esperadas al cierre (4999) y su efecto en el IVA repercutido."
palabras_clave: [descuentos sobre ventas, rappels, devoluciones de ventas, pronto pago, "706", "708", "709", "430", "4999", "477", cifra de negocios, factura rectificativa]
aplica_a: [pgc_normal, pgc_pymes, microempresas]
vigente_desde: 2021-01-01
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/grupo7-2
  - BOE-A-2007-19884/grupo4-2
  - BOE-A-2007-19884/A14
  - BOE-A-2007-19966/A16
  - BOE-A-2021-2155/a1-5
  - BOE-A-2021-2155/a2-6
  - BOE-A-2021-2155/a3-6
  - BOE-A-1992-28740/a78
  - BOE-A-1992-28740/a80
  - BOE-A-1992-28740/a89
  - BOE-A-2012-14696/a15
otras_fuentes: []
relacionados: [10211, 10221, 10225, 10231, 10261, 10852, 10712, 10821]
consultas_sif: ["mayor:706", "mayor:708", "mayor:709", "mayor:430", "mayor:4999", "mayor:477", "iva"]
---

## En pocas palabras

Todo lo que reduce el precio de venta reduce también la cifra de negocios, nunca es un gasto. Si la rebaja va en la propia factura, simplemente se factura menos. Si llega después, va a cuentas propias que restan de las ventas: 706 (pronto pago fuera de factura), 708 (devoluciones y descuentos por defectos o incumplimientos) y 709 (rappels por volumen). En las tres se rebaja también el IVA repercutido, con factura rectificativa.

## Cuándo se aplica

- **Descuento comercial en factura**: se registra la venta por el neto. El precio de adquisición del cliente y la base del IVA ya vienen rebajados (art. 78.Tres.2.º de la Ley del IVA).
- **Pronto pago fuera de factura** (706): el cliente paga antes de lo pactado y se le reconoce un descuento.
- **Devoluciones y descuentos posteriores por defectos** (708): mercancía devuelta o rebaja porque llegó tarde o con defectos.
- **Rappels** (709): descuentos por haber alcanzado un volumen de compras.
- **Devoluciones esperadas al cierre**: si la empresa vende con derecho de devolución, no reconoce ingreso por lo que espera que le devuelvan (art. 24 de la Resolución del ICAC de 2021, aplicable al PGC normal y subsidiariamente a pymes).

## Cómo se contabiliza

**1. Rappel anual.** Un cliente ha comprado 50.000 € en el año y le corresponde un 2 %: 1.000 € más IVA al 21 % (210 €). Se emite factura rectificativa por el periodo, sin necesidad de identificar cada factura (art. 15.4 del Reglamento de facturación).

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 709 «Rappels» sobre ventas | 1.000,00 | |
| 477 Hacienda Pública, IVA repercutido | 210,00 | |
| 430 Clientes | | 1.210,00 |
| **Total** | **1.210,00** | **1.210,00** |

**2. Devolución.** El cliente devuelve mercancía por 2.000 € de base: cargo a la 708 por 2.000 €, cargo a la 477 por 420 € y abono a la 430 por 2.420 €. Si la devolución se compensa en la siguiente factura al mismo cliente y al mismo tipo de IVA, no hace falta rectificativa: basta restarla en esa factura (art. 15.2 del Reglamento de facturación).

**3. Pronto pago fuera de factura.** El cliente paga una factura de 10.000 € a los diez días y se le concede un 1 %: cargo a la 706 por 100 €, cargo a la 477 por 21 € y abono a la 430 por 121 €.

**4. Rappel devengado y no liquidado al cierre.** Si al 31 de diciembre el rappel ya se ha ganado pero se liquida en enero, el gasto es de este año: se carga la 709 con abono a la 4999 si el importe es estimado, o a la propia cuenta del cliente (430) si ya está cerrado, y se emite la rectificativa al liquidarlo. El IVA se corrige cuando se emite la rectificativa.

**5. Provisión por devoluciones esperadas.** En diciembre se han vendido 100.000 € de un producto que los clientes pueden devolver en 60 días; por experiencia vuelve el 3 % (3.000 €), con un coste del 60 % (1.800 €). La resolución del ICAC manda reconocer la provisión con cargo a la 708 (art. 34.3.a) y un activo por el derecho a recuperar los productos, que se registra como menor gasto en la variación de existencias o en el consumo (art. 34.13).

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 708 Devoluciones de ventas y operaciones similares | 3.000,00 | |
| 4999 Provisión para otras operaciones comerciales | | 3.000,00 |
| 300 Mercaderías (derecho a recuperar productos) | 1.800,00 | |
| 610 Variación de existencias de mercaderías | | 1.800,00 |
| **Total** | **4.800,00** | **4.800,00** |

Al año siguiente se revierte y se registran las devoluciones reales. El IVA no se toca hasta que la devolución ocurre de verdad. La provisión y el activo no se compensan entre sí en el balance (art. 24.3).

## Fiscalidad relacionada

- **IVA**: las rebajas posteriores a la venta reducen la base imponible (art. 80.Uno.2.º y Dos) y obligan a rectificar la cuota repercutida (art. 89) con factura rectificativa (art. 15 del Reglamento de facturación). Cuando la rectificación rebaja la cuota, la empresa puede regularizarla en el 303 del periodo en que debe rectificar o en los de los doce meses siguientes, y devolver al cliente el IVA cobrado de más (art. 89.Cinco).
- **Impuesto sobre Sociedades**: las provisiones tienen reglas propias de deducibilidad en la Ley 27/2014; antes del cierre conviene comprobar si la provisión por devoluciones exige ajuste (tema 10821).

## Errores frecuentes

- Registrar el rappel o el pronto pago concedido como gasto financiero (665) o como otro gasto: son menos ventas y reducen la cifra de negocios.
- Restar la devolución directamente de la 700: el PGC tiene la 708 para eso y la información se pierde.
- Conceder rappels sin emitir rectificativa, con lo que el IVA repercutido queda de más.
- No reconocer al cierre rappels ya ganados por los clientes.
- Usar la 708 para anular una factura emitida por error (ver tema 10225).

## Qué revisar en la contabilidad

- Las 706, 708 y 709 deben tener saldo deudor; uno acreedor indica asientos invertidos.
- Comparar el saldo de la 709 con los acuerdos comerciales de rappels del año.
- Cada movimiento de la 708 y la 709 debe tener su cargo en la 477 (o justificarse por qué no, como en las entregas intracomunitarias).
- Al cierre, revisar si hay rappels devengados sin registrar y si el negocio tiene devoluciones habituales que exijan provisión.
- Facturas rectificativas emitidas en serie propia frente a los cargos en 706, 708 y 709.

## Fuentes

- PGC, quinta parte, grupo 7: cuentas 706, 708 y 709 (BOE-A-2007-19884/grupo7-2); grupo 4: cuentas 430 y 4999 (BOE-A-2007-19884/grupo4-2).
- PGC, NRV 14.ª.3 Valoración (BOE-A-2007-19884/A14); PGC PYMES, NRV 16.ª (BOE-A-2007-19966/A16).
- Resolución del ICAC de 10 de febrero de 2021: art. 13 (contraprestación variable), art. 24 (ventas con derecho a devolución) y art. 34 (cifra de negocios).
- Ley 37/1992 del IVA: arts. 78, 80 y 89.
- RD 1619/2012, Reglamento de facturación, art. 15 (facturas rectificativas).
