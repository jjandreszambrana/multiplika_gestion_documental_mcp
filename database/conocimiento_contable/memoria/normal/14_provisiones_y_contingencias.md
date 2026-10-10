---
id: 31114
modelo: normal
numero: 14
titulo: "Provisiones y contingencias"
obligatorio: false
cuadros: [desglose_balance, desglose_perdidas_y_ganancias]
datos:
  - clave: movimiento_provisiones
    descripcion: "Movimiento de cada provisión del balance: saldo inicial, dotaciones, aplicaciones, otros ajustes y saldo final (sin comparativo)"
    tipo: contabilidad
    formato: tabla
  - clave: actualizacion_financiera
    descripcion: "Aumento por el paso del tiempo de las provisiones actualizadas y efecto de cambios en el tipo de descuento"
    tipo: contabilidad
    formato: numero
  - clave: naturaleza_obligacion
    descripcion: "Naturaleza de la obligación de cada provisión"
    tipo: gd
    formato: texto
  - clave: estimacion_calculo
    descripcion: "Estimaciones y procedimientos de cálculo, incertidumbres y ajustes realizados"
    tipo: manual
    formato: texto
  - clave: derechos_reembolso
    descripcion: "Derechos de reembolso (por ejemplo, seguros) y lo reconocido en el activo"
    tipo: gd
    formato: numero
  - clave: contingencias
    descripcion: "Por cada contingencia no remota: naturaleza, evolución previsible, estimación de efectos con riesgos máximo y mínimo, reembolsos y motivo si no se pudo registrar"
    tipo: gd
    formato: texto
  - clave: activos_contingentes
    descripcion: "Activos contingentes con entrada probable de beneficios: naturaleza, evolución y criterios de estimación"
    tipo: manual
    formato: texto
  - clave: omision_por_litigio
    descripcion: "Si la información perjudica seriamente la posición en un litigio: naturaleza del litigio, omisión y razones"
    tipo: manual
    formato: texto
fuentes: [BOE-A-2007-19884/A14-3]
---
# Provisiones y contingencias (modelo normal)

Separa dos cosas que se confunden a menudo:

- **Provisión**: obligación probable con importe estimable. Está en el balance (subgrupo 14 a largo plazo, cuenta 529 a corto).
- **Contingencia**: obligación posible pero no probable, o probable pero no estimable. No está en el balance; solo se cuenta aquí, salvo que sea remota.

## Qué contar y en qué orden

1. **Una ficha por provisión** del balance (litigios, garantías a clientes, desmantelamiento, reestructuración, retribuciones al personal...):
   - movimiento: saldo inicial, dotaciones, aplicaciones, otros ajustes, saldo final. **Sin cifras comparativas**, lo dice el propio modelo. Las cifras salen de `desglose_balance` y de las cuentas de dotación y exceso (por ejemplo, 7951 a 7955);
   - si está actualizada a valor presente, el aumento por el paso del tiempo (cuenta 660) y el efecto del cambio de tipo de descuento;
   - qué obligación cubre, cómo se ha calculado, qué incertidumbres tiene;
   - derechos de reembolso, típicamente un seguro que cubrirá parte.
2. **Contingencias** no remotas: naturaleza, evolución previsible, estimación de efectos (con un rango si no hay cifra única) y reembolsos. Si es una provisión que no se pudo registrar por no ser medible, decirlo y explicar por qué.
3. **Activos contingentes** (cobros probables pero no seguros, como una demanda ganada en primera instancia): naturaleza y estimación.
4. **Excepción de litigio**: si dar los datos perjudicara seriamente la posición de la empresa en un pleito, se puede omitir la información, pero describiendo el litigio y diciendo que se omite y por qué.

## Cuándo se dice "no aplica"

Si no hay provisiones en el balance ni contingencias no remotas, la nota se omite o se dice en una frase. Por eso no es obligatoria. Antes de escribir "no existen", conviene preguntar expresamente por litigios, reclamaciones, inspecciones y avales.

## Errores frecuentes

- Usar la provisión como "colchón" sin obligación concreta detrás. Si no hay obligación actual, no hay provisión.
- Informar como contingencia lo que es probable y medible: debió provisionarse.
- Mezclar aquí el deterioro de clientes o de existencias, que no son provisiones de pasivo aunque se llamen así coloquialmente.
- Incluir cifras comparativas en el cuadro de movimientos, que el modelo no exige.

## Datos difíciles de conseguir

- **Litigios y reclamaciones**: demandas, burofaxes y cartas de abogados en la GD; si no están, preguntar. La carta de los abogados al cierre (habitual en auditoría) es la mejor fuente.
- **Estimación del importe** y su rango: solo los asesores jurídicos o la dirección.
- **Garantías dadas a clientes** y su histórico de reclamaciones: datos internos de la empresa.
