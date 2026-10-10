---
id: 10225
titulo: "Facturas rectificativas: contabilización"
resumen: "Cómo registrar una factura rectificativa emitida o recibida según su causa (error de precio o de IVA, devolución, descuento, rappel, anulación), en qué cuentas va y cómo afecta al IVA repercutido o soportado del periodo."
palabras_clave: [factura rectificativa, abono, anulación de factura, error en factura, "708", "608", "477", "472", "430", "400", modelo 303, modificación de base imponible]
aplica_a: [pgc_normal, pgc_pymes, microempresas, autonomos]
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2012-14696/a15
  - BOE-A-2012-14696/a6
  - BOE-A-1992-28740/a80
  - BOE-A-1992-28740/a89
  - BOE-A-1992-28740/a114
  - BOE-A-2007-19884/grupo7-2
  - BOE-A-2007-19884/grupo6-2
  - BOE-A-2007-19884/grupo4-2
  - BOE-A-2007-19884/A22
otras_fuentes: []
relacionados: [10222, 10211, 10221, 10852, 10261, 10816, 10422, 10851]
consultas_sif: ["mayor:700", "mayor:708", "mayor:608", "mayor:477", "mayor:472", "mayor:430", "mayor:400", "iva"]
---

## En pocas palabras

Una factura emitida no se borra ni se modifica: si está mal o la operación cambia después, se emite otra, la **rectificativa**, en serie propia y citando la factura original. En contabilidad, la rectificativa se registra con signo contrario en la misma cuenta de ingreso o gasto si corrige un error, o en las cuentas de devoluciones, descuentos y rappels (708/709/706 en ventas; 608/609/606 en compras) si refleja un hecho posterior. El IVA se corrige en el periodo que marca la Ley del IVA, que depende de si la cuota sube o baja y de la causa.

## Cuándo se aplica

Es obligatorio emitir factura rectificativa (art. 15 del Reglamento de facturación) cuando:

- la factura original no cumple algún requisito del art. 6 o 7 (falta el NIF del cliente, fecha errónea...);
- las cuotas de IVA se calcularon mal (tipo equivocado, IVA en una operación exenta o al revés);
- se produce una causa de modificación de la base imponible del art. 80 de la Ley del IVA: devoluciones, descuentos o rappels posteriores, anulación de la operación, impago en concurso o crédito incobrable.

Requisitos prácticos: serie específica (art. 6.1.a), referencia a la factura o facturas rectificadas, y plazo de cuatro años desde el devengo o desde que ocurre la causa (art. 15.3). En rappels por volumen basta indicar el periodo (art. 15.4). Las facturas que sustituyen a una simplificada correcta no son rectificativas (art. 15.6).

## Cómo se contabiliza

**1. Error de precio en una venta (el emisor).** Se facturó 1.000 € más IVA (210 €) y el precio pactado era 800 €. La rectificativa es de -200 € de base y -42 € de IVA. Como es un error, se corrige la misma cuenta de ventas:

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 700 Ventas de mercaderías | 200,00 | |
| 477 Hacienda Pública, IVA repercutido | 42,00 | |
| 430 Clientes | | 242,00 |
| **Total** | **242,00** | **242,00** |

Si el error es de un ejercicio ya cerrado y sus cuentas ya se formularon, no se corrige contra la 700 del año en curso: se aplica la NRV 22.ª del PGC, que lleva el efecto a reservas.

**2. El mismo error, en el cliente (el receptor).** Abono a la 600 por 200 €, abono a la 472 por 42 € y cargo a la 400 por 242 €.

**3. Devolución, descuento o rappel posterior.** Va a las cuentas propias, no a la 700 ni a la 600:

- emisor: cargo a 708 (devoluciones y descuentos por defectos), 709 (rappels) o 706 (pronto pago);
- receptor: abono a 608, 609 o 606.

Ver los temas 10222 (ventas) y 10211 (compras).

**4. Solo el IVA estaba mal.** Venta de 1.000 € facturada al 21 % (210 €) cuando el tipo correcto era otro inferior. La rectificativa corrige solo la cuota: cargo a la 477 y abono a la 430 por la diferencia. La venta (700) no cambia.

**5. Anulación total.** Factura emitida a un cliente equivocado. Se emite rectificativa por el total con signo negativo, que deja el saldo de la 700, la 477 y la 430 de esa operación a cero, y una factura nueva al cliente correcto.

## Fiscalidad relacionada

**Emisor (IVA repercutido), art. 89 de la Ley del IVA:**

- Si la cuota **baja**, puede regularizarla en el 303 del periodo en que debe rectificar o en los siguientes hasta un año, devolviendo al cliente el IVA cobrado de más; o pedir la rectificación de la autoliquidación (art. 89.Cinco).
- Si la cuota **sube** por un error sin causa del art. 80, hay que presentar autoliquidación complementaria del periodo original, con recargo e intereses si procede. Si sube por una causa del art. 80 o por un error fundado de derecho, se incluye en el periodo en que se rectifica.

**Receptor (IVA soportado), art. 114:**

- Si la cuota deducida **baja** por una causa del art. 80 o un error fundado de derecho, se rectifica en el 303 del periodo en que **recibe** la rectificativa. Por otros errores, con declaración complementaria y recargo.
- Si **sube**, puede deducir la diferencia en el periodo en que la recibe o en los siguientes, dentro de los cuatro años.

**Impuesto sobre Sociedades**: el ingreso o el gasto se corrigen en el ejercicio que corresponda por devengo; si la rectificativa llega después del cierre y la causa ya existía, debió tenerse en cuenta al cerrar.

## Errores frecuentes

- Corregir la factura original en el programa (cambiar importes o borrarla) en lugar de emitir rectificativa.
- Numerar las rectificativas en la misma serie que las facturas ordinarias.
- Registrar la rectificativa recibida en el trimestre que le conviene a la empresa y no en el que la recibe.
- Usar la 708 para errores de facturación: infla las devoluciones y distorsiona el análisis de calidad.
- Olvidar la rectificativa de los rappels de final de año, con lo que el IVA repercutido queda de más.
- Rectificar a la baja el IVA de un crédito impagado sin cumplir los requisitos del art. 80 (plazos, reclamación, comunicación a la AEAT; tema 10422).

## Qué revisar en la contabilidad

- Libro de facturas emitidas: las rectificativas tienen serie propia y referencia a la original.
- Saldo negativo en la 700 de un mes o un cliente: suele ser una anulación mal llevada.
- Rectificativas recibidas registradas en el periodo de su recepción, con su efecto en la 472.
- Facturas con IVA corregido: el cambio solo afecta a la 477 o 472, no a la cuenta de ingreso o gasto.
- Cuadre entre las rectificativas del trimestre y las casillas de modificación de bases del 303.

## Fuentes

- RD 1619/2012, Reglamento de facturación: art. 15 (facturas rectificativas) y art. 6.1.a (serie específica).
- Ley 37/1992 del IVA: art. 80 (modificación de la base imponible), art. 89 (rectificación de cuotas repercutidas) y art. 114 (rectificación de deducciones).
- PGC, quinta parte, grupos 4, 6 y 7: cuentas 400, 430, 472, 477, 606, 608, 609, 706, 708 y 709.
- PGC, NRV 22.ª Cambios en criterios contables, errores y estimaciones contables (BOE-A-2007-19884/A22).
