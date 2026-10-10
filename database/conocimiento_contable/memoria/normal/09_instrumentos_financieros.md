---
id: 31109
modelo: normal
numero: 9
titulo: "Instrumentos financieros"
obligatorio: true
cuadros: [desglose_balance, deudas_plazo, desglose_perdidas_y_ganancias]
datos:
  - clave: categorias_activos_financieros
    descripcion: "Valor en libros de los activos financieros por categoría y clase, a largo y a corto plazo (salvo participaciones en grupo, multigrupo y asociadas)"
    tipo: contabilidad
    formato: tabla
  - clave: categorias_pasivos_financieros
    descripcion: "Valor en libros de los pasivos financieros por categoría y clase, a largo y a corto plazo"
    tipo: contabilidad
    formato: tabla
  - clave: valor_razonable_pyg
    descripcion: "Activos y pasivos a valor razonable con cambios en resultados: variación del ejercicio y acumulada, método, derivados y uso de la opción de designación"
    tipo: manual
    formato: texto
  - clave: reclasificaciones
    descripcion: "Reclasificaciones de activos financieros entre categorías: importes, justificación y efecto"
    tipo: manual
    formato: texto
  - clave: compensacion
    descripcion: "Activos y pasivos financieros compensados: importes brutos, compensados y netos"
    tipo: manual
    formato: tabla
  - clave: activos_garantia
    descripcion: "Activos financieros entregados en garantía y activos de terceros recibidos en garantía de los que se puede disponer"
    tipo: gd
    formato: texto
  - clave: deterioro_riesgo_credito
    descripcion: "Movimiento por clase de las correcciones por deterioro por riesgo de crédito"
    tipo: contabilidad
    formato: tabla
  - clave: impagos_incumplimientos
    descripcion: "Préstamos recibidos con impagos o incumplimientos: detalle, valor en libros y si se han subsanado o renegociado antes de formular"
    tipo: gd
    formato: texto
  - clave: deudas_caracteristicas_especiales
    descripcion: "Deudas con características especiales: naturaleza, importe y características"
    tipo: gd
    formato: texto
  - clave: resultados_por_categoria
    descripcion: "Pérdidas y ganancias netas por categoría de instrumentos, resultados por baja de activos a coste amortizado e ingresos y gastos por tipo de interés efectivo"
    tipo: contabilidad
    formato: tabla
  - clave: coberturas
    descripcion: "Coberturas contables: estrategia, instrumentos, valores razonables, eficacia e importes en patrimonio neto y resultados"
    tipo: manual
    formato: texto
  - clave: valor_razonable_jerarquia
    descripcion: "Valor razonable por clase frente al valor en libros, nivel de jerarquía 1, 2 o 3, técnicas, variables y sensibilidad"
    tipo: manual
    formato: tabla
  - clave: empresas_grupo_asociadas
    descripcion: "Participaciones en empresas del grupo, multigrupo y asociadas: denominación, domicilio, forma jurídica, actividad, porcentajes de capital y voto, patrimonio neto y resultado, valor en libros, dividendos, deterioros, notificaciones del art. 155 LSC"
    tipo: gd
    formato: tabla
  - clave: compromisos_activos_financieros
    descripcion: "Compromisos firmes de compra y venta de activos financieros y otras circunstancias sustantivas (litigios, embargos)"
    tipo: manual
    formato: texto
  - clave: lineas_descuento_polizas
    descripcion: "Importe disponible en líneas de descuento y pólizas de crédito con su límite y parte dispuesta"
    tipo: gd
    formato: tabla
  - clave: deudas_garantia_real
    descripcion: "Importe de las deudas con garantía real, con su forma y naturaleza"
    tipo: gd
    formato: tabla
  - clave: riesgos_cualitativo
    descripcion: "Para riesgo de crédito, liquidez y mercado: exposición, origen, objetivos, políticas y métodos de gestión y medición"
    tipo: manual
    formato: texto
  - clave: vencimientos_cinco_anos
    descripcion: "Pasivos financieros que vencen en cada uno de los cinco años siguientes y resto hasta el último vencimiento, por partida del balance"
    tipo: gd
    formato: tabla
  - clave: riesgo_credito_cuantitativo
    descripcion: "Riesgo de crédito: definiciones de incumplimiento, antigüedad de la deuda en mora, deterioros, exposición máxima y garantías"
    tipo: manual
    formato: tabla
  - clave: sensibilidad_mercado
    descripcion: "Análisis de sensibilidad a tipos de interés, de cambio y otros precios y concentraciones de riesgo"
    tipo: manual
    formato: texto
  - clave: transferencias_activos
    descripcion: "Cesiones de activos financieros que no se han dado de baja (factoring con recurso, descuento): naturaleza, riesgos retenidos y valores en libros"
    tipo: gd
    formato: tabla
  - clave: fondos_propios
    descripcion: "Fondos propios: número y nominal de acciones o participaciones por clase, desembolsos pendientes, ampliaciones en curso, capital autorizado, restricciones de reservas, acciones propias, socios con 10 % o más y opciones sobre acciones propias"
    tipo: gd
    formato: tabla
