---
id: 31113
modelo: normal
numero: 13
titulo: "Ingresos y gastos"
obligatorio: true
cuadros: [desglose_perdidas_y_ganancias, desglose_balance]
datos:
  - clave: desagregacion_ingresos
    descripcion: "Ingresos ordinarios desagregados por tipo de bien o servicio, región, mercado, tipo o duración de contrato, calendario de transferencia o canal de venta"
    tipo: contabilidad
    formato: tabla
  - clave: saldos_contrato
    descripcion: "Saldos de apertura y cierre de cuentas a cobrar, activos y pasivos del contrato con clientes, si no están separados en el balance"
    tipo: contabilidad
    formato: tabla
  - clave: obligaciones_cliente
    descripcion: "Obligaciones frente al cliente: cuándo se cumplen, términos de pago, naturaleza de lo comprometido (actuación como agente), devoluciones y garantías"
    tipo: manual
    formato: texto
  - clave: juicios_significativos
    descripcion: "Juicios sobre el calendario de cumplimiento (métodos de grado de avance, momento de transferencia del control) y sobre el precio y su asignación"
    tipo: manual
    formato: texto
  - clave: costes_contrato
    descripcion: "Activos por costes para obtener o cumplir contratos: juicios, método de imputación, saldos de cierre, amortización y deterioro"
    tipo: manual
    formato: tabla
  - clave: desglose_aprovisionamientos
    descripcion: "Consumo de mercaderías y de materias primas: compras y variación de existencias, separando compras nacionales, intracomunitarias e importaciones"
    tipo: contabilidad
    formato: tabla
  - clave: desglose_cargas_sociales
    descripcion: "Cargas sociales: aportaciones y dotaciones para pensiones y otras cargas sociales"
    tipo: contabilidad
    formato: tabla
  - clave: otros_resultados
    descripcion: "Resultados excepcionales incluidos en la partida «Otros resultados»"
    tipo: contabilidad
    formato: tabla
fuentes: [BOE-A-2007-19884/A13-3]
---
# Ingresos y gastos (modelo normal)

Desde 2021 esta nota tiene dos partes muy distintas: una larga sobre **ingresos de contratos con clientes** (13.1 a 13.4) y otra corta y mecánica sobre **determinados gastos** (13.5 y 13.6).

## Qué contar y en qué orden

1. **Desagregación de la cifra de negocios** en categorías que expliquen cómo se comportan los ingresos: por línea de producto o servicio, por zona geográfica, por tipo de cliente (público o privado), por canal... Elegir las que use la propia dirección para seguir el negocio. Las cuentas y subcuentas del subgrupo 70 dan el desglose si la contabilidad lo separa (por ejemplo, 7000 ventas nacionales, 7001 ventas UE, 7002 exportación).
2. **Saldos del contrato**: clientes, facturación anticipada, anticipos de clientes (cuenta 438) al principio y al final, si no figuran ya separados en el balance.
3. **Obligaciones frente al cliente**: cuándo se entiende cumplida la venta (envío, entrega, a medida que se presta el servicio), plazos de pago, si la empresa actúa como agente o comisionista, devoluciones y garantías.
4. **Juicios significativos**: en servicios u obras que duran, cómo se mide el grado de avance y por qué es fiable; cómo se fija el precio cuando hay descuentos, rappels o contraprestación variable.
5. **Costes de obtener o cumplir contratos** activados, si los hay.
6. **Aprovisionamientos** (13.5.a): para mercaderías (cuentas 600 y 610) y para materias primas y otras (601, 602, 611, 612), compras y variación de existencias, y las compras separadas en **nacionales, intracomunitarias e importaciones**.
7. **Cargas sociales** (13.5.b): seguridad social a cargo de la empresa (cuenta 642), aportaciones a pensiones (643) y otras (649).
8. **Otros resultados** (13.6): detalle de lo excepcional (multas, siniestros, indemnizaciones extraordinarias).

## Cuándo se dice "no aplica"

La nota siempre existe. Los puntos 4 y 5 se reducen a una frase en empresas de venta simple (comercio que cobra al entregar). El 8 solo si hay importe en "Otros resultados".

## Errores frecuentes

- Desagregar por categorías que no explican nada (por meses, por cliente sin agrupar).
- No separar compras nacionales, intracomunitarias e importaciones: si las subcuentas no lo hacen, sacarlo de los libros registro de IVA (modelos 303 y 349).
- Mezclar en cargas sociales la Seguridad Social a cargo del trabajador, que es retención y no gasto.
- Meter en "Otros resultados" partidas que son de la actividad normal.

## Datos difíciles de conseguir

- **Desagregación geográfica o por línea** si las ventas están en una sola cuenta 700: listado del programa de facturación.
- **Compras por origen**: libro registro de facturas recibidas o modelo 349.
- **Juicios sobre ingresos** en contratos largos: solo la dirección; en la GD pueden estar los contratos con clientes que lo justifican.
