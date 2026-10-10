---
id: 10261
titulo: "IVA soportado y repercutido: cuentas y liquidación trimestral (472, 477, 4700, 4750)"
resumen: "Cómo se registra el IVA de compras (472) y ventas (477), el asiento de liquidación de cada trimestre con resultado a ingresar (4750) o a compensar o devolver (4700), y los plazos del modelo 303 vigentes en 2026."
palabras_clave: [IVA soportado, IVA repercutido, liquidación de IVA, modelo 303, modelo 390, a compensar, devolución, 472, 477, 4700, 4750, 4709]
aplica_a: [pgc_normal, pgc_pymes, microempresas, esfl, autonomos]
vigente_desde: 2008-01-01
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/grupo4-2      # PGC, quinta parte, grupo 4 (472, 477, 4700, 4709, 4750)
  - BOE-A-2007-19966/grupo4-2      # PGC PYMES, quinta parte, grupo 4
  - BOE-A-1992-28740/a90           # Ley del IVA, art. 90: tipo general del 21 %
  - BOE-A-1992-28740/a91           # Ley del IVA, art. 91: tipos reducidos del 10 % y 4 %
  - BOE-A-1992-28740/a99           # Ley del IVA, art. 99: ejercicio del derecho a deducir y compensación
  - BOE-A-1992-28740/a115          # Ley del IVA, art. 115: devolución al final del año
  - BOE-A-1992-28740/a164          # Ley del IVA, art. 164: obligaciones de los sujetos pasivos
  - BOE-A-1992-28925/a71           # Reglamento del IVA, art. 71: periodos y plazos de liquidación
otras_fuentes:
  - nombre: "AEAT, Modelo 303. IVA. Autoliquidación"
    url: https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G414.shtml
    consultado: 2026-10-10
  - nombre: "AEAT, Modelo 390. IVA. Declaración resumen anual"
    url: https://sede.agenciatributaria.gob.es/Sede/procedimientoini/G412.shtml
    consultado: 2026-10-10
  - nombre: "AEAT, Manual práctico de IVA 2026"
    url: https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/manual-iva-2026/presentacion.html
    consultado: 2026-10-10
relacionados: [10211, 10213, 10225, 10262, 10811, 10812, 10816, 11112]
consultas_sif: ["mayor:472", "mayor:477", "mayor:4700", "mayor:4750", "iva", "sumas_y_saldos"]
---

## En pocas palabras

El IVA de las facturas recibidas que se puede deducir se carga en la **472**; el de las facturas emitidas se abona en la **477**. Al final de cada trimestre (o mes) se cancelan las dos cuentas entre sí. Si el repercutido es mayor, la diferencia es una deuda con Hacienda (**4750**) que se paga con el modelo 303. Si el soportado es mayor, la diferencia es un derecho (**4700**) que se compensa en los periodos siguientes o se pide devolver en el último periodo del año.

## Cuándo se aplica

A todo empresario o profesional que repercute IVA y presenta el modelo 303. No se usa así en el recargo de equivalencia (el comerciante no liquida IVA) ni para el IVA que no es deducible: ese IVA es más coste de la compra o del inmovilizado y nunca pasa por la 472.

## Cómo se contabiliza

**Cuentas** (quinta parte del PGC y del PGC PYMES):

- **472 Hacienda Pública, IVA soportado**: IVA devengado en adquisiciones "que tenga carácter deducible". Se carga con cada factura recibida y se abona en la liquidación contra la 477.
- **477 Hacienda Pública, IVA repercutido**: IVA de entregas y servicios. Se abona con cada factura emitida y se carga en la liquidación contra la 472.
- **4750 Hacienda Pública, acreedora por IVA**: exceso de repercutido sobre soportado; se carga al pagar.
- **4700 Hacienda Pública, deudora por IVA**: exceso de soportado sobre repercutido; se abona al compensarlo en un periodo posterior (contra la 477) o al cobrar la devolución (contra la 572).

**Periodos y plazos** (Reglamento del IVA, art. 71, vigente en 2026):

- Periodo trimestral, como regla general. Mensual para quienes superaron 6.010.121,04 € de volumen de operaciones el año anterior, los inscritos en el registro de devolución mensual y los grupos de entidades.
- Trimestral: se presenta en los **veinte primeros días naturales** del mes siguiente al trimestre; el cuarto trimestre, en los **treinta primeros días de enero**.
- Mensual con SII: treinta primeros días naturales del mes siguiente (el de enero, hasta el último día de febrero).
- Además, resumen anual (modelo 390), salvo los exonerados por orden ministerial.

