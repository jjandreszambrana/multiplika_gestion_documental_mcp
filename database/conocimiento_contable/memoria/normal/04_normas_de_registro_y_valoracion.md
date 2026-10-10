---
id: 31104
modelo: normal
numero: 4
titulo: "Normas de registro y valoración"
obligatorio: true
cuadros: []
datos:
  - clave: criterio_inmovilizado_intangible
    descripcion: "Criterios de activación, amortización y deterioro del inmovilizado intangible; importe recuperable de las UGE con fondo de comercio"
    tipo: manual
    formato: texto
  - clave: criterio_inmovilizado_material
    descripcion: "Amortización, deterioro y su reversión, gastos financieros activados, mejoras, desmantelamiento y trabajos para el propio inmovilizado"
    tipo: manual
    formato: texto
  - clave: criterio_inversiones_inmobiliarias
    descripcion: "Criterio para calificar terrenos y construcciones como inversiones inmobiliarias y su valoración"
    tipo: manual
    formato: texto
  - clave: criterio_arrendamientos
    descripcion: "Criterio de contabilización de arrendamientos financieros y operaciones similares"
    tipo: manual
    formato: texto
  - clave: criterio_permutas
    descripcion: "Criterio de las permutas y por qué se califican como comerciales o no"
    tipo: manual
    formato: texto
  - clave: criterio_instrumentos_financieros
    descripcion: "Categorías de activos y pasivos financieros, deterioro de clientes, bajas, híbridos, compuestos, garantías, participaciones en grupo, ingresos y gastos financieros y acciones propias"
    tipo: manual
    formato: texto
  - clave: criterio_coberturas
    descripcion: "Criterios de las coberturas contables y de su interrupción"
    tipo: manual
    formato: texto
  - clave: criterio_existencias
    descripcion: "Valoración de existencias, deterioro y gastos financieros activados"
    tipo: manual
    formato: texto
  - clave: criterio_moneda_extranjera
    descripcion: "Valoración de transacciones en moneda extranjera, diferencias de cambio y tipo de cambio aplicado"
    tipo: manual
    formato: texto
  - clave: criterio_impuesto_beneficios
    descripcion: "Registro y valoración de activos y pasivos por impuesto diferido"
    tipo: manual
    formato: texto
  - clave: criterio_ingresos_gastos
    descripcion: "Criterios generales de ingresos y gastos; obligaciones cumplidas a lo largo del tiempo o en un momento y método del grado de avance"
    tipo: manual
    formato: texto
  - clave: criterio_provisiones
    descripcion: "Valoración de provisiones y contingencias, compensaciones de terceros y método de estimación de cada riesgo"
    tipo: manual
    formato: texto
  - clave: criterio_medioambiente
    descripcion: "Criterios para gastos e inversiones medioambientales y provisiones por impacto medioambiental"
    tipo: manual
    formato: texto
  - clave: criterio_personal
    descripcion: "Registro de gastos de personal y compromisos por pensiones"
    tipo: manual
    formato: texto
  - clave: criterio_pagos_acciones
    descripcion: "Contabilización de pagos basados en acciones"
    tipo: manual
    formato: texto
  - clave: criterio_subvenciones
    descripcion: "Clasificación e imputación a resultados de subvenciones, donaciones y legados"
    tipo: manual
    formato: texto
  - clave: criterio_combinaciones_negocios
    descripcion: "Registro y valoración de combinaciones de negocios"
    tipo: manual
    formato: texto
  - clave: criterio_negocios_conjuntos
    descripcion: "Integración de los saldos de negocios conjuntos (UTE, comunidades de bienes)"
    tipo: manual
    formato: texto
  - clave: criterio_partes_vinculadas
    descripcion: "Criterios en transacciones entre partes vinculadas"
    tipo: manual
    formato: texto
  - clave: criterio_activos_venta
    descripcion: "Calificación y valoración de activos no corrientes mantenidos para la venta y pasivos asociados"
    tipo: manual
    formato: texto
  - clave: criterio_operaciones_interrumpidas
    descripcion: "Identificación de operaciones interrumpidas y de sus ingresos y gastos"
    tipo: manual
    formato: texto
fuentes: [BOE-A-2007-19884/A4-4, BOE-A-2007-19884/A10-2]
---
# Normas de registro y valoración (modelo normal)

Describe los criterios contables que la empresa ha aplicado de verdad a cada partida. No es un resumen del PGC: es lo que hace esta empresa, con sus números concretos (años de vida útil, método de existencias, porcentaje de deterioro de clientes).

## Qué contar y en qué orden

El modelo enumera 21 partidas. Seguir ese orden y tratar solo las que existen en las cuentas:

1. Inmovilizado intangible; 2. inmovilizado material; 3. inversiones inmobiliarias; 4. arrendamientos; 5. permutas; 6. instrumentos financieros (categorías, deterioro de clientes, bajas, híbridos y compuestos, garantías financieras, participaciones en empresas del grupo, intereses y dividendos, acciones propias); 7. coberturas; 8. existencias; 9. moneda extranjera; 10. impuesto sobre beneficios; 11. ingresos y gastos; 12. provisiones y contingencias; 13. medio ambiente; 14. personal y pensiones; 15. pagos basados en acciones; 16. subvenciones; 17. combinaciones de negocios; 18. negocios conjuntos; 19. partes vinculadas; 20. activos mantenidos para la venta; 21. operaciones interrumpidas.

Para cada una, lo concreto:

- **Inmovilizado**: método de amortización (lineal casi siempre) y una tabla de años de vida útil por clase de elemento, coherente con la que figura en la nota 5 y con las cuentas del subgrupo 28.
- **Clientes**: cómo se estima el deterioro (análisis individual, antigüedad de la deuda) y cuándo se da de baja.
- **Existencias**: precio medio ponderado o FIFO, y cómo se deteriora lo obsoleto.
- **Ingresos**: cuándo se reconoce la venta (entrega, avance de obra) y, en servicios que duran, cómo se mide el grado de avance.
- **Impuesto sobre beneficios**: cuándo se reconocen activos por impuesto diferido y bases imponibles negativas.

La norma 10.ª de elaboración pide que esta nota sea **sintética y clara**: frases cortas, sin transcribir las normas.

## Cuándo se dice "no aplica"

La nota siempre existe. Las partidas que la empresa no tiene se omiten sin más (no hace falta escribir "no hay coberturas"). Lo que sí debe estar es todo lo que aparezca en el balance o en la cuenta de pérdidas y ganancias.

## Errores frecuentes

- Copiar el texto de las normas de registro y valoración del PGC. El auditor y el registro lo detectan enseguida y no informa de nada.
- Poner vidas útiles que no cuadran con la amortización contabilizada: si dice "equipos informáticos, 4 años" y la dotación anual es la cuarta parte del coste, bien; si es la décima parte, no.
- Mantener criterios de ejercicios anteriores que ya no se aplican, o al revés, no añadir los de una operación nueva (primer leasing, primera subvención).
- Seguir describiendo los ingresos con el lenguaje anterior a 2021 (porcentaje de realización) en lugar de obligaciones cumplidas en un momento o a lo largo del tiempo.

## Datos difíciles de conseguir

- Los criterios internos (vidas útiles, método de existencias, criterio de deterioro de clientes) no están en el SIF como texto: hay que preguntarlos o partir de la memoria del año anterior en la GD.
- Las vidas útiles pueden deducirse de las dotaciones del SIF (coste dividido entre amortización anual), pero eso es una comprobación, no la fuente: la IA debe proponerlas y pedir confirmación.
