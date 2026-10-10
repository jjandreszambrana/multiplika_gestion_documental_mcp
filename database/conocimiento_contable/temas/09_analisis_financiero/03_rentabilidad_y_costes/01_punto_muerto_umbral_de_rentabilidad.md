---
id: 10931
titulo: "Punto muerto (umbral de rentabilidad)"
resumen: "Cuánto hay que vender para no ganar ni perder: separar costes fijos y variables desde la contabilidad, calcular el punto muerto en euros y en unidades, el margen de seguridad y las ventas necesarias para un beneficio objetivo, con ejemplo."
palabras_clave: [punto muerto, umbral de rentabilidad, break-even, costes fijos, costes variables, margen de contribución, margen de seguridad, apalancamiento operativo, subactividad, 60, 64, 62]
aplica_a: [pgc_normal, pgc_pymes, microempresas, autonomos]
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-1885-6627/art35
  - BOE-A-2015-4394/cuaa
otras_fuentes: []
relacionados: [10912, 10923, 10231, 10941, 11011]
consultas_sif: ["perdidas_y_ganancias", "sumas_y_saldos", "mayor:600", "mayor:640"]
---

## En pocas palabras

El punto muerto es la cifra de ventas con la que la empresa cubre todos sus costes y ni gana ni pierde. Por debajo hay pérdidas; por encima, cada euro vendido deja su margen de contribución como beneficio. Se calcula dividiendo los costes fijos entre el porcentaje de margen de contribución.

## Cuándo se aplica

Para responder al gerente "¿cuánto tengo que vender al mes para cubrir gastos?", al estudiar una contratación, un local nuevo o una subida de precios, al preparar el presupuesto anual y cuando las ventas bajan y hay que saber cuánto margen queda antes de entrar en pérdidas.

## Cómo se aplica

### Paso 1: separar costes fijos y variables

- **Variables**: cambian con lo que se vende. Consumo de mercaderías o materias primas (60 y variación de existencias del 61), portes de venta, comisiones de vendedores, envases, la parte de energía ligada a la producción.
- **Fijos**: se pagan se venda o no, al menos a corto plazo. Personal de estructura (64), alquileres (621), seguros (625), asesoría (623), amortización (68), intereses (662), tributos fijos (631).

La contabilidad no hace esta separación: el PGC clasifica por naturaleza, no por comportamiento. Hay que hacerla con criterio y revisarla con el gerente; muchas cuentas son mixtas (suministros, personal con horas extra o temporales) y se reparten por estimación.

En empresas que fabrican, ojo: el coste de las existencias incluye una parte de costes indirectos de fabricación, y la Resolución del ICAC de coste de producción (norma cuarta, apartado 2.b) obliga a llevar a gasto del ejercicio los costes de subactividad, medidos a partir de los costes que no varían a corto plazo con el nivel de producción. Es decir, la propia norma contable reconoce costes fijos de producción; para el punto muerto deben ir en el grupo de fijos aunque contablemente parte de ellos esté en el valor de las existencias.

### Paso 2: calcular

Datos del ejemplo (en euros, año completo):

| Concepto | Importe | Tipo |
| --- | ---: | --- |
| Ventas | 1.200.000 | |
| Consumo de mercaderías | 720.000 | Variable |
| Gastos de personal | 250.000 | Fijo |
| Servicios exteriores, tributos y otros | 130.000 | Fijo |
| Amortización | 30.000 | Fijo |
| Gastos financieros | 16.000 | Fijo |
| **Total costes fijos** | **426.000** | |
| **Resultado antes de impuestos** | **54.000** | |

Comprobación: 1.200.000 − 720.000 − 426.000 = 54.000.

| Medida | Fórmula | Ejemplo | Resultado |
| --- | --- | --- | ---: |
| Margen de contribución | Ventas − costes variables | 1.200.000 − 720.000 | 480.000 € |
| % de margen de contribución | Margen de contribución / ventas | 480.000 / 1.200.000 | 40 % |
| Punto muerto | Costes fijos / % de margen | 426.000 / 0,40 | 1.065.000 € |
| Punto muerto mensual | Punto muerto / 12 | 1.065.000 / 12 | 88.750 € |
| Margen de seguridad | (Ventas − punto muerto) / ventas | 135.000 / 1.200.000 | 11,25 % |

Lectura para el gerente: "Necesitamos vender 88.750 euros al mes para cubrir gastos. Vendemos 100.000; si las ventas bajan más de un 11 %, entramos en pérdidas".

### En unidades

Si la empresa vende un producto principal a 50 euros con un coste variable de 30, el margen unitario es 20 euros. Punto muerto = 426.000 / 20 = 21.300 unidades al año.

### Ventas para un beneficio objetivo

Para ganar 100.000 euros antes de impuestos: (costes fijos + beneficio) / % de margen = (426.000 + 100.000) / 0,40 = 1.315.000 euros de ventas.

### Sensibilidad (apalancamiento operativo)

Con costes fijos altos, pequeñas variaciones de ventas mueven mucho el resultado. Si las ventas bajan un 10 % (120.000 euros), el margen de contribución baja 48.000 (40 % de 120.000) y el resultado pasa de 54.000 a 6.000: cae un 89 %. Esto es lo que se explica al gerente antes de comprometer un coste fijo nuevo: un empleado más de 35.000 euros al año sube el punto muerto en 35.000 / 0,40 = 87.500 euros de ventas.

### Subir precios o bajar costes

Subir el precio un 5 % sin perder ventas lleva el margen de contribución al 42,9 % (los variables pasan a ser 720.000 sobre 1.260.000 = 57,1 %) y baja el punto muerto a unos 994.000 euros (426.000 / 0,4286). Conviene enseñar las dos o tres palancas con números y dejar que el gerente decida.

## Errores frecuentes

- **Tomar las compras en vez del consumo** (sin variación de existencias): el porcentaje de margen sale falso.
- **Meter todo el personal como fijo** en negocios con mucha temporalidad o destajo, o como variable en negocios con plantilla estable.
- **Olvidar la amortización y los intereses**: se calcula un punto muerto "de caja" sin decirlo. Puede hacerse (punto muerto de tesorería, sin amortización, sumando en cambio las cuotas de principal de los préstamos), pero indicándolo.
- **Usar un solo margen** en empresas con productos de márgenes muy distintos: el punto muerto depende de la mezcla de ventas. Mejor calcularlo por línea de negocio.
- **Datos de un trimestre sin anualizar** o en negocios estacionales: el punto muerto mensual no es igual todos los meses.

## Qué revisar en la contabilidad

- Que el consumo de mercaderías incluya la variación de existencias del periodo (subgrupo 61) y los rappels y descuentos (608, 609).
- Que los portes y comisiones de venta estén en cuentas separadas (624, 623) para poder tratarlos como variables.
- Que la amortización y los intereses estén registrados en el periodo analizado, no solo al cierre.
- Cuentas del grupo 6 que mezclen conceptos fijos y variables: proponer subcuentas para separarlos.

## Fuentes

- Código de Comercio, art. 35.2 (cifra de negocios neta de descuentos e IVA, base del cálculo).
- Resolución del ICAC de 14 de abril de 2015, sobre coste de producción, norma cuarta (costes indirectos y costes de subactividad).
- La fórmula del punto muerto no está en ninguna norma: es una herramienta de contabilidad de gestión.
