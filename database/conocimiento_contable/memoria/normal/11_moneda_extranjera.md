---
id: 31111
modelo: normal
numero: 11
titulo: "Moneda extranjera"
obligatorio: false
cuadros: [desglose_balance, desglose_perdidas_y_ganancias]
datos:
  - clave: elementos_moneda_extranjera
    descripcion: "Importe global de activos y pasivos en moneda extranjera, con desglose por moneda de los más significativos"
    tipo: contabilidad
    formato: tabla
  - clave: transacciones_moneda_extranjera
    descripcion: "Compras, ventas y servicios recibidos y prestados en moneda extranjera"
    tipo: manual
    formato: tabla
  - clave: diferencias_cambio_resultado
    descripcion: "Diferencias de cambio en resultados por clase de instrumento, separando las de operaciones liquidadas y las vivas al cierre"
    tipo: contabilidad
    formato: tabla
  - clave: diferencias_conversion
    descripcion: "Diferencias de conversión en patrimonio neto y conciliación de su saldo inicial y final"
    tipo: contabilidad
    formato: tabla
  - clave: cambio_moneda_funcional
    descripcion: "Cambio de moneda funcional de la empresa o de un negocio en el extranjero y su razón"
    tipo: manual
    formato: texto
  - clave: varias_monedas_funcionales
    descripcion: "Si hay más de una moneda funcional: activos, cifra de negocios y resultados expresados en cada una"
    tipo: manual
    formato: tabla
  - clave: negocio_extranjero
    descripcion: "Moneda funcional de cada negocio en el extranjero e inversión neta en él, si difiere de la moneda de presentación"
    tipo: manual
    formato: tabla
  - clave: hiperinflacion
    descripcion: "Negocios en países con alta inflación: ajuste aplicado, índice de precios al cierre y su evolución"
    tipo: manual
    formato: texto
fuentes: [BOE-A-2007-19884/A11-3]
---
# Moneda extranjera (modelo normal)

Solo procede si la empresa tiene **saldos u operaciones en divisas** distintas del euro (clientes o proveedores en dólares, cuentas bancarias en libras, préstamos en francos suizos) o negocios en el extranjero con otra moneda.

## Qué contar y en qué orden

1. **Saldos en moneda extranjera al cierre**: total de activos y de pasivos en divisa y desglose de los más importantes por moneda (por ejemplo, clientes en USD, proveedores en CNY). La contabilidad lo da si las cuentas o subcuentas en divisa están separadas; si no, es manual.
2. **Volumen de transacciones** del ejercicio en divisa: compras, ventas y servicios recibidos y prestados. Suele requerir un listado de facturas en divisa.
3. **Diferencias de cambio en resultados** (cuentas 668 y 768), por clase de instrumento financiero, separando las de operaciones **ya liquidadas** de las de saldos **vivos al cierre**. Esta separación rara vez está en la contabilidad: lo habitual es que haya que pedirla, o usar subcuentas distintas para diferencias realizadas y no realizadas.
4. **Diferencias de conversión** en patrimonio neto (cuenta 135), con su conciliación, solo si hay negocios en el extranjero con moneda funcional distinta del euro.
5. Los casos especiales: cambio de moneda funcional, más de una moneda funcional, negocios en el extranjero y economías hiperinflacionarias.

Para una pyme española que solo importa o exporta, la nota se reduce a los puntos 1 a 3.

## Cuándo se dice "no aplica"

Si todas las operaciones son en euros, la nota no se incluye. Una factura aislada en divisa cobrada en el mismo ejercicio con una diferencia de cambio insignificante tampoco justifica la nota (norma 10.ª: lo no significativo no se rellena).

## Errores frecuentes

- Valorar al cierre los saldos en divisa al tipo histórico. Las partidas monetarias (clientes, proveedores, bancos, préstamos) se valoran al tipo de cambio de cierre; las no monetarias (inmovilizado, existencias), no.
- Compensar diferencias positivas y negativas y presentar solo el neto.
- Olvidar las cuentas bancarias en divisa, que también son partida monetaria.
- Usar como "tipo de cierre" un tipo distinto del publicado por el BCE para esa fecha sin explicarlo.

## Datos difíciles de conseguir

- **Saldos por moneda**: si el SIF no lleva la divisa original del apunte, hay que pedir a la empresa el detalle (facturas pendientes en divisa al cierre).
- **Diferencias realizadas frente a no realizadas**: casi siempre manual.
- **Volumen de compras y ventas en divisa**: listado del programa de facturación o del ERP.
