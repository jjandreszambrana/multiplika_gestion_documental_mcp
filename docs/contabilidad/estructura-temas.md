# Estructura de la biblioteca contable

Propuesta, 2026-10-10. Cómo se organiza el conocimiento del asesor contable y financiero para que la IA cargue solo lo que necesita. Ver [planificacion.md](planificacion.md) (fase 1) y [fuentes.md](fuentes.md).

## Los cuatro niveles

| Nivel | Nombre en el código | Qué es | Ejemplo |
| --- | --- | --- | --- |
| 1 | Área (índice) | Gran materia | 3. Inmovilizado y arrendamientos |
| 2 | Bloque (subíndice) | Parte de un área | 3.2 Arrendamientos |
| 3 | Capítulo | Grupo de temas muy relacionados | 3.2.1 Arrendamiento financiero |
| 4 | Tema | La unidad que la IA lee. Responde a una pregunta concreta | Leasing: contabilización por el arrendatario |

Solo los temas tienen contenido. Los niveles 1 a 3 solo tienen título y un resumen de una línea, que es lo que devuelve `indice_contable_gd`. **El capítulo es opcional** (cambio al implementar, 2026-10-10): si un bloque no necesita agruparse, sus temas cuelgan directamente de él, como en todo el primer lote. Así no hay un paso de navegación que no aporta nada.

### Cómo navega la IA

Pregunta: "¿cómo contabilizo un leasing de una furgoneta?"

1. **Atajo** (lo normal): `buscar_temas_contables_gd("leasing")` devuelve 3 temas con su ruta. Abre el del arrendatario. Unos 1.800 tokens en total.
2. **Bajando niveles** (si la búsqueda no da nada claro): índice (12 áreas, unos 400 tokens), área 3 (4 bloques, 150), bloque 3.2 (3 capítulos, 120), capítulo 3.2.1 (3 temas, 120) y tema (1.500). Unos 2.300 tokens.
3. Si el tema remite a otro (p. ej. "IVA de las cuotas de leasing"), lo abre solo si la pregunta lo necesita.

Cargar la biblioteca entera serían unos 270.000 tokens. Con este sistema, cada consulta carga menos del 1 %.

## Identificadores

Siguiendo la regla de siempre (identificador autonumérico, nunca derivado de un texto que se pueda editar), cada nodo lleva un **número fijo** (`id`) que no cambia aunque se renombre o se mueva de sitio. La numeración "3.2.1" que se ve es solo la posición, se calcula al cargar y puede cambiar al reordenar. Las propuestas (`gd_conta_propuestas.id_tema`), los enlaces entre temas y las respuestas de la IA guardan el `id`, nunca la posición.

Rangos para que se vea a simple vista qué es cada número: áreas 1-99, bloques 100-999, capítulos 1000-9999, temas 10000 en adelante. Al crear un nodo se toma el siguiente libre de su rango. Un script de comprobación avisa si hay dos iguales.

## En el disco

```
database/conocimiento_contable/
  temas/                                ← capa 1: explicaciones propias
    03_inmovilizado/                    ← área (prefijo = orden, no identificador)
      _nodo.md                          ← id, título y resumen del área
      02_arrendamientos/
        _nodo.md
        01_arrendamiento_financiero/
          _nodo.md
          01_leasing_arrendatario.md    ← tema
          02_leasing_arrendador.md
  normativa/                            ← capa 2: artículos literales del BOE
    BOE-A-1992-28740/                   ← una carpeta por norma (Ley del IVA)
      _norma.md                         ← título, identificador, fecha de la última versión
      a95.md                            ← artículo vigente
      a95.2025-01-01.md                 ← versión anterior, con sus fechas de vigencia
  doctrina/                             ← capa 3: consultas DGT citadas (resumen propio)
    DGT-V1234-25.md
```

El prefijo numérico de carpetas y ficheros de `temas/` solo da el orden. Renombrar un fichero no rompe nada porque manda el `id` de dentro.