fuentes: [BOE-A-2007-19884/A9-3]
---
# Instrumentos financieros (modelo normal)

La nota más larga del modelo normal. Cubre todos los activos y pasivos financieros (clientes, préstamos concedidos, inversiones, deudas con bancos, proveedores) y además los **fondos propios** (9.5). Su objetivo es que el lector entienda cuánto pesan en la empresa y qué riesgos traen.

## Qué contar y en qué orden

1. **Cuadros de categorías** (9.2.1.a): activos y pasivos financieros por categoría (coste amortizado, valor razonable con cambios en resultados, en patrimonio neto, coste) y por clase (instrumentos de patrimonio, valores de deuda, créditos y derivados, deudas con entidades de crédito...), a largo y corto plazo, ejercicio y anterior. Salen de `desglose_balance` y `deudas_plazo`; la asignación de cada cuenta a una categoría la propone el programa y la confirma el contable.
2. **Otra información del balance**: reclasificaciones, compensaciones, activos en garantía, movimiento del deterioro de clientes (cuentas 490 y 694/794), **impagos de préstamos** y deudas especiales.
3. **Resultados** (9.2.2): ganancias y pérdidas por categoría e intereses por tipo de interés efectivo.
4. **Coberturas y valor razonable** (9.2.3.1 y 9.2.3.2): solo si existen derivados de cobertura o instrumentos a valor razonable.
5. **Empresas del grupo, multigrupo y asociadas** (9.2.3.3): una ficha por participada.
6. **Otra información** (9.2.3.4): compromisos, **pólizas de crédito y líneas de descuento** con su límite y lo dispuesto, y **deudas con garantía real**.
7. **Riesgos** (9.3): explicación de los riesgos de crédito, liquidez y mercado y cómo se gestionan, con su información cuantitativa. Aquí va el cuadro de **vencimientos de los pasivos financieros en cada uno de los cinco años siguientes y el resto**.
8. **Transferencias de activos** no dadas de baja (9.4).
9. **Fondos propios** (9.5): capital por clases, desembolsos pendientes, acciones propias, restricciones de reservas, socios con un 10 % o más.

## Cuándo se dice "no aplica"

La nota siempre existe (toda empresa tiene clientes, tesorería o deudas). Los bloques 4, 5 y 8 se omiten si no hay operaciones. La norma 10.ª permite no rellenar lo que no sea significativo.

## Errores frecuentes

- Calcular los vencimientos año a año con el saldo a largo y corto del balance. **El SIF solo separa largo y corto plazo**: los importes que vencen en el año 2, 3, 4, 5 y más de 5 salen de los cuadros de amortización de los préstamos (en la GD) o los da el contable. Son datos `gd`, no contables.
- Meter la tesorería, las Administraciones públicas (subgrupo 47) o los anticipos de clientes en los cuadros de categorías: los saldos con Hacienda y Seguridad Social no son instrumentos financieros.
- Olvidar las pólizas de crédito no dispuestas, que también se informan.
- Poner "no hay riesgos significativos" sin más en la nota 9.3.

## Datos difíciles de conseguir

- **Cuadros de amortización** de préstamos y leasing (para los vencimientos) y **escrituras de hipoteca** (garantías reales): GD.
- **Límites de las pólizas** de crédito y de las líneas de descuento: contratos en la GD o certificado bancario.
- **Datos de las participadas** (patrimonio neto, resultado): sus propias cuentas, que pueden no estar formuladas a tiempo.
- **Libro registro de socios** para la composición del capital: GD.
