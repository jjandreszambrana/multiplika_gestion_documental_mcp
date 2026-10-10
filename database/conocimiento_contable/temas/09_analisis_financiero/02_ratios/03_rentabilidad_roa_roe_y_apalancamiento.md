---
id: 10923
titulo: "Rentabilidad: ROA, ROE y apalancamiento"
resumen: "Cómo medir lo que rinde el negocio (ROA) y lo que rinde el dinero de los socios (ROE), descomponerlos en margen, rotación y endeudamiento, y cuándo endeudarse mejora o empeora la rentabilidad, con ejemplos numéricos."
palabras_clave: [rentabilidad, ROA, ROE, rentabilidad económica, rentabilidad financiera, apalancamiento financiero, DuPont, margen, rotación de activos, coste de la deuda]
aplica_a: [pgc_normal, pgc_pymes, microempresas]
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-1885-6627/art35
  - BOE-A-2007-19884/cuenta
otras_fuentes:
  - nombre: "Banco de España, Ratios sectoriales de las sociedades no financieras"
    url: https://app.bde.es/rss_www/
    consultado: 2026-10-10
relacionados: [10911, 10912, 10922, 10931, 11021]
consultas_sif: ["balance", "perdidas_y_ganancias", "mayor:662"]
---

## En pocas palabras

La **rentabilidad económica (ROA)** dice cuánto rinde todo lo que la empresa tiene invertido, se haya pagado con dinero propio o prestado. La **rentabilidad financiera (ROE)** dice cuánto rinde el dinero de los socios. La diferencia entre las dos la explica el **apalancamiento**: endeudarse sube el ROE solo si el negocio rinde más de lo que cuesta la deuda.

## Cuándo se aplica

En el informe anual al cliente, al comparar la empresa con su sector, al estudiar una inversión con financiación (tema 11021) y cuando los socios preguntan si "les compensa" el negocio frente a otras inversiones.

## Cómo se aplica

### Fórmulas y ejemplo

Datos (en euros): activo total 750.000; patrimonio neto 250.000; deuda con coste (préstamos y pólizas) 290.000; cifra de negocios 1.200.000; EBIT 70.000; gastos financieros 16.000; resultado antes de impuestos 54.000; resultado del ejercicio 40.500 (temas 10911 y 10912).

| Ratio | Fórmula | Ejemplo | Resultado |
| --- | --- | --- | ---: |
| ROA (rentabilidad económica) | EBIT / activo total | 70.000 / 750.000 | 9,3 % |
| ROE (rentabilidad financiera) | Resultado del ejercicio / patrimonio neto | 40.500 / 250.000 | 16,2 % |
| ROE antes de impuestos | Resultado antes de impuestos / patrimonio neto | 54.000 / 250.000 | 21,6 % |
| Coste medio de la deuda | Gastos financieros / deuda con coste | 16.000 / 290.000 | 5,5 % |

Se usa el EBIT en el ROA porque es el resultado antes de pagar a quienes financian (bancos y Hacienda): así se mide el negocio sin que influya cómo se ha financiado. Lo ideal es dividir por el activo y el patrimonio neto **medios** del año (inicio más final entre dos); con un solo balance, se usa el del cierre y se dice.

### Descomposición del ROE (método DuPont)

El ROE es el producto de tres palancas, y cada una se gestiona de forma distinta:

| Palanca | Fórmula | Ejemplo | Resultado |
| --- | --- | --- | ---: |
| Margen neto | Resultado del ejercicio / ventas | 40.500 / 1.200.000 | 3,375 % |
| Rotación del activo | Ventas / activo total | 1.200.000 / 750.000 | 1,6 veces |
| Apalancamiento | Activo total / patrimonio neto | 750.000 / 250.000 | 3,0 veces |
| **ROE** | Margen × rotación × apalancamiento | 3,375 % × 1,6 × 3,0 | **16,2 %** |

Lectura para el gerente: la empresa gana poco por cada venta (3,4 céntimos por euro), pero vende 1,6 veces su activo al año y trabaja con mucho dinero ajeno. Mejorar un punto el margen neto (a 4,375 %) subiría el ROE a 21 %; reducir deuda hasta un apalancamiento de 2 lo bajaría a 10,8 % si lo demás no cambiara (en la práctica, menos deuda también ahorra intereses y sube algo el margen).

### Cuándo el apalancamiento ayuda

Ejemplo sencillo, antes de impuestos. Un negocio necesita 100.000 euros de activo.

| Caso | ROA | Financiación | EBIT | Intereses (5 %) | Resultado | ROE |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| A | 10 % | 100.000 propios | 10.000 | 0 | 10.000 | 10 % |
| B | 10 % | 50.000 propios + 50.000 deuda | 10.000 | 2.500 | 7.500 | 15 % |
| C | 4 % | 50.000 propios + 50.000 deuda | 4.000 | 2.500 | 1.500 | 3 % |

Regla: si el ROA es mayor que el coste de la deuda (caso B), la deuda multiplica la rentabilidad del socio. Si es menor (caso C), la deuda la destruye, y además añade riesgo: con un ROA del 2 % el caso C daría pérdidas.

En el ejemplo de la empresa, el ROA (9,3 %) supera al coste de la deuda (5,5 %): el apalancamiento es positivo. Pero el margen es estrecho; con una caída de ventas el ROA bajaría deprisa (ver punto muerto, tema 10931).

### Cómo interpretarlas

- El ROE se compara con lo que el socio podría obtener con riesgo parecido fuera de la empresa. Un ROE inferior al de una inversión sin riesgo indica que el negocio no compensa el riesgo.
- El ROA se compara con el sector (el Banco de España publica rentabilidades sectoriales) y con el coste de la deuda.
- Un ROE alto con patrimonio neto muy pequeño puede ser engañoso: lo infla el apalancamiento, no el negocio. Mirar siempre junto a los ratios de solvencia (tema 10922).

## Errores frecuentes

- **Mezclar numeradores y denominadores**: resultado neto sobre activo, o EBIT sobre patrimonio neto. Cada rentabilidad tiene su pareja.
- **ROE con patrimonio neto negativo**: el porcentaje no significa nada; se dice que no es calculable.
- **Retribuciones de socios mal registradas**: si el socio trabaja y no cobra sueldo, el ROE sale alto porque se le paga en dividendos; si cobra un sueldo muy alto, sale bajo. Hay que explicarlo (tema 10245).
- **Activo inflado** con inmovilizado ocioso o créditos incobrables sin deteriorar: baja el ROA y la rotación.
- **Gastos financieros del leasing o de pólizas** registrados en servicios bancarios (626): bajan el EBIT y suben la cobertura de intereses de forma ficticia.

## Qué revisar en la contabilidad

- Que la cuenta 662 recoja todos los intereses de préstamos, pólizas y leasing, y la 626 solo comisiones.
- Que el resultado del ejercicio (129) esté calculado con el impuesto devengado (6300) y no solo con los pagos fraccionados.
- Activo no afecto al negocio (inmuebles sin uso, préstamos a socios) que convenga separar para calcular el ROA de la actividad.
- Comparar el coste medio de la deuda con los tipos de los contratos: una diferencia grande indica intereses sin registrar o mal clasificados.

## Fuentes

- Código de Comercio, art. 35.1 y 35.2 (estructura del balance y de la cuenta de pérdidas y ganancias, de donde salen los datos).
- PGC, modelo normal de cuenta de pérdidas y ganancias (resultado de explotación, resultado financiero y resultado del ejercicio).
- Las fórmulas de ROA, ROE y apalancamiento no están en ninguna norma: son convenciones de análisis financiero.
