# Memoria anual redactada desde la GD

Plan, 2026-10-10. Nada implementado. Encaja como **fase 3 bis** de [planificacion.md](planificacion.md): necesita que la IA ya lea la contabilidad del SIF (fase 3) y va antes de las propuestas (fase 4). Lo marcado **[COMPROBAR]** hay que verificarlo antes de empezar.

## Qué es

La memoria de las cuentas anuales de cada empresa, por ejercicio, guardada **en el SIF** (junto al balance y la cuenta de pérdidas y ganancias de los que forma parte) y redactada **desde la GD** por la IA con tres tipos de información:

1. **Datos de la contabilidad** (SIF): cuadros de inmovilizado, amortizaciones, deudas por vencimiento, desglose de partidas, cifras del año anterior.
2. **Datos documentados en la GD**: contratos, avales, préstamos, subvenciones, litigios, actas, escrituras.
3. **Datos que solo puede aportar una persona**: plantilla media por sexo y categoría, retribución de administradores, honorarios del auditor, hechos posteriores al cierre, información medioambiental...

Decisión del usuario (2026-10-10). Cambia una regla del plan: hasta ahora la GD no escribía en el SIF. **La memoria sí se guarda en el SIF**, siempre con la clave del usuario y después de que la apruebe el contable. La IA prepara el borrador; quien guarda es la persona.

## Principios

- **Por apartados, no un texto único.** Cada apartado tiene su texto, su estado y de dónde sale cada dato. Así se revisa apartado por apartado y el ejercicio siguiente parte del anterior (la memoria lleva cifras comparativas del año anterior).
- **Las cifras las calcula el programa, no la IA.** Los cuadros numéricos salen de la contabilidad del SIF por código, para que nunca contradigan el balance. La IA redacta el texto que los explica.
- **Cada dato dice de dónde sale**: contabilidad, documento de la GD (con su id) o dato manual (quién y cuándo).
- **Al formular se bloquea**, igual que el libro diario del SIF (`docs/modulo_contabilidad/14_inalterabilidad_del_libro.md`). Un cambio posterior es una versión nueva; la anterior se conserva.

## Catálogo de apartados

Una lista fija por modelo, que mantenemos nosotros (como la biblioteca), con los apartados que exige el PGC para cada modelo: **normal**, **abreviado** y **PYMES** (las microempresas usan el de PYMES). El modelo de la empresa se elige con los límites del tema 10721 de la biblioteca.

Para cada apartado: código, título, modelos en que es obligatorio, qué datos necesita y de qué tipo es cada uno (`contabilidad` / `gd` / `manual`), y la norma en que se apoya (bloque del BOE de la tercera parte del PGC o del PGC PYMES).

Ejemplo, apartado "Inmovilizado material" del modelo PYMES:

| Dato | Tipo | De dónde |
| --- | --- | --- |
| Cuadro de saldo inicial, altas, bajas, traspasos y saldo final, con su amortización | contabilidad | Subgrupos 21 y 281 en el SIF |
| Bienes en leasing, con coste y cuotas pendientes | contabilidad + gd | Cuentas 174/524 y el contrato en la GD |
| Bienes afectos a garantías | gd | Escrituras de préstamo hipotecario en la GD |
| Compromisos firmes de compra | manual | Pregunta al contable |

El catálogo vive en la GD, en ficheros como la biblioteca (`database/conocimiento_contable/memoria/`, un `.md` por apartado con su cabecera YAML). Al SIF solo llega el código de cada apartado. **[COMPROBAR]** si el backend prefiere tener también el catálogo en el SIF (para que su propia interfaz pueda enseñarlo); si es así, la fuente sigue siendo una sola y la otra parte la lee.

## Qué se pide al SIF

Tablas en la base de contabilidad:

```
msif_conta_memorias
  id, id_obligado, ejercicio, modelo (normal | abreviado | pymes),
  version, estado (borrador | revisada | formulada),
  fecha_formulacion, formulada_por, fecha_alta, fecha_modificacion
  UNIQUE (id_obligado, ejercicio, version)

msif_conta_memorias_apartados
  id, id_memoria, codigo_apartado, orden,
  texto (Markdown),
  estado (pendiente | borrador | revisado),
  datos (JSON: cada dato con su valor, tipo de origen y referencia:
         cuenta del SIF, id de documento de la GD, o usuario y fecha del dato manual),
  pendientes (JSON: datos que faltan y a quién se le han pedido),
  revisado_por, fecha_revision, fecha_modificacion
  UNIQUE (id_memoria, codigo_apartado)
```

