---
id: 10213
titulo: "Facturas recibidas de otros países: intracomunitarias e importaciones (asiento)"
resumen: "Cómo contabilizar compras de bienes a otro país de la UE (autorrepercusión del IVA, 472 y 477), servicios de proveedores extranjeros (inversión del sujeto pasivo) e importaciones con DUA (IVA y aranceles en aduana), con asientos de ejemplo."
palabras_clave: [adquisición intracomunitaria, importación, DUA, autorrepercusión, inversión del sujeto pasivo, aranceles, "472", "477", "600", modelo 303, modelo 349, moneda extranjera]
aplica_a: [pgc_normal, pgc_pymes, microempresas, autonomos]
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-1992-28740/a13
  - BOE-A-1992-28740/a15
  - BOE-A-1992-28740/a17
  - BOE-A-1992-28740/a69
  - BOE-A-1992-28740/a76
  - BOE-A-1992-28740/a77
  - BOE-A-1992-28740/a83
  - BOE-A-1992-28740/a84
  - BOE-A-1992-28740/a85
  - BOE-A-1992-28740/a97
  - BOE-A-1992-28740/a167
  - BOE-A-1992-28925/a74
  - BOE-A-2007-19884/A10
  - BOE-A-2007-19884/A11
otras_fuentes:
  - nombre: "AEAT, Manual práctico de IVA 2026"
    url: https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/manual-iva-2026/presentacion.html
    consultado: 2026-10-10
relacionados: [10211, 10815, 10814, 10816, 10261, 10851]
consultas_sif: ["mayor:472", "mayor:477", "mayor:600", "mayor:400", "iva"]
---

## En pocas palabras

Cuando una empresa española compra bienes a un proveedor de otro país de la UE, la factura llega **sin IVA** y es la propia empresa la que se lo repercute y se lo deduce en la misma declaración (adquisición intracomunitaria). Con los servicios de proveedores no establecidos pasa algo parecido: el destinatario es el sujeto pasivo. En cambio, si los bienes vienen de fuera de la UE (importación), el IVA se liquida en la aduana con el DUA, junto con los aranceles, y la factura del proveedor extranjero tampoco lleva IVA español.

## Cuándo se aplica

- **Adquisición intracomunitaria de bienes**: bienes que llegan a España desde otro Estado miembro, comprados a un empresario de allí por una empresa o profesional (arts. 13 y 15 de la Ley del IVA). El proveedor factura exento con su NIF-IVA y el nuestro. El comprador es sujeto pasivo (art. 85).
- **Servicios de un proveedor no establecido**: si el destinatario es un empresario establecido en España, el servicio se entiende prestado aquí (art. 69.Uno.1.º) y el sujeto pasivo es el destinatario (art. 84.Uno.2.º.a). Ejemplos: publicidad en plataformas extranjeras, software por suscripción, comisiones de un agente francés.
- **Importación**: entrada de bienes desde fuera de la UE (arts. 17 y 18). El IVA se devenga cuando se devengan los derechos de importación (art. 77) y lo liquida la aduana (art. 167.Dos).

## Cómo se contabiliza

**1. Compra intracomunitaria de mercaderías.** Proveedor alemán, 5.000 €. La empresa calcula el IVA al tipo que tendría la operación en España (21 %, tipo general en 2026): 1.050 €. Lo apunta a la vez como soportado y como repercutido.

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 600 Compras de mercaderías | 5.000,00 | |
| 472 Hacienda Pública, IVA soportado | 1.050,00 | |
| 400 Proveedores (intracomunitarios) | | 5.000,00 |
| 477 Hacienda Pública, IVA repercutido | | 1.050,00 |
| **Total** | **6.050,00** | **6.050,00** |

Si la empresa tiene derecho a deducir todo el IVA, el efecto en la liquidación es cero. El IVA se devenga cuando se entienden entregados los bienes (art. 76), no cuando se paga; un anticipo al proveedor no adelanta el devengo.

Los servicios de proveedores extranjeros se registran igual, con la cuenta del subgrupo 62 que corresponda y la 410.

