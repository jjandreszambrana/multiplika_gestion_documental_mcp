---
id: 11111
titulo: "Revisión mensual de la contabilidad: lista de comprobación"
resumen: "Qué comprobar cada mes para que la contabilidad esté al día y sin errores (bancos, caja, 555, clientes y proveedores, facturas, nóminas, IVA, préstamos, amortizaciones), con criterio de aceptación de cada punto y un ejemplo de conciliación."
palabras_clave: [revisión mensual, lista de comprobación, conciliación bancaria, sumas y saldos, 572, 570, 555, 430, 400, 476, 4751, libros registro]
aplica_a: [pgc_normal, pgc_pymes, microempresas, autonomos]
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-1885-6627/art25
  - BOE-A-1885-6627/art29
  - BOE-A-1992-28925/a62
  - BOE-A-2007-19884/grupo5-2
otras_fuentes: []
relacionados: [11112, 11113, 11121, 10251, 10253, 10254, 10241, 10261, 10411, 10712]
consultas_sif: ["sumas_y_saldos", "mayor:572", "mayor:570", "mayor:555", "mayor:430", "mayor:400", "mayor:476", "mayor:4751", "libros_iva", "diario"]
---

## En pocas palabras

Cada mes, cuando ya está contabilizada la documentación del mes anterior, se repasa una lista fija de puntos. El objetivo es que los errores se encuentren con semanas de antigüedad y no al hacer el modelo trimestral o el cierre, cuando cuesta mucho más rastrearlos.

## Cuándo se aplica

Todos los meses, en todas las empresas cuya contabilidad lleva la asesoría, entre los días 5 y 15 del mes siguiente (cuando ya están los extractos y la mayoría de facturas). En empresas pequeñas con poco movimiento puede hacerse cada dos meses, pero nunca menos que antes de cada modelo trimestral (tema 11112).

Fundamento: el Código de Comercio exige una contabilidad ordenada que permita seguir las operaciones por orden cronológico (art. 25.1) y que los errores se corrijan en cuanto se adviertan (art. 29.1). Aunque la lleve la asesoría, la responsabilidad sigue siendo del empresario (art. 25.2; ver tema 11131).

## Cómo se aplica

### La lista

| N.º | Comprobación | Correcto si |
| --- | --- | --- |
| 1 | Documentación del mes recibida (tema 11121) | No falta ningún extracto, factura emitida ni nómina |
| 2 | Sumas y saldos cuadrado | Suma de debe = suma de haber; ningún asiento descuadrado |
| 3 | Bancos conciliados (572) | Saldo contable = saldo del extracto a fin de mes, o diferencias explicadas (tema 10251) |
| 4 | Caja (570) | Saldo nunca negativo en ningún día del mes y razonable para el negocio (tema 10253) |
| 5 | Partidas pendientes de aplicación (555) | Saldo cero o solo cobros de los últimos días, identificados (tema 10254) |
| 6 | Facturas emitidas | Numeración correlativa sin saltos; todas en el libro registro de facturas expedidas |
| 7 | Facturas recibidas | Las del mes registradas; las de proveedores habituales no faltan |
| 8 | Clientes (430) y proveedores (400, 410) | Ninguna subcuenta con saldo de signo contrario sin explicación |
| 9 | Nóminas y seguros sociales (640, 642, 476, 4751, 465) | 476 = cuota del mes pendiente; 465 a cero tras pagar; 4751 = retenciones del mes (tema 10241) |
| 10 | IVA (472, 477) | Coinciden con los libros registro del mes |
| 11 | Préstamos y leasing (170, 520, 174, 524, 662) | Cuotas del mes registradas separando capital e intereses según el cuadro |
| 12 | Amortizaciones (68, 28) | Dotación del mes registrada, si se hace mensual |
| 13 | Periodificaciones (480, 485) | Gastos anuales (seguros, cuotas) imputados por meses (tema 10712) |
| 14 | Socios y administradores (551) | Movimientos explicados y documentados |
| 15 | Cuentas nuevas | No se han creado subcuentas duplicadas o en el grupo equivocado |

### Ejemplo: conciliar un banco

A 31 de mayo, la cuenta 572 marca 23.450 euros y el extracto 24.120. Diferencia: 670 euros. Repasando, en el extracto hay un cobro de un cliente de 700 euros no contabilizado y una comisión de 30 no registrada: 23.450 + 700 − 30 = 24.120. Cuadra.

Asiento de ajuste:

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 572 Bancos e instituciones de crédito c/c vista, euros | 670 | |
| 626 Servicios bancarios y similares | 30 | |
| 430 Clientes | | 700 |
| **Total** | **700** | **700** |

Si una diferencia no se puede explicar, no se fuerza: se deja anotada y se pregunta al cliente.

### Cómo se documenta

Para cada empresa y mes, una hoja (o nota en la GD) con los 15 puntos, quién los revisó, la fecha y las incidencias pendientes. Lo que no se resuelva se arrastra al mes siguiente y, si sigue abierto, se lleva a la revisión trimestral.

### Orden de trabajo recomendado

Primero bancos (puntos 3 a 5), porque descubren facturas y cobros que faltan; después terceros (6 a 8); después personal, impuestos y financiación (9 a 11); por último los ajustes de periodo (12 y 13). Repetir el sumas y saldos al final.

## Errores frecuentes

- **Dar por conciliado un banco porque "más o menos cuadra"**: una diferencia pequeña puede ser la suma de dos grandes de signo contrario.
- **Dejar la 555 como cajón**: el PGC dice que las remesas deben estar en ella solo el tiempo estrictamente necesario para aclarar su causa.
- **Revisar solo saldos de fin de mes** en caja: el saldo puede haber sido negativo a mitad de mes.
- **No registrar el capital del préstamo** y llevar toda la cuota a gasto financiero.
- **Hacer la revisión solo cuando toca el modelo**: con tres meses acumulados, cualquier error tarda el triple en encontrarse.
- **No dejar constancia** de lo revisado: si después aparece un error, no se sabe si se miró.

## Qué revisar en la contabilidad

Las consultas que la IA puede hacer con los datos del SIF para cada punto:

- Sumas y saldos del mes: cuadre y cuentas con signo contrario al natural.
- Mayor de 572 frente al saldo del extracto que aporte el cliente.
- Mayor de 570 día a día: saldos negativos.
- Saldo de 555 y antigüedad de sus partidas.
- Diario: asientos descuadrados o sin concepto.
- Libros registro del IVA: saltos en la numeración de facturas emitidas.
- Mayor de 476 y 4751 frente a los importes de los documentos de cotización y del modelo 111.

## Fuentes

- Código de Comercio, art. 25 (contabilidad ordenada, seguimiento cronológico; responsabilidad del empresario aunque la lleve otra persona) y art. 29.1 (claridad, orden de fechas y corrección inmediata de errores).
- Reglamento del IVA, art. 62 (libros registro obligatorios).
- PGC, quinta parte, grupo 5 (definición y movimiento de las cuentas 555, 570 y 572).
