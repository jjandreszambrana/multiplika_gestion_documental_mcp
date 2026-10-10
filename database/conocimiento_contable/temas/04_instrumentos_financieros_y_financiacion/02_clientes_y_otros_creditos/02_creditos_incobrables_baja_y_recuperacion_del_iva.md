---
id: 10422
titulo: "Créditos incobrables: baja y recuperación del IVA"
resumen: "Cómo dar de baja un cliente incobrable (650) y cómo recuperar el IVA repercutido y no cobrado con la modificación de la base imponible del art. 80 de la Ley del IVA: requisitos, plazos, factura rectificativa, comunicación a la AEAT y asientos."
palabras_clave: [créditos incobrables, insolvencia firme, modificación de la base imponible, recuperar IVA impagado, factura rectificativa, artículo 80 LIVA, concurso, 650, 436, 477, 490, 794, modelo 303]
aplica_a: [pgc_normal, pgc_pymes, microempresas, autonomos]
vigente_desde: 2023-01-01
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/grupo4-2      # PGC, quinta parte, grupo 4 (436, 477, 490)
  - BOE-A-2007-19884/grupo6-2      # PGC, quinta parte, grupo 6 (650)
  - BOE-A-2007-19884/grupo7-2      # PGC, quinta parte, grupo 7 (794)
  - BOE-A-1992-28740/a80           # Ley del IVA, art. 80: modificación de la base imponible
  - BOE-A-1992-28925/a24           # Reglamento del IVA, art. 24: requisitos y comunicación
  - BOE-A-2014-12328/a13           # Ley del IS, art. 13.1: deterioro de créditos
otras_fuentes: []
relacionados: [10421, 10225, 10261, 10852, 10816, 10821]
consultas_sif: ["mayor:436", "mayor:650", "mayor:477", "mayor:490", "iva"]
---

## En pocas palabras

Un crédito incobrable se da de baja con cargo a la **650 Pérdidas de créditos comerciales incobrables**, y si estaba deteriorado se revierte el deterioro (490 a 794). El IVA que se repercutió y nunca se cobró se puede recuperar reduciendo la base imponible (Ley del IVA, art. 80): factura rectificativa al cliente, comunicación a la AEAT en un mes y menor IVA repercutido en el modelo 303. Hay plazos estrictos: si se pasan, el IVA ya no se recupera.

## Cuándo se aplica

**Baja contable**: cuando la pérdida es definitiva (insolvencia firme): concurso concluido sin pago, sentencia o auto de insolvencia, acuerdo de quita, deudor desaparecido sin bienes, prescripción. Mientras solo sea dudoso, se dota deterioro (tema 10421).

**Recuperación del IVA**, por dos vías:

1. **Concurso del cliente** (art. 80.Tres): cuando, después del devengo, se dicta auto de declaración de concurso. La rectificativa no puede emitirse después de dos meses contados desde el fin del plazo de comunicación de créditos del concurso (el art. 80.Tres remite a la Ley Concursal); conviene actuar en cuanto se conozca el auto.
2. **Crédito incobrable sin concurso** (art. 80.Cuatro), si se cumplen todas estas condiciones:
   - que haya pasado **un año desde el devengo** del IVA sin cobrar. Si el acreedor tuvo un volumen de operaciones no superior a 6.010.121,04 € el año anterior, el plazo puede ser de **seis meses o un año**;
   - que conste en los libros registro de IVA;
   - que el cliente sea empresario o profesional o, si no lo es, que la base imponible supere 50 €;
   - que se haya **reclamado el cobro judicialmente, por requerimiento notarial** o por otro medio que acredite fehacientemente la reclamación.

La modificación por incobrable debe hacerse en los **seis meses siguientes** al fin del plazo de seis meses o un año.

No se puede modificar la base (art. 80.Cinco) en la parte con garantía real, avalada o asegurada; en créditos entre partes vinculadas; ni cuando el cliente no está establecido en el territorio de aplicación del impuesto, Canarias, Ceuta o Melilla (salvo procedimientos de insolvencia de otro Estado miembro). Tampoco por la vía de incobrables después del auto de concurso para operaciones anteriores a él.

## Cómo se aplica

Pasos para recuperar el IVA (Reglamento del IVA, art. 24):

1. Emitir y **enviar al cliente una factura rectificativa** que anule la cuota repercutida, y poder acreditar el envío. En concurso, enviar copia también a la administración concursal.
2. **Comunicarlo a la AEAT** por el formulario de su sede electrónica en el plazo de **un mes desde la fecha de la rectificativa**, con copia de la rectificativa y, si es incobrable, el documento de la reclamación judicial o notarial.
3. Restar la cuota en el **modelo 303** del periodo en que se emite la rectificativa.

