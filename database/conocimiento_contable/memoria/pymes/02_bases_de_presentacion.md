---
id: 31302
modelo: pymes
numero: 2
titulo: "Bases de presentación de las cuentas anuales"
obligatorio: true
cuadros: [desglose_balance]
datos:
  - clave: declaracion_imagen_fiel
    descripcion: "Declaración expresa de que las cuentas reflejan la imagen fiel y, si se elabora estado de flujos, la veracidad de los flujos"
    tipo: manual
    formato: si_no
  - clave: disposiciones_no_aplicadas
    descripcion: "Disposiciones legales contables no aplicadas por razones excepcionales y su efecto cualitativo y cuantitativo"
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
  - clave: cambios_estimacion
    descripcion: "Naturaleza e importe de los cambios significativos en estimaciones contables, o impracticabilidad de estimar su efecto futuro"
    tipo: manual
    formato: texto
  - clave: empresa_en_funcionamiento
    descripcion: "Incertidumbres importantes sobre la continuidad o, si no se aplica el principio, hipótesis alternativas y razones"
    tipo: manual
    formato: texto
  - clave: comparacion_informacion
    descripcion: "Cambios de estructura de los estados, causas que impiden la comparación y adaptación de las cifras del ejercicio anterior"
    tipo: manual
    formato: texto
  - clave: elementos_varias_partidas
    descripcion: "Elementos registrados en dos o más partidas del balance, con el importe en cada una"
    tipo: contabilidad
    formato: tabla
  - clave: cambios_criterios_contables
    descripcion: "Ajustes por cambios de criterio contable, razones y, si procede, impracticabilidad de la aplicación retroactiva"
    tipo: manual
    formato: texto
  - clave: correccion_errores
    descripcion: "Ajustes por corrección de errores, naturaleza del error y, si procede, impracticabilidad"
    tipo: manual
    formato: texto
fuentes: [BOE-A-2007-19966/iimodelosdecuentasanuales, BOE-A-2007-19966/inormasdeelaboracion-2]
---
# Bases de presentación de las cuentas anuales (modelo PYMES)

Explica sobre qué base se han preparado las cuentas: que dan la imagen fiel, si hay estimaciones que han cambiado o dudas sobre la continuidad de la empresa, y si el año anterior es comparable.

## Qué contar y en qué orden

Siete puntos, en el orden del modelo:

1. **Imagen fiel**: frase expresa de que las cuentas muestran la imagen fiel del patrimonio, la situación financiera y los resultados. La mención a los flujos de efectivo solo si la empresa elabora voluntariamente el estado de flujos, que el PGC PYMES no exige. Si alguna norma contable se ha dejado de aplicar para lograr la imagen fiel, cuál y con qué efecto.
2. **Principios contables no obligatorios**: lo normal es "no se han aplicado".
3. **Aspectos críticos de la valoración y estimación de la incertidumbre**. En el modelo PYMES este punto tiene solo dos partes (no pide, a diferencia del normal y del abreviado, los supuestos clave sobre el futuro):
   - **cambios de estimación** significativos del ejercicio, con su importe (por ejemplo, alargar la vida útil de la maquinaria);
   - **dudas sobre la continuidad** de la empresa: pérdidas reiteradas, patrimonio neto negativo o inferior a la mitad del capital, falta de liquidez, y los factores que las compensan (apoyo de los socios, refinanciación). Si las cuentas no se han hecho con el principio de empresa en funcionamiento, decirlo y explicar con qué criterio se han hecho.
4. **Comparación de la información**: cambios de estructura del balance o de la cuenta de pérdidas y ganancias y cómo se han adaptado las cifras del año anterior.
5. **Elementos recogidos en varias partidas**: el caso típico, un préstamo con parte a largo y parte a corto plazo.
6. **Cambios en criterios contables** y 7. **Corrección de errores**: ajustes, razones y, si no se pudo aplicar hacia atrás, por qué. Sin cifras comparativas.

## Cuándo se dice "no aplica"

Los puntos 1 y 3 siempre llevan texto (al menos la declaración de imagen fiel y la mención a la continuidad). Los demás, una frase si no hay nada. Se mantienen los títulos.

## Errores frecuentes

- Mencionar el estado de flujos de efectivo cuando la empresa no lo elabora.
- Llamar "cambio de criterio" a un cambio de estimación.
- Corregir un error de años anteriores contra resultados del ejercicio en lugar de contra reservas.
- Afirmar que no hay dudas sobre la continuidad sin mirar el patrimonio neto: si está por debajo de la mitad del capital social hay causa de disolución y debe explicarse cómo se va a resolver.

## Datos difíciles de conseguir

- **Dudas sobre la continuidad y cómo se mitigan**: solo las conoce la dirección; preguntarlas expresamente cuando el SIF muestre pérdidas o patrimonio neto bajo.
- **Explicación de cambios de criterio o errores**: los asientos contra reservas (subgrupo 11) se ven en el SIF, pero el porqué es del contable.
