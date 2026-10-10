---
id: 10814
titulo: "Inversión del sujeto pasivo"
resumen: "Cuándo el cliente, y no el proveedor, debe declarar el IVA (proveedores extranjeros, obras de construcción, chatarra, móviles y portátiles, inmuebles con renuncia a la exención), cómo se factura, el asiento doble 472/477 y dónde va en el 303."
palabras_clave: [inversión del sujeto pasivo, ISP, autorrepercusión, artículo 84, construcción, chatarra, proveedor extranjero, renuncia exención, 303, 472, 477, 607]
aplica_a: [pgc_normal, pgc_pymes, microempresas, autonomos]
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-1992-28740/a84
  - BOE-A-1992-28740/a69
  - BOE-A-1992-28740/a92
  - BOE-A-1992-28740/a97
  - BOE-A-1992-28740/a163duodecies
  - BOE-A-1992-28740/a90
  - BOE-A-2012-14696/a6
  - BOE-A-2007-15984/a34
otras_fuentes:
  - nombre: Instrucciones del modelo 303, 2026 (AEAT)
    url: https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/iva/modelo-303-iva-autoliquidacion_/instrucciones-2026.html
    consultado: 2026-10-10
  - nombre: Manual práctico de IVA 2026 (AEAT)
    url: https://sede.agenciatributaria.gob.es/static_files/Sede/Biblioteca/Manual/Practicos/IVA/Manual_IVA_2026.pdf
    consultado: 2026-10-10
relacionados: [10213, 10815, 10816, 10261, 10851, 10817]
consultas_sif: ["mayor:472", "mayor:477", "mayor:607", "iva"]
---

## En pocas palabras

En la inversión del sujeto pasivo (ISP) el IVA lo declara **el cliente empresario**, no quien vende o presta el servicio. El proveedor factura sin IVA e indica que opera la inversión; el cliente calcula la cuota y la anota a la vez como IVA repercutido y como IVA soportado. Si puede deducirlo entero, el efecto en caja es cero, pero la operación tiene que aparecer en el 303 y en los libros. Si no lo declara, Hacienda lo trata como IVA devengado no ingresado.

## Cuándo se aplica

La lista está en el art. 84.Uno.2.º de la Ley del IVA. Solo opera cuando el destinatario es **empresario o profesional**. Casos que más se ven en una asesoría:

1. **Proveedor no establecido en España** (letra a). Servicios de empresas extranjeras (licencias de software, publicidad en plataformas, asesoría, comisiones) que se entienden prestados en España por estar aquí la sede del cliente (art. 69.Uno.1.º). También entregas de bienes en España por un vendedor no establecido. Hay excepciones: no aplica, por ejemplo, a entregas exentas a otro Estado miembro o exportaciones, ni a alquileres de inmuebles sujetos y no exentos, que repercute el propio arrendador extranjero.
2. **Desechos, chatarra y materiales de recuperación** (letra c): metales férricos y no férricos, plásticos, papel, cartón, vidrio, trapos.
3. **Inmuebles** (letra e): entregas en un proceso concursal, entregas exentas en las que se **renuncia a la exención** (segundas transmisiones, terrenos rústicos) y entregas en ejecución de una garantía o en pago de deudas.
4. **Construcción** (letra f): ejecuciones de obra de urbanización, construcción o rehabilitación de edificaciones contratadas directamente entre promotor y contratista, y también entre contratista y subcontratistas. Una reforma pedida por un particular no entra (el destinatario no es empresario).
5. **Oro sin elaborar**, **derechos de emisión de CO2** y **plata, platino y paladio** (letras b, d y g).
6. **Teléfonos móviles, consolas, portátiles y tabletas** (letra g): cuando el comprador es revendedor, o cuando es otro empresario y la factura supera 10.000 € sin IVA. Esas facturas deben emitirse en serie especial.

## Cómo se contabiliza

La factura recibida no lleva IVA. El cliente:

1. Calcula la cuota al tipo que corresponda.
2. La abona en la 477 (IVA repercutido) y la carga en la 472 (IVA soportado), en el mismo asiento o en uno complementario.
3. Si el IVA no es deducible total o parcialmente (prorrata, actividad exenta, bien excluido del art. 96), la parte no deducible se suma al coste.

