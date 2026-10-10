---
id: 31116
modelo: normal
numero: 16
titulo: "Retribuciones a largo plazo al personal"
obligatorio: false
cuadros: [desglose_balance, desglose_perdidas_y_ganancias]
datos:
  - clave: descripcion_planes
    descripcion: "Descripción general de cada plan de aportación definida o de prestación definida"
    tipo: gd
    formato: texto
  - clave: aportaciones_ejercicio
    descripcion: "Aportaciones del ejercicio a planes de aportación definida"
    tipo: contabilidad
    formato: numero
  - clave: movimiento_provision_prestacion
    descripcion: "Planes de prestación definida: movimiento de la provisión como en la nota 14"
    tipo: contabilidad
    formato: tabla
  - clave: conciliacion_activos_pasivos
    descripcion: "Conciliación entre activos y pasivos del plan reconocidos en el balance"
    tipo: gd
    formato: tabla
  - clave: activos_afectos
    descripcion: "Partidas que forman el valor razonable de los activos afectos al plan"
    tipo: gd
    formato: tabla
  - clave: hipotesis_actuariales
    descripcion: "Principales hipótesis actuariales al cierre (tipo de descuento, crecimiento salarial, tablas de mortalidad)"
    tipo: gd
    formato: tabla
fuentes: [BOE-A-2007-19884/A16-2, BOE-A-2007-19884/A14-3]
---
# Retribuciones a largo plazo al personal (modelo normal)

Trata los compromisos de la empresa con sus trabajadores que se pagan **después**, normalmente al jubilarse: planes de pensiones de empleo, seguros colectivos de jubilación, premios de permanencia o de jubilación que obligue el convenio.

## Qué contar y en qué orden

1. **Tipo de plan**. Hay dos clases y la información cambia mucho:
   - **Aportación definida**: la empresa paga una cantidad fija (a un plan de pensiones o a una aseguradora) y ahí termina su obligación. Basta describir el plan y dar la aportación del año (cuenta 643).
   - **Prestación definida**: la empresa garantiza una prestación (por ejemplo, una mensualidad por año trabajado al jubilarse) y asume el riesgo de que lo aportado no llegue. Exige mucha más información.
2. Para **prestación definida**, además:
   - la información de provisiones de la nota 14: movimiento (saldo inicial, dotaciones, aplicaciones, saldo final; cuenta 140), naturaleza y método de cálculo;
   - conciliación entre la obligación y los activos del plan que figuran en el balance;
   - composición del valor razonable de los activos afectos al plan (póliza de seguros, fondo);
   - hipótesis actuariales al cierre: tipo de descuento, incrementos salariales, tablas de mortalidad, edad de jubilación.

## Cuándo se dice "no aplica"

Si no hay ningún compromiso a largo plazo con el personal, la nota se omite. Antes de omitirla hay que **revisar el convenio colectivo** aplicable: muchos convenios sectoriales recogen premios de jubilación o de permanencia que son prestación definida aunque la empresa no lo haya contabilizado nunca. Si existen y no están exteriorizados ni provisionados, es una incidencia que el contable debe conocer.

## Errores frecuentes

- Contabilizar solo lo pagado cada año en un premio de jubilación del convenio, sin provisionar el compromiso acumulado.
- Llamar plan de aportación definida a uno en el que la empresa garantiza un resultado.
- Confundir estos planes con el plan de pensiones individual de un administrador, que va además en la nota 23 (retribuciones de administradores).
- No actualizar las hipótesis actuariales de un año a otro.

## Datos difíciles de conseguir

- **Estudio actuarial**: lo elabora un actuario o la aseguradora; buscarlo en la GD junto con la póliza de exteriorización.
- **Convenio colectivo** aplicable y sus cláusulas de premios: en la GD o en el boletín oficial correspondiente.
- **Certificado de la aseguradora** con las provisiones matemáticas al cierre.
