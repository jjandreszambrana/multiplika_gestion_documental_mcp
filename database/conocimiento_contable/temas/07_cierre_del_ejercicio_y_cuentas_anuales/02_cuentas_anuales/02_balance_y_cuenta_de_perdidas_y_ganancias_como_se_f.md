---
id: 10722
titulo: "Balance y cuenta de pérdidas y ganancias: cómo se forman desde las cuentas"
resumen: "Cómo pasar del balance de sumas y saldos a las partidas del balance y de la cuenta de pérdidas y ganancias según la columna de números de cuenta de los modelos del PGC y del PGC PYMES, con las reclasificaciones que más se olvidan."
palabras_clave: [balance, cuenta de pérdidas y ganancias, modelos de cuentas anuales, número de cuentas, partidas, corriente, no corriente, reclasificación, sumas y saldos, 129, 520, 490]
aplica_a: [pgc_normal, pgc_pymes, microempresas]
vigente_desde: 2008-01-01
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/balance
  - BOE-A-2007-19884/cuenta
  - BOE-A-2007-19884/A6-3
  - BOE-A-2007-19884/A7-3
  - BOE-A-2007-19966/iimodelosdecuentasanuales
  - BOE-A-1885-6627/art35
relacionados: [10714, 10711, 10721, 10131, 10411, 10911, 10912, 10523]
consultas_sif: ["sumas_y_saldos", "balance", "perdidas_y_ganancias", "mayor:170", "mayor:520", "mayor:430", "mayor:438"]
---

## En pocas palabras

El balance y la cuenta de pérdidas y ganancias no se rellenan a mano: cada partida de los modelos oficiales lleva al lado, en la columna "N.º cuentas", qué cuentas del PGC suman o restan en ella. Se parte del balance de sumas y saldos al cierre (después de los ajustes y antes del asiento de cierre) y se agrupan los saldos según esa columna. Lo que hay que vigilar son las cuentas que cambian de partida según su saldo o su plazo.

## Cuándo se aplica

Al preparar las cuentas anuales de cada ejercicio, y también para balances de situación intermedios que pida un banco o un socio. Los programas de contabilidad hacen este agrupamiento solos; el contable revisa que la plantilla está bien y que los saldos están en la cuenta correcta.

## Cómo se aplica

### Leer la columna de cuentas

En los modelos del PGC (tercera parte, II Modelos normales y III Modelos abreviados) y del PGC PYMES, cada línea indica las cuentas. Las que van entre paréntesis restan. Algunos ejemplos del balance normal:

| Partida del balance | Cuentas que la forman |
| --- | --- |
| B.III.1 Clientes por ventas y prestaciones de servicios | 430, 431, 432, 435, 436, (437), (490), (4935) |
| B.VI Periodificaciones a corto plazo (activo) | 480, 567 |
| B.VII.1 Tesorería | 570, 571, 572, 573, 574, 575 |
| A-1.VII Resultado del ejercicio | 129 |
| B.II.2 Deudas con entidades de crédito a largo plazo | 1605, 170 |
| C.III.2 Deudas con entidades de crédito a corto plazo | 5105, 520, 527 |
| C.V.1 Proveedores | 400, 401, 405, (406) |
| C.V.6 Otras deudas con las Administraciones Públicas | 4750, 4751, 4758, 476, 477 |
| C.V.7 Anticipos de clientes | 438 |

Y de la cuenta de pérdidas y ganancias normal:

| Partida | Cuentas |
| --- | --- |
| 1.a) Ventas | 700, 701, 702, 703, 704, (706), (708), (709) |
| 4.a) Consumo de mercaderías | (600), 6060, 6080, 6090, 610 |
| 6.a) Sueldos, salarios y asimilados | (640), (641), (6450) |
| 7.a) Servicios exteriores | (62) |
| 8. Amortización del inmovilizado | (68) |
| 13. Gastos financieros (con terceros) | (6624), (6642), (6643), ... (669) |
| 17. Impuestos sobre beneficios | (6300), 6301, (633), 638 |

Las partidas del modelo abreviado agrupan varias líneas del normal; las del PGC PYMES son parecidas a las abreviadas. Se usa siempre el modelo que corresponda al tamaño (tema 10721).

