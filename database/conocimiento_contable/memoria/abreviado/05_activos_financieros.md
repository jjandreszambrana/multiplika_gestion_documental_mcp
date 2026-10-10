---
id: 31205
modelo: abreviado
numero: 5
titulo: "Activos financieros"
obligatorio: false
cuadros: [desglose_balance, desglose_perdidas_y_ganancias]
datos:
  - clave: movimiento_activos_no_corrientes
    descripcion: "Movimiento del ejercicio de cada clase de activos financieros no corrientes"
    tipo: contabilidad
    formato: tabla
  - clave: movimiento_correcciones_credito
    descripcion: "Movimiento de las cuentas correctoras por riesgo de crédito"
    tipo: contabilidad
    formato: tabla
  - clave: valor_razonable_metodo
    descripcion: "Si el valor razonable se basa en precios cotizados o en modelos de valoración, y supuestos principales de estos"
    tipo: manual
    formato: texto
  - clave: valor_razonable_variaciones
    descripcion: "Por categoría: valor razonable y variaciones registradas en pérdidas y ganancias y directamente en patrimonio neto"
    tipo: contabilidad
    formato: tabla
  - clave: derivados
    descripcion: "Naturaleza de los derivados y condiciones que afectan al importe, calendario y certeza de los flujos futuros"
    tipo: gd
    formato: texto
  - clave: movimiento_patrimonio_valor_razonable
    descripcion: "Cuadro de movimientos del patrimonio neto por cambios de valor razonable de instrumentos financieros"
    tipo: contabilidad
    formato: tabla
  - clave: deterioro_participaciones_grupo
    descripcion: "Correcciones por deterioro de participaciones en grupo, multigrupo y asociadas, del ejercicio y acumuladas, y las cargadas o abonadas contra patrimonio neto"
    tipo: contabilidad
    formato: tabla
fuentes: [BOE-A-2007-19884/contenidodelamemoriaabreviada, BOE-A-2010-10544/a260]
---
# Activos financieros (modelo abreviado)

Informa de los activos financieros (inversiones en otras empresas, préstamos concedidos, fianzas, depósitos, clientes) con especial atención a los **no corrientes**, al deterioro por riesgo de crédito y a lo valorado a valor razonable.

## Qué contar y en qué orden

1. **Movimiento de los activos financieros no corrientes** por clase (participaciones en empresas del grupo y asociadas, otros instrumentos de patrimonio, créditos a terceros, valores de deuda, fianzas y depósitos constituidos a largo plazo): saldo inicial, altas, bajas, traspasos al corto plazo y saldo final. Del SIF, a partir de los subgrupos 24, 25 y 26.
2. **Movimiento de las correcciones por riesgo de crédito**: deterioro de créditos y de clientes (cuentas 490, 493, 295, 298, 594...), con dotaciones (694, 696, 698) y reversiones (794, 796, 798). El modelo pide esto para cada clase de activos financieros no corrientes; en la práctica es útil también para clientes.
3. **Activos a valor razonable**, solo si los hay (acciones cotizadas, fondos de inversión, derivados):
   - si el valor sale de precios cotizados o de un modelo de valoración, y sus supuestos;
   - por categoría, el valor razonable y las variaciones llevadas a resultados y a patrimonio neto;
   - para los derivados, su naturaleza y condiciones importantes;
   - cuadro de movimientos del patrimonio neto por cambios de valor razonable (subgrupo 13, cuenta 133).
4. **Empresas del grupo, multigrupo y asociadas**: deterioro de cada participación, del ejercicio y acumulado, y el registrado contra patrimonio neto si lo hubo.

Además, la indicación segunda del art. 260 de la Ley de Sociedades de Capital pide denominación, domicilio, forma jurídica, porcentaje de capital y de voto y patrimonio neto de las sociedades en que se participa en un 20 % o más. El art. 261 no la incluye entre las obligatorias para la memoria abreviada, pero es buena práctica darla cuando hay participadas significativas.

## Cuándo se dice "no aplica"

Si la empresa no tiene activos financieros no corrientes, ni deterioros por riesgo de crédito, ni nada a valor razonable, la nota se omite o se reduce a una frase. Por eso no es obligatoria. Muchas pymes solo tienen fianzas de alquiler, que pueden mencionarse brevemente.

## Errores frecuentes

- Meter aquí la tesorería o los saldos con Hacienda, que no se tratan en esta nota.
- No reclasificar al corto plazo la parte de un crédito que vence en los doce meses siguientes.
- Valorar a coste unas acciones cotizadas que la empresa mantiene para negociar (deben ir a valor razonable).
- No informar del deterioro de una participada con pérdidas continuadas.

## Datos difíciles de conseguir

- **Cuentas de las participadas** (patrimonio neto, resultado) para el test de deterioro: pueden no estar formuladas a tiempo.
- **Valor razonable** de instrumentos no cotizados: informe de valoración, si existe.
- **Contratos de derivados** (coberturas de tipo de interés ligadas a préstamos): en la GD, junto al préstamo.