Ejemplo: una constructora recibe de un subcontratista la factura de una obra de rehabilitación de un edificio por 10.000 €, con la mención "inversión del sujeto pasivo". Tipo general vigente en 2026 (art. 90 LIVA): 21 %, cuota 2.100 €.

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 607 Trabajos realizados por otras empresas | 10.000,00 | |
| 472 Hacienda Pública, IVA soportado | 2.100,00 | |
| 477 Hacienda Pública, IVA repercutido | | 2.100,00 |
| 400 Proveedores | | 10.000,00 |
| **Total** | **12.100,00** | **12.100,00** |

El proveedor contabiliza su venta sin IVA (700 o 705 contra 430). No anota nada en la 477.

**En el 303** (instrucciones 2026 de la AEAT):
- El cliente declara la base y la cuota devengada en las **casillas 12 y 13** (inversión del sujeto pasivo), salvo los servicios recibidos de empresas de otros Estados miembros, que se declaran junto a las adquisiciones intracomunitarias en las **casillas 10 y 11**. La cuota deducible va en las casillas de IVA deducible (28 y siguientes).
- El proveedor informa el importe de sus ventas con ISP en la **casilla 122** (operaciones sujetas con inversión del sujeto pasivo).

**En los libros y declaraciones informativas.** La factura se anota en el libro registro de facturas recibidas con la cuota autorrepercutida. En el modelo 347 estas operaciones se señalan por separado (art. 34.1.k del Reglamento de gestión). Los servicios intracomunitarios recibidos van además en el 349 (ver tema 10815).

## Fiscalidad relacionada

- El justificante para deducir es la propia factura del proveedor o el justificante contable, siempre que la operación esté **consignada en la autoliquidación** (art. 97.Uno.4.º). Sin el apunte en el 303, no hay deducción.
- Las operaciones con ISP no pueden acogerse al criterio de caja (art. 163 duodecies).
- El proveedor español que factura con ISP debe poner en la factura la mención «inversión del sujeto pasivo» (art. 6.1.m del Reglamento de facturación; ver tema 10851).

## Errores frecuentes

- Contabilizar la factura de Google, Meta, Microsoft u otra empresa extranjera como gasto sin IVA y no autorrepercutir.
- Subcontratista de obra que repercute IVA al contratista principal cuando procedía ISP: hay que pedir factura rectificativa en lugar de deducir esa cuota sin más.
- Aplicar ISP en reformas de viviendas para particulares o en obras que no son construcción ni rehabilitación de edificaciones (mantenimiento, reparaciones menores): conviene revisar caso por caso con el manual de la AEAT.
- Renunciar a la exención en una segunda transmisión de inmueble sin que el comprador lo comunique y acredite su derecho a deducir.
- Declarar la cuota solo en IVA soportado, sin el devengado: el 303 sale con un saldo a devolver ficticio.
- Usar las casillas 12 y 13 para servicios de empresas comunitarias, que van en 10 y 11.

## Qué revisar en la contabilidad

- Facturas de proveedores con NIF extranjero en el mayor de la 400/410 o en gastos del grupo 62 sin cuota en la 472: candidatas a ISP.
- En empresas de construcción, mayor de la 607 por subcontratista: si las facturas llevan IVA, comprobar si la obra encaja en la letra f.
- Que el importe autorrepercutido en la 477 coincide con el deducido en la 472 por las mismas facturas (salvo prorrata).
- Cuadre entre casillas 12-13 y 10-11 del 303 y las subcuentas usadas para ISP.

## Fuentes

- Ley 37/1992 del IVA: art. 84 (sujetos pasivos e ISP), art. 69 (lugar de los servicios entre empresarios), art. 92.Uno.3.º (deducibilidad de estas cuotas), art. 97.Uno.4.º (justificante de la deducción), art. 163 duodecies (exclusión del criterio de caja).
- Ley 37/1992, art. 90: tipo general del 21 %.
- Reglamento de facturación (RD 1619/2012), art. 6.1.m: mención «inversión del sujeto pasivo».
- Reglamento general de gestión e inspección (RD 1065/2007), art. 34.1.k: datos separados en el modelo 347.
- AEAT, instrucciones del modelo 303 de 2026 y Manual práctico de IVA 2026.
