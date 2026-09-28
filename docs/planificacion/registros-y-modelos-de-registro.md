# Registros de datos y modelos de registro

Planteamiento, 2026-09-28. El choque de nombres ya está resuelto; queda por decidir lo marcado **[DECIDIR]**.

## Qué es esto

Datos que el cliente anota una y otra vez con la misma estructura: temperaturas de cámaras, partes de limpieza, resultados de un análisis, control de recepción de mercancía, horas de un trabajo. No son documentos (no hay un PDF ni un texto que interpretar) ni comentarios sobre un documento: son **datos**, y lo que da valor es poder buscarlos, sumarlos y ver si se cumplen.

Dos tablas nuevas, relacionadas por id:

- **Modelo de registro**: qué campos tiene ese tipo de registro y cómo deben ser (el JSON al que se ajusta).
- **Registro**: una anotación concreta, con sus valores en un JSON, su fecha y su hora.

## El nombre ya está libre (resuelto el 2026-09-28)

`gd_registros` guardaba los comentarios, anotaciones, observaciones e incidencias de un documento. El usuario decidió renombrar esa tabla a `gd_notas` (y `gd_registros_relaciones` a `gd_notas_relaciones`), con sus tools y rutas del panel, para dejar "registro" libre para lo de aquí — ver `docs/gestion-documental.md` → "Notas de seguimiento", apartado del renombrado. Así que las tablas nuevas se llaman **`gd_registros`** y **`gd_modelos_registro`**, sin apellidos ni ambigüedad.

## Modelo de datos propuesto

### `gd_modelos_registro`

| Campo | Tipo | Para qué |
|---|---|---|
| `id` | INT autonumérico | Identificador operativo (igual que el resto del esquema) |
| `nombre` | VARCHAR(100) | `temperaturas_camaras` — identifica a la **familia**, no a la fila: todas las versiones comparten nombre (único junto con `version`) |
| `titulo` | VARCHAR(255) | Cómo se llama para una persona: "Control diario de temperaturas" |
| `descripcion` | TEXT | Qué se anota, cuándo y quién — lo que lee la IA antes de rellenar uno |
| `esquema` | TEXT (JSON) | El modelo al que debe ajustarse el registro (ver abajo) |
| `version` | INT, empieza en 1 | 1, 2, 3… dentro de la familia; la pone el servidor al crear la siguiente, no se edita |
| `id_modelo_raiz` | INT, FK a sí misma, opcional | La primera versión de la familia; NULL en la propia primera |
| `motivo_version` | TEXT, opcional | Qué cambia respecto a la versión anterior y por qué |
| `periodicidad` | ENUM `diaria`/`semanal`/`mensual`/`puntual` | Opcional. Solo tiene sentido si más adelante quieres avisos de "falta el registro de hoy" |
| `activo` | BOOLEAN | Retirar una versión sin borrarla ni perder sus registros; al crear la siguiente, la anterior se desactiva sola |
| `fecha_alta` | TIMESTAMP | |

### `gd_registros`

| Campo | Tipo | Para qué |
|---|---|---|
| `id` | INT autonumérico | |
| `id_modelo` | INT, FK → `gd_modelos_registro`, `ON DELETE RESTRICT` | La versión **exacta** con la que se validó, no la familia. Un modelo con registros no se puede borrar |
| `valores` | TEXT (JSON) | Los datos anotados, validados contra el esquema del modelo |
| `fecha` | DATE | El día al que se refiere el registro |
| `hora` | TIME, opcional | La hora a la que se refiere (en un control de temperaturas importa; en un parte diario, no) |
| `creado_por` | VARCHAR(255) | Texto libre, igual que `gd_notas.creado_por` y `gd_scripts.creado_por`: por MCP no hay identidad fiable de persona |
| `conforme` | BOOLEAN, opcional | Si el registro está dentro de lo que debe. Es lo que permite "enséñame los registros no conformes de septiembre" sin abrir ni un JSON |
| `observaciones` | TEXT, opcional | La desviación y qué se hizo, en palabras |
| `id_entidad` | INT, opcional, **sin FK** | A qué proveedor, local o equipo se refiere (→ `gd_entidades.id`) |
| `id_documento` | INT, opcional, **sin FK** | Si el registro nace de un documento o lo respalda (→ `gd_documentos.id`) |
| `fecha_alta` | TIMESTAMP | Cuándo se guardó de verdad (distinto de `fecha`/`hora`) |

