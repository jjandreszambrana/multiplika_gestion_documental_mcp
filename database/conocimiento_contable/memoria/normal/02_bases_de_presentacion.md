---
id: 31102
modelo: normal
numero: 2
titulo: "Bases de presentación de las cuentas anuales"
obligatorio: true
cuadros: [desglose_balance, desglose_perdidas_y_ganancias]
datos:
  - clave: declaracion_imagen_fiel
    descripcion: "Declaración expresa de que las cuentas reflejan la imagen fiel y la veracidad de los flujos del estado de flujos de efectivo"
    tipo: manual
    formato: si_no
  - clave: disposiciones_no_aplicadas
    descripcion: "Disposiciones legales contables no aplicadas por razones excepcionales, con su efecto cualitativo y cuantitativo en cada ejercicio"
    tipo: manual
    formato: texto
  - clave: informacion_complementaria
    descripcion: "Informaciones complementarias necesarias para la imagen fiel y nota donde se encuentran"
    tipo: manual
    formato: texto
  - clave: principios_no_obligatorios
    descripcion: "Principios contables no obligatorios aplicados"
    tipo: manual
    formato: texto
  - clave: supuestos_clave_incertidumbre
    descripcion: "Supuestos clave sobre el futuro con riesgo de cambios significativos en activos o pasivos del ejercicio siguiente, con su naturaleza y valor contable"
    tipo: manual
    formato: texto
  - clave: cambios_estimacion
    descripcion: "Naturaleza e importe de los cambios significativos en estimaciones contables"
    tipo: manual
    formato: texto
  - clave: empresa_en_funcionamiento
    descripcion: "Incertidumbres importantes sobre la continuidad de la empresa o, si no se aplica el principio, hipótesis alternativas y razones"
    tipo: manual
    formato: texto
  - clave: comparacion_informacion
    descripcion: "Cambios de estructura de los estados, causas que impiden la comparación y adaptación de las cifras del ejercicio anterior"
    tipo: manual
    formato: texto
  - clave: agrupacion_partidas
    descripcion: "Desglose de las partidas agrupadas en balance, cuenta de pérdidas y ganancias, ECPN o EFE, si no está en otras notas"
    tipo: contabilidad
    formato: tabla
  - clave: elementos_varias_partidas
    descripcion: "Elementos registrados en dos o más partidas del balance, con el importe de cada una"
    tipo: contabilidad
    formato: tabla
  - clave: cambios_criterios_contables
    descripcion: "Cambios de criterio contable: naturaleza, razones, importe de la corrección por partida y, si procede, impracticabilidad"
    tipo: manual
    formato: texto
  - clave: correccion_errores
    descripcion: "Errores corregidos: naturaleza, ejercicio de origen, importe por partida y, si procede, impracticabilidad"
    tipo: manual
    formato: texto
fuentes: [BOE-A-2007-19884/A2-4, BOE-A-2007-19884/A10-2]
---
# Bases de presentación de las cuentas anuales (modelo normal)

Explica sobre qué base se han preparado las cuentas: que muestran la imagen fiel, qué estimaciones arriesgadas hay detrás de las cifras y si las del año anterior son comparables. Es una nota en gran parte de juicio, no de cifras.

## Qué contar y en qué orden

Seguir los ocho puntos del modelo, con este número:

1. **Imagen fiel**. Frase expresa de que las cuentas reflejan la imagen fiel del patrimonio, la situación financiera y los resultados, y la veracidad de los flujos del estado de flujos de efectivo. Si se ha dejado de aplicar alguna norma contable para lograr esa imagen fiel (caso rarísimo), qué norma y con qué efecto en cifras. Si hace falta información adicional, dónde está.
2. **Principios contables no obligatorios**. Lo normal es "no se han aplicado".
3. **Aspectos críticos de la valoración y estimación de la incertidumbre**: las estimaciones que pueden cambiar mucho el año siguiente (deterioros de inmovilizado o de clientes, provisiones por litigios, activos por impuesto diferido, vidas útiles). Por cada una, qué activo o pasivo afecta y su valor en libros. Después, los **cambios de estimación** del año con su importe. Y, en su caso, las **dudas sobre la continuidad** de la empresa (pérdidas reiteradas, patrimonio neto negativo, falta de liquidez) con los factores que las mitigan.
4. **Comparación de la información**: si se ha cambiado la estructura del balance o de la cuenta de pérdidas y ganancias, o si algo impide comparar con el año anterior, y cómo se han adaptado las cifras.
5. **Agrupación de partidas**: desglose de lo agrupado, si no está ya en otra nota.
6. **Elementos recogidos en varias partidas**: el caso típico es un préstamo con parte a largo y parte a corto plazo.
7. **Cambios en criterios contables** y 8. **Corrección de errores**: naturaleza, importe por partida y, si no se pudo aplicar hacia atrás, por qué. Estos dos puntos no llevan cifras comparativas.

## Cuándo se dice "no aplica"

Los puntos 1 y 3 siempre llevan texto. Los demás, si no hay nada, una frase breve cada uno ("No se han producido cambios en criterios contables"). No se omiten los títulos: el lector debe ver que se han considerado.

## Errores frecuentes

- Llamar "cambio de criterio" a un cambio de estimación (por ejemplo, alargar la vida útil de una máquina). El cambio de estimación va hacia delante, no se reexpresa el año anterior.
- Corregir un error de años anteriores contra resultados del ejercicio en lugar de contra reservas, y luego no explicarlo aquí.
- Escribir la declaración de empresa en funcionamiento sin mirar el patrimonio neto: si es inferior a la mitad del capital (causa de disolución) o negativo, hay que hablar de ello.
- Rellenar el punto 3 con frases genéricas que valen para cualquier empresa.

## Datos difíciles de conseguir

- Las estimaciones críticas y las incertidumbres de continuidad: solo las conoce la dirección. Preguntarlas explícitamente al contable.
- El importe de una corrección de error por partida: requiere saber qué asientos se hicieron contra reservas (subgrupo 11); el SIF los muestra en el desglose del balance, pero la explicación es manual.
