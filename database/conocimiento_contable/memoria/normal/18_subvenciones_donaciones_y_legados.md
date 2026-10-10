---
id: 31118
modelo: normal
numero: 18
titulo: "Subvenciones, donaciones y legados"
obligatorio: false
cuadros: [desglose_balance, desglose_perdidas_y_ganancias]
datos:
  - clave: importe_caracteristicas
    descripcion: "Importe y características de las subvenciones, donaciones y legados en el balance y de los imputados a resultados"
    tipo: contabilidad
    formato: tabla
  - clave: movimiento_subagrupacion
    descripcion: "Movimiento de la subagrupación del patrimonio neto: saldo inicial, aumentos, disminuciones (imputación a resultados, devoluciones) y saldo final"
    tipo: contabilidad
    formato: tabla
  - clave: origen_ente_concedente
    descripcion: "Origen de cada subvención: ente público concedente y si es Administración local, autonómica, estatal o internacional"
    tipo: gd
    formato: tabla
  - clave: cumplimiento_condiciones
    descripcion: "Cumplimiento o no de las condiciones asociadas a cada subvención, donación o legado"
    tipo: gd
    formato: texto
fuentes: [BOE-A-2007-19884/A18-2]
---
# Subvenciones, donaciones y legados (modelo normal)

Informa de las ayudas recibidas sin contraprestación: subvenciones públicas, donaciones y legados de terceros, y las recibidas de los socios (que tienen tratamiento distinto y van como fondos propios).

## Qué contar y en qué orden

1. **Cuadro de subvenciones**: una fila por subvención significativa, con el ente concedente, la finalidad (inversión en inmovilizado, gastos corrientes, contratación de personal), el importe concedido, lo imputado a resultados en el ejercicio y lo pendiente de imputar.
2. **Movimiento de la subagrupación** "Subvenciones, donaciones y legados recibidos" del patrimonio neto (cuentas 130, 131 y 132): saldo inicial, aumentos (concesiones del año, netas del efecto fiscal), disminuciones (traspasos a resultados por la cuenta 746 o 747, devoluciones) y saldo final. Lo da el SIF a partir del `desglose_balance`.
3. **Subvenciones de explotación** imputadas directamente a resultados (cuenta 740).
4. **Origen**: para cada subvención pública, qué organismo la concede y de qué nivel es (local, autonómico, estatal, internacional; los fondos europeos gestionados por una comunidad autónoma son autonómicos a efectos de quién concede, pero conviene mencionar la financiación europea).
5. **Cumplimiento de condiciones**: si se cumplen las condiciones (mantener la inversión cinco años, mantener empleo, justificar el gasto) y, si alguna está en riesgo, qué efecto tendría (reintegro). Si no se cumplen, la subvención se convierte en deuda (cuenta 172 o 522).

## Cuándo se dice "no aplica"

Si la empresa no ha recibido ninguna subvención, donación ni legado, ni tiene saldo pendiente de imputar de años anteriores, la nota se omite.

## Errores frecuentes

- Llevar toda la subvención de capital a resultados el año que se cobra. Se imputa al mismo ritmo que se amortiza el bien subvencionado.
- Registrar en patrimonio neto el importe bruto sin descontar el efecto impositivo (cuenta 479).
- Clasificar como no reintegrable una subvención cuyas condiciones aún no están razonablemente aseguradas.
- No diferenciar las aportaciones de socios para compensar pérdidas (cuenta 118), que no son subvención.
- Omitir las bonificaciones en cuotas de la Seguridad Social, que también son ayuda pública aunque no pasen por la cuenta 740 en muchas contabilidades.

## Datos difíciles de conseguir

- **Resolución de concesión** de cada subvención, con sus condiciones y plazos: GD.
- **Estado de cumplimiento**: justificaciones presentadas, requerimientos y resoluciones de reintegro; en la GD si se han archivado, si no, preguntar.
- **Calendario de imputación** a resultados, que depende de la amortización del bien subvencionado: lo calcula la contabilidad si se ha vinculado la subvención al elemento.
