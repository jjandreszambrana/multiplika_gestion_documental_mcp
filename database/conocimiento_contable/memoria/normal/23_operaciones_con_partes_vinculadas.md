---
id: 31123
modelo: normal
numero: 23
titulo: "Operaciones con partes vinculadas"
obligatorio: true
cuadros: [desglose_balance, desglose_perdidas_y_ganancias]
datos:
  - clave: identificacion_partes
    descripcion: "Partes vinculadas con las que se ha operado, por categoría (dominante, otras del grupo, negocios conjuntos, asociadas, con control conjunto o influencia, personal clave, otras) y naturaleza de la relación"
    tipo: gd
    formato: tabla
  - clave: detalle_operaciones
    descripcion: "Operaciones por tipo (compras y ventas, servicios, arrendamientos, financiación, intereses, dividendos, garantías, remuneraciones...) y su importe, con la política de precios"
    tipo: contabilidad
    formato: tabla
  - clave: beneficio_funciones_riesgos
    descripcion: "Beneficio o pérdida de cada operación y funciones y riesgos asumidos por cada parte"
    tipo: manual
    formato: texto
  - clave: saldos_pendientes
    descripcion: "Saldos pendientes activos y pasivos por tipo de instrumento, plazos, condiciones y garantías otorgadas o recibidas"
    tipo: contabilidad
    formato: tabla
  - clave: dudoso_cobro_vinculadas
    descripcion: "Correcciones por dudoso cobro de saldos con vinculadas y gastos por incobrables del ejercicio"
    tipo: contabilidad
    formato: tabla
  - clave: retribucion_administradores_alta_direccion
    descripcion: "Sueldos, dietas y remuneraciones de cualquier clase de los administradores y de la alta dirección, pensiones, seguros de vida, indemnizaciones por cese y pagos con acciones"
    tipo: manual
    formato: tabla
  - clave: prima_seguro_rc
    descripcion: "Prima del seguro de responsabilidad civil de administradores pagada por la empresa"
    tipo: gd
    formato: numero
  - clave: anticipos_creditos_administradores
    descripcion: "Anticipos y créditos a administradores y alta dirección: tipo de interés, características, importes devueltos y garantías asumidas por su cuenta"
    tipo: contabilidad
    formato: tabla
  - clave: conflictos_interes
    descripcion: "Situaciones de conflicto de interés de los administradores o personas vinculadas (art. 229 LSC)"
    tipo: manual
    formato: texto
  - clave: estructura_financiera_grupo
    descripcion: "Estructura financiera del grupo, si la empresa pertenece a uno"
    tipo: manual
    formato: texto
fuentes: [BOE-A-2007-19884/A23-2, BOE-A-2010-10544/a229]
---
# Operaciones con partes vinculadas (modelo normal)

Explica las operaciones con quienes tienen capacidad de influir en la empresa o están bajo su influencia: sociedades del grupo, socios significativos, administradores, directivos y sus familiares. Es una de las notas que más miran el auditor y la Inspección.

## Qué contar y en qué orden

1. **Partes vinculadas por categoría**, en el orden del modelo: entidad dominante, otras empresas del grupo, negocios conjuntos, asociadas, empresas con control conjunto o influencia significativa, personal clave de la dirección, otras partes vinculadas.
2. **Operaciones del ejercicio**, para cada categoría: tipo (compras, ventas, servicios, alquileres, préstamos, intereses, dividendos, garantías, remuneraciones, condonaciones...), importe, **política de precios** comparada con la que se aplica a terceros, beneficio o pérdida y funciones y riesgos de cada parte.
3. **Saldos pendientes** al cierre (cuentas 160 a 163, 240 a 243, 403, 433, 551, 552...) con plazos, condiciones y garantías, y deterioros por dudoso cobro.
4. **Administradores y alta dirección**, aunque no haya ninguna otra operación vinculada: sueldos, dietas y remuneraciones de cualquier clase, pensiones, seguros de vida, indemnizaciones por cese, pagos con acciones, prima del seguro de responsabilidad civil, anticipos y créditos. Se puede dar de forma global por concepto, separando administradores de alta dirección. Si el administrador es persona jurídica, también lo que corresponde a su representante persona física.
5. **Conflictos de interés** de los administradores (art. 229 LSC), aunque sea para decir que no ha habido ninguno.
6. **Estructura financiera del grupo**, si la empresa pertenece a uno.

## Cuándo se dice "no aplica"

La nota siempre existe, porque los puntos 4 y 5 se exigen **en todo caso**. Si los administradores no cobran nada, se dice: "Los miembros del órgano de administración no han percibido remuneración alguna durante el ejercicio". Las operaciones del tráfico ordinario, en condiciones de mercado y de escasa importancia, se pueden omitir.

## Errores frecuentes

- Omitir el sueldo de un administrador que además es trabajador (contrato laboral o de alta dirección): también es remuneración.
- No identificar como vinculadas las sociedades de los socios o de sus familiares.
- Presentar los saldos con socios (préstamos de socios, cuenta 551) solo en el balance y no aquí.
- Dejar en blanco la política de precios.

## Datos difíciles de conseguir

- **Lista de partes vinculadas**: la empresa debe darla (socios, familiares, sociedades participadas por ellos). El libro registro de socios y los poderes en la GD ayudan.
- **Remuneraciones** de administradores y directivos: nóminas, acuerdos de junta sobre la retribución y estatutos (si el cargo es retribuido) en la GD.
- **Conflictos de interés**: solo los administradores pueden declararlos.
