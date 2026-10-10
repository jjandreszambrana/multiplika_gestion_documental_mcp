---
id: 10211
titulo: "Compras de mercaderías y materias primas: descuentos, rappels, devoluciones, portes"
resumen: "Cómo registrar una compra de existencias (600/601/602) con sus portes, aranceles y descuentos en factura, y los descuentos por pronto pago, devoluciones y rappels posteriores (606, 608, 609), con su IVA."
palabras_clave: [compras, mercaderías, materias primas, "600", "601", "606", "608", "609", "400", rappels, pronto pago, portes]
aplica_a: [pgc_normal, pgc_pymes, microempresas]
vigente_desde: 2008-01-01
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/A10
  - BOE-A-2007-19884/grupo6-2
  - BOE-A-2007-19884/grupo4-2
  - BOE-A-2007-19966/A12
  - BOE-A-1992-28740/a78
  - BOE-A-1992-28740/a80
  - BOE-A-1992-28740/a90
otras_fuentes:
  - nombre: "AEAT, Manual práctico de IVA 2026"
    url: https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/manual-iva-2026/presentacion.html
    consultado: 2026-10-10
relacionados: [10212, 10213, 10222, 10225, 10231, 10261, 10132]
consultas_sif: ["mayor:600", "mayor:601", "mayor:606", "mayor:608", "mayor:609", "mayor:400", "iva"]
---

## En pocas palabras

Una compra de mercaderías o materias primas se carga en la cuenta del subgrupo 60 por el **precio de adquisición**: lo facturado menos los descuentos que vengan en la propia factura, más los gastos necesarios hasta que el bien está en el almacén (portes, aranceles, seguros del transporte). Lo que el proveedor rebaje después de la factura no se resta de la 600: va a cuentas propias (606 pronto pago, 608 devoluciones, 609 rappels), que figuran con signo negativo dentro de "Aprovisionamientos".

## Cuándo se aplica

A todo lo que entra en los subgrupos 30, 31 y 32: mercaderías para revender (600), materias primas que se transforman (601) y otros aprovisionamientos como envases, embalajes, combustibles almacenables o repuestos de ciclo corto (602). Los trabajos que forman parte de la producción y se encargan a otra empresa van a la 607.

No se aplica a servicios (grupo 62, ver tema 10212) ni a compras de inmovilizado (grupo 2).

El PGC dice que la compra se registra **a la recepción** de la mercancía, o cuando se pone en camino si el transporte va por cuenta del comprador. Si al cierre ha llegado la mercancía y no la factura, se registra igualmente contra la subcuenta 4009 (proveedores, facturas pendientes de recibir).

## Cómo se contabiliza

**1. La factura de compra.** El precio de adquisición (NRV 10.ª del PGC y 12.ª del PGC PYMES) incluye "el importe facturado por el vendedor después de deducir cualquier descuento, rebaja en el precio u otras partidas similares" y suma los transportes, aranceles, seguros y demás gastos atribuibles hasta que los bienes están listos para la venta. Por eso:

- el descuento comercial o por volumen que viene en factura se resta directamente;
- los portes que cobra el proveedor en la misma factura se suman a la 600 (o a una subcuenta de la 600 si se quiere verlos aparte, por ejemplo 6000001 Portes de compras).

Ejemplo: mercancía de 10.000 € con un 5 % de descuento comercial en factura (500 €) y 200 € de portes. Base: 9.700 €. IVA al 21 % (tipo general vigente en 2026, art. 90 de la Ley del IVA): 2.037 €.

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 600 Compras de mercaderías | 9.700,00 | |
| 472 Hacienda Pública, IVA soportado | 2.037,00 | |
| 400 Proveedores | | 11.737,00 |
| **Total** | **11.737,00** | **11.737,00** |

Si los portes los factura un transportista aparte, también son mayor coste de la compra (cargo en 600 o en su subcuenta de portes), no un gasto de la 624. La 624 queda para los transportes que no forman parte del precio, como los de ventas.

**2. Descuento por pronto pago fuera de factura.** El proveedor concede un 2 % por pagar antes (194 € sobre la base de 9.700 €). Al rebajar la base, también baja el IVA (art. 80.Uno.2.º de la Ley del IVA) y el proveedor debe emitir factura rectificativa.

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 400 Proveedores | 234,74 | |
| 606 Descuentos sobre compras por pronto pago | | 194,00 |
| 472 Hacienda Pública, IVA soportado | | 40,74 |
| **Total** | **234,74** | **234,74** |

**3. Devolución.** Se devuelve mercancía por 1.000 € de base porque llegó defectuosa: abono a la 608 por 1.000 €, abono a la 472 por 210 € y cargo a la 400 por 1.210 €. En la 608 van también los descuentos posteriores a la factura que tienen la misma causa (defectos, retrasos, incumplimiento del pedido).

**4. Rappel.** Al final del año el proveedor reconoce 300 € por haber superado un volumen de compras: abono a la 609 por 300 €, abono a la 472 por 63 € y cargo a la 400 por 363 €.

**Envases con derecho a devolución.** Si el proveedor cobra en factura envases que se le pueden devolver, no son compra: se cargan en la 406 (envases y embalajes a devolver a proveedores) y se abonan al devolverlos.

## Fiscalidad relacionada

- **IVA.** Los descuentos concedidos en el momento de la operación no forman parte de la base imponible (art. 78.Tres.2.º). Los posteriores (pronto pago fuera de factura, rappels, devoluciones) la reducen (art. 80) y obligan a corregir el IVA soportado deducido cuando llega la rectificativa (ver tema 10225).
- **Impuesto sobre Sociedades.** El criterio contable se sigue: la compra se deduce a través del consumo (compras más o menos la variación de existencias, tema 10231).

## Errores frecuentes

- Registrar el pronto pago o el rappel como ingreso financiero (769) o como otros ingresos (759). Son menor coste de la compra.
- Cargar los portes de compras en la 624. El resultado del año no cambia, pero las existencias finales quedan infravaloradas si no se suma ese coste.
- Restar los descuentos posteriores directamente de la 600: se pierde la información de cuánto se recupera por rappels y devoluciones.
- No reducir el IVA soportado al recibir la rectificativa del proveedor.
- Registrar la compra cuando llega la factura y no cuando llega la mercancía, sobre todo en diciembre.

## Qué revisar en la contabilidad

- La 606, 608 y 609 deben tener saldo acreedor; un saldo deudor indica asientos invertidos.
- Comparar el saldo de la 400 de cada proveedor con su extracto; los rappels pactados y no recibidos a fin de año aparecen aquí.
- Las compras de diciembre deben tener su entrada en almacén en diciembre; albaranes sin factura al cierre, en la 4009.
- La 624 no debe contener portes de compras (buscar en el concepto "portes" o el nombre de transportistas que traen mercancía).
- El IVA de la 472 de compras debe coincidir con el libro registro de facturas recibidas.

## Fuentes

- PGC, segunda parte, NRV 10.ª Existencias, apartado 1.1 Precio de adquisición (BOE-A-2007-19884/A10). En el PGC PYMES, NRV 12.ª (BOE-A-2007-19966/A12), con el mismo texto.
- PGC, quinta parte, grupo 6: definiciones de las cuentas 600/602, 606, 607, 608 y 609 (BOE-A-2007-19884/grupo6-2).
- PGC, quinta parte, grupo 4: movimiento de las cuentas 400 y 406 (BOE-A-2007-19884/grupo4-2).
- Ley 37/1992 del IVA, arts. 78 (base imponible), 80 (modificación de la base) y 90 (tipo general del 21 %).
