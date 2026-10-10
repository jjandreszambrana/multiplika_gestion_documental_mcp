---
id: 11113
titulo: "Saldos anómalos y qué significan"
resumen: "Tabla de saldos que no deberían existir o que indican un error o un problema (caja negativa, proveedores deudores, clientes acreedores, 555 permanente, IVA sin liquidar, 551 creciente, 129 sin aplicar...), con su causa probable y qué hacer."
palabras_clave: [saldos anómalos, saldo contrario, caja negativa, 570, 572, 430, 400, 410, 555, 551, 129, 4750]
aplica_a: [pgc_normal, pgc_pymes, microempresas, autonomos]
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/grupo4-2
  - BOE-A-2007-19884/grupo5-2
  - BOE-A-2007-19884/A6-3
  - BOE-A-1885-6627/art29
otras_fuentes: []
relacionados: [11111, 11112, 10253, 10254, 10251, 10532, 10521, 10261, 10241, 10132, 10941]
consultas_sif: ["sumas_y_saldos", "mayor:570", "mayor:572", "mayor:430", "mayor:400", "mayor:410", "mayor:555", "mayor:551", "mayor:129", "mayor:4750", "mayor:476", "mayor:465"]
---

## En pocas palabras

Cada cuenta tiene un saldo "natural": las de activo, deudor; las de pasivo y patrimonio neto, acreedor; los gastos, deudor; los ingresos, acreedor. Un saldo del signo contrario, o uno que no se mueve durante meses donde debería moverse, casi siempre es un error de registro o la pista de un problema. Revisarlos es la forma más rápida de encontrar fallos.

## Cuándo se aplica

En la revisión mensual (tema 11111), antes de los modelos trimestrales (tema 11112) y, con más cuidado, antes del cierre. También al recibir una contabilidad nueva de otro asesor: el sumas y saldos con los saldos anómalos marcados es la mejor foto de su calidad.

## Cómo se aplica

### Tabla de saldos anómalos

| Cuenta | Saldo natural | Anomalía | Causa probable | Qué hacer |
| --- | --- | --- | --- | --- |
| 570 Caja | Deudor | Acreedor (negativo) en algún día | Pagos registrados sin el ingreso o la reposición de caja que los financió; ventas al contado sin registrar | Es físicamente imposible. Buscar el ingreso que falta (tema 10253) |
| 570 Caja | Deudor | Muy alto y estable | Cobros en efectivo que no se ingresan, o diferencias acumuladas | Arqueo con el cliente |
| 572 Bancos | Deudor | Acreedor | Descubierto real, o error de registro | Si es real, presentarlo como deuda a corto con entidades de crédito al cierre; si no, conciliar (tema 10251) |
| 430 Clientes | Deudor | Acreedor | Cobro duplicado, factura sin registrar, anticipo cobrado | Revisar mayor; los anticipos van a 438 |
| 400 Proveedores, 410 Acreedores | Acreedor | Deudor | Pago duplicado, factura sin registrar, anticipo pagado, abono sin aplicar | Revisar mayor; los anticipos van a 407 |
| 555 Partidas pendientes | Acreedor | Saldo que no baja | Cobros sin identificar que se quedan | El PGC solo admite tenerlas el tiempo estrictamente necesario (tema 10254) |
| 472 y 477 | Cero tras liquidar | Saldo después del asiento de liquidación | Facturas registradas después de presentar el 303, o liquidación incompleta | Cuadrar con el 303 presentado (tema 10261) |
| 4750 Hacienda acreedora por IVA | Acreedor | Acumula varios trimestres | IVA declarado y no pagado, o pagos no registrados | Si es impago, es señal de alarma (tema 10941) |
| 4700 Hacienda deudora por IVA | Deudor | Saldo antiguo | Devolución no pedida o compensación no registrada | Revisar el último 303 |
| 4751 Retenciones | Acreedor | Deudor | Pago del 111 mayor que lo registrado; retenciones sin contabilizar | Cuadrar con los modelos 111 y 115 |
| 476 Seguridad Social | Acreedor | Más de un mes de cuotas | Cuotas sin pagar o pagos mal aplicados | Comparar con los recibos de liquidación (tema 10241) |
| 465 Remuneraciones pendientes | Acreedor | Saldo que crece | Nóminas sin pagar o pagos registrados contra otra cuenta | Cuadrar con las transferencias de nóminas |
| 551 Socios y administradores | Cualquiera | Deudor y creciente | Pagos personales con dinero de la empresa | Documentar y valorar sus efectos fiscales (tema 10532) |
| 129 Resultado del ejercicio | Del año | Con saldo del año anterior pasado el plazo de aprobación | Falta el asiento de aplicación del resultado | Registrar la distribución aprobada por la junta (tema 10521) |
| 28 Amortización acumulada | Acreedor | Mayor que el coste del bien | Se sigue amortizando un bien ya amortizado | Parar la dotación y revisar el inventario |
| Cuentas de gasto (6) | Deudor | Acreedor | Abonos o rappels contabilizados en la cuenta de gasto con importe mayor | Usar las cuentas propias (606, 608, 609) |
| Cuentas de ingreso (7) | Acreedor | Deudor | Rectificativas o devoluciones mal registradas | Usar 706, 708, 709 |