### Ejemplo

Saldos de una sociedad a 31-12-2026 (extracto):

- 430 Clientes: 92.000 deudor
- 436 Clientes de dudoso cobro: 6.000 deudor
- 490 Deterioro de valor de créditos por operaciones comerciales: 6.000 acreedor
- 438 Anticipos de clientes: 4.000 acreedor
- 170 Deudas a largo plazo con entidades de crédito: 150.000 acreedor, de los que 30.000 vencen en 2027 y no se han reclasificado
- 520 Deudas a corto plazo con entidades de crédito: 12.000 acreedor (póliza dispuesta)
- 527 Intereses a corto plazo de deudas con entidades de crédito: 400 acreedor

Partidas resultantes:

- **Clientes por ventas** = 92.000 + 6.000 − 6.000 = **92.000**.
- **Anticipos de clientes** (pasivo corriente) = **4.000**. No se resta de clientes.
- Antes de presentar, se reclasifica la parte del préstamo que vence en 12 meses (PGC, tercera parte, norma 6.ª.1.b): asiento 170 al Debe y 520 al Haber por 30.000.
- **Deudas con entidades de crédito a largo plazo** = 150.000 − 30.000 = **120.000**.
- **Deudas con entidades de crédito a corto plazo** = 12.000 + 30.000 + 400 = **42.400**.

Sin la reclasificación, el pasivo corriente quedaría 30.000 por debajo de la realidad y el fondo de maniobra saldría mejor de lo que es.

### Cuentas que cambian de partida

- **Saldos de signo contrario**: un proveedor con saldo deudor (pagado de más) no es un menos en Proveedores sino un deudor. Lo correcto es corregir el error en la contabilidad; si el saldo es real (anticipo), debe ir en 407 Anticipos a proveedores.
- **Hacienda**: el saldo deudor de la 4700 (IVA a devolver) va en el activo; el acreedor de la 4750, en el pasivo. Lo mismo ocurre con 4709 frente a 4752.
- **Bancos**: una cuenta 572 con saldo acreedor (descubierto) es una deuda con entidades de crédito a corto plazo, no tesorería negativa.
- **Largo y corto plazo**: préstamos (170/520), arrendamientos financieros (174/524), fianzas (180/560, 260/565) y créditos (252/542) se dividen por vencimiento.

## Fiscalidad relacionada

El modelo 200 del Impuesto sobre Sociedades incluye el balance y la cuenta de pérdidas y ganancias con la misma estructura. Lo que se declara debe coincidir con las cuentas aprobadas y depositadas.

## Errores frecuentes

- Formar las cuentas después del asiento de cierre (todo a cero) o antes de regularizar sin incluir el resultado en la 129.
- No reclasificar a corto plazo la parte de las deudas que vence en el año siguiente.
- Netear anticipos de clientes con clientes, o proveedores deudores con proveedores acreedores.
- Presentar la 572 con saldo acreedor dentro de la tesorería.
- Usar plantillas antiguas del programa, anteriores a los cambios del RD 1/2021 en algunas partidas.

## Qué revisar en la contabilidad

- Total activo igual a total patrimonio neto y pasivo.
- Resultado de la cuenta de pérdidas y ganancias igual al saldo de la 129.
- Saldo de la 520 + 527 comparado con el cuadro de amortización de los préstamos: debe incluir el principal de los próximos 12 meses.
- Subcuentas de 400 y 430 con saldo de signo contrario.
- Cuentas 572 con saldo acreedor.
- Comparar cada partida con la del año anterior: cambios grandes sin explicación suelen ser errores de plantilla.

## Fuentes

- PGC (RD 1514/2007), tercera parte, II Modelos normales: balance y cuenta de pérdidas y ganancias (columna "N.º cuentas").
- PGC, tercera parte, normas 6.ª (balance) y 7.ª (cuenta de pérdidas y ganancias).
- RD 1515/2007, PGC de PYMES, tercera parte, II Modelos de cuentas anuales.
- Código de Comercio, art. 35 (estructura del balance y de la cuenta de pérdidas y ganancias).
