---
id: 31108
modelo: normal
numero: 8
titulo: "Arrendamientos y otras operaciones de naturaleza similar"
obligatorio: false
cuadros: [deudas_plazo, desglose_perdidas_y_ganancias]
datos:
  - clave: financiero_arrendatario_activo
    descripcion: "Arrendatario financiero: importe inicial de cada clase de activo y si es valor razonable o valor actual de los pagos mínimos"
    tipo: gd
    formato: tabla
  - clave: financiero_arrendatario_pagos
    descripcion: "Arrendatario financiero: conciliación entre pagos futuros mínimos (con opción de compra) y su valor actual, por plazos hasta un año, de uno a cinco y más de cinco"
    tipo: gd
    formato: tabla
  - clave: financiero_cuotas_contingentes
    descripcion: "Cuotas contingentes reconocidas como gasto o ingreso del ejercicio"
    tipo: manual
    formato: numero
  - clave: financiero_descripcion_acuerdos
    descripcion: "Descripción de los acuerdos significativos: cuotas contingentes, renovaciones, opciones de compra, actualización de precios y restricciones impuestas"
    tipo: gd
    formato: texto
  - clave: subarriendos
    descripcion: "Pagos futuros mínimos a recibir por subarriendos no cancelables (financieros y operativos)"
    tipo: gd
    formato: numero
  - clave: financiero_arrendador
    descripcion: "Arrendador financiero: conciliación de la inversión bruta y su valor actual, cobros mínimos por plazos, movimiento de contratos, ingresos no devengados, cuotas contingentes y deterioro"
    tipo: gd
    formato: tabla
  - clave: operativo_arrendatario_pagos
    descripcion: "Arrendatario operativo: pagos futuros mínimos no cancelables, total y por plazos hasta un año, de uno a cinco y más de cinco"
    tipo: gd
    formato: tabla
  - clave: operativo_gasto_ejercicio
    descripcion: "Cuotas de arrendamientos y subarrendamientos operativos reconocidas en el ejercicio, separando pagos mínimos, cuotas contingentes y subarriendos"
    tipo: contabilidad
    formato: tabla
  - clave: operativo_arrendador
    descripcion: "Arrendador operativo: cobros futuros mínimos no cancelables por plazos, descripción de bienes y acuerdos, cuotas contingentes"
    tipo: gd
    formato: tabla
fuentes: [BOE-A-2007-19884/A8-3]
---
# Arrendamientos y otras operaciones de naturaleza similar (modelo normal)

Informa de los contratos de arrendamiento en los que la empresa es **arrendataria** (usa el bien y paga) o **arrendadora** (cede el bien y cobra), separando los **financieros** (leasing: el bien está en el balance del arrendatario) de los **operativos** (alquiler normal: solo hay gasto o ingreso).

## Qué contar y en qué orden

Cuatro bloques, solo los que existan:

1. **Arrendatario financiero** (leasing con opción de compra): por clase de bien, el importe por el que se reconoció; conciliación entre los pagos futuros mínimos y su valor actual, **por tramos**: hasta un año, de uno a cinco años, más de cinco; cuotas contingentes; descripción de los contratos significativos (renovaciones, opción de compra, revisiones de precio, restricciones como no repartir dividendos o no endeudarse más). El bien en sí se describe en la nota 5 o 7.
2. **Arrendador financiero**: lo equivalente desde el lado del cobro, con la conciliación de la inversión bruta.
3. **Arrendatario operativo** (alquiler de locales, renting de vehículos): pagos futuros mínimos **no cancelables** por tramos y gasto del ejercicio (cuenta 621), separando pagos mínimos, cuotas contingentes y subarriendos.
4. **Arrendador operativo**: cobros futuros mínimos no cancelables por tramos y descripción de los bienes.

Los tramos de vencimiento (hasta un año, de uno a cinco y más de cinco) **no los da el SIF**: el cuadro `deudas_plazo` solo separa largo y corto plazo (cuentas 174 y 524 en el leasing). El reparto en tramos se calcula con el cuadro de amortización del contrato que esté en la GD, o lo da el contable.

## Cuándo se dice "no aplica"

Si la empresa no tiene leasing ni alquila nada significativo, se omite la nota o se dice en una frase. Muy pocas empresas no tienen ningún alquiler; lo habitual es que haya al menos el bloque 3.

## Errores frecuentes

- Poner en el bloque 3 el total de cuotas hasta el final del contrato aunque se pueda cancelar con un preaviso corto. Solo cuentan los pagos **no cancelables**: si el contrato de un local se puede rescindir con dos meses de aviso, el compromiso es de dos meses.
- Tratar un renting como leasing o al revés. Decide la sustancia del contrato (si se transfieren los riesgos y beneficios), no su nombre.
- No cuadrar la deuda por leasing de esta nota con la deuda del balance (cuentas 174 y 524).
- Olvidar la opción de compra en la conciliación de pagos.

## Datos difíciles de conseguir

- **Cuadros de amortización de cada leasing** y **duración no cancelable de cada alquiler**: están en los contratos de la GD. Si no están, pedirlos a la empresa o a la entidad financiera.
- **Cuotas contingentes** (las que dependen de ventas o de un índice): solo las conoce quien lleva el contrato.
