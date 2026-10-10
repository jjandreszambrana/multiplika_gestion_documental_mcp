---
id: 31305
modelo: pymes
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
    descripcion: "Por categoría: valor razonable y variaciones registradas en la cuenta de pérdidas y ganancias"
    tipo: contabilidad
    formato: tabla
  - clave: derivados
    descripcion: "Naturaleza de los derivados y condiciones que afectan al importe, calendario y certeza de los flujos futuros"
    tipo: gd
    formato: texto
  - clave: deterioro_participaciones_grupo
    descripcion: "Correcciones por deterioro de participaciones en grupo, multigrupo y asociadas, del ejercicio y acumuladas"
    tipo: contabilidad
    formato: tabla
fuentes: [BOE-A-2007-19966/iimodelosdecuentasanuales, BOE-A-2010-10544/a260]
---
# Activos financieros (modelo PYMES)

Informa de los activos financieros (participaciones en otras empresas, préstamos concedidos, fianzas y depósitos, clientes), con atención a los **no corrientes**, al deterioro por riesgo de crédito y a lo valorado a valor razonable.

## Qué contar y en qué orden

1. **Movimiento de los activos financieros no corrientes** por clase: participaciones en empresas del grupo y asociadas, otras inversiones en instrumentos de patrimonio, créditos a terceros, valores de deuda, fianzas y depósitos a largo plazo. Saldo inicial, altas, bajas, traspasos al corto plazo y saldo final. Del SIF, con los subgrupos 24, 25 y 26.
2. **Movimiento de las correcciones por riesgo de crédito**: deterioro de créditos y de clientes (cuentas 490, 295, 298...), dotaciones (694, 696, 698) y reversiones (794, 796, 798). Aunque el modelo lo liga a los activos no corrientes, en una pyme lo relevante suele ser el deterioro de clientes, y conviene informarlo.
3. **Activos a valor razonable**, solo si los hay (acciones cotizadas mantenidas para negociar, derivados):
   - si el valor sale de precios cotizados o de un modelo, y sus supuestos;
   - por categoría, el valor razonable y las variaciones llevadas a la cuenta de pérdidas y ganancias. A diferencia del modelo abreviado, no se piden los cambios llevados a patrimonio neto, porque el PGC PYMES no tiene esa categoría;
   - para los derivados, su naturaleza y condiciones importantes.
4. **Empresas del grupo, multigrupo y asociadas**: deterioro de cada participación, del ejercicio y acumulado.

La indicación segunda del art. 260 de la Ley de Sociedades de Capital (datos de las sociedades en que se participa en un 20 % o más) no figura entre las que el art. 261 exige a la memoria abreviada. Es buena práctica darla si hay participadas significativas: denominación, domicilio, forma jurídica, porcentaje de capital y voto, patrimonio neto.

## Cuándo se dice "no aplica"

Si la empresa no tiene activos financieros no corrientes, ni deterioros por riesgo de crédito, ni instrumentos a valor razonable, la nota se omite o se reduce a una frase. Las fianzas de alquiler (cuenta 260) suelen bastar para una mención breve.

## Errores frecuentes

- Incluir la tesorería o los saldos con Hacienda, que no van en esta nota.
- No pasar al corto plazo la parte de un crédito que vence en los doce meses siguientes.
- No deteriorar una participación en una sociedad con pérdidas continuadas y patrimonio neto inferior al valor en libros.
- Llevar a resultados como deterioro la pérdida definitiva de un cliente sin haber dado de baja el crédito.

## Datos difíciles de conseguir

- **Cuentas de las participadas** (patrimonio neto, resultado): pueden no estar formuladas a tiempo; pedirlas o usar estados provisionales indicándolo.
- **Valor razonable** de instrumentos no cotizados: informe de valoración, si existe.
- **Contratos de derivados**, normalmente ligados a un préstamo: en la GD junto al préstamo.
