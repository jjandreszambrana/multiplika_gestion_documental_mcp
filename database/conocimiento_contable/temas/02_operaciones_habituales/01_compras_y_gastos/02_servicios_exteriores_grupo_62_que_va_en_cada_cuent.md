---
id: 10212
titulo: "Servicios exteriores (grupo 62): qué va en cada cuenta"
resumen: "Qué gasto va en cada cuenta del subgrupo 62 (620 a 629), qué no va ahí aunque lo parezca, y cómo se registra una factura de servicios con IVA y retención."
palabras_clave: [servicios exteriores, "62", "621", "622", "623", "624", "625", "626", "627", "628", "629", "410"]
aplica_a: [pgc_normal, pgc_pymes, microempresas]
vigente_desde: 2008-01-01
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2007-19884/grupo6-2
  - BOE-A-2007-19884/grupo4-2
  - BOE-A-2007-19884/A10
  - BOE-A-1992-28740/a96
  - BOE-A-2014-12328/a15
  - BOE-A-2007-6820/a95
  - BOE-A-1992-28740/a90
otras_fuentes: []
relacionados: [10211, 10215, 10252, 10322, 10313, 10262, 10822, 10132]
consultas_sif: ["mayor:621", "mayor:622", "mayor:623", "mayor:624", "mayor:625", "mayor:626", "mayor:627", "mayor:628", "mayor:629", "mayor:410", "sumas_y_saldos"]
---

## En pocas palabras

El subgrupo 62 recoge los servicios que la empresa compra a terceros y que no son existencias ni mayor valor de un inmovilizado. Cada cuenta tiene un contenido definido en el PGC; usarlas bien importa porque el análisis de costes, los ratios y muchas comprobaciones fiscales (alquileres con retención, atenciones a clientes, seguros) se hacen mirando cuenta por cuenta. La contrapartida normal es la 410 (acreedores por prestaciones de servicios), no la 400.

## Cuándo se aplica

A cualquier servicio recibido que no forme parte del precio de adquisición de existencias (subgrupo 60) o del inmovilizado (grupo 2). Ejemplos de lo que no va al 62:

- portes de compras de mercaderías: son mayor coste de la compra (NRV 10.ª, tema 10211);
- honorarios de notario o de ingeniero por comprar o instalar una máquina: mayor valor del inmovilizado;
- intereses de préstamos: grupo 66, gastos financieros;
- seguros de vida o accidentes del personal: gastos de personal (grupo 64);
- impuestos y tasas (IBI, IAE, tasa de basuras): 631 Otros tributos.

## Cómo se aplica

Qué va en cada cuenta, según las definiciones del PGC:

| Cuenta | Qué recoge | Ejemplos |
| --- | --- | --- |
| 620 Gastos en investigación y desarrollo del ejercicio | I+D encargada a otras empresas | Encargo de un estudio técnico a una universidad |
| 621 Arrendamientos y cánones | Alquiler o arrendamiento operativo de muebles e inmuebles; cánones por uso de propiedad industrial | Alquiler del local, renting de vehículos, licencia de marca |
| 622 Reparaciones y conservación | Mantenimiento de bienes del grupo 2 | Reparación de la furgoneta, mantenimiento del ascensor |
| 623 Servicios de profesionales independientes | Honorarios de profesionales y comisiones de agentes independientes | Asesoría, abogado, auditor, notario (no ligado a un activo) |
| 624 Transportes | Transportes por terceros no incluidos en el coste de existencias o inmovilizado | Envíos a clientes, mensajería de ventas |
| 625 Primas de seguros | Seguros que no sean del personal ni de naturaleza financiera | Seguro del local, de responsabilidad civil, de los vehículos |
| 626 Servicios bancarios y similares | Comisiones que no son gastos financieros | Comisión de mantenimiento, de transferencias, TPV |
| 627 Publicidad, propaganda y relaciones públicas | Lo que indica su nombre | Campañas, ferias, regalos promocionales |
| 628 Suministros | Electricidad y otros abastecimientos no almacenables | Luz, agua, gas por red; telefonía e internet (hay quien los lleva en 629: lo importante es ser constante) |
| 629 Otros servicios | Lo no incluido en las anteriores | Limpieza, viajes, cuotas de asociaciones, material de oficina si no se lleva como aprovisionamiento (602) |

