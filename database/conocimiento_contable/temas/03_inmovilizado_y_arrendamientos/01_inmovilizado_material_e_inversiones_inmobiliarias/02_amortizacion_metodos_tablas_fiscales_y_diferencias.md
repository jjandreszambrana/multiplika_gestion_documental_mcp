---
id: 10312
titulo: "Amortización: métodos, tablas fiscales y diferencias"
resumen: "Cómo calcular y contabilizar la amortización del inmovilizado (681/281), qué métodos admite el PGC, la tabla de coeficientes de la Ley del Impuesto sobre Sociedades, la amortización acelerada de las empresas de reducida dimensión y los ajustes cuando contable y fiscal no coinciden."
palabras_clave: [amortización, vida útil, valor residual, método lineal, tablas de amortización, coeficiente máximo, periodo máximo, libertad de amortización, empresa de reducida dimensión, 681, 281, 2813, 4740]
aplica_a: [pgc_normal, pgc_pymes, microempresas, esfl, autonomos]
vigente_desde: 2015-01-01
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/A2-2
  - BOE-A-2013-2557/segunda
  - BOE-A-2014-12328/a11
  - BOE-A-2014-12328/a12
  - BOE-A-2014-12328/a101
  - BOE-A-2014-12328/a102
  - BOE-A-2014-12328/a103
  - BOE-A-2015-7771/a3
  - BOE-A-2015-7771/a4
otras_fuentes:
  - nombre: AEAT, Manual práctico de Sociedades 2025
    url: https://sede.agenciatributaria.gob.es/Sede/Ayuda/25Manual/200.shtml
    consultado: 2026-10-10
relacionados: [10311, 10313, 10321, 10821, 10824, 10714, 10831]
consultas_sif: ["mayor:681", "mayor:281", "mayor:21", "sumas_y_saldos"]
---

## En pocas palabras

La amortización reparte el coste de un bien entre los años en que se usa. Contablemente se calcula según la **vida útil** real y el **valor residual**, con el método que mejor refleje el desgaste. Fiscalmente, en el Impuesto sobre Sociedades, el gasto deducible tiene un **máximo** que suele salir de la **tabla de coeficientes** del art. 12 de la Ley 27/2014. Si la empresa amortiza más rápido que la tabla, hay un ajuste positivo que se recupera en los años siguientes.

## Cuándo se aplica

A todo el inmovilizado material, a las inversiones inmobiliarias y al intangible de vida útil definida. **No se amortizan** los terrenos (salvo excepciones como canteras o los costes de rehabilitación incluidos en su coste) ni el inmovilizado en curso. La amortización **empieza** cuando el bien está en condiciones de funcionamiento, tras el montaje y las pruebas, y **no se interrumpe** porque el bien esté parado; solo cesa cuando se clasifica como mantenido para la venta o queda totalmente amortizado (norma segunda, apartado 3, de la Resolución del ICAC de 1 de marzo de 2013).

## Cómo se contabiliza

**Cálculo contable** (NRV 2.ª del PGC y Resolución ICAC 2013, norma segunda):

- **Valor amortizable** = coste − valor residual. El valor residual no se tiene en cuenta si no es significativo.
- **Vida útil**: el periodo en que la empresa espera usar el bien, según desgaste, obsolescencia y límites legales. En obras en locales alquilados, la duración del contrato si es menor que la vida económica.
- **Métodos admitidos**: lineal, decreciente o por unidades de producción, el que refleje el patrón de consumo, «con independencia de consideraciones fiscales».
- **Componentes**: cada parte con coste significativo y vida útil distinta se amortiza por separado.
- Vida útil, valor residual y método se **revisan al menos al cierre**; los cambios son cambios de estimación y afectan a los años siguientes, no a los pasados.
- Terreno y edificio son activos separados aunque se compren juntos.

**Ejemplo**. La máquina del tema 10311 cuesta 41.000 €, se estima un valor residual de 1.000 € y una vida útil de 10 años. Entra en funcionamiento el 1 de abril de 2026. Amortización anual lineal: 40.000 / 10 = 4.000 €. En 2026, nueve meses: 3.000 €.

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 681 Amortización del inmovilizado material | 3.000,00 | |
| 2813 Amortización acumulada de maquinaria | | 3.000,00 |
| **Total** | **3.000,00** | **3.000,00** |

La 2813 aparece en el balance restando del valor de la maquinaria. A 31 de diciembre de 2026 el valor neto contable es 41.000 − 3.000 = 38.000 €.

## Fiscalidad relacionada

**Impuesto sobre Sociedades** (texto vigente comprobado en octubre de 2026):

