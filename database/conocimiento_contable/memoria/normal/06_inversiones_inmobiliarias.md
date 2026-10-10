---
id: 31106
modelo: normal
numero: 6
titulo: "Inversiones inmobiliarias"
obligatorio: false
cuadros: [inversiones_inmobiliarias, desglose_perdidas_y_ganancias]
datos:
  - clave: movimiento_inversiones_inmobiliarias
    descripcion: "Cuadro de movimientos con amortización y deterioro, con el mismo contenido que exige la nota 5"
    tipo: contabilidad
    formato: tabla
  - clave: descripcion_inmuebles
    descripcion: "Descripción de los inmuebles clasificados como inversiones inmobiliarias, tipos y destino"
    tipo: gd
    formato: texto
  - clave: ingresos_gastos_explotacion
    descripcion: "Ingresos que generan y gastos de su explotación, separando los inmuebles que generan ingresos de los que no"
    tipo: contabilidad
    formato: tabla
  - clave: restricciones
    descripcion: "Restricciones a la realización de las inversiones, al cobro de sus ingresos o al de los recursos de su venta, con importes"
    tipo: gd
    formato: texto
  - clave: obligaciones_contractuales
    descripcion: "Obligaciones contractuales de adquisición, construcción, desarrollo, reparaciones, mantenimiento o mejoras"
    tipo: gd
    formato: texto
fuentes: [BOE-A-2007-19884/A6-4, BOE-A-2007-19884/A5-4]
---
# Inversiones inmobiliarias (modelo normal)

Solo existe si la empresa tiene terrenos o edificios que no usa para su actividad sino para **alquilarlos o esperar a venderlos con plusvalía** (subgrupo 22). Una nave propia en la que la empresa fabrica es inmovilizado material; un local que alquila a un tercero es inversión inmobiliaria.

## Qué contar y en qué orden

1. **Toda la información de la nota 5** aplicada a estos bienes, empezando por el cuadro de movimientos (coste, amortización acumulada de la cuenta 282, deterioro de la cuenta 292), que da el SIF (`inversiones_inmobiliarias`). Se puede remitir a la nota 5 en lo que sea idéntico, pero el cuadro va aquí.
2. **Descripción de los inmuebles**: qué son (locales, viviendas, solares), dónde están y a qué se destinan (alquiler, plusvalía, sin uso decidido).
3. **Ingresos y gastos**: ingresos por arrendamientos (cuenta 752) y gastos de explotación de esos inmuebles (IBI, comunidad, reparaciones, seguros, amortización). El modelo pide **separar** los inmuebles que generan ingresos de los que no. El SIF da los totales por cuenta; el reparto por inmueble solo es posible si la contabilidad usa subcuentas o centros de coste por inmueble.
4. **Restricciones**: limitaciones para vender, cobrar las rentas o disponer del dinero de la venta (hipotecas, pactos, embargos).
5. **Obligaciones contractuales** pendientes: compra, construcción, reformas o mantenimiento comprometidos.

## Cuándo se dice "no aplica"

Si la empresa no tiene saldo en el subgrupo 22 ni lo tuvo el año anterior, la nota no se incluye (o se indica "La sociedad no posee inversiones inmobiliarias"). Por eso no es obligatoria.

## Errores frecuentes

- Mantener en inmovilizado material un inmueble que ha dejado de usarse y se alquila. El cambio de uso es un traspaso entre los subgrupos 21 y 22 y debe aparecer en ambos cuadros.
- Presentar los ingresos por alquiler como cifra de negocios cuando no es la actividad ordinaria de la empresa (o al revés, en una empresa patrimonial cuya actividad sí es alquilar).
- No separar terreno y construcción, igual que en la nota 5.
- Olvidar que los gastos de inmuebles vacíos también deben informarse.

## Datos difíciles de conseguir

- **Destino** de cada inmueble y si genera ingresos: preguntar o deducir de los contratos de arrendamiento que haya en la GD.
- **Restricciones y obligaciones**: escrituras, contratos de obra y contratos de arrendamiento en la GD.
- **Gastos por inmueble**: si la contabilidad no los separa, hay que pedir al contable un reparto razonable y decir en el texto cómo se ha hecho.
