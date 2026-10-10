---
id: 10421
titulo: "Clientes de dudoso cobro y deterioro de créditos (contable y fiscal)"
resumen: "Cuándo pasar un cliente a dudoso cobro (436), cómo dotar y revertir el deterioro (694, 490, 794) y cuándo es deducible en el Impuesto sobre Sociedades (6 meses desde el vencimiento, concurso, reclamación judicial), con asiento de ejemplo."
palabras_clave: [clientes de dudoso cobro, deterioro de créditos, insolvencias, morosos, provisión de insolvencias, 436, 490, 694, 794, 430, artículo 13 LIS]
aplica_a: [pgc_normal, pgc_pymes, microempresas, autonomos]
vigente_desde: 2008-01-01
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/A9            # PGC, NRV 9.ª, apartado 2.2.3: deterioro de activos a coste amortizado
  - BOE-A-2007-19884/grupo4-2      # PGC, quinta parte, grupo 4 (436, 490)
  - BOE-A-2007-19884/grupo6-2      # PGC, quinta parte, grupo 6 (650, 694)
  - BOE-A-2007-19884/grupo7-2      # PGC, quinta parte, grupo 7 (794)
  - BOE-A-2007-19966/A8            # PGC PYMES, NRV 8.ª Activos financieros (deterioro)
  - BOE-A-2014-12328/a13           # Ley del IS, art. 13.1: deducibilidad del deterioro de créditos
  - BOE-A-2006-20764/a28           # Ley del IRPF, art. 28.1: remisión a las normas del IS
otras_fuentes: []
relacionados: [10422, 10225, 10711, 10712, 10821, 10822, 10831, 11113]
consultas_sif: ["mayor:430", "mayor:436", "mayor:490", "mayor:694", "mayor:794", "sumas_y_saldos"]
---

## En pocas palabras

Cuando un cliente no paga y hay motivos razonables para dudar del cobro, su saldo se traspasa de la 430 a la **436 Clientes de dudoso cobro**. Al menos al cierre, la pérdida estimada se registra como gasto (**694**) con una cuenta correctora (**490**) que resta del activo. Si después se cobra, el deterioro se revierte (**794**). Fiscalmente el gasto solo es deducible si se da alguna de las circunstancias del art. 13.1 de la Ley del Impuesto sobre Sociedades, la más habitual que hayan pasado 6 meses desde el vencimiento.

## Cuándo se aplica

En cualquier crédito comercial (clientes y deudores de los subgrupos 43 y 44) con indicios de impago: retraso relevante, devolución de recibos, reclamaciones, concurso del cliente, cierre del negocio. El PGC exige corregir el valor "siempre que exista evidencia objetiva" de que los cobros futuros se reducirán o retrasarán, y al menos al cierre (NRV 9.ª, apartado 2.2.3).

La pérdida es la diferencia entre lo que figura en el balance y lo que se espera cobrar, incluido lo que se recupere de garantías. Si el crédito está asegurado o avalado, el deterioro se limita a la parte no cubierta.

Cuando el crédito es ya definitivamente incobrable (concurso concluido sin pago, deudor desaparecido, prescripción), no se dota deterioro: se da de baja con la 650 (tema 10422).

## Cómo se contabiliza

El PGC ofrece dos formas de calcular el deterioro (cuenta 490):

1. **Estimación global** de los saldos que, uno a uno, no son significativos: al cierre se dota la estimación del año (694 a 490) y se anula la del año anterior (490 a 794).
2. **Seguimiento individualizado** de cada cliente: se dota cuando se estima la pérdida y se revierte cuando el saldo se cobra, se da de baja o la pérdida disminuye.

En una pyme lo normal es el seguimiento individualizado, que además es el único deducible fiscalmente.

**Ejemplo (seguimiento individualizado).** Factura de 1 de marzo de 2026 a un cliente por 10.000 € más 21 % de IVA, total 12.100 €, con vencimiento el 31 de marzo. El 30 de septiembre sigue sin pagar y no contesta a las reclamaciones.

30 de septiembre de 2026, traspaso a dudoso cobro:

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 436 Clientes de dudoso cobro | 12.100,00 | |
| 430 Clientes | | 12.100,00 |
| **Total** | **12.100,00** | **12.100,00** |

