---
id: 10912
titulo: "Cuenta de resultados analítica: margen bruto, EBITDA, EBIT"
resumen: "Cómo reordenar la cuenta de pérdidas y ganancias del PGC en escalones (margen bruto, EBITDA, EBIT, resultado antes y después de impuestos), qué partidas van en cada uno y un ejemplo con cifras."
palabras_clave: [cuenta de pérdidas y ganancias, margen bruto, EBITDA, EBIT, resultado de explotación, cifra de negocios, aprovisionamientos, 70, 60, 64, 68]
aplica_a: [pgc_normal, pgc_pymes, microempresas]
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-1885-6627/art35
  - BOE-A-2007-19884/A7-3
  - BOE-A-2007-19884/cuenta
otras_fuentes:
  - nombre: "Banco de España, Central de Balances"
    url: https://www.bde.es/wbe/es/areas-actuacion/central-balances/
    consultado: 2026-10-10
relacionados: [10911, 10722, 10923, 10931, 10231, 10312]
consultas_sif: ["perdidas_y_ganancias", "sumas_y_saldos"]
---

## En pocas palabras

La cuenta de pérdidas y ganancias del PGC ordena ingresos y gastos por naturaleza. Para explicar el negocio sirve más reordenarla en escalones: lo que queda después de pagar la mercancía (**margen bruto**), después de pagar la estructura (**EBITDA**), después de amortizar (**EBIT**) y después de intereses e impuestos (**resultado neto**). Cada escalón responde a una pregunta distinta.

## Cuándo se aplica

En el informe trimestral o anual al cliente, al comparar con años anteriores o con el sector, cuando un banco pide el EBITDA o la relación deuda/EBITDA, y como base para el punto muerto (tema 10931) y la rentabilidad (tema 10923).

## Cómo se aplica

### Qué dice la norma y qué no

El Código de Comercio (art. 35.2) exige separar los resultados de explotación de los que no lo son y mostrar aparte, al menos, la cifra de negocios, los consumos, el personal, la amortización, los ingresos y gastos financieros y el impuesto. La cifra de negocios se presenta neta de descuentos e IVA. El PGC (tercera parte, norma 7.ª) añade que los ingresos y gastos se clasifican por naturaleza.

**Margen bruto, EBITDA y EBIT no están definidos en el PGC**. Son medidas de análisis. Por eso, cuando se den a un tercero, hay que decir qué se ha incluido en cada una.

### De las cuentas a los escalones

| Escalón | Partidas del modelo del PGC | Cuentas principales |
| --- | --- | --- |
| Ventas netas | 1. Importe neto de la cifra de negocios | 700-705 menos 706, 708, 709 |
| − Consumos | 4. Aprovisionamientos (y 2. variación de existencias de productos) | 60, 61, 71 |
| **= Margen bruto** | | |
| − Personal | 6. Gastos de personal | 64 |
| − Otros gastos de explotación | 7. Otros gastos de explotación | 62, 631, 634, 65, 694, 695 |
| + Otros ingresos de explotación | 5. Otros ingresos de explotación | 75, 740 |
| **= EBITDA** | | |
| − Amortización | 8. Amortización del inmovilizado | 68 |
| ± Deterioros y resultados de inmovilizado | 9, 10 y 11 | 69, 67, 77, 79 |
| **= EBIT (resultado de explotación)** | A.1 | |
| ± Resultado financiero | 12 a 16 | 66, 76 |
| **= Resultado antes de impuestos** | A.3 | |
| − Impuesto | 17 | 630, 633, 638 |
| **= Resultado del ejercicio** | A.5 | 129 |

Matices de criterio: la imputación de subvenciones de inmovilizado (partida 9) y los resultados por venta de inmovilizado (partida 11) suelen dejarse fuera del EBITDA porque no son del negocio ordinario; las dotaciones por deterioro de clientes (694) se suelen dejar dentro, porque cobrar es parte del negocio. Lo importante es aplicar siempre el mismo criterio.

### Ejemplo con cifras

| Concepto | Euros | % sobre ventas |
| --- | ---: | ---: |
| Cifra de negocios | 1.200.000 | 100,0 |
| Consumo de mercaderías | −720.000 | 60,0 |
| **Margen bruto** | **480.000** | **40,0** |
| Gastos de personal | −250.000 | 20,8 |
| Servicios exteriores, tributos y otros | −130.000 | 10,8 |
| **EBITDA** | **100.000** | **8,3** |
| Amortización | −30.000 | 2,5 |
| **EBIT** | **70.000** | **5,8** |
| Gastos financieros | −16.000 | 1,3 |
| **Resultado antes de impuestos** | **54.000** | **4,5** |
| Impuesto sobre beneficios | −13.500 | 1,1 |
| **Resultado del ejercicio** | **40.500** | **3,4** |

Cómo se lee: de cada 100 euros vendidos, 40 quedan tras pagar la mercancía; la estructura (personal y gastos generales) se come 31,6; el negocio genera 8,3 antes de amortizar; tras amortizaciones, intereses e impuestos quedan 3,4. Si el margen bruto baja dos puntos, el EBITDA baja 24.000 euros, casi una cuarta parte.

### Qué pregunta responde cada escalón

- **Margen bruto**: ¿vendo con suficiente diferencia sobre lo que me cuesta? Cambia con precios, descuentos y mermas.
- **EBITDA**: ¿el negocio en sí genera dinero, antes de cómo se ha financiado y de cuánto se amortiza? Es la cifra que miran los bancos.
- **EBIT**: ¿cubre el negocio el desgaste de lo invertido?
- **Resultado neto**: lo que queda para socios y reservas.

## Errores frecuentes

- **Margen bruto con compras en vez de consumo**. Si no se registra la variación de existencias (tema 10231), el margen trimestral sale falso: alto si se compró poco, bajo si se hizo acopio.
- **Gastos mal clasificados** que mueven el EBITDA: alquileres o renting en el 62 frente a leasing (que va a amortización e intereses), trabajos de otras empresas en el 607 o en el 623.
- **Amortización solo anual**. Si se registra en diciembre, el EBIT de los trimestres anteriores está inflado. Conviene periodificarla.
- **Meter el impuesto o extraordinarios en el EBITDA** o presentar un EBITDA "ajustado" sin decir qué se ha quitado.
- **Comparar porcentajes con un sector distinto**: el margen bruto normal de una distribuidora no se parece al de una consultora.

## Qué revisar en la contabilidad

- Que haya asiento de variación de existencias (subgrupos 61 y 71) al menos en cada cierre trimestral que se analice.
- Que la amortización (68) esté registrada por meses o por trimestres, no solo a final de año.
- Que el subgrupo 62 no recoja gastos que son consumos (600, 607) ni de personal (64).
- Que el resultado de la cuenta 129 coincida con el de la cuenta de pérdidas y ganancias.
- Variaciones de más de cinco puntos en el margen bruto entre trimestres: buscar errores de existencias o de facturación.

## Fuentes

- Código de Comercio, art. 35.2 (contenido mínimo de la cuenta de pérdidas y ganancias y concepto de cifra de negocios).
- PGC, tercera parte, norma 7.ª (clasificación por naturaleza) y modelo normal de cuenta de pérdidas y ganancias (correspondencia de partidas y cuentas).