El PGC indica que estas cuentas se cargan normalmente con abono a la 410, a cuentas de tesorería (subgrupo 57) o, si hay retención, a la 4751.

**Ejemplo con retención.** Factura de la asesoría del mes: 1.000 € de honorarios, IVA al 21 % (210 €) y retención del IRPF del 15 % (150 €), que es el tipo general para actividades profesionales en 2026 (art. 95.1 del Reglamento del IRPF; 7 % en el año de inicio y los dos siguientes).

| Cuenta | Debe | Haber |
| --- | ---: | ---: |
| 623 Servicios de profesionales independientes | 1.000,00 | |
| 472 Hacienda Pública, IVA soportado | 210,00 | |
| 4751 Hacienda Pública, acreedora por retenciones practicadas | | 150,00 |
| 410 Acreedores por prestaciones de servicios | | 1.060,00 |
| **Total** | **1.210,00** | **1.210,00** |

El gasto es la base (1.000 €). La retención no es menos gasto: es dinero que la empresa paga a Hacienda en nombre del profesional, en el modelo 111 (tema 10262).

## Fiscalidad relacionada

- **IVA no deducible.** No se deduce el IVA de las atenciones a clientes, asalariados o terceros, ni el de alimentos, bebidas y espectáculos, entre otros (art. 96 de la Ley del IVA). Los viajes y la hostelería sí son deducibles si el gasto es deducible en el Impuesto sobre Sociedades o en el IRPF. El IVA no deducible se suma al gasto de la cuenta 62 correspondiente.
- **Atenciones a clientes y proveedores.** En el Impuesto sobre Sociedades son deducibles con el límite del 1 % del importe neto de la cifra de negocios del periodo (art. 15.e de la Ley 27/2014, redacción vigente en 2026). Conviene llevarlas en una subcuenta propia (por ejemplo, 6290001 Atenciones a clientes) para controlar el límite.
- **Retenciones.** Alquileres de locales (621) y profesionales (623) suelen llevar retención; los alquileres se declaran en el modelo 115 y los profesionales en el 111.

## Errores frecuentes

- Usar la 629 como cajón de sastre. Si buena parte del subgrupo 62 está en la 629, la información de costes no sirve.
- Llevar los servicios contra la 400 en lugar de la 410. El PGC reserva la 400 para suministradores de existencias y de servicios del proceso productivo.
- Meter en la 626 los intereses o los gastos de formalización de un préstamo, que son gastos financieros.
- Cargar en la 622 una mejora que alarga la vida útil o aumenta la capacidad de un bien: eso es inmovilizado (tema 10313).
- Contabilizar el alquiler sin la retención, o la retención como gasto.
- Deducir el IVA de regalos de Navidad o comidas con clientes.

## Qué revisar en la contabilidad

- Saldo de la 621 frente a los contratos de alquiler y renting: doce cuotas al año por contrato.
- Los alquileres de locales con retención de la 621 deben cuadrar con la base del modelo 180, y los honorarios con retención de la 623 con la parte de profesionales del modelo 190.
- La 628 tiene que mostrar recibos todos los meses; un mes sin luz o teléfono suele ser una factura sin registrar.
- Subcuenta de atenciones a clientes frente al 1 % de la cifra de negocios (cuentas 700 a 705 menos 706, 708 y 709).
- En la 629, buscar importes repetidos de un mismo acreedor que deberían estar en otra cuenta.
- La 410 no debe tener saldos deudores (pagos sin factura registrada).

## Fuentes

- PGC, quinta parte, grupo 6: definiciones del subgrupo 62 y de las cuentas 620 a 629 (BOE-A-2007-19884/grupo6-2).
- PGC, quinta parte, grupo 4: cuentas 400 y 410 (BOE-A-2007-19884/grupo4-2).
- PGC, NRV 10.ª Existencias, precio de adquisición (BOE-A-2007-19884/A10).
- Ley 37/1992 del IVA, art. 96 (exclusiones del derecho a deducir) y art. 90 (tipo general).
- Ley 27/2014 del Impuesto sobre Sociedades, art. 15.e (límite de atenciones a clientes).
- RD 439/2007, Reglamento del IRPF, art. 95.1 (retención de profesionales).