**Por qué `id_entidad` e `id_documento` van sin clave ajena**: una FK obliga a registrar también la tabla apuntada al aplicar el esquema en un servidor real, y registrar `gd_documentos` arrastra `gd_estilos` y genera `ALTER TABLE` sobre tablas con datos (ya pasó dos veces, ver `docs/gestion-documental.md` y las notas de despliegue). Sin FKs, las dos tablas nuevas se aplican solas, igual que `gd_enlaces` o `gd_scripts`. El precio: si se borra una entidad, el registro se queda apuntando a un id que no existe — se comprueba en código al leer.

## Un modelo con registros no se altera: se versiona (decisión del usuario)

En cuanto un modelo tiene un solo registro, esa fila queda congelada: ni el esquema, ni el nombre, ni los textos. Para cambiar algo se crea **la versión siguiente**, una fila nueva con el mismo `nombre`, `version` + 1 y `id_modelo_raiz` apuntando a la primera; la anterior se desactiva sola y deja de aceptar registros nuevos.

Qué consigue eso, y es lo que se pedía: cada registro apunta con su `id_modelo` a la versión **exacta** con la que se validó, así que siempre se puede responder "qué forma tenía este parte el día que se rellenó" y "en qué cambió después" (`motivo_version`). Nada se revalida hacia atrás ni se migra.

Consecuencias en el esquema:
- `nombre` deja de ser único por sí solo: lo único es la pareja `(nombre, version)`. El nombre identifica a la familia; sin decir versión, "el modelo temperaturas_camaras" es su última versión activa.
- `gd_registros.version_modelo` desaparece: era redundante en cuanto `id_modelo` apunta a la fila de esa versión concreta.
- Un modelo sin ningún registro todavía sí se puede corregir en el sitio (es un borrador que nadie ha usado); en cuanto tiene el primero, solo versiones nuevas. Lo único que se puede cambiar siempre es `activo`.

## El esquema del modelo: JSON Schema

`jsonschema` 4.26 **ya está instalado** en los 5 servidores (viene con `fastmcp`), así que validar de verdad no añade dependencia nueva; solo hay que ponerlo explícito en `requirements.txt`.

Ejemplo de modelo, "temperaturas_camaras":

```json
{
  "type": "object",
  "required": ["camara", "temperatura"],
  "additionalProperties": false,
  "properties": {
    "camara":      {"type": "string", "enum": ["Cámara 1", "Cámara 2", "Congelador"]},
    "temperatura": {"type": "number", "minimum": -30, "maximum": 15},
    "termometro":  {"type": "string"}
  }
}
```

Y un registro que encaja: `{"camara": "Cámara 2", "temperatura": 3.5, "termometro": "T-04"}` con `fecha` 2026-09-28, `hora` 08:15, `conforme` true.

Validación **estricta**: si los valores no encajan, no se guarda y se devuelve el motivo en claro ("temperatura: 19 es mayor que el máximo 15"). Mismo patrón que ya usan las reglas: `ValueError` en el CRUD, 400 en el panel y `ToolError` en MCP. Así un registro guardado es siempre un registro válido.

## Buscar dentro del JSON

El ORM (`mtpk_postgres`) no tiene tipo JSON ni JSONB: la columna se declara como texto, igual que `gd_aprendizajes.sustituciones`. Para filtrar por un campo de dentro se usa SQL con conversión al vuelo:

```sql
WHERE id_modelo = %s AND fecha BETWEEN %s AND %s
  AND (valores::jsonb ->> 'camara') = %s
  AND (valores::jsonb ->> 'temperatura')::numeric > %s
```

Funciona sobre una columna de texto y no necesita índice para el volumen real de una GD: con 5.000 registros Postgres los recorre en milisegundos. Si algún cliente llegara a cientos de miles, se añade una columna JSONB de verdad con índice GIN, fuera del ORM — pero no antes de tener el problema medido.

