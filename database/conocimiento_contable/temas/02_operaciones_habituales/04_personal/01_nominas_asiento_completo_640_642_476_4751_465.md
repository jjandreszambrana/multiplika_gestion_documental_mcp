---
id: 10241
titulo: "Nóminas: asiento completo (640, 642, 476, 4751, 465)"
resumen: "Cómo contabilizar la nómina mensual: sueldo bruto, retención de IRPF, cuota obrera y patronal de la Seguridad Social y pago, con asiento de ejemplo y los tipos de cotización de 2026."
palabras_clave: [nómina, sueldos y salarios, seguridad social a cargo de la empresa, cuota obrera, retención IRPF, 640, 642, 465, 476, 4751, 460, modelo 111]
aplica_a: [pgc_normal, pgc_pymes, microempresas, autonomos]
vigente_desde: 2008-01-01
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/grupo6-2      # PGC, quinta parte, grupo 6 (cuentas 640, 641, 642, 649)
  - BOE-A-2007-19884/grupo4-2      # PGC, quinta parte, grupo 4 (cuentas 460, 465, 476, 4751)
  - BOE-A-2007-19966/grupo6-2      # PGC PYMES, quinta parte, grupo 6
  - BOE-A-2007-19966/grupo4-2      # PGC PYMES, quinta parte, grupo 4
  - BOE-A-2007-19884/A3            # PGC, marco conceptual, 3.º Principios contables (devengo)
  - BOE-A-2026-7296/a4             # Orden PJC/297/2026, tipos de cotización 2026
  - BOE-A-2026-7296/a3-5           # Orden PJC/297/2026, art. 33: desempleo, FOGASA y formación profesional
  - BOE-A-2015-11724/dt-14         # LGSS, DT 43.ª: Mecanismo de Equidad Intergeneracional
  - BOE-A-2007-6820/a80            # Reglamento IRPF, art. 80: retención sobre rendimientos del trabajo
  - BOE-A-2007-6820/a86            # Reglamento IRPF, art. 86: tipo de retención y mínimos
  - BOE-A-2007-6820/a108           # Reglamento IRPF, art. 108: declaración e ingreso de retenciones
otras_fuentes:
  - nombre: "AEAT, Modelo 111. Retenciones e ingresos a cuenta (rendimientos del trabajo y actividades económicas)"
    url: https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GH01.shtml
    consultado: 2026-10-10
relacionados: [10242, 10245, 10262, 10712, 10841, 11111]
consultas_sif: ["mayor:640", "mayor:642", "mayor:465", "mayor:476", "mayor:4751", "sumas_y_saldos"]
---

## En pocas palabras

La nómina se contabiliza en dos partes. Primero, el sueldo bruto se carga en la 640 y se reparte entre lo que se retiene al trabajador (IRPF en la 4751 y su cuota de Seguridad Social en la 476) y lo que se le debe pagar (465). Segundo, la cuota de Seguridad Social que paga la empresa se carga en la 642 con abono a la 476. Cuando se paga, se cancela la 465 contra el banco.

## Cuándo se aplica

En toda empresa o autónomo con trabajadores por cuenta ajena, cada mes. El gasto se registra en el mes en que se devenga el trabajo, aunque se pague después (principio de devengo, PGC, marco conceptual, 3.º). Si la nómina de diciembre se paga en enero, el gasto es de diciembre y la deuda queda en la 465 al cierre.

Los administradores y socios con control tienen reglas propias (tema 10245).

## Cómo se contabiliza

Cuentas que intervienen, según la quinta parte del PGC y del PGC PYMES:

- **640 Sueldos y salarios**: remuneraciones fijas y eventuales, por su importe **íntegro** (bruto), incluidas pagas extra y horas extraordinarias.
- **641 Indemnizaciones**: despidos y jubilaciones anticipadas. No se mezclan con la 640.
- **642 Seguridad Social a cargo de la empresa**: la cuota patronal, con abono a la 476.
- **649 Otros gastos sociales**: comedor, formación, seguros de vida o accidentes del personal.
- **460 Anticipos de remuneraciones**: entregas a cuenta de la nómina del mes. Se descuentan en la nómina abonando la 460.
- **465 Remuneraciones pendientes de pago**: el líquido a pagar al trabajador.
- **476 Organismos de la Seguridad Social, acreedores**: cuota obrera y cuota patronal pendientes de ingresar.
- **4751 Hacienda Pública, acreedora por retenciones practicadas**: el IRPF retenido.

**Tipos de cotización del Régimen General en 2026** (Orden PJC/297/2026, arts. 4 y 33, y LGSS, disposición transitoria 43.ª), para un contrato indefinido:

| Concepto | Empresa | Trabajador |
| --- | --- | --- |
| Contingencias comunes | 23,60 % | 4,70 % |
| Desempleo (contrato indefinido) | 5,50 % | 1,55 % |
| Fondo de Garantía Salarial | 0,20 % | — |
| Formación profesional | 0,60 % | 0,10 % |
| Mecanismo de Equidad Intergeneracional | 0,75 % | 0,15 % |
| Accidentes de trabajo y enfermedades profesionales | según actividad (tarifa de primas) | — |
| **Total sin accidentes** | **30,65 %** | **6,50 %** |

