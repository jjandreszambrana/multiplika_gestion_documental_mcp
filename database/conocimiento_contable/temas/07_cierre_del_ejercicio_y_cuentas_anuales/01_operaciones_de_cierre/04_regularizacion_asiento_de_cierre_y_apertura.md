---
id: 10714
titulo: "Regularización, asiento de cierre y apertura"
resumen: "Los tres últimos asientos del año: regularización de los grupos 6 y 7 contra la 129, asiento de cierre que deja a cero las cuentas de balance y asiento de apertura del ejercicio nuevo, con ejemplo numérico que cuadra."
palabras_clave: [regularización, asiento de cierre, asiento de apertura, resultado del ejercicio, 129, grupo 6, grupo 7, 610, variación de existencias, pérdidas y ganancias]
aplica_a: [pgc_normal, pgc_pymes, microempresas]
vigente_desde: 2008-01-01
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/grupo1-2
  - BOE-A-2007-19884/grupo3-2
  - BOE-A-2007-19884/grupo6-2
  - BOE-A-1885-6627/art28
relacionados: [10711, 10712, 10231, 10611, 10521, 10522, 10722, 10131]
consultas_sif: ["sumas_y_saldos", "mayor:129", "mayor:610", "balance", "perdidas_y_ganancias"]
---

## En pocas palabras

Cuando todos los ajustes del cierre están hechos, se calcula el resultado llevando el saldo de todas las cuentas de gastos (grupo 6) e ingresos (grupo 7) a la **129 Resultado del ejercicio** (regularización). Después, el **asiento de cierre** salda todas las cuentas de balance (grupos 1 a 5) y el **asiento de apertura**, el primer día del ejercicio siguiente, las vuelve a abrir con los mismos saldos.

## Cuándo se aplica

Una vez al año, al final, y solo después de terminar la lista de comprobación del cierre (tema 10711), incluidos la variación de existencias y el gasto por impuesto sobre beneficios. Si después hay que corregir algo, se anula la regularización, se corrige y se vuelve a regularizar.

Muchos programas de contabilidad generan estos asientos solos. Aun así conviene entender qué hacen, para detectar cuándo han salido mal (por ejemplo, porque se regularizó antes del último ajuste).

## Cómo se contabiliza

### 1. Variación de existencias

Antes de regularizar, las cuentas de existencias del grupo 3 se actualizan: se abonan por el inventario inicial con cargo a la 610 (o la 61x que corresponda) y se cargan por el inventario final con abono a la misma cuenta (PGC, quinta parte, grupo 3). Las existencias de productos terminados y en curso se hacen contra la 71. Ver tema 10231.

### 2. Regularización

La 129 se abona con cargo a las cuentas de los grupos 6 y 7 con saldo acreedor, y se carga con abono a las que tienen saldo deudor (PGC, quinta parte, cuenta 129). El saldo que queda en la 129 es el beneficio (acreedor) o la pérdida (deudor).

**Ejemplo.** Una sociedad comercial tiene a 31-12-2026 estos saldos, ya con todos los ajustes:

- 700 Ventas de mercaderías: 500.000 (acreedor)
- 600 Compras de mercaderías: 280.000 (deudor)
- 610 Variación de existencias de mercaderías: 10.000 (acreedor; inventario inicial 40.000 y final 50.000)
- 640 Sueldos y salarios: 90.000
- 642 Seguridad Social a cargo de la empresa: 27.000
- 621 Arrendamientos y cánones: 24.000
- 681 Amortización del inmovilizado material: 15.000
- 662 Intereses de deudas: 4.000
- 6300 Impuesto corriente: 14.000 (calculado como explica el tema 10611)

Ingresos: 500.000 + 10.000 = 510.000. Gastos: 280.000 + 90.000 + 27.000 + 24.000 + 15.000 + 4.000 + 14.000 = 454.000. Resultado: 56.000 de beneficio.

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 700 Ventas de mercaderías | 500.000 | |
| 610 Variación de existencias de mercaderías | 10.000 | |
| 600 Compras de mercaderías | | 280.000 |
| 640 Sueldos y salarios | | 90.000 |
| 642 Seguridad Social a cargo de la empresa | | 27.000 |
| 621 Arrendamientos y cánones | | 24.000 |
| 681 Amortización del inmovilizado material | | 15.000 |
| 662 Intereses de deudas | | 4.000 |
| 6300 Impuesto corriente | | 14.000 |
| 129 Resultado del ejercicio | | 56.000 |
| **Total** | **510.000** | **510.000** |

