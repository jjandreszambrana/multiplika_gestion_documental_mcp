---
id: 10815
titulo: "Operaciones intracomunitarias y modelo 349"
resumen: "Cómo tributan en IVA las compras y ventas de bienes y servicios con empresas de otros países de la UE (exención con NIF-IVA válido, autorrepercusión), su asiento, sus casillas del 303 y quién presenta el 349, cuándo y con qué contenido."
palabras_clave: [intracomunitaria, AIB, entrega intracomunitaria, adquisición intracomunitaria, NIF-IVA, VIES, ROI, declaración recapitulativa, 349, 303, 472, 477]
aplica_a: [pgc_normal, pgc_pymes, microempresas, autonomos]
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-1992-28740/a13
  - BOE-A-1992-28740/a25
  - BOE-A-1992-28740/a69
  - BOE-A-1992-28740/a84
  - BOE-A-1992-28740/a92
  - BOE-A-1992-28740/a90
  - BOE-A-1992-28925/a78
  - BOE-A-1992-28925/a79
  - BOE-A-1992-28925/a80
  - BOE-A-1992-28925/a81
otras_fuentes:
  - nombre: Instrucciones del modelo 303, 2026 (AEAT)
    url: https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/iva/modelo-303-iva-autoliquidacion_/instrucciones-2026.html
    consultado: 2026-10-10
  - nombre: Modelo 349, ficha del procedimiento y plazos (AEAT)
    url: https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GI28.shtml
    consultado: 2026-10-10
relacionados: [10213, 10814, 10816, 10817, 10261, 10851]
consultas_sif: ["mayor:472", "mayor:477", "mayor:600", "mayor:700", "iva"]
---

## En pocas palabras

Entre empresas de distintos países de la UE, el IVA de los bienes se paga en el país de llegada. Quien vende desde España factura **sin IVA** (entrega intracomunitaria exenta) si el cliente tiene un NIF-IVA de otro Estado miembro válido. Quien compra en España a una empresa comunitaria recibe la factura sin IVA y **se lo autorrepercute**: lo declara como devengado y, si tiene derecho, como deducible en el mismo 303. Con los servicios entre empresarios ocurre algo parecido. Todas estas operaciones se informan, cliente por cliente, en el **modelo 349**.

## Cuándo se aplica

**Entrega intracomunitaria exenta** (art. 25 LIVA). Requisitos:
1. Los bienes salen físicamente de España hacia otro Estado miembro (transporte acreditado: CMR, albarán firmado, factura del transportista).
2. El comprador es empresario o persona jurídica con NIF-IVA de otro Estado miembro y lo ha comunicado.
3. El vendedor incluye la operación en el 349. Sin esa inclusión no hay exención.

Si falta el NIF-IVA válido del cliente, la venta tributa en España con IVA español.

**Adquisición intracomunitaria de bienes (AIB)** (art. 13). Compra a título oneroso por un empresario español a un empresario de otro Estado miembro con transporte de los bienes a España. Está sujeta en España y el comprador es quien liquida el IVA.

**Servicios entre empresarios** (art. 69.Uno.1.º). Regla general: se entienden prestados donde está el cliente. Un servicio de una agencia francesa a una empresa española tributa en España y lo autorrepercute la empresa española (art. 84.Uno.2.º a). Un servicio de una consultora española a una empresa alemana no lleva IVA español y se informa en el 349 como prestación intracomunitaria. Hay reglas especiales (inmuebles, transporte de viajeros, restauración, eventos) en las que el servicio se localiza de otro modo.

En la práctica, para operar hay que estar dado de alta en el **Registro de Operadores Intracomunitarios (ROI)** con la declaración censal, para que el NIF-IVA aparezca en el censo VIES. Conviene comprobar en VIES el NIF del cliente o proveedor antes de facturar.

## Cómo se contabiliza

**Compra de bienes (AIB).** Ejemplo: una sociedad compra mercaderías a un proveedor alemán por 8.000 €. Tipo español vigente en 2026: 21 % (art. 90), cuota 1.680 €.

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 600 Compras de mercaderías | 8.000,00 | |
| 472 Hacienda Pública, IVA soportado | 1.680,00 | |
| 477 Hacienda Pública, IVA repercutido | | 1.680,00 |
| 400 Proveedores (subcuenta de proveedores intracomunitarios) | | 8.000,00 |
| **Total** | **9.680,00** | **9.680,00** |