En `normativa/` y `doctrina/` el nombre sí es el identificador, pero no es un texto editable: es el que da el propio BOE (norma y bloque del artículo) o la DGT (número de consulta), y no cambia nunca.

Un artículo guardado (`a95.md`):

```markdown
---
norma: BOE-A-1992-28740
titulo_norma: Ley 37/1992, de 28 de diciembre, del Impuesto sobre el Valor Añadido
articulo: Artículo 95. Limitaciones del derecho a deducir en relación con los bienes de inversión
id_bloque: a95                    # el de la API del BOE (texto/bloque/{id_bloque})
fecha_actualizacion: 19971231     # la del propio artículo en el índice de la API (texto/indice)
descargado: 2026-10-12
url: https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740#a95
citado_por: [10301, 10302]        # temas que lo usan (lo rellena el script)
---
(texto literal del artículo)

Fuente: Agencia Estatal Boletín Oficial del Estado. Texto consolidado de carácter informativo.
```

Comprobado el 2026-10-10: el índice de la API (`texto/indice`) trae cada artículo con su `id` (`a95`) y su propia `fecha_actualizacion`. El artículo 95 de la Ley del IVA no cambia desde 1997, aunque la ley entera se actualizó el 7 de octubre de 2026. **[COMPROBAR]** que ese `id` coincide con el ancla `#a95` de la web en todas las normas.

## Formato de un tema

Cabecera (frontmatter YAML) y cuerpo en Markdown. Entre **600 y 1.200 palabras**: un tema más largo se parte en dos.

```markdown
---
id: 10231
titulo: Leasing: contabilización por el arrendatario
resumen: Cómo registrar un arrendamiento financiero (leasing) en el PGC y PGC PYMES, con asiento de ejemplo y su IVA.
palabras_clave: [leasing, arrendamiento financiero, opción de compra, cuotas, 174, 524]
aplica_a: [pgc_normal, pgc_pymes]          # pgc_normal | pgc_pymes | microempresas | esfl | autonomos
vigente_desde: 2008-01-01
revisado: 2026-10-10
revisado_por: pendiente                     # quién lo validó (ver fuentes.md)
fuentes:                                    # lo que se guarda en normativa/ o doctrina/
  - BOE-A-2007-19884/nrv8                   # PGC, NRV 8.ª Arrendamientos
  - BOE-A-1992-28740/a95                    # Ley del IVA, art. 95
otras_fuentes:                              # lo que solo se cita, no se guarda
  - nombre: Manual práctico de IVA 2026, capítulo 8
    url: https://sede.agenciatributaria.gob.es/...
    consultado: 2026-10-10
relacionados: [10232, 10240, 10512]
consultas_sif: [mayor:174, mayor:524]       # qué mirar en la contabilidad real (fase 3)
---

# Leasing: contabilización por el arrendatario

## En pocas palabras
Dos o tres frases con la respuesta.

## Cuándo se aplica
Criterios para saber si el caso es este y no otro (p. ej. leasing frente a renting).

## Cómo se contabiliza
Pasos y **asiento de ejemplo con números** (furgoneta de 30.000 €, 48 cuotas...).

## Fiscalidad relacionada
IVA, deducibilidad en el Impuesto sobre Sociedades o en el IRPF... Breve, con enlace al tema fiscal si existe.

## Errores frecuentes
Lo que se suele hacer mal y cómo detectarlo.

## Qué revisar en la contabilidad
Comprobaciones concretas que la IA puede hacer con los datos del SIF (fase 3), p. ej. "la 174 y la 524 deben sumar el capital pendiente del cuadro de amortización".

## Fuentes
Norma y artículo, con el texto exacto citado solo cuando haga falta.
```

Por qué cada campo:

