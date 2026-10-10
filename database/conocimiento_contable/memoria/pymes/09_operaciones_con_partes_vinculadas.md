---
id: 31309
modelo: pymes
numero: 9
titulo: "Operaciones con partes vinculadas"
obligatorio: false
cuadros: [desglose_balance, desglose_perdidas_y_ganancias]
datos:
  - clave: identificacion_partes
    descripcion: "Partes vinculadas con las que se ha operado, por categoría (dominante, dependientes, negocios conjuntos, asociadas, con control conjunto o influencia, administradores y personal clave) y naturaleza de la relación"
    tipo: gd
    formato: tabla
  - clave: detalle_operaciones
    descripcion: "Detalle y cuantificación de las operaciones por categoría, con los criterios o métodos para determinar su valor"
    tipo: contabilidad
    formato: tabla
  - clave: beneficio_funciones_riesgos
    descripcion: "Beneficio o pérdida de cada operación y funciones y riesgos asumidos por cada parte"
    tipo: manual
    formato: texto
  - clave: saldos_pendientes
    descripcion: "Saldos pendientes activos y pasivos por epígrafe del balance, plazos, condiciones, contraprestación y garantías otorgadas o recibidas"
    tipo: contabilidad
    formato: tabla
  - clave: dudoso_cobro_vinculadas
    descripcion: "Correcciones por deudas de dudoso cobro o incobrables con vinculadas"
    tipo: contabilidad
    formato: numero
  - clave: compromisos_financieros_vinculadas
    descripcion: "Compromisos financieros con empresas vinculadas"
    tipo: gd
    formato: texto
  - clave: anticipos_creditos_administradores
    descripcion: "Anticipos y créditos a administradores y alta dirección: tipo de interés, características, importes devueltos o renunciados y garantías asumidas por su cuenta"
    tipo: contabilidad
    formato: tabla
  - clave: conflictos_interes
    descripcion: "Situaciones de conflicto de interés de los administradores o personas vinculadas (art. 229 LSC)"
    tipo: manual
    formato: texto
  - clave: retribucion_administradores
    descripcion: "Opcional en este modelo: remuneraciones de administradores y alta dirección"
    tipo: manual
    formato: tabla
fuentes: [BOE-A-2007-19966/iimodelosdecuentasanuales, BOE-A-2010-10544/a229, BOE-A-2010-10544/a261]
---
# Operaciones con partes vinculadas (modelo PYMES)

Informa de las operaciones con quienes pueden influir en la empresa o están bajo su influencia. En el modelo PYMES la lista de partes es **cerrada**: solo las seis categorías que enumera el modelo.

## Qué contar y en qué orden

1. **Categorías** que se consideran, en este orden: entidad dominante; empresas dependientes; negocios conjuntos en los que participa; empresas asociadas; empresas con control conjunto o influencia significativa sobre la empresa; miembros del órgano de administración y personal clave de la dirección. A diferencia del modelo normal, no hay categoría de "otras partes vinculadas" (familiares, sociedades de los socios...), aunque la Ley de Sociedades de Capital pide, de forma global, las transacciones significativas con terceros vinculados (indicación séptima del art. 260, que el art. 261 mantiene para quien puede formular balance abreviado). Si existen operaciones relevantes con esas otras personas, conviene informarlas.
2. Para **cada categoría**, separadamente: con quién y qué relación hay; detalle y cuantificación de las operaciones (ventas, compras, servicios, alquileres, préstamos, intereses, dividendos) y **cómo se ha fijado su valor**; beneficio o pérdida y funciones y riesgos de cada parte; saldos pendientes al cierre agrupados por epígrafes del balance, con plazos, condiciones y garantías; deterioros por dudoso cobro.
3. **Compromisos financieros** con empresas vinculadas, de forma individualizada si son significativos.
4. **Anticipos y créditos** a administradores y alta dirección: tipo de interés, características, importes devueltos o a los que se ha renunciado y garantías asumidas por su cuenta. También es obligatorio por el art. 261 LSC (indicación duodécima, de forma global).
5. **Conflictos de interés** de los administradores: el art. 229 LSC exige informarlos en la memoria de cualquier sociedad de capital, sea cual sea el modelo.

## Remuneración de los administradores

Desde 2016 el modelo PYMES **no exige** informar de sueldos y dietas de los administradores, y el art. 261 LSC tampoco la incluye entre las menciones obligatorias. Puede darse de forma voluntaria (si los estatutos prevén cargo retribuido, la junta fija el importe máximo y es habitual informarlo). La IA debe preguntar si se incluye, no decidirlo.

## Cuándo se dice "no aplica"

Si no hay operaciones con ninguna de las categorías, ni anticipos a administradores, la nota se reduce a decirlo, más la frase sobre conflictos de interés ("Los administradores no han comunicado situaciones de conflicto de interés"). Las operaciones del tráfico ordinario, en condiciones de mercado y de escasa importancia, se pueden omitir.

## Errores frecuentes

- Omitir los préstamos de socios administradores (cuenta 551) o los alquileres pagados a un administrador.
- No incluir el criterio de valoración de las operaciones.
- Olvidar la frase de conflictos de interés.
- Tratar como "personal clave" a cualquier empleado con responsabilidad: solo quien planifica, dirige y controla la empresa.

## Datos difíciles de conseguir

- **Lista de partes vinculadas**: solo la empresa la conoce; ayudan el libro registro de socios y los nombramientos de administradores en la GD.
- **Contratos** entre la empresa y sus socios o administradores (alquileres, préstamos, servicios): GD.
- **Conflictos de interés**: declaración de los propios administradores.
