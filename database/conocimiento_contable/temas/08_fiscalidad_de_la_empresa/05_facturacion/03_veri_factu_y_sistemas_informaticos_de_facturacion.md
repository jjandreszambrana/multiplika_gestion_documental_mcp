---
id: 10853
titulo: "Veri*Factu y sistemas informáticos de facturación"
resumen: "Qué exige el Reglamento de sistemas de facturación (RD 1007/2023): a quién afecta, fechas (sociedades antes del 1-1-2027, resto antes del 1-7-2027), modalidad VERI*FACTU o no, registros encadenados, QR, declaración responsable del fabricante y sanciones del art. 201 bis LGT."
palabras_clave: [Veri*Factu, VERIFACTU, SIF, sistemas informáticos de facturación, RD 1007/2023, Ley Antifraude, código QR, hash, registro de facturación, declaración responsable, 201 bis, software de facturación]
aplica_a: [pgc_normal, pgc_pymes, microempresas, esfl, autonomos]
vigente_desde: 2023-12-07
revisado: 2026-10-10
revisado_por: pendiente
fuentes:
  - BOE-A-2023-24840/df-4
  - BOE-A-2023-24840/a1
  - BOE-A-2023-24840/a3
  - BOE-A-2023-24840/a4
  - BOE-A-2023-24840/a7
  - BOE-A-2023-24840/a8
  - BOE-A-2023-24840/a9
  - BOE-A-2023-24840/a1-3
  - BOE-A-2023-24840/a1-4
  - BOE-A-2023-24840/a1-5
  - BOE-A-2023-24840/a1-6
  - BOE-A-2023-24840/a1-7
  - BOE-A-2023-24840/a1-8
  - BOE-A-2023-24840/a1-9
  - BOE-A-2003-23186/a29
  - BOE-A-2003-23186/a2-2
  - BOE-A-2012-14696/a6
  - BOE-A-1992-28925/a62
otras_fuentes:
  - nombre: "AEAT, Sistemas Informáticos de Facturación (SIF) y VERI*FACTU"
    url: https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu.html
    consultado: 2026-10-10
  - nombre: "Orden HAC/1177/2024, de 17 de octubre, especificaciones técnicas, funcionales y de contenido (BOE-A-2024-22138)"
    url: https://www.boe.es/buscar/act.php?id=BOE-A-2024-22138
    consultado: 2026-10-10
relacionados: [10851, 10852, 10834, 10123, 10862]
consultas_sif: ["libro_facturas_emitidas"]
---

## En pocas palabras

Desde la Ley Antifraude de 2021, los programas que usan las empresas y los autónomos para hacer facturas deben impedir que se borren o se cambien facturas sin dejar rastro (art. 29.2.j de la Ley General Tributaria). El Reglamento aprobado por el RD 1007/2023 concreta cómo: cada factura genera un **registro** encadenado al anterior con una huella digital (*hash*), la factura lleva un **código QR** y el programa guarda un registro de eventos. Hay dos formas de cumplir: enviar cada registro a la AEAT al momento (**modalidad VERI\*FACTU**) o guardarlos firmados en el propio sistema para entregarlos si la AEAT los pide. Según el texto vigente, las sociedades deben tener el programa adaptado **antes del 1 de enero de 2027** y el resto (autónomos y demás) **antes del 1 de julio de 2027**.

## Cuándo se aplica

**A quién** (art. 3 del Reglamento), si usan un programa informático para facturar, aunque solo sea para parte de la actividad:

- contribuyentes del **Impuesto sobre Sociedades** (salvo las entidades totalmente exentas del art. 9.1 de su Ley; las parcialmente exentas, solo por sus operaciones sujetas y no exentas);
- contribuyentes del **IRPF con actividades económicas**;
- no residentes con establecimiento permanente;
- **comunidades de bienes** y demás entidades en atribución de rentas con actividad.

También obliga a los **fabricantes y vendedores** de esos programas.

**A quién no**: a quienes llevan los libros del IVA por el **SII** (art. 3.3, en relación con el art. 62.6 del Reglamento del IVA). Tampoco se aplica a las facturas de ciertas operaciones excluidas (art. 4), entre ellas las que expide el destinatario o un tercero cuando el obligado lleva el SII, y las de establecimientos permanentes en el extranjero. Quien hace las facturas a mano o con un procesador de textos sin funciones de facturación no está usando un "sistema informático de facturación" en el sentido del art. 1.2, aunque conviene revisar cada caso con la AEAT.

**Fechas** (disposición final cuarta, en la redacción del Real Decreto-ley 15/2025, de 2 de diciembre, vigente al consultar el BOE el 10 de octubre de 2026):

| Quién | Sistema adaptado antes de |
| --- | --- |
| Contribuyentes del Impuesto sobre Sociedades | 1 de enero de 2027 |
| Resto de obligados (autónomos, comunidades de bienes, no residentes con establecimiento permanente) | 1 de julio de 2027 |
| Fabricantes de programas | Nueve meses desde la entrada en vigor de la orden ministerial de especificaciones (Orden HAC/1177/2024) |