Algunos despachos lo hacen en dos asientos (primero gastos contra la 129 y después ingresos contra la 129). El resultado es el mismo.

### 3. Asiento de cierre

Se cargan todas las cuentas de balance con saldo acreedor y se abonan todas las de saldo deudor, de modo que todas quedan a cero. Continuando el ejemplo, el balance de la sociedad tras la regularización es:

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 100 Capital social | 60.000 | |
| 112 Reserva legal | 12.000 | |
| 113 Reservas voluntarias | 40.000 | |
| 129 Resultado del ejercicio | 56.000 | |
| 170 Deudas a largo plazo con entidades de crédito | 100.000 | |
| 2813 Amortización acumulada de maquinaria | 60.000 | |
| 400 Proveedores | 70.000 | |
| 4752 Hacienda Pública, acreedora por impuesto sobre sociedades | 14.000 | |
| 476 Organismos de la Seguridad Social, acreedores | 3.000 | |
| 213 Maquinaria | | 200.000 |
| 300 Mercaderías A | | 50.000 |
| 430 Clientes | | 120.000 |
| 572 Bancos e instituciones de crédito c/c vista, euros | | 45.000 |
| **Total** | **415.000** | **415.000** |

Fíjese en que las amortizaciones acumuladas (2813) tienen saldo acreedor y por eso van al Debe, aunque estén en el activo del balance restando.

### 4. Asiento de apertura

El 1 de enero de 2027 se hace exactamente el asiento contrario al de cierre: las mismas cuentas e importes, cambiando Debe por Haber. La 129 queda abierta con 56.000 de saldo acreedor hasta que la junta apruebe la aplicación del resultado (tema 10521) o, si hubiera pérdidas, hasta su traspaso a la 121 (tema 10522).

El Código de Comercio exige que el libro de Inventarios y Cuentas anuales se abra con el balance inicial detallado y recoja el inventario de cierre (art. 28.1). El asiento de apertura es el reflejo en el Diario de ese balance inicial.

## Fiscalidad relacionada

Ninguna directa. El resultado que queda en la 129 es el punto de partida de la base imponible del Impuesto sobre Sociedades (tema 10821). Por eso el gasto por impuesto (6300) tiene que estar contabilizado antes de regularizar.

## Errores frecuentes

- Regularizar antes de contabilizar el impuesto o la variación de existencias.
- Dejar sin regularizar alguna cuenta del grupo 6 o 7 creada durante el año (una subcuenta nueva que el programa no incluye en su plantilla).
- Hacer la apertura con saldos distintos a los del cierre, por ejemplo porque se tocó un asiento del año anterior después de cerrar.
- Aplicar el resultado en la apertura: la 129 debe abrir con saldo y moverse solo con el acuerdo de la junta.
- Reabrir las cuentas de periodificación (480, 485) y olvidar el asiento de reversión del principio de año (tema 10712).

## Qué revisar en la contabilidad

- Tras la regularización, ninguna cuenta de los grupos 6 y 7 con saldo.
- El saldo de la 129 coincide con el resultado de la cuenta de pérdidas y ganancias.
- Tras el asiento de cierre, el balance de sumas y saldos queda a cero en todas las cuentas.
- El asiento de apertura del ejercicio nuevo es igual, línea a línea, al de cierre del anterior con los importes cambiados de lado.
- En el ejercicio nuevo, la 129 se mueve solo una vez por la aplicación del resultado.

## Fuentes

- PGC (RD 1514/2007), quinta parte, grupo 1 (cuenta 129 Resultado del ejercicio).
- PGC, quinta parte, grupo 3 (movimiento de las cuentas de existencias al cierre) y grupo 6 (subgrupo 61, variación de existencias).
- Código de Comercio, art. 28.1 (balance inicial e inventario de cierre en el libro de Inventarios y Cuentas anuales).