En contratos de duración determinada el desempleo es del 8,30 % (6,70 % empresa y 1,60 % trabajador). Las horas extraordinarias tienen cotización adicional (art. 5 de la Orden). Estos tipos cambian cada año: compruébese la orden de cotización del ejercicio.

**Ejemplo (octubre de 2026)**. Trabajador indefinido con un bruto de 2.000,00 €, retención de IRPF del 12 % y un tipo de accidentes de trabajo del 1,50 % (supuesto; depende del código de actividad).

- Cuota obrera: 2.000,00 × 6,50 % = 130,00 €.
- IRPF: 2.000,00 × 12 % = 240,00 €.
- Líquido a pagar: 2.000,00 − 130,00 − 240,00 = 1.630,00 €.
- Cuota patronal: 2.000,00 × (30,65 % + 1,50 %) = 643,00 €.

Asiento 1. Devengo de la nómina (31/10):

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 640 Sueldos y salarios | 2.000,00 | |
| 4751 H.P., acreedora por retenciones practicadas | | 240,00 |
| 476 Organismos de la Seguridad Social, acreedores | | 130,00 |
| 465 Remuneraciones pendientes de pago | | 1.630,00 |
| **Total** | **2.000,00** | **2.000,00** |

Asiento 2. Cuota patronal del mes (31/10):

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 642 Seguridad Social a cargo de la empresa | 643,00 | |
| 476 Organismos de la Seguridad Social, acreedores | | 643,00 |
| **Total** | **643,00** | **643,00** |

Asiento 3. Pago de la nómina por banco:

| Cuenta | Debe | Haber |
| --- | --- | --- |
| 465 Remuneraciones pendientes de pago | 1.630,00 | |
| 572 Bancos e instituciones de crédito c/c vista, euros | | 1.630,00 |
| **Total** | **1.630,00** | **1.630,00** |

La 476 queda con 773,00 € (130,00 + 643,00), que se pagan en noviembre (tema 10242). La 4751 queda con 240,00 €, que se ingresan con el modelo 111 (tema 10262).

Si el trabajador recibió un anticipo de 300,00 € a mitad de mes, en el asiento 1 se abona además la 460 por 300,00 € y la 465 baja a 1.330,00 €.

## Fiscalidad relacionada

- **IRPF**: la retención se calcula con el procedimiento del art. 86 del Reglamento del IRPF (tipo según la situación personal y familiar). En contratos de duración inferior al año el tipo no puede ser inferior al 2 %.
- **Modelo 111**: las retenciones se declaran e ingresan en los primeros veinte días naturales de abril, julio, octubre y enero (mensualmente en las grandes empresas), y el resumen anual es el modelo 190 (art. 108 del Reglamento del IRPF).

## Errores frecuentes

- Cargar en la 640 el **líquido** en lugar del bruto. La 640 debe cuadrar con el total devengado de los resúmenes de nómina.
- Llevar la cuota obrera a la 642. La 642 es solo la parte de la empresa; la obrera es parte del sueldo (está dentro de la 640).
- Registrar la nómina el día del pago y no el del devengo, sobre todo la de diciembre y las pagas extra prorrateadas.
- Contabilizar las indemnizaciones por despido en la 640 en lugar de la 641.
- Contabilizar los anticipos como gasto en lugar de usar la 460.

## Qué revisar en la contabilidad

- La suma de la 640 del año coincide con el total devengado del resumen anual de nóminas y con lo declarado en el modelo 190.
- La 4751 por rendimientos del trabajo coincide con las retenciones del modelo 111 de cada trimestre.
- La 465 queda a cero, o solo con la nómina del último mes si se paga el mes siguiente.
- La 476 tiene como saldo la liquidación del último mes, no meses acumulados.
- La proporción 642 / 640 debe acercarse, en 2026 y para contratos indefinidos, al 30,65 % más el tipo de accidentes de la actividad (algo más con contratos temporales). Una proporción muy distinta indica bonificaciones, bases topadas, errores o cuotas sin registrar.

## Fuentes

- PGC (RD 1514/2007), quinta parte, grupo 6, cuentas 640 a 649, y grupo 4, cuentas 460, 465, 476 y 4751. Mismo contenido en el PGC PYMES (RD 1515/2007).
- PGC, marco conceptual, 3.º Principios contables: devengo.
- Orden PJC/297/2026, arts. 4 (contingencias comunes) y 33 (desempleo, Fondo de Garantía Salarial y formación profesional).
- Texto refundido de la Ley General de la Seguridad Social, disposición transitoria cuadragésima tercera: Mecanismo de Equidad Intergeneracional (0,90 % en 2026).
- Reglamento del IRPF (RD 439/2007), arts. 80, 86 y 108.
