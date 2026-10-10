---
id: 10922
titulo: "Solvencia y endeudamiento"
resumen: "Ratios para saber cuánto debe la empresa frente a lo que es suyo y si puede devolverlo: endeudamiento, autonomía, garantía, deuda financiera neta/EBITDA y cobertura de intereses, con ejemplo y su relación con la causa de disolución."
palabras_clave: [solvencia, endeudamiento, autonomía financiera, ratio de garantía, deuda financiera neta, DFN/EBITDA, cobertura de intereses, patrimonio neto, 170, 520]
aplica_a: [pgc_normal, pgc_pymes, microempresas]
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-1885-6627/art35
  - BOE-A-2007-19884/A6-3
  - BOE-A-2010-10544/a363
otras_fuentes:
  - nombre: "Banco de España, Ratios sectoriales de las sociedades no financieras"
    url: https://app.bde.es/rss_www/
    consultado: 2026-10-10
relacionados: [10911, 10921, 10923, 10912, 10523, 10941, 11021]
consultas_sif: ["balance", "perdidas_y_ganancias", "mayor:170", "mayor:520", "mayor:171"]
---

## En pocas palabras

La solvencia mide si la empresa, en conjunto y a largo plazo, puede hacer frente a todas sus deudas. Se mira por dos lados: **cuánto debe** frente a lo que es suyo (estructura del balance) y **cuántos años tardaría** en devolver la deuda con lo que genera el negocio (deuda frente a EBITDA).

## Cuándo se aplica

Al analizar el cierre, antes de pedir o renovar financiación, al decidir si conviene endeudarse para una inversión (tema 11021) y cuando hay pérdidas que reducen el patrimonio neto (temas 10523 y 10941).

## Cómo se aplica

### Datos del ejemplo

Balance (en euros): activo total 750.000; patrimonio neto 250.000; deudas con bancos a largo 200.000 y a corto 90.000; proveedores 160.000; Hacienda y Seguridad Social 50.000; pasivo total 500.000; tesorería 50.000. De la cuenta de resultados (tema 10912): EBITDA 100.000, EBIT 70.000, gastos financieros 16.000.

### Ratios de estructura

| Ratio | Fórmula | Ejemplo | Resultado |
| --- | --- | --- | ---: |
| Endeudamiento | Pasivo total / patrimonio neto | 500.000 / 250.000 | 2,00 |
| Endeudamiento sobre activo | Pasivo total / activo total | 500.000 / 750.000 | 0,67 |
| Autonomía financiera | Patrimonio neto / pasivo total | 250.000 / 500.000 | 0,50 |
| Garantía (solvencia total) | Activo total / pasivo total | 750.000 / 500.000 | 1,50 |
| Calidad de la deuda | Pasivo corriente / pasivo total | 300.000 / 500.000 | 0,60 |

Lectura: por cada euro propio la empresa debe dos; dos tercios del activo están financiados con deuda. Si vendiera todo a valor contable, cubriría 1,5 veces sus deudas. El 60 % de lo que debe vence en menos de un año, lo que aprieta la liquidez (tema 10921).

### Ratios de capacidad de devolución

| Ratio | Fórmula | Ejemplo | Resultado |
| --- | --- | --- | ---: |
| Deuda financiera neta (DFN) | Deudas con entidades de crédito y otras financieras − tesorería | 200.000 + 90.000 − 50.000 | 240.000 € |
| DFN / EBITDA | DFN / EBITDA | 240.000 / 100.000 | 2,4 años |
| Cobertura de intereses | EBIT / gastos financieros | 70.000 / 16.000 | 4,4 veces |

Lectura: con lo que genera el negocio antes de amortizaciones, tardaría unos 2,4 años en devolver la deuda bancaria si dedicara todo a ello (sin pagar impuestos ni invertir). El beneficio de explotación cubre los intereses 4,4 veces.

La deuda financiera neta solo incluye deudas que generan interés (préstamos, pólizas, leasing, préstamos de socios si los hay). Proveedores, Hacienda y Seguridad Social no entran, aunque son pasivo.

### Cómo interpretarlas

No hay límites legales para estos ratios; son criterios de análisis y de los bancos, que cambian por sector. Orientaciones habituales:

- **Endeudamiento** por encima de 2 o 3 (según sector) empieza a limitar la financiación nueva.
- **DFN/EBITDA** por debajo de 3 suele considerarse cómodo; por encima de 4 o 5, la deuda pesa mucho para lo que genera el negocio. Con EBITDA negativo el ratio no tiene sentido: la empresa no genera para devolver nada.
- **Cobertura de intereses** por debajo de 1,5 significa que casi todo el beneficio de explotación se va en intereses.
- **Garantía** por debajo de 1 quiere decir que el patrimonio neto es negativo: la empresa debe más de lo que tiene.

### La frontera legal: patrimonio neto y capital

Hay un único límite legal ligado a estas cifras: en una sociedad de capital, las pérdidas que dejan el patrimonio neto por debajo de la mitad del capital social son causa de disolución, salvo que se aumente o reduzca el capital o proceda el concurso (Ley de Sociedades de Capital, art. 363.1.e). Con capital de 60.000 euros, la línea está en 30.000 de patrimonio neto. El cálculo del patrimonio neto a estos efectos tiene ajustes propios que se explican en el tema 10523.

### Préstamos de socios

Un préstamo de socios es deuda en el balance, pero el banco puede tratarlo como casi capital si está subordinado. Conviene presentarlo aparte y explicar sus condiciones. Si es participativo, tiene un tratamiento mercantil especial (ver tema 10523).

## Errores frecuentes

- **Comparar endeudamiento entre sectores** sin ajustar: una inmobiliaria y una consultora no tienen nada que ver.
- **Olvidar el leasing** (cuentas 174 y 524) al calcular la deuda financiera neta, o meter el renting, que no es deuda en el balance.
- **Usar el EBITDA de un trimestre** sin anualizar al calcular DFN/EBITDA.
- **Tesorería pignorada** restada de la deuda como si estuviera disponible.
- **No restar la tesorería** o restarla dos veces cuando hay cuentas de crédito con saldo deudor.
- **Analizar solo el endeudamiento** sin la capacidad de devolución: una empresa con mucha deuda y mucho EBITDA puede estar mejor que otra con poca deuda y sin margen.

## Qué revisar en la contabilidad

- Que los subgrupos 17 y 52 recojan toda la deuda financiera, incluidos leasing (174, 524) y préstamos de socios (1633, 163 o 171 según el caso), y que coincidan con los certificados bancarios de saldos al cierre.
- Que los intereses devengados y no vencidos estén registrados (527 o 528) y los gastos financieros (662) cuadren con los cuadros de amortización.
- Que el patrimonio neto se compare con la mitad del capital en cada cierre trimestral si hay pérdidas.
- Evolución del ratio DFN/EBITDA de un año a otro: si sube dos años seguidos, avisar.

## Fuentes

- Código de Comercio, art. 35.1 (separación de activo, pasivo y patrimonio neto; fondos propios).
- PGC, tercera parte, norma 6.ª (clasificación corriente y no corriente del pasivo).
- Ley de Sociedades de Capital, art. 363.1.e (disolución por pérdidas que dejan el patrimonio neto por debajo de la mitad del capital).
- Las fórmulas de los ratios no están en ninguna norma: son convenciones de análisis financiero.
