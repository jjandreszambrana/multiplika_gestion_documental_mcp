# Conciliación bancaria

Plan del 2026-10-27. Nada implementado.

## Qué es

Comparar los movimientos de un extracto del banco con las facturas emitidas y recibidas que ya están asentadas en la contabilidad (SIF), y dejar el resultado en una tabla para que el contable decida.

## Decisiones

- El extracto lo sube el usuario a mano (Norma 43, Excel o PDF con la extracción que ya existe). Leerlo directo del banco queda para más adelante.
- La GD **no escribe en el SIF**. Solo lee y deja una tabla de resultados. El contable decide qué hacer con cada línea.
- La IA propone, nunca aplica.

## Datos

`gd_conciliaciones` (un extracto subido): `id`, `id_obligado_sif`, `cuenta_banco`, `fecha_desde`, `fecha_hasta`, `saldo_inicial`, `saldo_final`, `id_documento` (el archivo), `estado`, `creado_por`, `fecha_alta`.

`gd_conciliacion_movimientos` (una línea del extracto): `id`, `id_conciliacion`, `fecha`, `importe`, `concepto`, `estado` (`exacto` / `dudoso` / `sin_emparejar` / `confirmado` / `descartado`), `propuesta` (JSON con las facturas candidatas, el motivo y la confianza), `decision` (JSON con lo que decidió el contable), `nota`, `revisado_por`, `fecha_revision`.

Sin claves foráneas, ids autonumericos (igual que el resto de tablas de la GD).

## Cómo empareja

1. Traer del SIF las facturas asentadas con cobro o pago pendiente (emitidas y recibidas) de la empresa y el periodo.
2. Exacto: mismo importe, fecha cercana y cliente/proveedor o número de factura dentro del concepto.
3. Dudoso: un pago que cubre varias facturas, pago parcial, importe parecido, concepto ambiguo. La IA propone y explica por qué.
4. Sin emparejar: comisiones, intereses, impuestos, nóminas, etc. Se sugiere el tipo de apunte, sin crearlo.

El emparejado exacto lo hace el código (determinista); la IA solo entra en los dudosos.

## Pantalla

Tabla con una fila por movimiento: fecha, importe, concepto, propuesta, confianza y estado. Filtros por estado. Por fila: confirmar, cambiar de factura, descartar, añadir nota. Arriba, resumen: movimientos conciliados, pendientes y diferencia con el saldo del banco. Exportar a Excel.

## Fases

1. Tablas + subida y lectura del extracto (Norma 43 y Excel primero).
2. Emparejado exacto en código + pantalla de la tabla.
3. Propuestas dudosas con IA + tools MCP (`conciliar_extracto_gd`, `listar_movimientos_conciliacion_gd`, `confirmar_movimiento_gd`).
4. Aplicar en el SIF (anotar cobro/pago) con la clave del contable, solo tras confirmar. Depende de que el SIF lo permita y se pueda deshacer.
5. Lectura directa del banco.

## Aclarado el 2026-10-27

- Formato de extracto: **Norma 43**. Es el primer (y de momento único) lector.
- Deshacer un cobro/pago anotado en el SIF: sí hace falta, y en cobros ya existe.
- Las facturas recibidas pendientes de pago **no existen en el SIF**: falta la gestión de pagos, que se plantea igual que la de cobros (`/ventas/gestion_cobros`). Pedido al SIF en [5.35] del canal (`multiplika_compartida/contabilidad/prompts/5_intercambio.md`), junto con tres datos para conciliar: fecha valor, cuenta bancaria y referencia externa en cobros y pagos.

## Orden de trabajo

Fases 1-3 solo leen del SIF, así que empiezan ya: con las emitidas (cobros) completo y con las recibidas en cuanto el SIF responda a [5.35]. La fase 4 (anotar en el SIF) espera a esa respuesta.