**2. Importación con DUA.** Mercancía de un proveedor chino por 8.000 € (factura sin IVA). El transitario presenta el DUA y nos refactura los derechos de aduana (supongamos 320 €) y el IVA de importación. La base del IVA en importación es el valor en aduana más los aranceles y los gastos hasta el primer destino en la UE (art. 83): 8.320 €. IVA al 21 %: 1.747,20 €.

Primero, la factura del proveedor:

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 600 Compras de mercaderías | 8.000,00 | |
| 400 Proveedores (moneda extranjera) | | 8.000,00 |
| **Total** | **8.000,00** | **8.000,00** |

Después, el DUA pagado por el transitario por cuenta nuestra:

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 600 Compras de mercaderías (aranceles) | 320,00 | |
| 472 Hacienda Pública, IVA soportado | 1.747,20 | |
| 410 Acreedores por prestaciones de servicios (transitario) | | 2.067,20 |
| **Total** | **2.067,20** | **2.067,20** |

Los aranceles y el transporte hasta el almacén forman parte del precio de adquisición (NRV 10.ª). Los honorarios del propio transitario, con su IVA español, son otra factura.

**IVA diferido.** Las empresas con liquidación mensual pueden optar, en noviembre para el año siguiente, por incluir el IVA de importación en su modelo 303 en lugar de pagarlo en la aduana (art. 74.1 del Reglamento del IVA). En ese caso no lo adelanta el transitario: se apunta en la 472 y en la 477 como en la compra intracomunitaria.

**Moneda extranjera.** Si la factura viene en dólares, se convierte al tipo de cambio de contado del día de la operación, o a un tipo medio como máximo mensual si no ha variado mucho (NRV 11.ª). La diferencia al pagar va a 668 o 768 (diferencias de cambio).

## Fiscalidad relacionada

- La adquisición intracomunitaria y la inversión del sujeto pasivo van en el modelo 303 en las casillas de IVA devengado y deducible, y los bienes intracomunitarios además en el modelo 349 (tema 10815).
- Para deducir el IVA de importación hace falta el documento de la liquidación de la aduana (DUA) (art. 97.Uno.3.º); la factura del transitario no basta. En la adquisición intracomunitaria, la factura del proveedor y haber declarado la operación en el 303 (art. 97.Uno.2.º).

## Errores frecuentes

- Registrar la factura intracomunitaria sin autorrepercutir el IVA. Si la deducción es total, no hay cuota a ingresar, pero el 303 y el 349 salen mal y no cuadran con los datos que el proveedor declara en su país.
- Apuntar el IVA de importación de la factura del transitario como si fuera IVA de su servicio.
- Meter los aranceles en la 631 (tributos) o en la 629: son coste de la mercancía.
- Usar el tipo de cambio del día del pago para registrar la compra.
- Tratar como intracomunitario a un proveedor sin NIF-IVA válido (comprobar en el VIES): la operación puede llevar IVA del país de origen.

## Qué revisar en la contabilidad

- En cada periodo, el IVA autorrepercutido de la 477 debe ser igual al deducido en la 472 por las mismas operaciones (salvo prorrata).
- Proveedores intracomunitarios y extranjeros en subcuentas propias de la 400 y la 410; sus facturas no deben llevar cuota de IVA en el libro registro.
- Cada DUA debe tener su cargo en la 472 y su arancel en la 600.
- La suma de compras intracomunitarias de bienes del trimestre debe coincidir con el modelo 349.

## Fuentes

- Ley 37/1992 del IVA: arts. 13 y 15 (adquisición intracomunitaria), 17 y 18 (importación), 69 (lugar de los servicios), 76 y 77 (devengo), 83 (base en importación), 84 y 85 (sujeto pasivo), 97 (documentos para deducir), 167 (liquidación en importación).
- RD 1624/1992, Reglamento del IVA, art. 74 (IVA diferido a la importación).
- PGC, NRV 10.ª Existencias (BOE-A-2007-19884/A10) y NRV 11.ª Moneda extranjera (BOE-A-2007-19884/A11).