Los filtros que sí van indexados son los normales: `id_modelo`, `fecha`, `conforme`, `id_entidad`.

## Tools MCP propuestas

| Herramienta | Qué hace |
|---|---|
| `crear_modelo_registro_gd(nombre, titulo, descripcion, esquema, periodicidad?)` | Da de alta un modelo. La IA puede construir el esquema hablando con el cliente ("¿qué anotas en ese parte?") |
| `nueva_version_modelo_registro_gd(id_modelo, esquema, motivo, …)` | Crea la versión siguiente de un modelo y desactiva la anterior. Un modelo con registros no se puede editar de ninguna otra forma |
| `listar_modelos_registro_gd()` / `obtener_modelo_registro_gd` | Qué modelos hay (la última versión activa de cada uno) y cómo es uno (solo lectura) |
| `listar_versiones_modelo_registro_gd(nombre)` | Toda la historia de un modelo, en orden, con el motivo de cada cambio (solo lectura) |
| `crear_registro_gd(modelo, valores, fecha, hora?, creado_por, conforme?, observaciones?, id_entidad?, id_documento?)` | Anota un registro, validado contra el esquema |
| `listar_registros_gd(modelo?, desde?, hasta?, id_entidad?, conforme?, filtros?)` | Los registros que encajan (solo lectura). `filtros` son pares campo/valor de dentro del JSON |
| `corregir_registro_gd(id_registro, …)` | Corrige valores mal anotados (vuelve a validar) |
| `resumir_registros_gd(modelo, desde, hasta, campo)` | Opcional: mínimo, máximo y media de un campo numérico, para no traerse 500 registros al contexto solo para calcular una media |

Nada de esto se comparte con las GDs enlazadas (no llevan etiqueta `gd_enlazada`): los registros son datos operativos del cliente, y una central no tiene por qué verlos. Si algún día interesa, se hace con el mismo mecanismo de `reservado` que ya tienen documentos y reglas.

## Panel web

- Pantalla "Registros": selector de modelo arriba, y debajo la tabla con una columna por campo del esquema, más fecha, hora, conforme y quién lo anotó. Filtros por rango de fechas, entidad y conforme/no conforme. Exportar a CSV con el mismo patrón que la pantalla de uso de GDs enlazadas.
- Pantalla "Modelos de registro" (o una pestaña de la anterior): alta y edición, con el esquema en un campo de texto y comprobación de que es JSON válido antes de guardar.
- **Alta de registros [DECIDIR]**: en v1 puede ser (a) solo por conversación con la IA, como guardar un documento — cero frontend nuevo; (b) un formulario generado a partir del esquema — es lo cómodo para anotar 20 temperaturas seguidas, y es el trozo de trabajo más grande de todo esto; (c) las dos, con el formulario en una fase posterior. Mi recomendación es (c): empezar por conversación y añadir el formulario cuando esté claro qué modelos usa de verdad el cliente.

## Cómo se junta con lo que ya hay

- **Reglas**: una regla puede decir "para anotar temperaturas usa el modelo temperaturas_camaras y avisa si pasa de 8 °C". El nombre del modelo es único, así que la regla puede citarlo igual que cita a otra regla.
- **Documentos**: un registro puede apuntar a un documento (`id_documento`) cuando lo respalda — el informe de laboratorio del que salen los valores, por ejemplo. Nada más: los registros viven aparte, como pediste.
- **Avisos por email**: con `periodicidad` en el modelo, un script como `avisar_caducidades.py` podría avisar de los registros que faltan. Fuera de v1.

## Fases

1. Las dos tablas, el CRUD con validación y las tools MCP. Sin panel: se puede empezar a usar por conversación el mismo día.
2. Panel: listado con filtros, alta y edición de modelos, exportar a CSV.
3. Formulario generado desde el esquema, y avisos de registros que faltan.

## Lo que este planteamiento no incluye

- Adjuntar ficheros a un registro (una foto del termómetro). Se puede añadir luego con el mismo patrón de `gd_estilos_imagenes`.
- Firma o bloqueo de un registro para que no se pueda corregir después (en auditoría a veces se pide). Hoy `corregir_registro_gd` no deja rastro; añadirlo sería reutilizar `gd_historial_ediciones`.