Estas fechas ya se han cambiado varias veces (RD 254/2025 y Real Decreto-ley 15/2025). Antes de dar una fecha a un cliente, compruébese la disposición final cuarta vigente.

## Cómo se aplica

**Qué tiene que hacer el programa** (arts. 8 a 12):

- Generar un **registro de alta** automáticamente al expedir cada factura (art. 9), con los datos de la factura, y un **registro de anulación** si se emitió por error (art. 11).
- **Encadenar** los registros con una huella o *hash*, de modo que se pueda seguir la secuencia del primero al último y cualquier alteración se detecte (art. 8.2.b y art. 12).
- **No permitir** modificar ni borrar registros: cualquier corrección se hace con un registro posterior (art. 8.2.a). En la práctica, una factura emitida no se edita; se rectifica o se anula con su registro (tema 10852).
- Llevar un **registro de eventos** (accesos, errores, exportaciones...) consultable desde el propio sistema (art. 8.3).
- Conservar los registros durante el plazo de la Ley General Tributaria y poder exportarlos (art. 8.2.c).
- Incluir en cada factura un **código QR** y, si se envían los registros a la AEAT, la frase "Factura verificable en la sede electrónica de la AEAT" o "VERI\*FACTU" (art. 6.5 del Reglamento de facturación).

**Dos modalidades:**

| | VERI\*FACTU | No VERI\*FACTU |
| --- | --- | --- |
| Envío a la AEAT | Cada registro, de forma automática e inmediata (art. 16.1) | No se envía; se conserva |
| Firma electrónica de cada registro | No hace falta; basta el *hash* (art. 16.3) | Obligatoria (art. 12) |
| Requisitos del art. 8 | Se presumen cumplidos (art. 16.2) | Hay que cumplirlos y poder demostrarlo |
| Acceso de la AEAT | Ya tiene los datos | Puede personarse y pedir copia de registros y eventos (art. 14) |
| Leyenda en la factura | "VERI\*FACTU" | Solo QR |

Elegir VERI\*FACTU es automático en cuanto se empiezan a enviar los registros, y obliga hasta el final de ese año natural (art. 16.5). La AEAT ofrece una **aplicación gratuita** que funciona siempre en modalidad VERI\*FACTU (arts. 7.b y 16.4).

**Declaración responsable** (art. 13): el fabricante debe declarar por escrito, de forma visible en el programa y en cada versión, que cumple el Reglamento. El usuario puede pedirla y conviene guardarla.

**El cliente** puede leer el QR y enviar los datos a la AEAT para comprobar la factura (art. 17).

## Fiscalidad relacionada

- **Sanciones** (art. 201 bis de la Ley General Tributaria, infracción grave):
  - **Usuario**: tener un programa no certificado cuando debería estarlo, o alterado, se sanciona con **50.000 euros por ejercicio**.
  - **Fabricante o vendedor**: comercializar programas que permitan llevar contabilidades distintas, ocultar o alterar operaciones o que no cumplan las especificaciones, **150.000 euros** por ejercicio y por tipo de programa; **1.000 euros** por cada programa vendido sin el certificado obligatorio.
- Veri\*Factu no sustituye a los libros registro ni al SII (tema 10834), ni a la factura electrónica obligatoria entre empresarios (art. 8 bis del Reglamento de facturación; tema 8.5.4, pendiente).

## Errores frecuentes

- Pensar que un autónomo o una pequeña sociedad queda fuera por ser pequeña: el criterio es usar un programa para facturar, no el tamaño.
- Pensar que con el SII también hay que adaptarse a Veri\*Factu: quien lleva el SII queda fuera.
- Seguir con programas que permiten borrar o renumerar facturas emitidas.
- Facturar con una hoja de cálculo con fórmulas y numeración automática creyendo que no es un sistema de facturación: depende de lo que haga (art. 1.2); revisar el caso.
- No pedir al proveedor del programa la declaración responsable.
- Dar por buenas fechas antiguas (2025 o 2026), que se aplazaron.

## Qué revisar en la contabilidad

- Que la numeración de facturas emitidas no tenga huecos ni repeticiones: con un sistema adaptado, cada hueco debe tener su registro de anulación.
- Que las facturas emitidas desde la fecha de adaptación lleven el QR (y la leyenda si es VERI\*FACTU).
- Que las rectificaciones se hagan con facturas rectificativas y no editando la original.

## Fuentes

- RD 1007/2023, Reglamento de requisitos de los sistemas de facturación (BOE-A-2023-24840): arts. 1, 3 y 4, 7 a 9, 11 a 14, 15 a 17 y disposición final cuarta.
- Ley 58/2003 General Tributaria (BOE-A-2003-23186): art. 29.2.j y art. 201 bis.
- Reglamento de facturación, RD 1619/2012 (BOE-A-2012-14696): art. 6.5.
- Reglamento del IVA, RD 1624/1992 (BOE-A-1992-28925): art. 62.6.
- Fuente: Agencia Estatal Boletín Oficial del Estado. Texto consolidado de carácter informativo, consultado el 10-10-2026.
