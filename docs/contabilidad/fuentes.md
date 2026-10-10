# Fuentes de la biblioteca contable

Investigación, 2026-10-10. De dónde sale la información de los temas ([estructura-temas.md](estructura-temas.md)), qué se puede reutilizar legalmente y cómo se mantiene al día. Lo marcado **[COMPROBAR]** no se ha podido confirmar del todo.

## Criterio general

1. **Solo fuentes oficiales** como base: normas (BOE), doctrina del ICAC, de la Dirección General de Tributos y del TEAC, y publicaciones de la AEAT y del Banco de España.
2. **Redactamos nosotros**: cada tema es un texto propio, explicado y con ejemplos, que **cita** la norma y el artículo. Solo se copia literal un fragmento corto de norma cuando la redacción exacta importa (un límite, un plazo).
3. **Nunca se copia de editoriales, blogs ni academias** (CEF, Supercontable, Iberley, Wolters Kluwer, Lefebvre...). Su contenido tiene derechos de autor y, además, no es fuente primaria. Pueden servir para ver qué dudas son frecuentes, nada más.
4. Cada tema guarda en `fuentes` qué consultó, con enlace y fecha de consulta.

## Nivel 1: normas (BOE)

**Qué se puede hacer**: el aviso legal del BOE permite reutilizar sus documentos para fines comerciales y no comerciales, incluido modificarlos y crear obras derivadas. Condiciones:

- citar "Fuente: Agencia Estatal Boletín Oficial del Estado";
- no desnaturalizar el sentido;
- dar la fecha de actualización;
- no aparentar que es oficial. En legislación consolidada hay que avisar de que es informativa.

Quedan fuera las obras de la Biblioteca Jurídica Digital (los "códigos" electrónicos), que son CC BY-NC-ND: no se usan.

**API de datos abiertos** (comprobada el 2026-10-10, sin clave, JSON o XML):

- `GET https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/{id}/metadatos`: título y `fecha_actualizacion` de la versión consolidada.
- `.../id/{id}/texto/indice` y `.../id/{id}/texto/bloque/{id_bloque}`: índice de la norma y el texto de un artículo concreto. Sirve para citar el artículo exacto sin bajar la norma entera.
- `GET .../legislacion-consolidada?from=aaaammdd&to=aaaammdd`: normas modificadas entre dos fechas. Es la base del aviso de cambios (ver "Mantenimiento").

Normas base, con su identificador comprobado contra la API:

| Norma | Identificador BOE | Para qué áreas |
| --- | --- | --- |
| RD 1514/2007, Plan General de Contabilidad | BOE-A-2007-19884 | 1-7 |
| RD 1515/2007, PGC de Pymes (y criterios de microempresas) | BOE-A-2007-19966 | 1-7 |
| RD 1/2021, modificación del PGC (instrumentos financieros e ingresos) | BOE-A-2021-1350 | 2, 4 |
| RD 1159/2010, Normas de formulación de cuentas anuales consolidadas | BOE-A-2010-14621 | 12 |
| RD 1491/2011, adaptación del PGC a entidades sin fines lucrativos | BOE-A-2011-18458 | 12 |
| Código de Comercio (arts. 25-49: libros y cuentas anuales) | BOE-A-1885-6627 | 1, 7 |
| RDL 1/2010, Ley de Sociedades de Capital (cuentas anuales, depósito, auditoría, reservas) | BOE-A-2010-10544 | 5, 7 |
| Ley 37/1992 del IVA | BOE-A-1992-28740 | 8.1 |
| RD 1624/1992, Reglamento del IVA | BOE-A-1992-28925 | 8.1 |
| Ley 27/2014 del Impuesto sobre Sociedades | BOE-A-2014-12328 | 6, 8.2 |
| RD 634/2015, Reglamento del Impuesto sobre Sociedades | BOE-A-2015-7771 | 8.2 |
| Ley 35/2006 del IRPF | BOE-A-2006-20764 | 8.3, 8.4 |
| RD 439/2007, Reglamento del IRPF | BOE-A-2007-6820 | 8.3, 8.4 |
| RD 1619/2012, Reglamento de facturación | BOE-A-2012-14696 | 8.5 |
| RD 1007/2023, Reglamento Veri\*Factu | BOE-A-2023-24840 | 8.5 |
| Ley 58/2003 General Tributaria | BOE-A-2003-23186 | 8.6 |
| Ley 3/2004 de morosidad (plazos de pago) | BOE-A-2004-21830 | 10.3 |
| Ley 18/2022 de creación y crecimiento de empresas (factura electrónica, plazos) | BOE-A-2022-15818 | 8.5, 10.3 |