- `resumen`: lo único que ve la IA en el índice y en la búsqueda. Tiene que bastar para decidir si abre el tema.
- `palabras_clave`: lo que busca `buscar_temas_contables_gd`. Incluye números de cuenta y siglas (SII, 303, NRV...).
- `aplica_a`: para no aplicar un criterio del PGC normal a una microempresa que usa criterios simplificados, o al revés.
- `revisado`: la IA avisa si tiene más de 12 meses. Un script lista los temas caducados.
- `consultas_sif`: une cada tema con la contabilidad real. Es la base de las revisiones automáticas de la fase 4.
- `fuentes`: obligatorio. Un tema sin fuente no se publica.

## El árbol completo

P1 = primer lote (fase 1, unos 50 temas, el día a día de una asesoría). P2 = segundo lote. P3 = cuando haga falta. Unos 180 temas en total.

### 1. Marco contable y obligaciones

- **1.1 Normas que se aplican**
  - 1.1.1 Qué plan aplicar: PGC normal, PGC PYMES y criterios de microempresas (límites y cuándo se cambia) — P1
  - 1.1.2 Marco conceptual: principios contables y criterios de valoración — P2
  - 1.1.3 Jerarquía de normas: PGC, resoluciones del ICAC, consultas BOICAC — P2
- **1.2 Libros y obligaciones formales**
  - 1.2.1 Libros obligatorios (Código de Comercio) y libros registro fiscales — P1
  - 1.2.2 Legalización de libros en el Registro Mercantil — P2
  - 1.2.3 Conservación de libros y documentos (plazos mercantiles y fiscales) — P1
- **1.3 El cuadro de cuentas**
  - 1.3.1 Estructura del cuadro de cuentas (grupos 1 a 9) — P1
  - 1.3.2 Cuentas que más se confunden (p. ej. 600/602/629, 410/400, 523/173) — P1
  - 1.3.3 Grupos 8 y 9: ingresos y gastos imputados al patrimonio neto — P3

### 2. Operaciones habituales

- **2.1 Compras y gastos**
  - 2.1.1 Compras de mercaderías y materias primas: descuentos, rappels, devoluciones, portes — P1
  - 2.1.2 Servicios exteriores (grupo 62): qué va en cada cuenta — P1
  - 2.1.3 Facturas recibidas de otros países: intracomunitarias e importaciones (asiento) — P1
  - 2.1.4 Anticipos a proveedores — P2
  - 2.1.5 Gastos sin factura y tickets: qué se puede contabilizar y deducir — P1
- **2.2 Ventas e ingresos**
  - 2.2.1 Ventas y prestaciones de servicios: cuándo se reconoce el ingreso (Resolución ICAC 2021) — P1
  - 2.2.2 Descuentos, rappels y devoluciones de ventas — P1
  - 2.2.3 Anticipos de clientes — P2
  - 2.2.4 Ingresos por obra o servicios de larga duración (grado de avance) — P2
  - 2.2.5 Facturas rectificativas: contabilización — P1
- **2.3 Existencias**
  - 2.3.1 Variación de existencias al cierre — P1
  - 2.3.2 Métodos de valoración (precio medio, FIFO) y coste de producción — P2
  - 2.3.3 Deterioro de existencias — P2
- **2.4 Personal**
  - 2.4.1 Nóminas: asiento completo (640, 642, 476, 4751, 465) — P1
  - 2.4.2 Seguros sociales y su pago — P1
  - 2.4.3 Anticipos y préstamos al personal; dietas y kilometraje — P2
  - 2.4.4 Indemnizaciones por despido — P2
  - 2.4.5 Retribución de administradores y socios trabajadores — P1
- **2.5 Tesorería y bancos**
  - 2.5.1 Conciliación bancaria — P1
  - 2.5.2 Comisiones, intereses y gastos bancarios — P1
  - 2.5.3 Caja: control y saldos imposibles — P1
  - 2.5.4 Partidas pendientes de aplicación (555) — P1
  - 2.5.5 Efectos comerciales, descuento, factoring y confirming — P2
  - 2.5.6 Moneda extranjera: diferencias de cambio — P3
