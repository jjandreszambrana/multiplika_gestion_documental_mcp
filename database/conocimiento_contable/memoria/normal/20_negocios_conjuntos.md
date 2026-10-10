---
id: 31120
modelo: normal
numero: 20
titulo: "Negocios conjuntos"
obligatorio: false
cuadros: [desglose_balance, desglose_perdidas_y_ganancias]
datos:
  - clave: descripcion_negocios
    descripcion: "Intereses significativos en negocios conjuntos y su forma, distinguiendo explotaciones controladas conjuntamente (UTE, comunidades de bienes) y activos controlados conjuntamente"
    tipo: gd
    formato: texto
  - clave: contingencias_negocios
    descripcion: "Importe agregado de contingencias como partícipe, su parte de las del negocio y las derivadas de responder por pasivos de otros partícipes"
    tipo: manual
    formato: tabla
  - clave: compromisos_inversion
    descripcion: "Compromisos de inversión de capital asumidos en relación con los negocios conjuntos y su parte en los del propio negocio"
    tipo: manual
    formato: tabla
  - clave: importes_integrados
    descripcion: "Importes integrados de los negocios conjuntos en cada partida significativa del balance, cuenta de pérdidas y ganancias, EFE y ECPN, en agregado"
    tipo: contabilidad
    formato: tabla
fuentes: [BOE-A-2007-19884/A20-2, BOE-A-2007-19884/A14-3]
---
# Negocios conjuntos (modelo normal)

Se aplica cuando la empresa participa con otras en una actividad que **controlan entre todas**: uniones temporales de empresas (UTE) para una obra o un contrato público, comunidades de bienes, explotaciones agrarias compartidas, un edificio en copropiedad que se explota en común.

## Qué contar y en qué orden

1. **Descripción** de cada negocio conjunto significativo: con quién, para qué, porcentaje de participación y forma que adopta. El modelo pide distinguir:
   - **explotaciones controladas conjuntamente** (la UTE típica: una actividad compartida sin sociedad con personalidad propia);
   - **activos controlados conjuntamente** (un bien en común, como un oleoducto o una nave, que cada partícipe usa en su parte).

   Las participaciones en sociedades multigrupo (con personalidad jurídica) no se describen aquí, sino en la nota 9 (empresas del grupo, multigrupo y asociadas).
2. **Contingencias**, salvo que sean remotas, con la información de la nota 14 y separando: las que tiene la empresa como partícipe, su parte en las del negocio y las que surgen por responder de los pasivos de los otros partícipes (en las UTE la responsabilidad frente a terceros es solidaria).
3. **Compromisos de inversión** asumidos por la empresa en el negocio y su parte en los del propio negocio.
4. **Importes integrados**: lo que aporta el conjunto de los negocios conjuntos a cada partida significativa del balance, la cuenta de pérdidas y ganancias, el estado de flujos y el de cambios en el patrimonio neto. En agregado para todos los negocios.

El punto 4 solo lo puede dar la contabilidad si la integración proporcional se ha hecho con subcuentas o un diario separado por negocio; si se hizo con un asiento resumen, el desglose sale de las cuentas de la UTE.

## Cuándo se dice "no aplica"

Si la empresa no participa en ninguna UTE, comunidad de bienes ni activo compartido, la nota se omite.

## Errores frecuentes

- No integrar la parte de la UTE en las cuentas de la empresa y dejar solo la aportación o el saldo con la UTE.
- Olvidar la responsabilidad solidaria de las UTE como contingencia.
- Duplicar ingresos y gastos facturados entre la empresa y la UTE sin eliminar la parte propia.
- Describir aquí sociedades multigrupo.

## Datos difíciles de conseguir

- **Contrato o escritura de la UTE** o de la comunidad de bienes, con porcentajes: GD.
- **Cuentas de cada negocio conjunto** al cierre: las lleva el gerente de la UTE y a veces llegan tarde.
- **Compromisos de inversión** y garantías prestadas (avales de licitación): contratos y avales en la GD.