Faltan por localizar: Ley 22/2015 de Auditoría de Cuentas (para los límites de auditoría también vale la LSC, art. 263) y las órdenes con los modelos de depósito de cuentas en el Registro Mercantil (Ministerio de Justicia; cambian cada pocos años).

## Nivel 2: doctrina

### ICAC (Instituto de Contabilidad y Auditoría de Cuentas)

Las **resoluciones** desarrollan el PGC y son de obligado cumplimiento. Están **en el BOE**, así que se reutilizan con las condiciones del BOE. Identificadores comprobados:

| Resolución | Identificador BOE | Tema |
| --- | --- | --- |
| 1 de marzo de 2013 | BOE-A-2013-2557 | Inmovilizado material e inversiones inmobiliarias |
| 28 de mayo de 2013 | BOE-A-2013-5827 | Inmovilizado intangible |
| 18 de septiembre de 2013 | BOE-A-2013-9945 | Deterioro del valor de los activos |
| 14 de abril de 2015 | BOE-A-2015-4394 | Coste de producción |
| 9 de febrero de 2016 | BOE-A-2016-1564 | Impuesto sobre beneficios |
| 5 de marzo de 2019 | BOE-A-2019-3422 | Presentación de instrumentos financieros y aspectos mercantiles (capital, reservas, dividendos...) |
| 10 de febrero de 2021 | BOE-A-2021-2155 | Reconocimiento de ingresos |

Las **consultas del BOICAC** (boletín trimestral del ICAC) resuelven casos concretos. No obligan, pero son el criterio que sigue cualquier auditor. **Ojo**: solo están en la web del ICAC (icac.gob.es), y su aviso legal **prohíbe reproducir, copiar o redifundir** su contenido sin autorización, salvo para uso personal. Por tanto:

- se leen para entender el criterio;
- el tema lo explica con nuestras palabras y cita "Consulta n.º X del BOICAC n.º Y", sin copiar el texto;
- **[DECIDIR]** si se pide autorización al ICAC para reproducir fragmentos. No hace falta para empezar.

### Dirección General de Tributos (DGT): consultas vinculantes

Buscador PETETE: https://petete.tributos.hacienda.gob.es/consultas. Las consultas vinculantes obligan a la Administración en casos iguales. Son la mejor fuente para los grises fiscales (deducibilidad de gastos, IVA de operaciones concretas). Están en un dominio del Ministerio de Hacienda, cuyo aviso legal sigue el régimen general de reutilización del sector público (citar la fuente, no desnaturalizar y dar la fecha). **[COMPROBAR]** el aviso legal propio de PETETE. Se citan por número (p. ej. "V1234-25").

### TEAC (Tribunal Económico-Administrativo Central)

Base DYCTEA (doctrina y criterios). Las resoluciones que fijan doctrina obligan a la AEAT. Se usan para los temas de procedimientos y discrepancias. **[COMPROBAR]** dirección y aviso legal.

## Nivel 3: guías de la AEAT

- **Manuales prácticos**: IVA 2026 ya publicado (PDF y HTML), Sociedades, Renta y Patrimonio. Se publican cada año en https://sede.agenciatributaria.gob.es/Sede/manuales-practicos.html. Son la explicación oficial "para humanos" de cada impuesto, con ejemplos. Son la mejor base para redactar los temas del área 8.
- **INFORMA**: preguntas frecuentes de la AEAT, muy útil para casos concretos de IVA.
- **Calendario del contribuyente** del año: base del tema 8.6.1 y, más adelante, de los avisos de plazos.
- **Instrucciones de los modelos** (303, 390, 349, 347, 111, 115, 130, 200, 202...).

**Reutilización**: la página "Condiciones de reutilización" de la AEAT autoriza reutilizar la información de su web en la modalidad básica, sin condiciones específicas (art. 8.1 del RD 1495/2011). No prohíbe el uso comercial. Las condiciones generales son: citar la fuente, no desnaturalizar el sentido, dar la fecha de última actualización, no dar a entender que la AEAT patrocina o apoya el producto y conservar los metadatos. La página de "Propiedad intelectual" protege el diseño y el código de la web, no la información. Aun así se sigue el criterio general: redacción propia y cita.

## Nivel 4: datos para el análisis financiero

- **Banco de España, base de Ratios Sectoriales de las Sociedades no Financieras (RSE)**: gratuita en línea. 29 ratios por sector de actividad, tamaño y país, con su distribución (cuartiles), para situar a una empresa frente a su sector. Base del tema 9.2.5 y de la comparación sectorial de "Más adelante" en [planificacion.md](planificacion.md). También está BExplora (Central de Balances por comunidad y provincia). **[COMPROBAR]** las condiciones de reutilización del Banco de España y si hay descarga en un formato que se pueda leer por programa.
- **INE**: IPC (actualizar rentas y presupuestos) y estadísticas por sector.
- **Registro Mercantil (Colegio de Registradores)**: modelos oficiales de depósito de cuentas. Las cuentas de otras empresas son de pago y no se usan.