- **2.6 Impuestos en el día a día**
  - 2.6.1 IVA soportado y repercutido: cuentas y liquidación trimestral (472, 477, 4700, 4750) — P1
  - 2.6.2 Retenciones practicadas y soportadas (4751, 473) — P1
  - 2.6.3 Otros tributos (IBI, IAE, IVTM) y sanciones — P2
- **2.7 Subvenciones**
  - 2.7.1 Subvenciones de explotación — P2
  - 2.7.2 Subvenciones de capital: imputación a resultados — P2

### 3. Inmovilizado y arrendamientos

- **3.1 Inmovilizado material e inversiones inmobiliarias**
  - 3.1.1 Alta: precio de adquisición, gastos incluidos, IVA no deducible — P1
  - 3.1.2 Amortización: métodos, tablas fiscales y diferencias — P1
  - 3.1.3 Reparaciones, mantenimiento y mejoras: cuándo es gasto y cuándo activo — P1
  - 3.1.4 Bajas, ventas y permutas — P2
  - 3.1.5 Deterioro del inmovilizado — P2
  - 3.1.6 Inversiones inmobiliarias: cuándo un inmueble va en el grupo 22 — P3
  - 3.1.7 Inmovilizado en curso y trabajos realizados para la propia empresa — P3
- **3.2 Arrendamientos**
  - 3.2.1 Leasing: contabilización por el arrendatario — P1
  - 3.2.2 Renting y alquiler (arrendamiento operativo) — P1
  - 3.2.3 Lease-back (venta con arrendamiento financiero posterior) — P3
- **3.3 Inmovilizado intangible**
  - 3.3.1 Aplicaciones informáticas, propiedad industrial y fondo de comercio — P2
  - 3.3.2 Gastos de investigación y desarrollo — P3
- **3.4 Activos no corrientes mantenidos para la venta** — P3

### 4. Instrumentos financieros y financiación

- **4.1 Préstamos y créditos recibidos**
  - 4.1.1 Préstamo bancario: alta, cuotas y reclasificación del corto plazo — P1
  - 4.1.2 Coste amortizado y gastos de formalización — P2
  - 4.1.3 Pólizas de crédito — P1
  - 4.1.4 Préstamos de socios y entre empresas del grupo — P2
  - 4.1.5 Préstamos ICO y avales públicos — P2
- **4.2 Clientes y otros créditos**
  - 4.2.1 Clientes de dudoso cobro y deterioro de créditos (contable y fiscal) — P1
  - 4.2.2 Créditos incobrables: baja y recuperación del IVA — P1
- **4.3 Inversiones financieras**
  - 4.3.1 Clasificación de los activos financieros (Resolución ICAC 2019 / RD 1/2021) — P2
  - 4.3.2 Acciones y participaciones: compra, dividendos y venta — P2
  - 4.3.3 Depósitos y fianzas entregadas y recibidas — P2
- **4.4 Derivados y coberturas** — P3

### 5. Patrimonio neto y operaciones societarias

- **5.1 Capital**
  - 5.1.1 Constitución de la sociedad: aportaciones dinerarias y no dinerarias — P1
  - 5.1.2 Ampliación y reducción de capital — P2
  - 5.1.3 Acciones y participaciones propias — P3
- **5.2 Resultado del ejercicio**
  - 5.2.1 Distribución del resultado: reservas legal y voluntarias, dividendos — P1
  - 5.2.2 Compensación de pérdidas y aportaciones de socios — P1
  - 5.2.3 Desequilibrio patrimonial: causa de disolución y cómo se mide — P1
- **5.3 Operaciones con socios y vinculadas**
  - 5.3.1 Operaciones vinculadas: valoración contable y fiscal — P2
  - 5.3.2 Cuentas corrientes con socios y administradores — P1
- **5.4 Modificaciones estructurales** (fusiones, escisiones, combinaciones de negocios) — P3

### 6. Impuesto sobre beneficios en la contabilidad

- 6.1.1 Gasto por impuesto corriente: cálculo y asiento (6300, 4752, 473) — P1
- 6.1.2 Diferencias permanentes y temporarias; impuesto diferido (4740, 479) — P2
- 6.1.3 Bases imponibles negativas: cuándo se activan — P2
- 6.1.4 Deducciones y bonificaciones en la contabilidad — P3
- 6.1.5 PGC PYMES: método simplificado del impuesto — P2