Una vez reducida la base, no se vuelve a subir aunque luego se cobre, salvo que el cliente no sea empresario. Si el acreedor desiste de la reclamación judicial o llega a un acuerdo de cobro tras el requerimiento notarial, debe emitir una nueva rectificativa al alza en un mes (art. 80.Cuatro.C).

**Ejemplo** (continúa el del tema 10421). Factura de 1 de marzo de 2026: 10.000 € de base y 2.100 € de IVA. El crédito está en la 436 y deteriorado por 12.100 € en la 490. La empresa supera los 6.010.121,04 € de volumen de operaciones, así que el plazo es de un año, y presentó demanda judicial en noviembre de 2026. El año desde el devengo termina el 1 de marzo de 2027 y puede emitir la rectificativa hasta el 1 de septiembre de 2027. La emite el 15 de abril de 2027 y la comunica a la AEAT antes del 15 de mayo.

Rectificativa: se anula el IVA repercutido y se reduce el crédito contra el cliente en el mismo importe:

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 477 Hacienda Pública, IVA repercutido | 2.100,00 | |
| 436 Clientes de dudoso cobro | | 2.100,00 |
| **Total** | **2.100,00** | **2.100,00** |

Como esa parte ya no es una pérdida, se revierte su deterioro:

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 490 Deterioro de valor de créditos por operaciones comerciales | 2.100,00 | |
| 794 Reversión del deterioro de créditos por operaciones comerciales | | 2.100,00 |
| **Total** | **2.100,00** | **2.100,00** |

En 2028 el juzgado declara al deudor insolvente, sin bienes con los que pagar: insolvencia firme de la base pendiente:

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 650 Pérdidas de créditos comerciales incobrables | 10.000,00 | |
| 436 Clientes de dudoso cobro | | 10.000,00 |
| 490 Deterioro de valor de créditos por operaciones comerciales | 10.000,00 | |
| 794 Reversión del deterioro de créditos por operaciones comerciales | | 10.000,00 |
| **Total** | **20.000,00** | **20.000,00** |

El efecto neto en resultados de 2028 es cero (650 y 794 se compensan), porque la pérdida ya se reconoció en 2026 con la 694.

Si el crédito no estaba deteriorado, la baja es directa: 650 a 430 o 436 por el importe pendiente.

## Fiscalidad relacionada

- **Impuesto sobre Sociedades**: si el deterioro ya fue deducible (art. 13.1 de la Ley 27/2014), la baja definitiva no cambia nada. Si el deterioro no se dedujo (por ejemplo, crédito con una parte vinculada), conviene revisar con el tema 10821 cuándo y cómo se integra la pérdida.
- **Cliente que recibe la rectificativa**: debe minorar el IVA que dedujo en el 303 del periodo en que la recibe y comunicarlo a la AEAT (Reglamento del IVA, art. 24.2.b).

## Errores frecuentes

- Dejar pasar los plazos: los seis meses para emitir la rectificativa o el mes para comunicarla.
- Reclamar por burofax o correo y no por vía judicial, notarial u otro medio fehaciente.
- Rectificar la base de un cliente vinculado, extranjero o con crédito asegurado.
- Contabilizar la rectificativa como un abono por devolución de ventas (708) en lugar de reducir solo el IVA.
- Cobrar después parte del crédito de un cliente empresario y volver a repercutir el IVA.
- Dar de baja con la 650 sin revertir el deterioro, de modo que la pérdida se registra dos veces.

## Qué revisar en la contabilidad

- Saldos de la 436 con más de seis meses (o un año) desde la factura y sin rectificativa: comprobar plazos y reclamación.
- Cada rectificativa por impago debe tener su comunicación a la AEAT dentro del mes.
- La 650 del año debe ir acompañada de la reversión de la 490 por los mismos clientes, si estaban deteriorados.
- El IVA rectificado en el 303 debe coincidir con el cargo a la 477 por rectificativas de impago.

## Fuentes

- Ley 37/1992 del IVA, art. 80, apartados Tres, Cuatro y Cinco (redacción vigente desde el 1 de enero de 2023).
- RD 1624/1992, Reglamento del IVA, art. 24.
- PGC (RD 1514/2007), quinta parte: cuentas 436, 477, 490, 650 y 794.
- Ley 27/2014 del Impuesto sobre Sociedades, art. 13.1.