## Nivel 5: financiación pública

Webs oficiales de **ICO** (líneas de mediación), **ENISA** (préstamos participativos) y **CDTI** (I+D+i), más los institutos autonómicos (p. ej. Andalucía TRADE). Cambian a menudo. Los temas de 10.2.2 explican **qué es cada organismo y cómo funciona**, sin listar las líneas abiertas, y remiten a la web oficial para lo vigente.

## Mantenimiento

Lo fiscal cambia cada año y a veces a mitad de año (la Ley del IVA se actualizó el 7 de octubre de 2026, según la API del BOE). Hace falta un sistema, no confiar en la memoria:

1. **Actualización semanal de los artículos** (automática). Un script nuestro hace esto:
   1. Pregunta a la API del BOE qué normas se han modificado esa semana (`?from=...&to=...`) y se queda con las que tenemos en `normativa/`.
   2. Baja el índice de cada una (`texto/indice`), que trae la `fecha_actualizacion` de cada artículo, y vuelve a bajar (`texto/bloque/{id_bloque}`) solo los artículos guardados cuya fecha ha cambiado. Así, que cambie una ley de 300 artículos no obliga a revisar los 300.
   3. Si cambió, guarda la versión nueva, conserva la anterior con sus fechas de vigencia y marca como "pendiente de revisar" los temas que la citan (`citado_por`).
   4. Si un artículo ha sido derogado, lo marca y avisa.
   5. Deja todo en un commit con el resumen de lo cambiado. Se sube con el despliegue de siempre.

   Los artículos se sustituyen solos porque son texto literal. Los temas no se reescriben solos: se revisan.
2. **Revisión anual** (enero, cuando salen los nuevos manuales de la AEAT y el calendario del contribuyente): se revisan todos los temas del área 8 y los que tengan cifras (tipos, límites, plazos).
3. **Caducidad**: un tema con `revisado` de hace más de 12 meses sale en un listado. La IA avisa al usarlo.
4. **Preguntas sin respuesta**: cuando la IA no encuentra un tema, lo anota (como ya hace `anotar_pregunta_pendiente_gd`). Esa lista dice qué temas faltan, en orden de lo que piden los clientes.

## Quién valida

Un tema escrito por la IA a partir de fuentes oficiales puede tener errores de interpretación. Para un producto que asesora a empresas, cada tema debería pasar por un contable antes de publicarse (`revisado_por`).

**Decidido (usuario, 2026-10-10)**: los revisa **otro agente de IA de otra plataforma**. Un modelo distinto no comparte los mismos fallos que el que redactó, así que sirve de segunda mirada.

Cómo se hace:

1. Se le pasa el tema junto con las fuentes que cita (el artículo exacto, sacado de la API del BOE).
2. Se le pide que compruebe tres cosas: que cada afirmación sale de la fuente citada, que las cifras (tipos, límites, plazos) son las del año del tema y que el asiento de ejemplo cuadra y usa las cuentas correctas.
3. Lo que señale se corrige aquí y se vuelve a pasar hasta que no haya objeciones.
4. En `revisado_por` se anota la plataforma y el modelo con la fecha (p. ej. `ia:<plataforma>/<modelo> 2026-10-20`).

Hasta entonces, los temas salen como "no revisado" y la IA lo dice al usarlos.

## Fuentes consultadas para este documento

- [Aviso legal del BOE](https://www.boe.es/informacion/aviso_legal/index.php)
- [API de datos abiertos del BOE](https://www.boe.es/datosabiertos/api/api.php) (e identificadores comprobados contra ella el 2026-10-10)
- [Aviso legal del ICAC](https://www.icac.gob.es/aviso-legal)
- [Condiciones de reutilización de la AEAT](https://sede.agenciatributaria.gob.es/Sede/gobierno-abierto/reutilizacion-informacion/condiciones-reutilizacion.html) y [Propiedad intelectual de la AEAT](https://sede.agenciatributaria.gob.es/Sede/condiciones-uso-sede-electronica/aviso-legal/propiedad-intelectual.html)
- [Manual práctico de IVA 2026](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/manual-iva-2026/presentacion.html) y [manuales prácticos de la AEAT](https://sede.agenciatributaria.gob.es/Sede/manuales-practicos.html)
- [PETETE, consultas de la DGT](https://petete.tributos.hacienda.gob.es/consultas)
- [Folleto de la Central de Balances del Banco de España](https://repositorio.bde.es/bitstream/123456789/15159/1/Folleto_CB.pdf)