(Un único bloque y capítulo, "Impuesto sobre beneficios", con estos temas.)

### 7. Cierre del ejercicio y cuentas anuales

- **7.1 Operaciones de cierre**
  - 7.1.1 Lista de comprobación del cierre — P1
  - 7.1.2 Periodificaciones: gastos e ingresos anticipados (480, 485) y devengados — P1
  - 7.1.3 Provisiones: cuándo dotarlas — P2
  - 7.1.4 Regularización, asiento de cierre y apertura — P1
  - 7.1.5 Errores contables y cambios de criterio de ejercicios anteriores — P2
- **7.2 Cuentas anuales**
  - 7.2.1 Qué modelo presentar: normal, abreviado o PYME (límites) — P1
  - 7.2.2 Balance y cuenta de pérdidas y ganancias: cómo se forman desde las cuentas — P1
  - 7.2.3 Memoria: contenido mínimo y lo que más se olvida — P2
  - 7.2.4 Estado de cambios en el patrimonio neto y estado de flujos de efectivo — P3
  - 7.2.5 Informe de gestión y estado de información no financiera — P3
- **7.3 Formulación, aprobación y depósito**
  - 7.3.1 Plazos: formular, aprobar en junta y depositar — P1
  - 7.3.2 Depósito en el Registro Mercantil y consecuencias de no depositar — P1
  - 7.3.3 Auditoría obligatoria: límites — P1

### 8. Fiscalidad de la empresa

- **8.1 IVA**
  - 8.1.1 Regímenes de IVA: general, simplificado, recargo de equivalencia, criterio de caja, REBU — P1
  - 8.1.2 Deducibilidad del IVA soportado (vehículos, atenciones a clientes...) — P1
  - 8.1.3 Prorrata general y especial — P2
  - 8.1.4 Inversión del sujeto pasivo — P1
  - 8.1.5 Operaciones intracomunitarias y modelo 349 — P1
  - 8.1.6 Modelos 303 y 390: casillas que más se equivocan — P1
  - 8.1.7 Modelo 347 (operaciones con terceros) — P1
  - 8.1.8 SII: quién está obligado — P2
  - 8.1.9 Modificación de la base imponible (impagos, concursos) — P2
- **8.2 Impuesto sobre Sociedades**
  - 8.2.1 Del resultado contable a la base imponible: ajustes más frecuentes — P1
  - 8.2.2 Gastos no deducibles — P1
  - 8.2.3 Pagos fraccionados (modelo 202) — P1
  - 8.2.4 Tipos de gravamen y empresas de reducida dimensión — P1
  - 8.2.5 Reserva de capitalización y de nivelación — P2
  - 8.2.6 Modelo 200: estructura y plazos — P2
- **8.3 IRPF de la actividad económica (autónomos)**
  - 8.3.1 Estimación directa normal y simplificada — P1
  - 8.3.2 Estimación objetiva (módulos) — P2
  - 8.3.3 Pagos fraccionados (modelos 130 y 131) — P1
  - 8.3.4 Libros registro del autónomo — P1
- **8.4 Retenciones e ingresos a cuenta**
  - 8.4.1 Modelo 111 y 190 (trabajo y profesionales) — P1
  - 8.4.2 Modelo 115 y 180 (alquileres) — P1
  - 8.4.3 Modelo 123 y 193 (capital mobiliario: dividendos, intereses) — P2
- **8.5 Facturación**
  - 8.5.1 Requisitos de una factura (RD 1619/2012) — P1
  - 8.5.2 Facturas simplificadas y rectificativas — P1
  - 8.5.3 Veri\*Factu y sistemas informáticos de facturación — P1
  - 8.5.4 Factura electrónica entre empresas (Ley Crea y Crece) — P2
