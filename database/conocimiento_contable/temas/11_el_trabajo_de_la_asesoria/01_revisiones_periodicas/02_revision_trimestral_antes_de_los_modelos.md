---
id: 11112
titulo: "Revisión trimestral antes de los modelos"
resumen: "Qué cuadrar en la contabilidad antes de presentar los modelos trimestrales (303, 111, 115, 130, 202, 349) y sus plazos legales, con el asiento de liquidación del IVA y una lista de comprobación por modelo."
palabras_clave: [revisión trimestral, modelo 303, modelo 111, modelo 115, modelo 130, modelo 202, modelo 349, liquidación del IVA, 472, 477, 4750, 4751]
aplica_a: [pgc_normal, pgc_pymes, microempresas, autonomos]
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-1992-28925/a71
  - BOE-A-2007-6820/a108
  - BOE-A-2007-6820/a109
  - BOE-A-2007-6820/a110
  - BOE-A-2007-6820/a111
  - BOE-A-2014-12328/a40
otras_fuentes:
  - nombre: "AEAT, Calendario del contribuyente"
    url: https://sede.agenciatributaria.gob.es/Sede/calendario-contribuyente.html
    consultado: 2026-10-10
  - nombre: "AEAT, Manuales prácticos"
    url: https://sede.agenciatributaria.gob.es/Sede/manuales-practicos.html
    consultado: 2026-10-10
relacionados: [11111, 11113, 10261, 10262, 10816, 10815, 10823, 10833, 10841, 10842, 10861, 10941]
consultas_sif: ["cuadre_iva", "libros_iva", "iva", "retenciones", "mayor:472", "mayor:477", "mayor:4751", "perdidas_y_ganancias"]
---

## En pocas palabras

Antes de presentar los modelos del trimestre se cuadra la contabilidad con lo que se va a declarar: el IVA de los libros con las cuentas 472 y 477, las retenciones con la 4751 y el resultado acumulado con el pago fraccionado. Además es el momento de mirar el trimestre con perspectiva: resultado, tesorería y señales de alarma.

## Cuándo se aplica

En los días previos a cada plazo trimestral, después de la revisión mensual del último mes del trimestre (tema 11111). Plazos según la norma vigente (comprobados en el BOE en octubre de 2026):

| Modelo | Qué es | Plazo legal | Norma |
| --- | --- | --- | --- |
| 303 | IVA trimestral | 20 primeros días naturales del mes siguiente al trimestre; el 4.º trimestre, 30 primeros días de enero | Reglamento del IVA, art. 71.4 |
| 111, 115, 123 | Retenciones e ingresos a cuenta del IRPF | 20 primeros días naturales de abril, julio, octubre y enero | Reglamento del IRPF, art. 108.1 |
| 130 | Pago fraccionado del IRPF (estimación directa) | 1 al 20 de abril, julio y octubre; 4.º trimestre, 1 al 30 de enero | Reglamento del IRPF, art. 111.1 |
| 202 | Pago fraccionado del Impuesto sobre Sociedades | 20 primeros días naturales de abril, octubre y diciembre | Ley del Impuesto sobre Sociedades, art. 40.1 |

Tributan por meses, no por trimestres, entre otros, las empresas cuyo volumen de operaciones del año anterior superó 6.010.121,04 euros (Reglamento del IVA, art. 71.3; Reglamento del IRPF, art. 108.1). Cuando un plazo acaba en festivo o fin de semana, o se domicilia el pago, las fechas exactas del año salen del calendario del contribuyente de la AEAT. El modelo 349 tiene su propio régimen de periodicidad (tema 10815).

## Cómo se aplica

### Lista por modelo

**IVA (303)**

- Libros registro de facturas expedidas y recibidas completos y sin saltos de numeración.
- Base y cuota de los libros = saldos de 477 y 472 del trimestre (consulta `cuadre_iva`).
- Operaciones con inversión del sujeto pasivo e intracomunitarias registradas a la vez en 472 y 477 (temas 10814 y 10815).
- IVA no deducible (vehículos, atenciones a clientes) llevado a gasto y no a 472 (tema 10812).
- Saldo a compensar de trimestres anteriores (4700) igual al que figura en el último 303.
- Si hay entregas intracomunitarias o adquisiciones, que coincidan con el 349.