**Ejemplo, tercer trimestre de 2026.** Ventas de 40.000,00 € al 21 % (tipo general, Ley del IVA, art. 90): IVA repercutido de 8.400,00 €. Compras y gastos deducibles de 25.000,00 €: IVA soportado de 5.250,00 €.

Asiento de liquidación (30/09):

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 477 Hacienda Pública, IVA repercutido | 8.400,00 | |
| 472 Hacienda Pública, IVA soportado | | 5.250,00 |
| 4750 Hacienda Pública, acreedora por IVA | | 3.150,00 |
| **Total** | **8.400,00** | **8.400,00** |

Pago del modelo 303 (hasta el 20 de octubre):

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 4750 Hacienda Pública, acreedora por IVA | 3.150,00 | |
| 572 Bancos e instituciones de crédito c/c vista, euros | | 3.150,00 |
| **Total** | **3.150,00** | **3.150,00** |

**Variante: resultado a compensar.** Si en el segundo trimestre el soportado fue 6.000,00 € y el repercutido 4.500,00 €:

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 477 Hacienda Pública, IVA repercutido | 4.500,00 | |
| 4700 Hacienda Pública, deudora por IVA | 1.500,00 | |
| 472 Hacienda Pública, IVA soportado | | 6.000,00 |
| **Total** | **6.000,00** | **6.000,00** |

En el trimestre siguiente, el saldo de la 4700 se aplica contra la 477 (el PGC: "en caso de compensación en declaración-liquidación posterior, con cargo a la cuenta 477"). Con los datos del tercer trimestre, el asiento sería 477 por 8.400,00 al Debe y, al Haber, 472 por 5.250,00, 4700 por 1.500,00 y 4750 por 1.650,00.

**Devolución.** Fuera del registro de devolución mensual, solo se puede pedir la devolución del saldo a favor existente a 31 de diciembre, en la autoliquidación del último periodo del año (Ley del IVA, art. 115.Uno). Si se pide, el importe pasa de la 4700 a cobrarse por banco. El saldo a compensar caduca si no se aplica en cuatro años desde la autoliquidación en que se originó (art. 99.Cinco).

## Fiscalidad relacionada

- Las cuotas soportadas se pueden deducir en el periodo en que se soportan o en los siguientes, siempre que no hayan pasado cuatro años desde el nacimiento del derecho (Ley del IVA, art. 99.Tres). Se entienden soportadas cuando se recibe la factura (art. 99.Cuatro).
- No todo IVA soportado es deducible: vehículos, atenciones a clientes, bienes de uso mixto (tema 10812) y la prorrata en actividades con operaciones exentas.
- Las casillas del 303 deben cuadrar con los libros registro de facturas emitidas y recibidas (Ley del IVA, art. 164; tema 10816).

## Errores frecuentes

- Contabilizar en la 472 el IVA no deducible en vez de sumarlo al gasto o al activo.
- No hacer el asiento de liquidación y dejar la 472 y la 477 acumulando saldos de todo el año.
- Pagar el 303 contra la 477 directamente, con lo que la 4750 nunca se mueve y la 472 queda viva.
- Olvidar aplicar el saldo de la 4700 en el trimestre siguiente, o arrastrar en contabilidad un "a compensar" distinto del que figura en el modelo.
- Registrar el IVA de una factura recibida en el trimestre de su fecha y no en el de su recepción, sin advertir la diferencia en el 303.

## Qué revisar en la contabilidad

- Tras cada liquidación, la 472 y la 477 quedan a cero.
- Saldo de la 4750 = resultado del último 303 pendiente de pago. Debe quedar a cero tras el pago.
- Saldo de la 4700 = casilla de cuotas a compensar del último 303 presentado.
- Bases y cuotas del trimestre en contabilidad = bases y cuotas del libro registro y del 303.
- Suma de los cuatro trimestres = modelo 390.
- Cuota de la 477 / ventas del grupo 70: debe ser coherente con los tipos que aplica el negocio (21 %, 10 % o 4 %, arts. 90 y 91 de la Ley del IVA).

## Fuentes

- PGC (RD 1514/2007) y PGC PYMES (RD 1515/2007), quinta parte, grupo 4: cuentas 472, 477, 4700, 4709 y 4750.
- Ley 37/1992 del IVA, arts. 90, 91, 99, 115 y 164.
- Reglamento del IVA (RD 1624/1992), art. 71, apartados 3, 4 y 7.