- **8.6 Calendario y procedimientos**
  - 8.6.1 Calendario fiscal del año por tipo de empresa — P1
  - 8.6.2 Recargos por presentar fuera de plazo y sanciones habituales — P1
  - 8.6.3 Requerimientos de la AEAT: cómo responderlos — P2
  - 8.6.4 Aplazamientos y fraccionamientos de deudas — P2

### 9. Análisis financiero

- **9.1 Estados financieros**
  - 9.1.1 Leer un balance para quien no es contable — P1
  - 9.1.2 Cuenta de resultados analítica: margen bruto, EBITDA, EBIT — P1
  - 9.1.3 Flujos de caja: de dónde viene y a dónde va el dinero — P2
- **9.2 Ratios**
  - 9.2.1 Liquidez: corriente, ácida, tesorería y fondo de maniobra — P1
  - 9.2.2 Solvencia y endeudamiento — P1
  - 9.2.3 Rentabilidad: ROA, ROE y apalancamiento — P1
  - 9.2.4 Periodos medios de cobro, pago y almacén — P1
  - 9.2.5 Comparar con el sector: ratios sectoriales del Banco de España — P2
- **9.3 Rentabilidad y costes**
  - 9.3.1 Punto muerto (umbral de rentabilidad) — P1
  - 9.3.2 Márgenes por producto o cliente — P2
  - 9.3.3 Costes fijos y variables; contabilidad de costes básica — P2
- **9.4 Señales de alarma**
  - 9.4.1 Indicios de problemas financieros en la contabilidad — P1
  - 9.4.2 Preconcurso y concurso de acreedores: cuándo avisar — P2

### 10. Tesorería, presupuestos y financiación

- **10.1 Planificación**
  - 10.1.1 Previsión de tesorería a 13 semanas — P1
  - 10.1.2 Presupuesto anual y seguimiento de desviaciones — P2
- **10.2 Financiación**
  - 10.2.1 Préstamo, póliza, leasing o renting: cuál conviene — P1
  - 10.2.2 Financiación pública: ICO, ENISA, CDTI — P2
  - 10.2.3 Qué mira un banco antes de dar financiación — P2
- **10.3 Cobros y pagos**
  - 10.3.1 Plazos legales de pago (Ley 3/2004) y periodo medio de pago a proveedores — P1
  - 10.3.2 Gestión de impagados y reclamación de deudas — P2

### 11. El trabajo de la asesoría

- **11.1 Revisiones periódicas**
  - 11.1.1 Revisión mensual de la contabilidad: lista de comprobación — P1
  - 11.1.2 Revisión trimestral antes de los modelos — P1
  - 11.1.3 Saldos anómalos y qué significan — P1
- **11.2 Con el cliente**
  - 11.2.1 Documentación a pedir al cliente cada mes, trimestre y año — P1
  - 11.2.2 Explicar los resultados al cliente: informe trimestral — P2
- **11.3 Responsabilidad**
  - 11.3.1 Límites del asesor y de la IA: qué se propone y qué decide el contable — P1

### 12. Entidades y casos especiales

- 12.1 Autónomos y comunidades de bienes — P2
- 12.2 Entidades sin fines lucrativos (adaptación del PGC, RD 1491/2011) — P3
- 12.3 Cooperativas — P3
- 12.4 Empresas de construcción e inmobiliarias — P3
- 12.5 Grupos de sociedades: cuándo consolidar — P3

(Cada uno se abre en capítulos y temas cuando entre en un lote.)

## Cómo se escribe cada lote

1. Se elige el lote (P1 primero).
2. Para cada tema, la IA redacta un borrador **solo a partir de las fuentes de [fuentes.md](fuentes.md)**, citando norma y artículo. Nunca copia de editoriales o blogs.
3. Revisión de un contable, que firma en `revisado_por`. Mientras esté en `pendiente`, la IA avisa al usarlo de que el tema no está revisado.
4. Un script comprueba que cada tema tiene `id` único, fuentes, `resumen`, el tamaño dentro del límite y `relacionados` que existen.