### Ejemplo

El proveedor habitual de una empresa aparece con saldo deudor de 1.210 euros. En su mayor se ve un pago de 1.210 el día 12 sin factura asociada. El cliente confirma que había una factura de 1.000 euros más IVA del 21 % que no se entregó a la asesoría. Se registra:

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 600 Compras de mercaderías | 1.000 | |
| 472 Hacienda Pública, IVA soportado | 210 | |
| 400 Proveedores | | 1.210 |
| **Total** | **1.210** | **1.210** |

El saldo del proveedor queda a cero. Si en cambio el pago hubiera sido un error (pago duplicado), se deja el saldo deudor con una nota y se pide al proveedor la devolución o que lo descuente de la siguiente factura.

### Cómo se busca

1. Sacar el sumas y saldos a nivel de subcuenta.
2. Filtrar las subcuentas con saldo de signo contrario al natural de su cuenta.
3. Filtrar las que no han tenido movimiento en los últimos tres meses y deberían tenerlo (555, 465, 476, 4750).
4. Para cada una, abrir el mayor y buscar el apunte que lo provoca.

### Por qué importa más allá del error

Los saldos con signo cambiado deforman el balance: un proveedor deudor dentro de "Acreedores comerciales" reduce el pasivo y mejora en falso la liquidez (tema 10921). El PGC solo permite presentar activos y pasivos por su neto cuando hay derecho exigible a compensarlos e intención de liquidarlos por el neto (tercera parte, norma 6.ª, apartado 2). Al cierre, los saldos deudores de proveedores que se mantengan deben presentarse en el activo, no restando del pasivo.

## Errores frecuentes

- **Corregir con un apunte manual "de cuadre"** sin saber la causa: el error vuelve a aparecer y además se pierde la pista.
- **Mirar a nivel de cuenta y no de subcuenta**: un proveedor deudor se esconde dentro de la suma de los acreedores.
- **Ignorar la caja negativa por "pequeña"**: si es imposible, hay un ingreso o un registro que falta, y en una inspección es un indicio de ventas no declaradas.
- **Dejar la 551 sin documentar**: tiene efectos fiscales y mercantiles.
- **Arrastrar la 129** un año más sin aplicar el resultado.

## Qué revisar en la contabilidad

- Sumas y saldos por subcuenta: lista de subcuentas con signo contrario al natural.
- Mayor de 570 día a día para detectar saldos negativos.
- Antigüedad de los saldos de 555, 465, 476 y 4750.
- 472 y 477 a cero tras cada liquidación trimestral.
- Saldo de 129 después del plazo de aprobación de cuentas.
- Amortización acumulada frente al coste de cada elemento del inmovilizado.

## Fuentes

- PGC, quinta parte, grupos 4 y 5 (contenido, movimiento y ubicación en el balance de las cuentas 400, 430, 4700, 4750, 555, 570 y 572).
- PGC, tercera parte, norma 6.ª, apartado 2 (cuándo se pueden compensar activos y pasivos).
- Código de Comercio, art. 29.1 (los errores deben salvarse en cuanto se adviertan).
