---
id: 31110
modelo: normal
numero: 10
titulo: "Existencias"
obligatorio: false
cuadros: [desglose_balance, desglose_perdidas_y_ganancias]
datos:
  - clave: deterioro_existencias
    descripcion: "Correcciones por deterioro de existencias y reversiones del ejercicio: importe y circunstancias que las motivan"
    tipo: contabilidad
    formato: tabla
  - clave: gastos_financieros_capitalizados
    descripcion: "Gastos financieros capitalizados en existencias de ciclo de producción superior a un año y criterio"
    tipo: contabilidad
    formato: numero
  - clave: compromisos_futuros_opciones
    descripcion: "Compromisos firmes de compra y venta y contratos de futuros u opciones sobre existencias"
    tipo: manual
    formato: texto
  - clave: limitaciones_disponibilidad
    descripcion: "Limitaciones a la disponibilidad por garantías, pignoraciones o fianzas: partidas afectadas, importe y duración"
    tipo: gd
    formato: texto
  - clave: otras_circunstancias
    descripcion: "Otras circunstancias sobre titularidad, disponibilidad o valoración: litigios, seguros, embargos"
    tipo: gd
    formato: texto
fuentes: [BOE-A-2007-19884/A10-3]
---
# Existencias (modelo normal)

Nota corta. No pide un cuadro de movimientos: lo que interesa es **por qué se han deteriorado** las existencias, si están **comprometidas** o **bloqueadas** y cualquier problema que afecte a su valor o a quién es su dueño.

## Qué contar y en qué orden

1. **Composición** (opcional pero útil): saldos por tipo (mercaderías, materias primas, productos en curso, productos terminados, anticipos a proveedores), del subgrupo 30 al 36 y la cuenta 407. Sale de `desglose_balance`.
2. **Deterioro**: importe dotado (cuenta 693) y revertido (cuenta 793) en el ejercicio y su causa (obsolescencia, caducidad, caída del precio de venta por debajo del coste). La cifra la da la contabilidad; la causa la explica el contable.
3. **Gastos financieros activados**, solo en existencias que tardan más de un año en estar listas para la venta (promociones inmobiliarias, vinos de crianza, obra larga).
4. **Compromisos firmes** de compra y de venta y **contratos de futuros u opciones** sobre existencias (habituales en materias primas cotizadas: cereales, metales, combustibles).
5. **Limitaciones**: existencias dadas en prenda o garantía, depositadas en almacén de un tercero como fianza, etc., con su importe y hasta cuándo.
6. **Otras circunstancias**: litigios sobre la mercancía, embargos, si los seguros cubren el valor de las existencias.

## Cuándo se dice "no aplica"

Una empresa de servicios sin existencias no incluye la nota (por eso no es obligatoria). Si hay existencias pero no hay deterioros, compromisos ni limitaciones, basta una frase que lo diga, porque el lector espera ver que se ha revisado.

## Errores frecuentes

- Confundir el deterioro (provisión reversible, cuenta 393) con una pérdida definitiva por mercancía destruida o robada, que se registra como menor existencia final y no se explica aquí como deterioro.
- No explicar un deterioro que aparece en la cuenta de pérdidas y ganancias.
- Informar como compromiso firme un pedido que el cliente puede cancelar sin coste.
- Olvidar la mercancía en depósito en casa de clientes o en consigna: sigue siendo de la empresa y debe estar en el inventario.

## Datos difíciles de conseguir

- **Causa de los deterioros**: solo la conoce la empresa (informe de almacén, inventario físico con productos caducados).
- **Compromisos firmes**: contratos de suministro y pedidos en firme; pueden estar en la GD si se archivan los contratos de compra y venta.
- **Pignoraciones y garantías**: pólizas de crédito con garantía de mercancía, en la GD.
- **Cobertura de seguros**: la póliza multirriesgo en la GD; comprobar que el capital asegurado de existencias es razonable frente al saldo del balance.
