---
id: 10924
titulo: "Periodos medios de cobro, pago y almacén"
resumen: "Cuántos días tarda la empresa en cobrar, en pagar y en vender sus existencias, cómo se calcula el ciclo de caja y cómo se calcula el periodo medio de pago a proveedores que exige la memoria (Resolución ICAC de 2016), con ejemplos."
palabras_clave: [periodo medio de cobro, periodo medio de pago, PMP, periodo medio de almacén, ciclo de caja, ciclo de maduración, morosidad, Ley 3/2004, 430, 400, 410]
aplica_a: [pgc_normal, pgc_pymes, microempresas]
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2004-21830/a4
  - BOE-A-2004-21830/a3
  - BOE-A-2016-1112/a4
  - BOE-A-2016-1112/a5
  - BOE-A-2016-1112/a6
  - BOE-A-2010-10544/a262
otras_fuentes:
  - nombre: "Banco de España, Ratios sectoriales de las sociedades no financieras"
    url: https://app.bde.es/rss_www/
    consultado: 2026-10-10
relacionados: [10921, 10911, 11031, 11011, 10421, 10231]
consultas_sif: ["sumas_y_saldos", "mayor:430", "mayor:400", "mayor:410", "perdidas_y_ganancias"]
---

## En pocas palabras

Tres cifras en días: cuánto se tarda en **cobrar** a los clientes, cuánto en **pagar** a los proveedores y cuánto tiempo pasa la mercancía en el **almacén**. Con ellas se calcula el **ciclo de caja**: los días que la empresa tiene que financiar con su dinero o con el del banco. Además, las sociedades deben informar en la memoria de su periodo medio de pago a proveedores con una fórmula oficial.

## Cuándo se aplica

En el análisis trimestral o anual, cuando la empresa crece y "le falta dinero", al preparar la previsión de tesorería (tema 11011), al negociar plazos con clientes y proveedores, y al redactar la nota de la memoria sobre el periodo medio de pago.

## Cómo se aplica

### Fórmulas de análisis

Datos del ejemplo (en euros): clientes 180.000; ventas 1.200.000, todas con IVA del 21 %; proveedores 160.000; compras 730.000, con IVA del 21 %; existencias 120.000; consumo de mercaderías 720.000.

| Periodo | Fórmula | Ejemplo | Días |
| --- | --- | --- | ---: |
| Cobro (PMC) | Clientes / ventas con IVA × 365 | 180.000 / 1.452.000 × 365 | 45,2 |
| Pago (PMP de análisis) | Proveedores / compras con IVA × 365 | 160.000 / 883.300 × 365 | 66,1 |
| Almacén (PMA) | Existencias / consumo × 365 | 120.000 / 720.000 × 365 | 60,8 |

Se suma el IVA a ventas y compras porque los saldos de clientes y proveedores lo incluyen. Si hay ventas exentas o al exterior, se usa el IVA real de las facturas (libros registro), no un tipo general. Lo ideal es usar saldos **medios** (inicio más final entre dos, o media de los cierres trimestrales); con un solo saldo, si el negocio es estacional, el resultado engaña.

**Ciclo de maduración**: PMA + PMC = 60,8 + 45,2 = 106 días desde que entra la mercancía hasta que se cobra. **Ciclo de caja**: ciclo de maduración − PMP = 106 − 66,1 = unos 40 días. Durante esos 40 días la empresa adelanta el dinero. Con ventas de 1.452.000 euros al año (IVA incluido), cada día de ciclo de caja inmoviliza unos 4.000 euros: acortar el cobro en 10 días libera unos 40.000.

### Plazos legales de pago

La Ley 3/2004 de morosidad (art. 4, texto vigente desde 2013) fija para las operaciones entre empresas:

- **30 días naturales** desde la recepción de la mercancía o la prestación del servicio, si el contrato no dice otra cosa;
- ampliables por pacto, pero **nunca más de 60 días naturales**;
- si hay un procedimiento de aceptación o comprobación, no puede durar más de 30 días, y el plazo de pago empieza a contar desde la aceptación.

