---
id: 31306
modelo: pymes
numero: 6
titulo: "Pasivos financieros"
obligatorio: true
cuadros: [deudas_plazo, desglose_balance]
datos:
  - clave: deudas_largo_corto
    descripcion: "Deudas por epígrafe y partida del balance separadas en largo y corto plazo (punto de partida para el cuadro de vencimientos)"
    tipo: contabilidad
    formato: tabla
  - clave: vencimientos_cinco_anos
    descripcion: "Deudas que vencen en cada uno de los cinco años siguientes al cierre y resto hasta el último vencimiento, por epígrafe y partida del balance"
    tipo: gd
    formato: tabla
  - clave: deudas_garantia_real
    descripcion: "Importe de las deudas con garantía real, con su forma y naturaleza (hipoteca, prenda)"
    tipo: gd
    formato: tabla
  - clave: impagos_prestamos
    descripcion: "Préstamos pendientes al cierre con impago de principal o intereses en el ejercicio: detalle, valor en libros y si se subsanó o renegoció antes de formular"
    tipo: manual
    formato: texto
fuentes: [BOE-A-2007-19966/iimodelosdecuentasanuales, BOE-A-2010-10544/a260, BOE-A-2010-10544/a261]
---
# Pasivos financieros (modelo PYMES)

Informa de cuándo vencen las deudas, cuáles tienen garantía real y si ha habido impagos. Es obligatoria también por el art. 261 de la Ley de Sociedades de Capital, que exige a las sociedades que pueden formular balance abreviado (en la práctica, las que aplican el PGC PYMES) las deudas a más de cinco años y las garantizadas (indicación sexta del art. 260).

## Qué contar y en qué orden

1. **Cuadro de vencimientos**: para cada epígrafe y partida de deudas del balance (deudas con entidades de crédito, acreedores por arrendamiento financiero, otras deudas, deudas con empresas del grupo, acreedores comerciales...), los importes que vencen en el año 1, 2, 3, 4, 5 y en adelante, hasta el último vencimiento. La suma de cada fila debe coincidir con el saldo total (largo más corto) de esa partida en el balance.
2. **Deudas con garantía real**: importe y tipo de garantía (hipoteca sobre la nave, prenda sobre depósitos, hipoteca mobiliaria).
3. **Impagos**: si durante el ejercicio se dejó de pagar principal o intereses de algún préstamo vivo al cierre, el detalle, el valor en libros de esos préstamos y si se ha regularizado o renegociado antes de formular las cuentas.

## De dónde sale cada cifra

El SIF solo separa **largo y corto plazo** (cuadro `deudas_plazo`). La columna del año 1 coincide con el corto plazo, pero el reparto del largo plazo entre los años 2 a 5 y "más de 5" **no lo tiene el SIF**: sale del **cuadro de amortización** de cada préstamo o leasing (documento de la GD) o lo aporta el contable. Por eso `vencimientos_cinco_anos` es un dato `gd`. Las deudas comerciales y con Administraciones públicas suelen vencer en el año 1 en su totalidad.

## Cuándo se dice "no aplica"

La nota se incluye siempre que la empresa tenga deudas, es decir, casi siempre. Si no hay deudas con garantía real ni impagos, una frase para cada punto. Si toda la deuda es a corto plazo, el cuadro se reduce a una columna, pero se presenta.

## Errores frecuentes

- Rellenar el cuadro de vencimientos repartiendo el largo plazo a partes iguales entre los años: hay que usar el cuadro de amortización real, con carencias y cuotas crecientes.
- Que la suma de las columnas no cuadre con el balance (por olvidar intereses devengados o comisiones pendientes de imputar, que forman parte del coste amortizado).
- No incluir el leasing (cuentas 174 y 524) en el cuadro.
- Omitir los avales y la garantía personal de los socios: no son garantía real de la empresa, pero conviene mencionarlos en "Otra información" (compromisos y garantías).
- Callar un impago que se regularizó en el mismo ejercicio.

## Datos difíciles de conseguir

- **Cuadros de amortización** de todos los préstamos y leasing vivos al cierre: GD o certificado bancario a 31 de diciembre. Si falta alguno, anotarlo como pendiente.
- **Escrituras de hipoteca** y pólizas con prenda: GD.
- **Impagos**: los conoce el contable o aparecen en los extractos bancarios (cuotas devueltas).
