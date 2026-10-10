---
id: 10321
titulo: "Leasing: contabilización por el arrendatario"
resumen: "Cuándo un arrendamiento es financiero, cómo registrar el activo y la deuda (174/524), el pago de cuotas con intereses (662) e IVA, la reclasificación al corto plazo, la amortización, el régimen fiscal del art. 106 LIS y el atajo de las microempresas (6211)."
palabras_clave: [leasing, arrendamiento financiero, opción de compra, cuotas, cuadro de amortización, 174, 524, 662, 218, 6211, art. 106 LIS, NRV 8.ª]
aplica_a: [pgc_normal, pgc_pymes, microempresas]
vigente_desde: 2008-01-01
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/A8
  - BOE-A-2007-19966/A7-2
  - BOE-A-2007-19966/a4
  - BOE-A-2007-19884/grupo1-2
  - BOE-A-2014-12328/a106
  - BOE-A-1992-28740/a75
  - BOE-A-1992-28740/a95
otras_fuentes:
  - nombre: AEAT, Manual práctico de Sociedades 2025
    url: https://sede.agenciatributaria.gob.es/Sede/Ayuda/25Manual/200.shtml
    consultado: 2026-10-10
relacionados: [10322, 10311, 10312, 10111, 11021, 10411, 10812]
consultas_sif: ["mayor:174", "mayor:524", "mayor:662", "mayor:218", "mayor:6211"]
---

## En pocas palabras

Si el contrato transfiere en la práctica los riesgos y beneficios del bien (lo normal en un leasing con opción de compra que se va a ejercer), el arrendatario registra el bien en su activo y una **deuda** con la entidad (174 a largo plazo y 524 a corto). Cada cuota se divide en **devolución de deuda** e **intereses** (662). El bien se amortiza como si fuera propio. Las microempresas que aplican sus criterios específicos pueden llevar las cuotas directamente a gasto.

## Cuándo se aplica

La NRV 8.ª del PGC (7.ª en el PGC PYMES) califica un arrendamiento como **financiero** cuando de sus condiciones económicas se deduce que se transfieren sustancialmente todos los riesgos y beneficios de la propiedad. Se presume así:

- si hay **opción de compra** y no hay dudas razonables de que se va a ejercer (una opción por el importe de una cuota, por ejemplo);
- y, salvo prueba en contrario, también sin opción de compra cuando la propiedad se transfiere al final, el plazo cubre la mayor parte de la vida económica del bien, el valor actual de los pagos mínimos es prácticamente el valor del bien, el bien es tan específico que solo lo puede usar el arrendatario, o el arrendatario asume las pérdidas de cancelar o las variaciones del valor residual.

Si no se cumplen, es arrendamiento operativo (renting o alquiler): tema 10322. La calificación depende del contenido económico, no del nombre del contrato.

## Cómo se contabiliza

1. **Al inicio**: activo según su naturaleza (por ejemplo, 218 Elementos de transporte) y deuda por el **menor** entre el valor razonable del bien y el valor actual de los pagos mínimos (cuotas sin IVA, más la opción de compra). Los gastos directos iniciales del arrendatario suman al activo. El descuento se hace al tipo de interés implícito del contrato.
2. **Cada cuota**: la parte de capital reduce la deuda; la de intereses es gasto financiero (662), por el método del tipo de interés efectivo. El IVA de la cuota es soportado.
3. **Al cierre**: la parte de capital que vence en los doce meses siguientes se traspasa de la 174 a la 524.
4. **Amortización** del bien según su vida útil (no según la duración del contrato, si se va a ejercer la opción).
5. **Opción de compra**: la última cuota cancela la deuda; el bien ya estaba en el activo.

**Ejemplo**. Furgoneta de 30.000 € (sin IVA) en leasing a 3 años, tipo de interés del 5 % anual, tres cuotas anuales vencidas de 11.016,26 € más IVA al 21 %; la última incluye la opción de compra. Cuotas anuales para simplificar; las mensuales se calculan igual.

Cuadro de amortización de la deuda:

| Año | Cuota sin IVA | Intereses | Capital | Deuda pendiente |
| --- | --- | --- | --- | --- |
| 0 | | | | 30.000,00 |
| 1 | 11.016,26 | 1.500,00 | 9.516,26 | 20.483,74 |
| 2 | 11.016,26 | 1.024,19 | 9.992,07 | 10.491,67 |
| 3 | 11.016,26 | 524,59 | 10.491,67 | 0,00 |

