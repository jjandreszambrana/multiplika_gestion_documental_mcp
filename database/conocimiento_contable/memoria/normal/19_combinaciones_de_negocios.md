---
id: 31119
modelo: normal
numero: 19
titulo: "Combinaciones de negocios"
obligatorio: false
cuadros: [desglose_balance]
datos:
  - clave: identificacion_combinacion
    descripcion: "Para cada combinación del ejercicio: empresa o negocio adquirido, fecha de adquisición y forma jurídica (fusión, escisión, compra de negocio)"
    tipo: gd
    formato: texto
  - clave: razones_fondo_comercio
    descripcion: "Razones de la combinación y factores cualitativos que originan el fondo de comercio"
    tipo: manual
    formato: texto
  - clave: contraprestacion
    descripcion: "Valor razonable de la contraprestación total y por clase (efectivo, activos, contingente, deuda, instrumentos de patrimonio) y participaciones previas"
    tipo: gd
    formato: tabla
  - clave: activos_pasivos_adquiridos
    descripcion: "Importes reconocidos en la adquisición por cada clase de activos y pasivos, señalando los no valorados a valor razonable"
    tipo: contabilidad
    formato: tabla
  - clave: contraprestacion_contingente
    descripcion: "Contraprestación contingente y activos por indemnización: importe, descripción, rango de resultados e importe máximo"
    tipo: gd
    formato: texto
  - clave: cuentas_cobrar_adquiridas
    descripcion: "Cuentas a cobrar adquiridas: valor razonable, importe contractual bruto y lo que no se espera cobrar"
    tipo: manual
    formato: tabla
  - clave: fondo_comercio_deducible
    descripcion: "Fondo de comercio surgido (información de la nota 7.2) e importe que se espera fiscalmente deducible"
    tipo: manual
    formato: numero
  - clave: relacion_preexistente
    descripcion: "Relaciones previas entre adquirente y adquirida: descripción, importe y método de cancelación"
    tipo: manual
    formato: texto
  - clave: diferencia_negativa
    descripcion: "Exceso del valor de los activos netos sobre el coste reconocido en resultados y razones"
    tipo: manual
    formato: texto
  - clave: combinacion_por_etapas
    descripcion: "Combinaciones por etapas: valor razonable de la participación previa y resultado por su revalorización"
    tipo: manual
    formato: tabla
  - clave: ingresos_resultado_aportados
    descripcion: "Ingresos y resultado aportados desde la adquisición y los proforma como si se hubiera adquirido al inicio del ejercicio"
    tipo: manual
    formato: tabla
  - clave: posteriores_al_cierre
    descripcion: "Combinaciones efectuadas o en curso entre el cierre y la formulación"
    tipo: gd
    formato: texto
  - clave: ajustes_provisionales
    descripcion: "Valoraciones provisionales, ajustes del periodo de valoración, impuestos diferidos y cambios en la contraprestación contingente"
    tipo: manual
    formato: texto
fuentes: [BOE-A-2007-19884/A19-2, BOE-A-2007-19884/A7-4]
---
# Combinaciones de negocios (modelo normal)

Solo procede si en el ejercicio (o en ejercicios anteriores con efectos todavía abiertos) la empresa ha **adquirido el control de un negocio**: fusión, escisión, aportación de rama de actividad o compra de un conjunto de activos y pasivos que forma un negocio. Comprar una máquina o un local no es combinación de negocios; comprar un taller completo con su clientela y su personal, sí.

## Qué contar y en qué orden

1. **Identificación** de cada combinación: qué se ha adquirido, cuándo (fecha de toma de control, no la de la escritura si difieren) y cómo (fusión por absorción, compra de negocio, escisión).
2. **Razones** y factores que explican el fondo de comercio (sinergias, clientela, personal formado).
3. **Contraprestación** a valor razonable, total y por clases: efectivo, otros activos, contraprestación contingente, deuda asumida, acciones emitidas (con su número y cómo se han valorado).
4. **Activos y pasivos reconocidos** por clase, en la fecha de adquisición. El SIF puede dar los saldos que entraron con el asiento de la combinación, pero la valoración a valor razonable es del contable.
5. **Fondo de comercio** resultante (con remisión a la nota 7.2) y la parte fiscalmente deducible; o la **diferencia negativa** llevada a resultados, con su justificación.
6. **Casos especiales**: contraprestación contingente, cuentas a cobrar adquiridas, relaciones previas, combinaciones por etapas.
7. **Ingresos y resultado** aportados por el negocio adquirido desde la compra, y los que habría habido si se hubiera comprado el 1 de enero.
8. **Combinaciones posteriores al cierre** y **ajustes de valoraciones provisionales** de combinaciones de años anteriores.

## Cuándo se dice "no aplica"

En la mayoría de ejercicios no hay ninguna combinación y la nota se omite. Si la hubo el año anterior con valoración provisional, este año puede haber que informar de los ajustes (punto 8).

## Errores frecuentes

- Tratar como combinación de negocios una fusión entre empresas del mismo grupo: tiene reglas propias (norma 21.ª, operaciones entre empresas del grupo) y no genera fondo de comercio nuevo.
- Reconocer como fondo de comercio la diferencia sin haber valorado antes los intangibles identificables (marcas, cartera de clientes).
- Usar la fecha de la escritura cuando el control se tomó antes.

## Datos difíciles de conseguir

- **Proyecto de fusión, escritura, contrato de compraventa** y anexos: GD.
- **Informe de valoración** (asignación del precio): experto independiente.
- **Resultados proforma**: solo los puede calcular la dirección con la contabilidad del negocio adquirido.
