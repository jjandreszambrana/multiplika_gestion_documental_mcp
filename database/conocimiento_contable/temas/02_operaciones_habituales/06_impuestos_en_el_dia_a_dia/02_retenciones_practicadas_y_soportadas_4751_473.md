---
id: 10262
titulo: "Retenciones practicadas y soportadas (4751, 473)"
resumen: "Diferencia entre las retenciones que la empresa practica y debe ingresar (4751, modelos 111 y 115) y las que le practican a ella (473, a descontar del impuesto), con porcentajes de 2026, plazos y asientos de ejemplo."
palabras_clave: [retenciones, retención IRPF, profesionales, alquileres, 4751, 473, 4709, 6300, modelo 111, modelo 115, modelo 190, modelo 180]
aplica_a: [pgc_normal, pgc_pymes, microempresas, esfl, autonomos]
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/grupo4-2      # PGC, quinta parte, grupo 4 (473, 4709, 4751, 4752)
  - BOE-A-2007-19966/grupo4-2      # PGC PYMES, quinta parte, grupo 4
  - BOE-A-2007-19884/grupo6-2      # PGC, quinta parte, grupo 6 (621, 623, 6300)
  - BOE-A-2007-19884/grupo7-2      # PGC, quinta parte, grupo 7 (752)
  - BOE-A-2006-20764/a101          # Ley del IRPF, art. 101: porcentajes de retención
  - BOE-A-2007-6820/a95            # Reglamento del IRPF, art. 95: retención de profesionales (15 % y 7 %)
  - BOE-A-2007-6820/a108           # Reglamento del IRPF, art. 108: declaración e ingreso
  - BOE-A-2014-12328/a128          # Ley del Impuesto sobre Sociedades, art. 128: retenciones (19 %)
otras_fuentes:
  - nombre: "AEAT, Modelo 111. Retenciones e ingresos a cuenta (rendimientos del trabajo y actividades económicas)"
    url: https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GH01.shtml
    consultado: 2026-10-10
  - nombre: "AEAT, Modelo 115. Retenciones e ingresos a cuenta (arrendamiento de inmuebles urbanos)"
    url: https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GH02.shtml
    consultado: 2026-10-10
  - nombre: "AEAT, Modelo 190. Resumen anual de retenciones (trabajo y actividades económicas)"
    url: https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GI10.shtml
    consultado: 2026-10-10
  - nombre: "AEAT, Modelo 180. Resumen anual de retenciones (arrendamiento de inmuebles urbanos)"
    url: https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GI00.shtml
    consultado: 2026-10-10
relacionados: [10241, 10245, 10252, 10322, 10611, 10823, 10833, 10841, 10842]
consultas_sif: ["mayor:4751", "mayor:473", "mayor:623", "mayor:621", "mayor:4709"]
---

## En pocas palabras

Hay dos cuentas y no se deben mezclar:

- **4751 Hacienda Pública, acreedora por retenciones practicadas**: lo que la empresa **retiene** al pagar nóminas, facturas de profesionales o alquileres. No es suyo: lo ingresa en Hacienda con los modelos 111 y 115. Es un pasivo.
- **473 Hacienda Pública, retenciones y pagos a cuenta**: lo que **le retienen** a la empresa (por ejemplo, sobre intereses o alquileres que cobra) y los pagos fraccionados que hace. Es un activo: se descuenta de la cuota del Impuesto sobre Sociedades o del IRPF del año.

## Cuándo se aplica

**Retenciones practicadas (4751)**: cuando la empresa, o un autónomo en su actividad, paga rentas sujetas a retención. Porcentajes de la Ley del IRPF (art. 101) y su Reglamento, vigentes en 2026:

| Renta pagada | Retención | Modelo trimestral / anual |
| --- | --- | --- |
| Nóminas | Según tabla y situación personal (tema 10241) | 111 / 190 |
| Administradores y consejeros | 35 % (19 % si la cifra de negocios es inferior a 100.000 €) | 111 / 190 |
| Profesionales (abogados, asesores, arquitectos...) | 15 %; 7 % el año de inicio y los dos siguientes (Reglamento, art. 95) | 111 / 190 |
| Alquiler de inmuebles urbanos | 19 % | 115 / 180 |

**Retenciones soportadas (473)**: cuando la empresa cobra rentas sujetas a retención. Para una sociedad, lo habitual es sobre intereses, dividendos y alquileres que cobra: el 19 % con carácter general (Ley 27/2014, art. 128.6.a). Un autónomo profesional soporta además la retención del 15 % en sus facturas.

## Cómo se contabiliza

**Asiento 1. Factura de un abogado (persona física).** Honorarios 1.000,00 €, IVA 21 % 210,00 €, retención 15 % 150,00 €. A pagar: 1.060,00 €.

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 623 Servicios de profesionales independientes | 1.000,00 | |
| 472 Hacienda Pública, IVA soportado | 210,00 | |
| 4751 H.P., acreedora por retenciones practicadas | | 150,00 |
| 410 Acreedores por prestaciones de servicios | | 1.060,00 |
| **Total** | **1.210,00** | **1.210,00** |