Los servicios recibidos de empresas comunitarias se contabilizan igual, cargando la cuenta de gasto del grupo 62 que corresponda.

**Venta de bienes exenta.** Ejemplo: venta a un cliente italiano con NIF-IVA válido por 5.000 €: cargo en la 430 (subcuenta de clientes intracomunitarios) por 5.000 € y abono en la 700 por 5.000 €. No hay cuota.

Conviene llevar subcuentas propias para las operaciones intracomunitarias (en la 472, la 477, la 400, la 430 y la 700/600) para cuadrar con el 303 y el 349 sin buscar factura a factura.

**En el 303** (instrucciones 2026 de la AEAT):
- Casillas **10 y 11**: base y cuota de las adquisiciones intracomunitarias de **bienes y servicios**.
- La cuota deducible va en el bloque de IVA deducible (casillas 28 a 39), en la línea de adquisiciones intracomunitarias, separando bienes corrientes y bienes de inversión.
- Casilla **59**: entregas intracomunitarias exentas y prestaciones intracomunitarias de servicios.

## El modelo 349

**Quién lo presenta** (art. 79 del Reglamento del IVA): los empresarios que hagan entregas intracomunitarias exentas, adquisiciones intracomunitarias de bienes, prestaciones intracomunitarias de servicios o adquisiciones intracomunitarias de servicios, además de algunos supuestos especiales (ventas en consigna, operaciones triangulares).

**Qué contiene** (art. 80): NIF-IVA y nombre de cada cliente o proveedor y la base imponible total por cada uno, en el periodo en que se devenga la operación. Las rectificaciones se declaran en el periodo en que se notifican al cliente.

**Cuándo** (art. 81, vigente desde el 1 de marzo de 2020):
- Con carácter general, **mensual**, en los 20 primeros días naturales del mes siguiente (julio se presenta en agosto y hasta el 20 de septiembre).
- **Trimestral** si ni en el trimestre ni en ninguno de los cuatro anteriores las entregas de bienes más las prestaciones de servicios intracomunitarias superan **50.000 €** sin IVA. Si se superan a mitad de trimestre, se pasa a mensual desde ese mes.
- El último periodo del año se presenta hasta el 30 de enero.
- Ya no existe la presentación anual del 349.

## Fiscalidad relacionada

La exención de la entrega depende de que exista prueba del transporte: si la AEAT la discute, la venta pasa a tributar en España. Las importaciones y exportaciones fuera de la UE no van en el 349 (ver tema 10213 para importaciones). Las ventas a particulares de otros países (ventas a distancia) tienen un régimen distinto (ventanilla única, modelo 369) que no se trata aquí.

## Errores frecuentes

- Facturar sin IVA a un cliente comunitario cuyo NIF-IVA no está en VIES.
- No incluir la venta en el 349: la exención queda en entredicho aunque el 303 esté bien.
- Contabilizar la factura de un proveedor comunitario sin autorrepercutir el IVA.
- Declarar en las casillas 12 y 13 (otras inversiones del sujeto pasivo) servicios comunitarios que van en la 10 y 11.
- Diferencias entre la casilla 59 del 303 y la suma de entregas y servicios del 349 del mismo periodo.
- Seguir presentando trimestral tras superar los 50.000 € en un trimestre.

## Qué revisar en la contabilidad

- Suma de las subcuentas intracomunitarias de la 700 y 705 del trimestre frente a la casilla 59 del 303 y al 349.
- Suma de la base de la 477 por AIB frente a casillas 10 y 11, y frente a las adquisiciones del 349.
- Clientes con NIF que empieza por código de país (DE, FR, IT, PT...) facturados con IVA, o sin IVA y sin estar en VIES.
- Acumulado de los cuatro últimos trimestres frente a 50.000 € para decidir periodicidad.

## Fuentes

- Ley 37/1992 del IVA: art. 13 (adquisición intracomunitaria), art. 25 (exención de entregas a otro Estado miembro y condición de declararlas en el 349), art. 69 (servicios entre empresarios), art. 84 (cliente como sujeto pasivo), art. 90 (tipo general), art. 92 (deducción de la cuota autorrepercutida).
- Reglamento del IVA (RD 1624/1992): arts. 78 a 81 (declaración recapitulativa: obligados, contenido y plazos).
- AEAT: instrucciones del modelo 303 de 2026 y ficha del modelo 349.