1. **Métodos fiscales** (art. 12.1 Ley 27/2014): tabla de coeficientes lineales; porcentaje constante; números dígitos; plan aprobado por la Administración; o justificar el importe. El más usado es la tabla.
2. **La tabla** fija para cada tipo de elemento un **coeficiente máximo** y un **periodo máximo**. Cualquier coeficiente entre el mínimo (el que sale del periodo máximo) y el máximo es válido (art. 4 del Reglamento, RD 634/2015). Se aplica sobre el valor amortizable, sin el valor residual (art. 3.2 del Reglamento). Algunas líneas de la tabla:

| Elemento | Coeficiente máximo | Periodo máximo |
| --- | --- | --- |
| Edificios industriales | 3 % | 68 años |
| Edificios comerciales, administrativos y viviendas | 2 % | 100 años |
| Maquinaria | 12 % | 18 años |
| Mobiliario | 10 % | 20 años |
| Elementos de transporte externo | 16 % | 14 años |
| Autocamiones | 20 % | 10 años |
| Equipos para procesos de información | 25 % | 8 años |
| Sistemas y programas informáticos | 33 % | 6 años |

   En el ejemplo, 4.000 / 40.000 = 10 % anual, entre el 5,56 % (1/18) y el 12 %: no hay ajuste.
3. **Requisito de contabilización**: un gasto que no se ha llevado a la cuenta de pérdidas y ganancias no es deducible, salvo la libertad de amortización y la amortización acelerada (art. 11.3 Ley 27/2014).
4. **Libertad de amortización** (art. 12.3): entre otros casos, elementos nuevos de valor unitario no superior a **300 €**, con un límite de **25.000 €** por periodo impositivo; y elementos afectos a I+D.
5. **Empresas de reducida dimensión** (cifra de negocios del año anterior inferior a **10 millones de euros**, art. 101): pueden amortizar elementos nuevos con el **doble del coeficiente máximo** de la tabla (art. 103), y tienen libertad de amortización ligada a creación de empleo (120.000 € por cada persona de incremento de plantilla, art. 102).

**Ejemplo de diferencia**. Un ordenador de 3.000 € que la empresa amortiza contablemente en 2 años (1.500 € al año). La tabla permite como máximo el 25 % (750 €). Una empresa que **no** es de reducida dimensión hace un **ajuste positivo de 750 €** en el modelo 200 los años 1 y 2, y un **ajuste negativo de 750 €** los años 3 y 4, cuando ya no hay gasto contable pero queda amortización fiscal pendiente. Es una diferencia temporaria: en el PGC normal y en el PGC PYMES (sin criterios de microempresas) se registra un activo por impuesto diferido en la 4740 por el importe del ajuste multiplicado por el tipo de gravamen (ver 10824 y el tema 6.1.2). Una empresa de reducida dimensión puede aplicar el 50 % (doble del 25 %) y no tiene ajuste.

**Autónomos**: en estimación directa normal se aplican las mismas tablas; en estimación directa simplificada hay una tabla simplificada propia, aprobada por orden ministerial (ver 10831).

## Errores frecuentes

- Empezar a amortizar en la fecha de factura y no en la de puesta en funcionamiento, o amortizar el año completo de un bien que llegó en noviembre.
- Dejar de amortizar un bien parado.
- Amortizar el terreno junto con el edificio.
- Usar el coeficiente fiscal máximo como vida útil contable sin analizar el uso real.
- Seguir amortizando un bien ya totalmente amortizado (la 281 supera el coste).
- Olvidar el ajuste negativo de los años en que se recupera la amortización fiscal pendiente.
- Aplicar la amortización acelerada de reducida dimensión a bienes usados: solo vale para elementos nuevos.

## Qué revisar en la contabilidad

- Que cada cuenta del 21 tenga su amortización acumulada en el 281 y que ninguna 281x supere el saldo de su cuenta del 21.
- Que la 681 del año cuadre con el cuadro de amortizaciones elemento a elemento.
- Altas del año: dotación proporcional desde la puesta en funcionamiento.
- Coeficiente efectivo de cada elemento frente al máximo de la tabla: si lo supera y la empresa no es de reducida dimensión, debe haber ajuste en el modelo 200 y, en su caso, saldo en la 4740.
- Elementos de menos de 300 € dados de alta en el 21: posible libertad de amortización.

## Fuentes

- PGC, NRV 2.ª Inmovilizado material, apartado 2.1 (amortización).
- Resolución del ICAC de 1 de marzo de 2013, norma segunda, apartado 3 (cálculo, inicio y cese de la amortización).
- Ley 27/2014 del Impuesto sobre Sociedades: art. 11.3 (imputación contable), art. 12 (amortizaciones y tabla), arts. 101 a 103 (empresas de reducida dimensión).
- RD 634/2015, Reglamento del Impuesto sobre Sociedades: arts. 3 y 4 (normas comunes y amortización según tabla).