**Asiento 2. Alquiler del local a un propietario persona física.** Renta 2.000,00 €, IVA 21 % 420,00 €, retención 19 % 380,00 €. A pagar: 2.040,00 €.

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 621 Arrendamientos y cánones | 2.000,00 | |
| 472 Hacienda Pública, IVA soportado | 420,00 | |
| 4751 H.P., acreedora por retenciones practicadas | | 380,00 |
| 410 Acreedores por prestaciones de servicios | | 2.040,00 |
| **Total** | **2.420,00** | **2.420,00** |

La retención se calcula sobre la base, sin IVA. Conviene llevar la 4751 en subcuentas (trabajo, profesionales, alquileres) para que cuadre con cada modelo.

**Asiento 3. Ingreso de las retenciones (modelos 111 y 115).** Se carga la 4751 con abono a la 572 por el importe de cada modelo. Plazo: los **primeros veinte días naturales de abril, julio, octubre y enero** por el trimestre anterior, o los veinte primeros días de cada mes en las grandes empresas (Reglamento del IRPF, art. 108.1). El resumen anual (190 y 180) se presenta en enero (art. 108.2).

**Asiento 4. Retención soportada.** La sociedad alquila una nave que le sobra: renta 1.500,00 €, IVA 315,00 €, y el inquilino retiene el 19 % (285,00 €). Cobra 1.530,00 €.

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 572 Bancos e instituciones de crédito c/c vista, euros | 1.530,00 | |
| 473 Hacienda Pública, retenciones y pagos a cuenta | 285,00 | |
| 752 Ingresos por arrendamientos | | 1.500,00 |
| 477 Hacienda Pública, IVA repercutido | | 315,00 |
| **Total** | **1.815,00** | **1.815,00** |

**Asiento 5. Cierre: aplicar la 473 a la cuota del impuesto.** Cuota líquida del Impuesto sobre Sociedades de 5.000,00 €; la 473 acumula 1.200,00 € (retenciones soportadas y pagos fraccionados). Según el PGC, la 473 se abona "hasta el importe de la cuota líquida del periodo, con cargo a la cuenta 6300".

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 6300 Impuesto corriente | 5.000,00 | |
| 473 Hacienda Pública, retenciones y pagos a cuenta | | 1.200,00 |
| 4752 H.P., acreedora por impuesto sobre sociedades | | 3.800,00 |
| **Total** | **5.000,00** | **5.000,00** |

Si la 473 superase la cuota, el exceso se pasa a la **4709 Hacienda Pública, deudora por devolución de impuestos** hasta que se cobre.

## Fiscalidad relacionada

- La retención es una obligación del pagador: si no retiene, responde ante Hacienda como si lo hubiera hecho.
- El modelo 111 se presenta aunque no haya importes a ingresar si se pagaron rentas sujetas sin retención por su cuantía (declaración negativa). Si en el trimestre no se pagaron rentas sujetas, no hay que presentarlo (Reglamento del IRPF, art. 108.1).
- Los porcentajes de esta tabla son los de la normativa vigente en 2026; se revisan cada año.

## Errores frecuentes

- Contabilizar la retención practicada en la 473 o la soportada en la 4751. El balance enseña entonces un derecho que es una deuda, o al revés.
- Calcular la retención sobre el total con IVA.
- No retener a un profesional persona física, o retener a una sociedad profesional cuando no corresponde.
- No retener en el alquiler del local sin haber comprobado que se da alguna de las excepciones que prevé el Reglamento del IRPF.
- No aplicar la 473 a la cuota del impuesto al cierre y arrastrarla de un año a otro.

## Qué revisar en la contabilidad

- Saldo de cada subcuenta de la 4751 al final del trimestre = importe del modelo 111 o 115 de ese trimestre; tras el pago, a cero.
- Abonos a la 4751 del año = modelos 190 y 180.
- Cargos en la 623 y la 621 a personas físicas sin abono a la 4751 en la misma factura.
- Que la 473 quede a cero tras el asiento del impuesto, o traspasada a la 4709.
- Que las retenciones de la 473 cuadren con los certificados de los pagadores (bancos, inquilinos).

## Fuentes

- PGC (RD 1514/2007) y PGC PYMES (RD 1515/2007), quinta parte, grupo 4: cuentas 473, 4709, 4751 y 4752; grupo 6: cuentas 621 y 623.
- Ley 35/2006 del IRPF, art. 101, apartados 2, 5.a y 8.
- Reglamento del IRPF (RD 439/2007), arts. 95 y 108.
- Ley 27/2014 del Impuesto sobre Sociedades, art. 128.6.