**Retenciones (111 y 115)**

- Saldo de la 4751 del trimestre = suma de retenciones de nóminas, profesionales y alquileres.
- Facturas de profesionales con retención: todas en la 4751, con su perceptor identificado.
- Alquileres de locales con retención: cada recibo con su retención.

**Pago fraccionado del IRPF (130)**

- Es el 20 % del rendimiento neto desde el 1 de enero hasta el final del trimestre, menos los pagos de los trimestres anteriores (Reglamento del IRPF, art. 110.1.a). Se restan además las retenciones soportadas desde el 1 de enero en los casos del art. 110.3.a (entre ellos, las actividades profesionales) y, si el rendimiento neto del año anterior no pasó de 12.000 euros, la deducción del cuadro del art. 110.3.c.
- Los profesionales no están obligados si, en el año anterior, al menos el 70 % de sus ingresos tuvo retención (art. 109.2).
- Ingresos y gastos de los libros del autónomo al día y cuadrados con el 303 (tema 10834).

**Pago fraccionado del Impuesto sobre Sociedades (202)**

- Modalidad general: 18 % de la cuota íntegra del último periodo declarado, menos deducciones, bonificaciones, retenciones e ingresos a cuenta (Ley del IS, art. 40.2).
- Si la empresa está en la modalidad sobre la base imponible del periodo (art. 40.3; obligatoria si la cifra de negocios superó 6 millones de euros en los 12 meses anteriores al inicio del periodo), hace falta el resultado contable acumulado fiable: amortizaciones, periodificaciones y variación de existencias del periodo registradas. Detalle en el tema 10823.

### Asiento de liquidación del IVA

En el trimestre, IVA repercutido 42.000 euros (477) e IVA soportado deducible 30.500 (472). Resultado a ingresar: 11.500.

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 477 Hacienda Pública, IVA repercutido | 42.000 | |
| 472 Hacienda Pública, IVA soportado | | 30.500 |
| 4750 Hacienda Pública, acreedora por IVA | | 11.500 |
| **Total** | **42.000** | **42.000** |

Si el soportado fuera mayor, la diferencia iría al debe de la 4700 (Hacienda Pública, deudora por IVA). Tras el asiento, 472 y 477 deben quedar a cero.

### Mirada de trimestre

Además de los modelos, con el trimestre cerrado se revisa:

- Resultado acumulado frente al mismo trimestre del año anterior (tema 10912).
- Liquidez y fondo de maniobra (tema 10921).
- Saldos anómalos (tema 11113) y señales de alarma (tema 10941).
- Si conviene, un breve informe al cliente con lo anterior y la previsión de lo que tendrá que pagar a Hacienda el trimestre siguiente.

## Errores frecuentes

- **Presentar el 303 desde los libros sin cuadrar con la contabilidad**: luego 472 y 477 no quedan a cero y nadie sabe por qué.
- **Facturas recibidas fuera de plazo** que se meten en el trimestre en que llegan sin revisar si el IVA se puede deducir en ese periodo.
- **Retenciones de profesionales no registradas** porque el cliente pagó el neto sin pasar la factura.
- **130 calculado solo con el trimestre** y no con el acumulado del año.
- **202 con la cuota del año equivocado**: se toma la del último periodo con plazo de declaración vencido al inicio del plazo del pago.
- **No conservar el justificante** de presentación con el asiento de liquidación.

## Qué revisar en la contabilidad

- Consulta `cuadre_iva`: bases y cuotas de los libros frente a 472 y 477.
- Saldos de 472 y 477 a cero tras el asiento de liquidación.
- Saldo de 4750 o 4700 igual al resultado del 303.
- Mayor de 4751 del trimestre frente al total de los modelos 111 y 115.
- Resultado acumulado del ejercicio para el 130 o el 202.

## Fuentes

- Reglamento del IVA, art. 71.3 y 71.4 (periodo de liquidación y plazos del 303).
- Reglamento del IRPF, arts. 108.1 (plazo de declaración de retenciones), 109.2 (excepción del 70 % para profesionales), 110.1.a y 110.3 (20 % del rendimiento neto y deducciones) y 111.1 (plazos del 130).
- Ley del Impuesto sobre Sociedades, art. 40 (pago fraccionado: plazos, base y 18 %).
