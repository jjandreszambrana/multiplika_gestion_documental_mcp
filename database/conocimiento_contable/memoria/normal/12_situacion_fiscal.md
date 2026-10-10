---
id: 31112
modelo: normal
numero: 12
titulo: "Situación fiscal"
obligatorio: true
cuadros: [desglose_balance, desglose_perdidas_y_ganancias]
datos:
  - clave: conciliacion_base_imponible
    descripcion: "Conciliación del saldo de ingresos y gastos (cuenta de pérdidas y ganancias y patrimonio neto) con la base imponible: impuesto, diferencias permanentes, temporarias con origen en el ejercicio y en anteriores, y compensación de bases negativas"
    tipo: manual
    formato: tabla
  - clave: conciliacion_gasto_impuesto
    descripcion: "Conciliación numérica entre el gasto o ingreso por impuesto y el resultado de aplicar el tipo de gravamen al total de ingresos y gastos reconocidos"
    tipo: manual
    formato: tabla
  - clave: desglose_gasto_impuesto
    descripcion: "Gasto por impuesto: corriente y variación de diferidos, en resultados y en patrimonio neto"
    tipo: contabilidad
    formato: tabla
  - clave: impuestos_diferidos
    descripcion: "Activos por impuesto diferido (diferencias temporarias, bases negativas, otros créditos) y pasivos por impuesto diferido"
    tipo: contabilidad
    formato: tabla
  - clave: creditos_no_registrados
    descripcion: "Diferencias temporarias deducibles, bases imponibles negativas y créditos fiscales no registrados: importe y plazo de aplicación"
    tipo: manual
    formato: tabla
  - clave: evidencia_activos_diferidos
    descripcion: "Evidencia que justifica los activos por impuesto diferido cuando dependen de ganancias futuras o hubo pérdidas recientes"
    tipo: manual
    formato: texto
  - clave: incentivos_fiscales
    descripcion: "Incentivos fiscales aplicados y pendientes (deducciones, bonificaciones, reservas de capitalización o nivelación) y compromisos asumidos"
    tipo: manual
    formato: tabla
  - clave: impuesto_a_pagar
    descripcion: "Impuesto a pagar por jurisdicción, con retenciones y pagos a cuenta"
    tipo: contabilidad
    formato: tabla
  - clave: otras_diferencias_permanentes
    descripcion: "Resto de diferencias permanentes con su importe y naturaleza"
    tipo: manual
    formato: tabla
  - clave: cambios_tipo_impositivo
    descripcion: "Cambios del tipo impositivo frente al año anterior y efecto en los diferidos ya registrados"
    tipo: manual
    formato: texto
  - clave: provisiones_contingencias_fiscales
    descripcion: "Provisiones y contingencias fiscales, cambios normativos posteriores al cierre y ejercicios abiertos a comprobación"
    tipo: gd
    formato: texto
  - clave: otros_tributos
    descripcion: "Circunstancias significativas de otros tributos (IVA, retenciones, tributos locales), contingencias y ejercicios pendientes de comprobación"
    tipo: gd
    formato: texto
fuentes: [BOE-A-2007-19884/A12-3]
---
# Situación fiscal (modelo normal)

Explica la diferencia entre el resultado contable y la base imponible del Impuesto sobre Sociedades, el gasto por impuesto contabilizado y los riesgos fiscales abiertos. Debe cuadrar con el modelo 200 presentado o el que se vaya a presentar.

## Qué contar y en qué orden

**12.1 Impuesto sobre beneficios**

1. **Cuadro de conciliación** del resultado con la base imponible, con el formato del modelo: dos columnas (cuenta de pérdidas y ganancias e ingresos y gastos imputados al patrimonio neto), cada una con aumentos y disminuciones. Filas: saldo de ingresos y gastos, impuesto sobre sociedades, diferencias permanentes, diferencias temporarias (con origen en el ejercicio y en ejercicios anteriores), compensación de bases imponibles negativas, base imponible.
2. **Conciliación del gasto por impuesto** con el resultado de aplicar el tipo de gravamen (25 %, 23 % o el que toque) al resultado antes de impuestos: explica por qué el gasto no es exactamente el tipo por el resultado (deducciones, gastos no deducibles, bases negativas).
3. **Desglose del gasto**: impuesto corriente (cuenta 6300) y variación de diferidos (6301, 633, 638), en resultados y en patrimonio neto.
4. **Impuestos diferidos**: activos (cuenta 474: diferencias temporarias, bases negativas, deducciones pendientes) y pasivos (cuenta 479). Créditos fiscales **no registrados**, con importe y plazo. Evidencia que justifica los registrados si la empresa viene de pérdidas.
5. **Incentivos fiscales** aplicados y pendientes, impuesto a pagar con retenciones y pagos a cuenta (cuentas 473 y 4752), resto de diferencias permanentes, cambios de tipo.
6. **Contingencias fiscales** y **ejercicios abiertos a inspección** (por regla general, los cuatro últimos).

**12.2 Otros tributos**: contingencias de IVA, retenciones, tributos locales y ejercicios abiertos.

## Cuándo se dice "no aplica"

La nota siempre existe. Si no hay diferencias temporarias ni créditos, el cuadro tiene menos filas, pero se presenta.

## Errores frecuentes

- Partir del resultado después de impuestos y olvidar sumar el propio impuesto como diferencia permanente (primera fila de ajustes).
- Que la base imponible de la memoria no coincida con la del modelo 200.
- Registrar activos por bases imponibles negativas sin poder justificar beneficios futuros.
- Tratar como permanente una diferencia que revierte (por ejemplo, amortización acelerada) o al revés.
- No informar de los ejercicios abiertos a inspección.

## Datos difíciles de conseguir

- **Los ajustes extracontables** (gastos no deducibles, amortización fiscal distinta, reserva de capitalización): están en el borrador del modelo 200 o los conoce el asesor fiscal; el SIF no los calcula. Buscar en la GD el modelo 200 del año y del anterior.
- **Bases imponibles negativas pendientes** y su año de origen: en el modelo 200 del ejercicio anterior.
- **Actas, requerimientos o inspecciones** en curso: notificaciones de la AEAT archivadas en la GD.