El detalle de la ley y su aplicación práctica está en el tema 11031.

### El periodo medio de pago de la memoria

La Resolución del ICAC de 29 de enero de 2016 obliga a las sociedades mercantiles a incluir en la memoria una nota con el periodo medio de pago a proveedores del ejercicio y del anterior. La fórmula depende del modelo de memoria:

- **Memoria normal** (art. 5.1 a 5.4): media ponderada por importes de los días que tardaron las facturas pagadas y de los días que llevan pendientes las no pagadas, contando desde la recepción de la mercancía o servicio (o desde la factura si no hay dato fiable). Se informa también de la ratio de operaciones pagadas, la de pendientes y los importes totales (art. 6.1).
- **Memoria abreviada o PGC de Pymes** (art. 5.5): fórmula simplificada:

  Periodo medio de pago = saldo medio de acreedores comerciales × 365 / (compras netas + gastos por servicios exteriores)

  Ejemplo: saldo medio de proveedores y acreedores (400 y 410) de 150.000 euros; compras netas 730.000 y servicios exteriores 110.000. 150.000 × 365 / 840.000 = **65,2 días**, por encima del máximo legal de 60.

Solo entran los acreedores comerciales del pasivo corriente por suministros de bienes o servicios (art. 4.b de la resolución) en operaciones sujetas a la Ley 3/2004 (art. 3). Por eso no se incluyen los proveedores de inmovilizado (523), que el PGC no trata como acreedores comerciales, ni las deudas con Hacienda o la Seguridad Social. Las sociedades que no pueden presentar cuenta de pérdidas y ganancias abreviada deben indicar además ese periodo en el informe de gestión y, si supera el máximo legal, las medidas para reducirlo (Ley de Sociedades de Capital, art. 262.1).

## Errores frecuentes

- **No sumar el IVA** a ventas o compras: alarga los días de forma ficticia en torno a un 21 %.
- **Usar el saldo de cierre** en negocios estacionales: un 31 de diciembre con poca actividad da periodos muy cortos.
- **Clientes de dudoso cobro** (436) incluidos en el periodo de cobro sin decirlo, o excluidos sin decirlo. Lo correcto es calcularlo con y sin ellos.
- **Anticipos** a proveedores (407) o de clientes (438) restando dentro de las mismas cuentas.
- **En la memoria**: incluir proveedores de inmovilizado (173, 523) o, en la fórmula simplificada, usar el saldo de cierre en lugar del medio.
- **Fecha de inicio**: contar desde la fecha de la factura cuando hay fecha de recepción fiable (albarán).

## Qué revisar en la contabilidad

- Antigüedad de los saldos de la 430: facturas con más de 60, 90 y 180 días.
- Proveedores con saldos de más de 60 días: riesgo de incumplir la Ley 3/2004 y de que salga en la memoria.
- Que existan saldos de 400 y 410 al principio y al final del año para calcular el saldo medio.
- Que la variación de existencias esté registrada (tema 10231); si no, el periodo de almacén no se puede calcular.
- Comparar el periodo de pago de la memoria del año anterior con el de este: un salto grande requiere explicación.

## Fuentes

- Ley 3/2004, de morosidad, art. 4 (plazo de 30 días, máximo de 60 por pacto y procedimiento de aceptación), en su redacción vigente desde el 28 de julio de 2013.
- Ley 3/2004, art. 3 (operaciones incluidas).
- Resolución del ICAC de 29 de enero de 2016, arts. 4 (definición de proveedores), 5 (fórmulas del periodo medio de pago) y 6 (contenido de la nota de la memoria).
- Ley de Sociedades de Capital, art. 262.1 (periodo medio de pago en el informe de gestión).
- Las fórmulas de PMC, PMA y ciclo de caja no están en ninguna norma: son convenciones de análisis financiero.
