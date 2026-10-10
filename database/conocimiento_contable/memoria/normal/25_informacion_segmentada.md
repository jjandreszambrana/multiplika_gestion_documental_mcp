---
id: 31125
modelo: normal
numero: 25
titulo: "Información segmentada"
obligatorio: false
cuadros: [desglose_perdidas_y_ganancias]
datos:
  - clave: cifra_negocios_actividades
    descripcion: "Importe neto de la cifra de negocios por categorías de actividades"
    tipo: contabilidad
    formato: tabla
  - clave: cifra_negocios_mercados
    descripcion: "Importe neto de la cifra de negocios por mercados geográficos"
    tipo: contabilidad
    formato: tabla
  - clave: puede_omitir
    descripcion: "Si la empresa puede formular cuenta de pérdidas y ganancias abreviada y opta por omitir la nota"
    tipo: manual
    formato: si_no
fuentes: [BOE-A-2007-19884/A25]
---
# Información segmentada (modelo normal)

Reparte la **cifra de negocios** entre las actividades y los mercados geográficos de la empresa, cuando unos y otros son claramente distintos. Es una nota corta y casi siempre numérica.

## Qué contar y en qué orden

1. **Comprobar si procede**. Dos filtros:
   - las empresas que pueden formular **cuenta de pérdidas y ganancias abreviada** pueden omitirla. Muchas empresas que presentan balance y memoria normales pueden, sin embargo, presentar la cuenta de pérdidas y ganancias abreviada, porque sus límites son más altos (véase el tema de la biblioteca sobre límites de los modelos de cuentas);
   - solo hay que desglosar si las categorías de actividad o los mercados **difieren entre sí de forma considerable** en la forma de vender o de prestar el servicio. Una empresa con una sola actividad que vende en un solo país no tiene nada que segmentar.
2. **Cuadro por actividades**: importe neto de la cifra de negocios (subgrupo 70, neto de devoluciones y rappels de las cuentas 706, 708 y 709) del ejercicio y del anterior, por categoría: por ejemplo, venta de productos, servicios de mantenimiento, instalación.
3. **Cuadro por mercados geográficos**: mismo importe por zona: nacional, Unión Europea, resto del mundo, o un detalle más fino si es relevante.

Ambos cuadros deben sumar la cifra de negocios de la cuenta de pérdidas y ganancias.

## Cuándo se dice "no aplica"

Si la empresa puede presentar la cuenta de pérdidas y ganancias abreviada y decide omitir la nota, o si no tiene actividades ni mercados considerablemente distintos. En el segundo caso es preferible una frase explicándolo antes que omitir la nota sin más.

## Errores frecuentes

- Que la suma de los cuadros no coincida con la cifra de negocios (por olvidar descuentos sobre ventas o los "otros ingresos" que no son cifra de negocios).
- Meter en la cifra de negocios ingresos accesorios (alquileres esporádicos, cuenta 752) o subvenciones de explotación (cuenta 740).
- Repetir sin más el desglose de la nota 13 (desagregación de ingresos). Pueden coincidir, pero el criterio de esta nota es actividad y mercado geográfico.

## Datos difíciles de conseguir

- **Desglose por actividad o mercado** cuando las ventas están en una sola cuenta: el SIF solo lo da si la contabilidad usa subcuentas por actividad o por mercado (por ejemplo, 7000 nacional, 7001 intracomunitaria, 7002 exportación). Si no, salen del programa de facturación o de los modelos de IVA (303, 349) como aproximación por mercado.
- **Si la empresa puede presentar cuenta de pérdidas y ganancias abreviada**: lo decide el cálculo de los límites de dos ejercicios consecutivos, que está en la biblioteca.
