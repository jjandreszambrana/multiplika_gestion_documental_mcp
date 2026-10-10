---
id: 31121
modelo: normal
numero: 21
titulo: "Activos no corrientes mantenidos para la venta y operaciones interrumpidas"
obligatorio: false
cuadros: [desglose_balance, desglose_perdidas_y_ganancias]
datos:
  - clave: interrumpidas_resultado
    descripcion: "Por cada actividad interrumpida: ingresos, gastos y resultado antes de impuestos, y su impuesto sobre beneficios"
    tipo: contabilidad
    formato: tabla
  - clave: interrumpidas_flujos
    descripcion: "Flujos netos de explotación, inversión y financiación atribuibles a las actividades interrumpidas"
    tipo: manual
    formato: tabla
  - clave: interrumpidas_elementos
    descripcion: "Elementos patrimoniales afectos a la actividad interrumpida, importe y circunstancias de la clasificación"
    tipo: manual
    formato: tabla
  - clave: interrumpidas_ajustes
    descripcion: "Ajustes de importes presentados en ejercicios anteriores y resultados de actividades que finalmente no se han enajenado"
    tipo: manual
    formato: texto
  - clave: mantenidos_venta_elementos
    descripcion: "Por cada activo o grupo enajenable mantenido para la venta: elementos, importe y circunstancias"
    tipo: contabilidad
    formato: tabla
  - clave: mantenidos_venta_resultado
    descripcion: "Resultado reconocido en pérdidas y ganancias o en patrimonio neto por cada elemento significativo y ajustes de ejercicios anteriores"
    tipo: contabilidad
    formato: tabla
  - clave: posteriores_al_cierre
    descripcion: "Activos que cumplen los requisitos de mantenidos para la venta después del cierre y antes de formular: descripción e importe"
    tipo: manual
    formato: texto
fuentes: [BOE-A-2007-19884/A21-2]
---
# Activos no corrientes mantenidos para la venta y operaciones interrumpidas (modelo normal)

Dos situaciones relacionadas:

- **Activo mantenido para la venta**: un activo no corriente (o un grupo de activos con sus pasivos) que la empresa va a **vender en menos de un año** y no a seguir usando. Se saca de su epígrafe y se presenta en el activo corriente (subgrupo 58).
- **Operación interrumpida**: una línea de negocio o zona geográfica importante que se ha vendido, cerrado o se va a vender. Su resultado se presenta en una línea separada de la cuenta de pérdidas y ganancias.

## Qué contar y en qué orden

**Operaciones interrumpidas**, por cada una:

1. Ingresos, gastos y resultado antes de impuestos, y el impuesto correspondiente.
2. Flujos netos de efectivo de explotación, inversión y financiación de esa actividad.
3. Elementos patrimoniales afectos, con importe y las circunstancias que llevaron a clasificarla así.
4. Ajustes a importes presentados en ejercicios anteriores y, si finalmente no se vendió, los resultados que se presentaron como interrumpidos.

**Activos mantenidos para la venta**, por cada activo o grupo:

5. Descripción, importe y circunstancias (quién compra, cuándo se prevé la venta).
6. Resultado reconocido (en resultados o en patrimonio neto) y ajustes de ejercicios anteriores.

**Hechos posteriores**:

7. Si las condiciones se cumplen después del cierre pero antes de formular, el activo **no** se reclasifica en estas cuentas, pero se describe aquí.

## Cuándo se dice "no aplica"

Si no hay saldo en el subgrupo 58 ni operaciones interrumpidas en la cuenta de pérdidas y ganancias, la nota se omite. Es poco frecuente en pymes.

## Errores frecuentes

- Clasificar como mantenido para la venta un activo cuya venta no es altamente probable (sin comprador, sin precio razonable, sin plan aprobado) solo porque "se quiere vender".
- Seguir amortizando un activo ya clasificado como mantenido para la venta: deja de amortizarse.
- No valorar el activo al menor entre su valor contable y su valor razonable menos costes de venta.
- Presentar como interrumpida una línea pequeña que no es un componente significativo.

## Datos difíciles de conseguir

- **Plan de venta**: acuerdo del órgano de administración, contrato de arras, mandato a una inmobiliaria u oferta firme en la GD.
- **Valor razonable menos costes de venta**: oferta recibida o tasación.
- **Flujos de efectivo** de la actividad interrumpida: casi siempre manual, porque la contabilidad no separa los cobros y pagos por actividad.