Alta (el capital del año 1 es corto plazo):

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 218 Elementos de transporte | 30.000,00 | |
| 524 Acreedores por arrendamiento financiero a corto plazo | | 9.516,26 |
| 174 Acreedores por arrendamiento financiero a largo plazo | | 20.483,74 |
| **Total** | **30.000,00** | **30.000,00** |

Pago de la primera cuota (IVA 21 % sobre 11.016,26 = 2.313,41):

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 524 Acreedores por arrendamiento financiero a corto plazo | 9.516,26 | |
| 662 Intereses de deudas | 1.500,00 | |
| 472 Hacienda Pública, IVA soportado | 2.313,41 | |
| 572 Bancos e instituciones de crédito c/c vista, euros | | 13.329,67 |
| **Total** | **13.329,67** | **13.329,67** |

Reclasificación al cierre del año 1 (capital que vence en el año 2):

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 174 Acreedores por arrendamiento financiero a largo plazo | 9.992,07 | |
| 524 Acreedores por arrendamiento financiero a corto plazo | | 9.992,07 |
| **Total** | **9.992,07** | **9.992,07** |

Amortización del año 1, con vida útil de 8 años: 30.000 / 8 = 3.750 € (681 al debe, 2818 al haber).

**Microempresas** (art. 4.3 del RD 1515/2007): si aplican sus criterios específicos, no registran activo ni deuda; cada cuota devengada (sin IVA) se carga a la **6211 Arrendamientos financieros y otros**. Al ejercer la opción se da de alta el bien por el precio de la opción. En la memoria se informa del valor al contado, cuotas pagadas, deuda pendiente y precio de la opción. No aplica a terrenos ni a otros activos no amortizables.

## Fiscalidad relacionada

- **IVA**: se devenga en cada cuota, cuando es exigible (art. 75.Uno.7.º de la Ley del IVA). Si el bien es un turismo, se presume afectado al 50 % (art. 95.Tres.2.ª), también en arrendamiento.
- **Impuesto sobre Sociedades, art. 106 de la Ley 27/2014**: cuando el arrendador es una entidad de crédito o un establecimiento financiero de crédito, el contrato dura al menos 2 años (muebles) o 10 (inmuebles) y la parte de recuperación del coste es constante o creciente, son deducibles la **carga financiera** y la parte de **recuperación del coste** (salvo terrenos), con el límite del **doble del coeficiente máximo** de la tabla (multiplicado además por 1,5 en empresas de reducida dimensión). Esta deducción no exige contabilizarla como gasto, así que crea **diferencias temporarias**: en el ejemplo, con un coeficiente máximo del 16 % (elementos de transporte externo), el límite es 30.000 × 32 % = 9.600 € al año. En el año 1 se deducirían 9.516,26 € de recuperación de coste frente a 3.750 € de amortización contable: ajuste negativo de 5.766,26 €, que revierte en años posteriores. Comprobar el coeficiente que corresponde al vehículo concreto.
- Si no se cumplen los requisitos del art. 106, solo se deduce la amortización según las reglas generales (tema 10312).

## Errores frecuentes

- Contabilizar la cuota completa como gasto (621 o 6211) en una empresa que no aplica los criterios de microempresas.
- Incluir en la deuda el IVA o los intereses futuros.
- No reclasificar cada cierre el capital del año siguiente de la 174 a la 524.
- Amortizar el bien en la duración del contrato cuando su vida útil es mayor y se ejercerá la opción.
- Repartir intereses y capital de forma lineal en lugar de seguir el cuadro del contrato.
- Aplicar el art. 106 a un contrato con una entidad que no es de crédito o con menos de dos años.

## Qué revisar en la contabilidad

- La suma de 174 y 524 debe coincidir con el capital pendiente del cuadro de la entidad a la fecha.
- La 524 al cierre debe ser el capital que vence en los doce meses siguientes.
- La 662 del año debe cuadrar con los intereses del cuadro.
- Cada leasing activo debe tener su elemento en el 21 y su dotación en la 681.
- En empresas que no son microempresas: saldo de la 6211 a cero.

## Fuentes

- PGC, NRV 8.ª Arrendamientos y otras operaciones de naturaleza similar (apartados 1.1 y 1.2). PGC PYMES, NRV 7.ª.
- RD 1515/2007, art. 4.3 y 4.4 (criterios de microempresas, cuenta 6211).
- PGC, quinta parte, grupo 1: cuenta 174.
- Ley 27/2014, art. 106 (contratos de arrendamiento financiero).
- Ley 37/1992 del IVA: art. 75.Uno.7.º (devengo) y art. 95.Tres (vehículos).
