---
id: 31105
modelo: normal
numero: 5
titulo: "Inmovilizado material"
obligatorio: true
cuadros: [inmovilizado_material]
datos:
  - clave: movimiento_inmovilizado_material
    descripcion: "Movimiento por partida: saldo inicial, entradas (con combinaciones de negocios, aportaciones no dinerarias y mejoras), traspasos, salidas y saldo final, con amortización y deterioro acumulados"
    tipo: contabilidad
    formato: tabla
  - clave: costes_desmantelamiento
    descripcion: "Costes estimados de desmantelamiento, retiro o rehabilitación incluidos en el valor de los activos y circunstancias consideradas"
    tipo: manual
    formato: texto
  - clave: vidas_utiles_metodos
    descripcion: "Vidas útiles o coeficientes por clase de elemento y método de amortización, con amortización del ejercicio y acumulada de los elementos significativos"
    tipo: contabilidad
    formato: tabla
  - clave: cambios_estimacion
    descripcion: "Cambios significativos de estimación en valores residuales, vidas útiles, métodos o costes de desmantelamiento"
    tipo: manual
    formato: texto
  - clave: adquirido_grupo
    descripcion: "Inmovilizado material adquirido a empresas del grupo y asociadas: valor contable, amortización y deterioro"
    tipo: gd
    formato: tabla
  - clave: situado_extranjero
    descripcion: "Inmovilizado material situado fuera de España: valor contable, amortización y deterioro"
    tipo: manual
    formato: tabla
  - clave: gastos_financieros_capitalizados
    descripcion: "Gastos financieros capitalizados en el ejercicio y criterio seguido"
    tipo: contabilidad
    formato: numero
  - clave: deterioros_significativos
    descripcion: "Para cada deterioro significativo reconocido o revertido: naturaleza del bien, importe, causas, método (valor razonable o valor en uso) e hipótesis"
    tipo: manual
    formato: texto
  - clave: compensaciones_terceros
    descripcion: "Compensaciones de terceros (seguros) incluidas en resultados por bienes deteriorados, perdidos o retirados"
    tipo: gd
    formato: numero
  - clave: no_afecto_explotacion
    descripcion: "Inmovilizado no afecto directamente a la explotación: valor contable, amortización y deterioro"
    tipo: manual
    formato: tabla
  - clave: totalmente_amortizado
    descripcion: "Bienes totalmente amortizados en uso, separando construcciones del resto"
    tipo: contabilidad
    formato: tabla
  - clave: garantias_restricciones
    descripcion: "Bienes afectos a garantías y reversión y restricciones a la titularidad, con importes"
    tipo: gd
    formato: texto
  - clave: subvenciones_relacionadas
    descripcion: "Subvenciones, donaciones y legados recibidos para inmovilizado material e importe de los activos afectados"
    tipo: gd
    formato: tabla
  - clave: compromisos_firmes
    descripcion: "Compromisos firmes de compra con sus fuentes previsibles de financiación y compromisos firmes de venta"
    tipo: manual
    formato: texto
  - clave: otras_circunstancias
    descripcion: "Otras circunstancias sustantivas: arrendamientos, seguros, litigios, embargos y similares"
    tipo: gd
    formato: texto
  - clave: arrendamiento_financiero
    descripcion: "Bienes del inmovilizado material en arrendamiento financiero u operaciones similares"
    tipo: gd
    formato: texto
  - clave: terreno_construccion
    descripcion: "Valor del terreno y de la construcción por separado en los inmuebles"
    tipo: contabilidad
    formato: tabla
  - clave: resultado_enajenaciones
    descripcion: "Resultado del ejercicio por enajenación o disposición de elementos del inmovilizado material"
    tipo: contabilidad
    formato: numero
fuentes: [BOE-A-2007-19884/A5-4]
---
# Inmovilizado material (modelo normal)

La nota más numérica de la memoria. Su núcleo es el **cuadro de movimientos** de cada partida del balance (terrenos y construcciones, instalaciones técnicas y otro inmovilizado material, inmovilizado en curso y anticipos), con su amortización y su deterioro. Ese cuadro lo calcula el SIF (`inmovilizado_material`) y la IA no debe rehacer ni redondear sus cifras.

## Qué contar y en qué orden

1. **Cuadro de movimientos** del ejercicio y del anterior: saldo inicial, entradas, traspasos, salidas y saldo final, para el coste (subgrupo 21 y 23), la amortización acumulada (cuenta 281) y el deterioro (cuenta 291). El modelo pide destacar dentro de las entradas las que vienen de combinaciones de negocios, de aportaciones no dinerarias y de ampliaciones o mejoras: el SIF no distingue el origen de una alta, así que ese detalle es dato manual.
2. **Amortización**: método y vidas útiles por clase (deben coincidir con la nota 4). Cambios de estimación, si los hay.
3. **Deterioros significativos** del año: qué bien, cuánto, por qué y cómo se calculó el importe recuperable.
4. **Información complementaria**, solo lo que exista: bienes totalmente amortizados en uso (separando construcciones), valor del terreno y de la construcción en cada inmueble, gastos financieros activados, costes de desmantelamiento, bienes adquiridos a empresas del grupo, bienes en el extranjero, bienes no afectos a la explotación.
5. **Situación jurídica**: bienes hipotecados o en garantía, restricciones de titularidad, embargos, litigios, seguros, bienes en leasing (con remisión a la nota 8).
6. **Subvenciones** recibidas para estos bienes (remisión a la nota 18), **compromisos firmes** de compra o venta y **resultado de las ventas** de inmovilizado del año (cuentas 671 y 771).

## Cuándo se dice "no aplica"

La nota existe en casi todas las empresas. Si no hay inmovilizado material, una frase. Los puntos 3 a 6 que no se den se omiten o se resuelven con una frase de cierre ("No existen bienes afectos a garantías ni compromisos firmes de compra").

## Errores frecuentes

- Que el saldo final del cuadro no coincida con el balance: nunca debería pasar si se usa el cuadro del SIF.
- Confundir traspasos con altas o bajas. El SIF considera traspaso el asiento que sale de una cuenta de inmovilizado y entra en otra (por ejemplo, del inmovilizado en curso a construcciones); el resto es alta o baja. Si la empresa contabilizó un traspaso en dos asientos, aparecerá como baja y alta: revisarlo.
- Olvidar la amortización acumulada de los bienes dados de baja.
- No separar terreno y construcción, que además tiene efecto en la amortización (el terreno no se amortiza).

## Datos difíciles de conseguir

- **Garantías e hipotecas**: buscar en la GD las escrituras de préstamo hipotecario y los contratos de leasing.
- **Compromisos firmes de compra** y su financiación: solo los sabe la empresa (pedidos en firme a proveedores de maquinaria, contratos de obra).
- **Bienes totalmente amortizados**: el SIF puede detectarlos si lleva el inventario por elemento; si solo hay saldos por cuenta, es dato manual.
- **Compensaciones de seguros** por siniestros: en la GD, la liquidación de la aseguradora.
