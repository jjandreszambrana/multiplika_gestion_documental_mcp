---
id: 31117
modelo: normal
numero: 17
titulo: "Transacciones con pagos basados en instrumentos de patrimonio"
obligatorio: false
cuadros: [desglose_balance, desglose_perdidas_y_ganancias]
datos:
  - clave: descripcion_acuerdos
    descripcion: "Descripción de cada acuerdo de pagos basados en instrumentos de patrimonio vigente en el ejercicio y sus beneficiarios"
    tipo: gd
    formato: texto
  - clave: pasivos_reconocidos
    descripcion: "Si se liquidan en efectivo: información de la provisión como en la nota 14"
    tipo: contabilidad
    formato: tabla
  - clave: movimiento_opciones
    descripcion: "Opciones sobre acciones: número y precio medio ponderado de ejercicio al inicio y al final, concedidas, anuladas, ejercitadas, caducadas y ejercitables"
    tipo: gd
    formato: tabla
  - clave: precio_ejercicio_vida
    descripcion: "Precio medio de las acciones en la fecha de ejercicio, rango de precios de ejercicio y vida media pendiente de las opciones vivas"
    tipo: gd
    formato: tabla
  - clave: determinacion_valor_razonable
    descripcion: "Cómo se ha determinado el valor razonable de lo recibido o de los instrumentos concedidos"
    tipo: manual
    formato: texto
  - clave: efecto_cuentas
    descripcion: "Efecto en la situación financiera y en el resultado de la empresa"
    tipo: contabilidad
    formato: tabla
  - clave: valor_no_fiable
    descripcion: "Si no se puede estimar con fiabilidad el valor razonable de lo recibido: hecho y motivos"
    tipo: manual
    formato: texto
fuentes: [BOE-A-2007-19884/A17-2, BOE-A-2007-19884/A14-3]
---
# Transacciones con pagos basados en instrumentos de patrimonio (modelo normal)

Se aplica cuando la empresa **paga con sus propias acciones o participaciones**, o con dinero calculado según su valor, a cambio de bienes o servicios. El caso típico son los planes de opciones sobre acciones o de acciones gratuitas para directivos y trabajadores, y los "phantom shares" (bonus según el valor de la acción, pagado en efectivo).

## Qué contar y en qué orden

1. **Descripción de cada plan** vigente durante el ejercicio: a quién va dirigido, qué se entrega, condiciones para consolidar el derecho (permanencia, objetivos), plazos. Si hay varios planes parecidos, se pueden agrupar siempre que se entienda su alcance.
2. **Forma de liquidación**:
   - con instrumentos de patrimonio: el gasto tiene contrapartida en patrimonio neto (cuenta 108 o una cuenta del subgrupo 11);
   - en efectivo: hay un pasivo, y se da la información de provisiones de la nota 14 (movimiento, naturaleza, cálculo).
3. **Opciones sobre acciones**, si las hay: cuadro con número y precio medio de ejercicio al inicio, concedidas, anuladas, ejercitadas, caducadas, al final y ejercitables; precio medio de la acción cuando se ejercitaron; rango de precios y vida media pendiente de las vivas.
4. **Valor razonable**: cómo se ha medido (modelo de valoración de opciones, valor de transacciones recientes, tasación).
5. **Efecto en las cuentas**: gasto de personal del ejercicio por estos planes y saldo en balance.
6. Si el valor razonable de lo recibido no se puede medir con fiabilidad, decirlo y explicar por qué.

## Cuándo se dice "no aplica"

En la gran mayoría de pymes no existe ningún plan de este tipo y la nota se omite. Preguntarlo solo si hay indicios: socios trabajadores que han recibido participaciones, contratos de alta dirección con cláusulas de "equity", startups con planes de incentivos.

## Errores frecuentes

- No reconocer gasto en un plan liquidado con acciones porque "no ha salido dinero".
- Tratar como plan de acciones una simple compraventa de participaciones entre socios a precio de mercado.
- Reconocer todo el gasto el año de concesión en lugar de repartirlo durante el periodo en que se presta el servicio.
- Olvidar que estos pagos a administradores o alta dirección también deben aparecer en la nota 23.

## Datos difíciles de conseguir

- **Reglamento del plan** y acuerdos de concesión: actas de junta y del órgano de administración en la GD.
- **Valoración** de las acciones o de las opciones: informe de un experto independiente, si existe.
- **Situación de cada beneficiario** (quién ha salido, quién ha ejercitado): solo la empresa.
