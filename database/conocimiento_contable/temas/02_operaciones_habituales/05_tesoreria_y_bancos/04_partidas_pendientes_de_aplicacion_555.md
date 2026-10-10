---
id: 10254
titulo: "Partidas pendientes de aplicación (555)"
resumen: "Para qué sirve la cuenta 555 (cobros cuya causa no se conoce todavía), cuánto tiempo puede estar un importe en ella, cómo se aplica después y por qué un saldo antiguo es un riesgo contable y fiscal."
palabras_clave: [partidas pendientes de aplicación, cobros sin identificar, ingreso sin concepto, 555, 572, 430, anticipos de clientes, 438, conciliación, pasivo inexistente]
aplica_a: [pgc_normal, pgc_pymes, microempresas, esfl, autonomos]
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/grupo5-2      # PGC, quinta parte, grupo 5 (cuenta 555)
  - BOE-A-2007-19966/grupo5-2      # PGC PYMES, quinta parte, grupo 5 (cuenta 555)
  - BOE-A-2007-19884/grupo4-2      # PGC, quinta parte, grupo 4 (cuentas 430 y 438)
  - BOE-A-2007-19884/A3            # PGC, marco conceptual, 3.º Principios contables (devengo, no compensación)
  - BOE-A-1992-28740/a75           # Ley del IVA, art. 75.Dos: devengo en pagos anticipados
  - BOE-A-2014-12328/a121          # Ley del Impuesto sobre Sociedades, art. 121: presunción de rentas no declaradas
otras_fuentes: []
relacionados: [10225, 10251, 10253, 10421, 10711, 11111, 11113]
consultas_sif: ["mayor:555", "mayor:572", "mayor:430", "sumas_y_saldos"]
---

## En pocas palabras

La 555 es una cuenta de espera para **cobros** que llegan al banco o a la caja sin que se sepa todavía a qué corresponden. Se abona al recibir el dinero y se carga cuando se descubre su causa, con abono a la cuenta correcta. El PGC dice que esos importes deben quedarse en ella "el tiempo estrictamente necesario para aclarar su causa". Al cierre del ejercicio debería estar a cero o con muy pocas partidas, todas recientes y documentadas.

## Cuándo se aplica

Según el PGC y el PGC PYMES, la 555 recoge "remesas de fondos recibidas cuya causa no resulte, en principio, identificable", siempre que no correspondan a operaciones que deban ir en otros subgrupos. Figura en el **pasivo corriente**. Casos típicos:

- Transferencia de un cliente sin número de factura y con un ordenante distinto (por ejemplo, la empresa del grupo del cliente).
- Ingreso en efectivo en el banco sin referencia.
- Devolución de un proveedor o de un organismo público sin comunicación previa.

No es para:

- **Pagos** sin justificante. El PGC solo prevé la 555 para cobros. Un cargo en el banco que no se identifica se investiga con el cliente; no se deja en la 555 con saldo deudor ni se lleva a gasto sin soporte.
- Anticipos de clientes conocidos: van a la 438 (tema de anticipos de clientes).
- Diferencias de conciliación que no se entienden: primero hay que encontrarlas (tema 10251).

## Cómo se contabiliza

**Asiento 1. Cobro sin identificar (12 de mayo).** Llega una transferencia de 1.210,00 € con el concepto "pago" y un ordenante que no está en la ficha de clientes.

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 572 Bancos e instituciones de crédito c/c vista, euros | 1.210,00 | |
| 555 Partidas pendientes de aplicación | | 1.210,00 |
| **Total** | **1.210,00** | **1.210,00** |

**Asiento 2a. Se identifica como cobro de una factura (20 de mayo).** El cliente confirma que paga la factura 2026/0158, de 1.210,00 € (1.000,00 + 210,00 de IVA ya repercutido al emitirla).

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 555 Partidas pendientes de aplicación | 1.210,00 | |
| 430 Clientes | | 1.210,00 |
| **Total** | **1.210,00** | **1.210,00** |

**Asiento 2b. Variante: era un anticipo de un pedido.** Si el cliente dice que es un pago adelantado de un pedido que se entregará en junio, el IVA se devenga en el momento del cobro por el importe cobrado (Ley del IVA, art. 75.Dos). La base es 1.000,00 € y el IVA 210,00 €, y hay que emitir factura del anticipo.

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 555 Partidas pendientes de aplicación | 1.210,00 | |
| 438 Anticipos de clientes | | 1.000,00 |
| 477 Hacienda Pública, IVA repercutido | | 210,00 |
| **Total** | **1.210,00** | **1.210,00** |

**Cobro parcial o por varias facturas.** Se aplica a cada factura su importe. Si sobra una parte que no corresponde a nada, se queda en la 555 solo esa parte y se sigue investigando; no se compensa con otros saldos de clientes (principio de no compensación).

**Cuándo no se identifica nunca.** Si tras reclamarlo no aparece el dueño del dinero, hay que decidir qué es con criterio y documentarlo: devolverlo al ordenante si se conoce, o reconocerlo como ingreso si se concluye que la empresa no lo debe. Esa decisión la toma el contable con el cliente; no se deja indefinidamente en el pasivo.

## Fiscalidad relacionada

- **IVA.** Mientras el cobro está en la 555 no hay IVA, salvo que en realidad sea un anticipo. Si se descubre en un trimestre posterior que era un anticipo, el IVA corresponde al periodo del cobro y puede obligar a una autoliquidación complementaria.
- **Impuesto sobre Sociedades.** Un saldo antiguo en el pasivo sin soporte puede parecer una deuda que no existe. La Ley 27/2014 presume que hay rentas no declaradas "cuando hayan sido registradas en los libros de contabilidad del contribuyente deudas inexistentes" (art. 121.4). Una 555 llena de partidas de años anteriores es un riesgo real en una comprobación.

## Errores frecuentes

- Usar la 555 como "cajón de sastre" para todo lo que no cuadra, cobros y pagos mezclados.
- Dejar partidas de ejercicios anteriores: si en un año no se ha averiguado qué son, ya no son "pendientes de aplicación".
- Aplicar el cobro a la factura más antigua del cliente sin confirmarlo, cuando podía ser un anticipo o el pago de otra empresa.
- Presentar la 555 en el activo del balance porque tiene saldo deudor.
- Saldar la 555 contra la 430 en bloque al cierre sin saber de qué cliente es cada partida.

## Qué revisar en la contabilidad

- Saldo de la 555 a fin de mes y antigüedad de cada partida: ninguna debería pasar de un mes o dos.
- Saldo **deudor** en la 555: indica que se ha usado para pagos, y eso no lo prevé el PGC.
- Al cierre, la 555 debería estar a cero; si no, cada partida que quede debe tener una explicación escrita.
- Clientes con facturas vencidas por importes iguales a partidas abiertas en la 555: probablemente son el mismo cobro.
- Partidas que se aplicaron a la 438 sin IVA repercutido.

## Fuentes

- PGC (RD 1514/2007) y PGC PYMES (RD 1515/2007), quinta parte, grupo 5: cuenta 555. Grupo 4: cuentas 430 y 438.
- PGC, marco conceptual, 3.º Principios contables: devengo y no compensación.
- Ley 37/1992 del IVA, art. 75.Dos.
- Ley 27/2014 del Impuesto sobre Sociedades, art. 121.4.
