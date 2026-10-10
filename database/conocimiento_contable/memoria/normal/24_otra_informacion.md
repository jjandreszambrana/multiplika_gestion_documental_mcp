---
id: 31124
modelo: normal
numero: 24
titulo: "Otra información"
obligatorio: true
cuadros: [desglose_perdidas_y_ganancias]
datos:
  - clave: plantilla_media_categorias
    descripcion: "Número medio de personas empleadas en el ejercicio por categorías"
    tipo: manual
    formato: tabla
  - clave: plantilla_sexo_cierre
    descripcion: "Distribución por sexos al cierre por categorías y niveles, incluidos altos directivos y consejeros"
    tipo: manual
    formato: tabla
  - clave: plantilla_discapacidad
    descripcion: "Número medio de personas empleadas con discapacidad igual o superior al 33 % por categorías"
    tipo: manual
    formato: tabla
  - clave: variaciones_nif
    descripcion: "Cotizadas que solo publican cuentas individuales: principales variaciones en patrimonio neto y resultado si se aplicasen las NIIF-UE"
    tipo: manual
    formato: texto
  - clave: honorarios_auditor
    descripcion: "Honorarios del auditor por auditoría y por otros servicios (fiscales y exigidos por normativa por separado), y los de empresas de su red"
    tipo: gd
    formato: tabla
  - clave: acuerdos_fuera_balance
    descripcion: "Naturaleza, propósito e impacto financiero de los acuerdos que no figuran en balance ni en otra nota"
    tipo: manual
    formato: texto
  - clave: unidad_decision_mayor_activo
    descripcion: "Si es la sociedad de mayor activo de una unidad de decisión: descripción de las sociedades, motivo y agregados de activo, pasivo, patrimonio neto, cifra de negocios y resultado"
    tipo: manual
    formato: tabla
  - clave: unidad_decision_otra
    descripcion: "Si pertenece a una unidad de decisión sin ser la de mayor activo: unidad y Registro Mercantil donde están depositadas las cuentas de la de mayor activo"
    tipo: manual
    formato: texto
  - clave: contratos_socios_administradores
    descripcion: "Conclusión, modificación o extinción anticipada de contratos con socios o administradores ajenos al tráfico ordinario o fuera de condiciones normales"
    tipo: gd
    formato: texto
  - clave: periodo_medio_pago
    descripcion: "Periodo medio de pago a proveedores, ratio de operaciones pagadas y pendientes, total de pagos realizados y pendientes, ejercicio y anterior"
    tipo: contabilidad
    formato: tabla
  - clave: facturas_pagadas_en_plazo
    descripcion: "Volumen monetario y número de facturas pagadas en plazo inferior al máximo legal y su porcentaje sobre el total (sociedades que no presentan cuentas abreviadas)"
    tipo: contabilidad
    formato: tabla
fuentes: [BOE-A-2007-19884/A24, BOE-A-2016-1112/a6, BOE-A-2010-10708/datercera]
---
# Otra información (modelo normal)

Nota de cajón con datos muy distintos entre sí, varios de los cuales **la contabilidad no tiene**: plantilla, honorarios del auditor, unidades de decisión. Incluye además, por exigencia de otras normas, el **periodo medio de pago a proveedores**.

## Qué contar y en qué orden

1. **Personal**:
   - número medio de personas empleadas en el año, por categorías (directivos, técnicos, administrativos, comerciales, operarios...);
   - distribución por sexo **al cierre**, por categorías, incluyendo altos directivos y consejeros (los consejeros cuentan aunque no sean trabajadores);
   - número medio de personas con discapacidad igual o superior al 33 %, por categorías.

   El número medio se calcula ponderando por el tiempo trabajado: una persona contratada seis meses a jornada completa cuenta 0,5.
2. **Cotizadas sin consolidadas**: efecto de aplicar las NIIF. Casi nunca aplica.
3. **Honorarios del auditor**, separando auditoría, servicios fiscales, otros servicios exigidos por normativa y resto, más los de empresas de su red.
4. **Acuerdos fuera de balance** significativos (no recogidos en otras notas).
5. **Unidad de decisión**: sociedades controladas por las mismas personas físicas sin formar grupo. La de mayor activo describe el conjunto y da los agregados; las demás dicen a qué unidad pertenecen y dónde está depositada la información.
6. **Contratos con socios o administradores** fuera del tráfico ordinario o de condiciones normales (alta, cambio o extinción anticipada).
7. **Periodo medio de pago a proveedores** (Ley 15/2010 y Resolución del ICAC de 29-1-2016). En el modelo normal, cuadro con periodo medio de pago, ratio de operaciones pagadas, ratio de operaciones pendientes, total de pagos realizados y total de pagos pendientes, del ejercicio y del anterior. Desde la Ley 18/2022, las sociedades que no presentan cuentas abreviadas añaden el volumen y el número de facturas pagadas dentro del plazo legal y su porcentaje sobre el total.

## Cuándo se dice "no aplica"

La nota siempre existe (la plantilla y el periodo medio de pago se informan siempre). Los puntos 2, 4, 5 y 6 solo si se dan. Si no hay auditor, se omite el punto 3.

## Errores frecuentes

- Dar la plantilla al cierre en lugar de la media, o al revés en la distribución por sexo.
- Olvidar a los consejeros en la distribución por sexo.
- Calcular el periodo medio de pago con todas las facturas recibidas: solo cuentan las de proveedores de bienes y servicios incluidos en el pasivo corriente, no las de inmovilizado ni las de Administraciones públicas.
- Confundir unidad de decisión con grupo (ver nota 1).

## Datos difíciles de conseguir

- **Plantilla media por categoría, sexo y discapacidad**: del programa de nóminas o de los informes de plantilla media de la Seguridad Social; el SIF no los tiene.
- **Honorarios del auditor**: carta de encargo o factura en la GD.
- **Periodo medio de pago**: el SIF puede calcularlo si registra las fechas de factura y de pago de cada proveedor; si no, es un cálculo manual sobre el libro de facturas recibidas. No está todavía entre los cuadros del SIF: **[pendiente de pedir]**.
- **Unidad de decisión**: solo la empresa sabe qué otras sociedades controlan sus socios.