31 de diciembre de 2026, deterioro por el importe que no se espera cobrar (aquí, todo):

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 694 Pérdidas por deterioro de créditos por operaciones comerciales | 12.100,00 | |
| 490 Deterioro de valor de créditos por operaciones comerciales | | 12.100,00 |
| **Total** | **12.100,00** | **12.100,00** |

En el balance, el cliente figura por 12.100 − 12.100 = 0 €.

Si en mayo de 2027 el cliente paga 4.000 € y se acuerda que el resto es incobrable, se registra el cobro (572 a 436 por 4.000 €), la baja del resto (650 a 436 por 8.100 €; tema 10422) y la reversión del deterioro ya dotado (490 a 794 por 12.100 €). Si en su lugar se espera cobrar más adelante, se revierte solo la parte que deja de estar deteriorada.

El IVA repercutido forma parte del crédito y, por tanto, del importe deteriorado. Si después se recupera mediante la modificación de la base imponible (tema 10422), la parte de IVA deja de ser una pérdida y su deterioro se revierte.

## Fiscalidad relacionada

La Ley 27/2014 del Impuesto sobre Sociedades, art. 13.1, permite deducir el deterioro de créditos por insolvencias si, **en la fecha de devengo del impuesto** (normalmente el 31 de diciembre), se da alguna de estas circunstancias:

- a) que hayan pasado **6 meses desde el vencimiento** de la obligación;
- b) que el deudor esté declarado en concurso;
- c) que el deudor esté procesado por alzamiento de bienes;
- d) que el crédito esté reclamado judicialmente o en un litigio o arbitraje del que dependa el cobro.

No son deducibles, aunque se cumpla lo anterior:

- los créditos de entidades de derecho público, salvo procedimiento judicial o arbitral sobre su existencia o cuantía;
- los créditos con personas o entidades vinculadas, salvo concurso con apertura de la fase de liquidación;
- las **estimaciones globales** del riesgo de insolvencias.

En el ejemplo, a 31 de diciembre de 2026 han pasado 9 meses desde el vencimiento: los 12.100 € son deducibles. Si el vencimiento hubiera sido el 31 de agosto, solo habrían pasado 4 meses: el gasto contable sería correcto, pero habría que hacer un ajuste positivo en el Impuesto sobre Sociedades (diferencia temporaria) y revertirlo en el año en que se cumplan los 6 meses o se produzca la pérdida definitiva (tema 10821).

Los autónomos en estimación directa parten de estas mismas reglas, porque el rendimiento de la actividad se calcula según las normas del Impuesto sobre Sociedades (Ley 35/2006 del IRPF, art. 28.1). En estimación directa simplificada hay reglas especiales para las provisiones (tema 10831).

## Errores frecuentes

- No dotar deterioro "porque fiscalmente no es deducible todavía". La obligación contable es independiente; la diferencia se corrige en el impuesto.
- Dotar deterioro sin pasar el saldo a la 436, o pasar a la 436 sin dotar el deterioro al cierre.
- Usar la 650 para lo que solo es dudoso: la 650 es para insolvencias firmes.
- Deducir fiscalmente una estimación global (por ejemplo, un porcentaje fijo sobre clientes).
- Deducir el deterioro de créditos con sociedades del grupo o con socios vinculados.
- Mantener años un saldo en la 436 y la 490 sin dar de baja los créditos ya incobrables ni recuperar el IVA a tiempo.

## Qué revisar en la contabilidad

- Antigüedad de la 430: los saldos vencidos hace más de 6 meses y no cobrados deberían estar en la 436 o tener explicación.
- Cada saldo de la 436 debe tener su deterioro en la 490, salvo la parte garantizada o que se espere cobrar.
- La 490 no puede ser mayor que la suma de la 436 y la 430 de los mismos clientes.
- Créditos de la 436 con más de un año desde el devengo de la factura: revisar si se ha modificado la base imponible del IVA (tema 10422).
- Créditos con vinculadas o administraciones públicas en la 490: revisar el ajuste fiscal.

## Fuentes

- PGC (RD 1514/2007), NRV 9.ª Instrumentos financieros, apartado 2.2.3 "Deterioro del valor", y quinta parte: cuentas 436, 490, 650, 694 y 794.
- PGC PYMES (RD 1515/2007), NRV 8.ª Activos financieros, apartado de deterioro de activos a coste amortizado.
- Ley 27/2014 del Impuesto sobre Sociedades, art. 13.1.
- Ley 35/2006 del IRPF, art. 28.1.
