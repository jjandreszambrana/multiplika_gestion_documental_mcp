---
id: 31304
modelo: pymes
numero: 4
titulo: "Inmovilizado material, intangible e inversiones inmobiliarias"
obligatorio: true
cuadros: [inmovilizado_material, inmovilizado_intangible, inversiones_inmobiliarias]
datos:
  - clave: movimiento_inmovilizado
    descripcion: "Movimiento de cada epígrafe (material, intangible, inversiones inmobiliarias) con amortización y deterioro acumulados: saldo inicial, entradas, salidas y saldo final"
    tipo: contabilidad
    formato: tabla
  - clave: descripcion_inversiones_inmobiliarias
    descripcion: "Descripción de las inversiones inmobiliarias"
    tipo: gd
    formato: texto
  - clave: informacion_adicional_significativa
    descripcion: "Información adicional de los epígrafes significativos por naturaleza o importe (garantías, bienes totalmente amortizados, compromisos, terreno y construcción...)"
    tipo: gd
    formato: texto
  - clave: arrendamiento_financiero
    descripcion: "Arrendamientos financieros sobre activos no corrientes: coste en origen, duración, años transcurridos, cuotas satisfechas en años anteriores y en el ejercicio, cuotas pendientes y valor de la opción de compra"
    tipo: gd
    formato: tabla
fuentes: [BOE-A-2007-19966/iimodelosdecuentasanuales, BOE-A-2010-10544/a261]
---
# Inmovilizado material, intangible e inversiones inmobiliarias (modelo PYMES)

Una sola nota para los tres tipos de activo no corriente no financiero. Su núcleo es el **cuadro de movimientos**, que exige también el art. 261 de la Ley de Sociedades de Capital (indicación decimocuarta del art. 260) y que el SIF calcula con los cuadros `inmovilizado_material`, `inmovilizado_intangible` e `inversiones_inmobiliarias`.

## Qué contar y en qué orden

1. **Cuadro de movimientos** de cada epígrafe, ejercicio y anterior: saldo inicial, entradas, salidas y saldo final. Para cada uno, el coste (subgrupos 20, 21, 22 y 23), la amortización acumulada (subgrupo 28) y el deterioro (subgrupo 29). El modelo PYMES solo pide entradas y salidas, pero el SIF también separa los **traspasos** (asiento que sale de una cuenta de inmovilizado y entra en otra, como el paso de inmovilizado en curso a construcciones). Se pueden presentar como columna propia o sumar a entradas y salidas; lo importante es que cuadre con el balance.
2. **Inversiones inmobiliarias**: su cuadro aparte y una descripción (qué inmuebles, dónde, para qué: alquiler o plusvalía).
3. **Información adicional de epígrafes significativos**: el modelo deja a criterio de la empresa qué añadir. Lo habitual y recomendable: vidas útiles, bienes totalmente amortizados en uso, valor del terreno y de la construcción, bienes hipotecados o en garantía, compromisos firmes de compra, subvenciones relacionadas y resultado de las ventas.
4. **Arrendamientos financieros** (leasing) sobre cualquier activo no corriente, contrato por contrato o agrupados: coste del bien en origen, duración del contrato, años transcurridos, cuotas pagadas en años anteriores y en el ejercicio, cuotas pendientes y valor de la opción de compra.

## Cuándo se dice "no aplica"

La nota existe en casi todas las empresas. Si un epígrafe no tiene saldo ni movimientos (por ejemplo, no hay inversiones inmobiliarias), se omite su cuadro. El punto 4 solo si hay contratos de leasing.

## Errores frecuentes

- Que el saldo final del cuadro no coincida con el balance; con los cuadros del SIF no debería ocurrir.
- Presentar un traspaso contabilizado como baja y alta en dos asientos distintos: el SIF lo verá como salida y entrada. Revisarlo antes de redactar.
- Olvidar dar de baja la amortización acumulada de los bienes vendidos o retirados.
- No separar las inversiones inmobiliarias del inmovilizado material (un local alquilado a terceros no es inmovilizado material).
- En el leasing, no incluir la opción de compra o confundir cuotas pagadas con capital amortizado.

## Datos difíciles de conseguir

- **Datos de cada leasing** (coste en origen, cuotas pagadas y pendientes, opción de compra): contratos y cuadros de amortización en la GD, o certificado de la entidad.
- **Garantías e hipotecas**: escrituras de préstamo en la GD.
- **Compromisos firmes de compra**: solo los conoce la empresa.
- **Bienes totalmente amortizados en uso**: el SIF solo los detecta si lleva inventario por elemento.