Endpoints bajo `/apisif/v1/contabilidad/memoria/`, con los niveles de acceso de siempre:

- `listar`, `obtener` (memoria con sus apartados) — nivel `consulta`.
- `crear` (empresa, ejercicio, modelo; opcionalmente partiendo de la del ejercicio anterior), `guardar_apartado`, `marcar_revisado` — nivel `apuntes`.
- `formular` (bloquea la versión) y `nueva_version` — nivel `cierre`.
- `datos_contables` (empresa, ejercicio, código de apartado): los cuadros numéricos de ese apartado calculados desde la contabilidad, con el año anterior. Es la pieza que garantiza que las cifras salen del programa. Se empieza por los apartados más mecánicos: inmovilizado, amortizaciones, deudas por plazo de vencimiento, desglose de partidas del balance y de la cuenta de pérdidas y ganancias.
- `pdf` (y más adelante Word): la memoria compuesta para firmar y depositar.

## Lo que hace la GD

**Tools MCP** (con el apartado contable activado y el usuario con su clave del SIF):

- `memoria_contable_gd(empresa, ejercicio)` — solo lectura: la memoria con sus apartados, estados y datos pendientes.
- `datos_memoria_gd(empresa, ejercicio, apartado)` — solo lectura: los cuadros calculados por el SIF.
- `proponer_apartado_memoria_gd(empresa, ejercicio, apartado, texto, datos)` — no escribe en el SIF: deja el borrador en la GD para que el contable lo vea. Cuenta como propuesta (fase 4), con su `id_documento` cuando un dato sale de un documento.
- Guardar en el SIF lo hace el contable desde el panel (o la IA con su confirmación expresa en el chat, que ya pide permiso para todo lo que escribe).

**Cómo redacta la IA un apartado:**

1. Lee el apartado en el catálogo (qué datos y de qué tipo).
2. Pide al SIF los cuadros (`datos_memoria_gd`).
3. Busca en la GD los documentos que responden a los datos de tipo `gd` (`consultar_documentos_gd`) y cita cada uno.
4. Mira qué datos manuales faltan. Si faltan, los anota como pendientes y los pregunta.
5. Redacta el texto apoyándose en el tema de la biblioteca de ese apartado, y lo deja como propuesta.

**Datos manuales**: en el panel, una lista de "datos pendientes" por memoria, con un formulario corto por dato (número, texto, fecha, sí/no). También se pueden contestar en el chat. Lo que se contesta queda en `datos` con quién y cuándo.

**Panel**: dentro del apartado de contabilidad, una pantalla "Memoria" por empresa y ejercicio. A la izquierda, los apartados con su estado. A la derecha, el texto (editable), los cuadros del SIF y los datos pendientes. Botones: pedir borrador a la IA, guardar en el SIF, marcar revisado y, con nivel de cierre, formular.

## Biblioteca: temas que hacen falta antes

- **7.2.3 Memoria: contenido mínimo** (P2): pasa al lote siguiente con prioridad, partido en tres temas, uno por modelo (normal, abreviado, PYMES).
- Un tema por apartado con más miga (bases de presentación, hechos posteriores, operaciones vinculadas, información medioambiental, situación fiscal), que es en lo que se apoya la IA al redactar.

## Orden

1. Catálogo de apartados (los tres modelos) y temas de la memoria en la biblioteca.
2. Petición al SIF (tablas y endpoints). Se manda por el canal compartido: `multiplika_compartida/contabilidad/prompts/5_intercambio.md`, apartado [5.5].
3. Tools de lectura y pantalla de la memoria en la GD.
4. Redacción por la IA, datos pendientes y guardado.
5. Formular, PDF y versiones.

## Coste aproximado

Redactar un apartado: catálogo (unos 500 tokens), cuadros del SIF (1.000-3.000), documentos de la GD (2.000-5.000) y tema de la biblioteca (unos 3.000). Unos 8.000-12.000 tokens por apartado. Una memoria PYMES de unos 15 apartados: entre 120.000 y 180.000 tokens el primer año. Los siguientes, bastante menos, porque se parte de la del año anterior y solo se rehacen los apartados con cambios.
