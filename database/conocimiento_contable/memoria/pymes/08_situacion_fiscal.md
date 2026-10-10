---
id: 31308
modelo: pymes
numero: 8
titulo: "Situación fiscal"
obligatorio: true
cuadros: [desglose_perdidas_y_ganancias, desglose_balance]
datos:
  - clave: gasto_impuesto_corriente
    descripcion: "Gasto por impuesto sobre beneficios corriente del ejercicio"
    tipo: contabilidad
    formato: numero
  - clave: informacion_norma_tributaria
    descripcion: "Otra información cuya publicación exija la norma tributaria (por ejemplo, la del art. 86 de la Ley 27/2014 en operaciones de reestructuración)"
    tipo: manual
    formato: texto
  - clave: diferencia_resultado_base
    descripcion: "Opcional: conciliación breve del resultado contable con la base imponible y del gasto por impuesto"
    tipo: manual
    formato: tabla
  - clave: contingencias_ejercicios_abiertos
    descripcion: "Opcional: contingencias fiscales y ejercicios abiertos a comprobación"
    tipo: gd
    formato: texto
fuentes: [BOE-A-2007-19966/iimodelosdecuentasanuales, BOE-A-2014-12328/a86, BOE-A-2014-12328/a25, BOE-A-2014-12328/a105]
---
# Situación fiscal (modelo PYMES)

El modelo PYMES reduce esta nota al mínimo: el **gasto por impuesto corriente** y la información que exijan las propias normas tributarias. Aun así, conviene que sea útil para quien lea las cuentas.

## Qué contar y en qué orden

1. **Gasto por impuesto corriente** del ejercicio: cuenta 6300 (y 6309 si hubiera ajustes negativos), comparado con el año anterior. Si hay impuesto diferido, puede añadirse la cuenta 6301 para que se entienda el total de la partida "Impuesto sobre beneficios" de la cuenta de pérdidas y ganancias.
2. **Información exigida por la norma tributaria**. El caso más claro es el **régimen especial de reestructuración** (fusiones, escisiones, aportaciones de rama de actividad, canjes de valores): el art. 86 de la Ley del Impuesto sobre Sociedades obliga a la entidad adquirente, y a los socios personas jurídicas, a incluir en la memoria determinados datos de la operación (ejercicio en que la transmitente adquirió los bienes, último balance de la transmitente, bienes incorporados por valor distinto del que tenían, beneficios fiscales asumidos). En las memorias siguientes basta remitirse a la primera, que debe conservarse.

   Las **reservas de capitalización y de nivelación** no se exigen en la memoria sino en el balance, con absoluta separación y título apropiado (arts. 25 y 105 de la misma ley). Aun así conviene explicar aquí su dotación y su plazo de indisponibilidad.

   La IA debe preguntar si la empresa ha hecho alguna operación acogida a estos regímenes; no se deduce de la contabilidad.
3. **Información voluntaria recomendable**: una conciliación breve entre resultado contable y base imponible, las bases imponibles negativas pendientes, las deducciones pendientes y los ejercicios abiertos a inspección. No es obligatoria en este modelo, pero es lo que más pregunta el lector (banco, socio).

## Cuándo se dice "no aplica"

La nota siempre existe, aunque el impuesto corriente sea cero (por bases negativas o pérdidas): en ese caso se dice y se explica brevemente por qué.

## Errores frecuentes

- Confundir el gasto por impuesto corriente con la cuota a pagar: la cuota a pagar resta retenciones y pagos fraccionados (cuentas 473 y 4752).
- Dar el gasto total de la partida "Impuesto sobre beneficios" como si fuera todo corriente cuando incluye diferidos.
- Olvidar las menciones del art. 86 en los años siguientes a la operación: se deben mientras los bienes sigan en el inventario o duren los requisitos de los incentivos (aunque sea remitiéndose a la primera memoria). Omitirlas es infracción grave, con multa de 1.000 euros por dato y año.
- Dotar la reserva de capitalización sin presentarla separada en el balance y sin explicarla.

## Datos difíciles de conseguir

- **Modelo 200** del ejercicio (o su borrador): GD o asesor fiscal. Es la fuente de la base imponible, deducciones y bases negativas.
- **Operaciones de reestructuración** de ejercicios anteriores con obligación de información: escrituras de fusión o escisión y la memoria del año de la operación en la GD.
- **Actas o comprobaciones** de la AEAT abiertas: notificaciones en la GD.
