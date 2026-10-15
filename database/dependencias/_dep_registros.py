"""Registros de datos y sus modelos — ver
docs/planificacion/registros-y-modelos-de-registro.md. Datos que el cliente
anota una y otra vez con la misma estructura (temperaturas de cámaras,
partes de limpieza, resultados de un análisis): no son documentos ni texto
libre, son valores con forma conocida, y lo que da valor es poder buscarlos,
sumarlos y ver si cumplen.

Nada que ver con gd_notas (comentarios, anotaciones e incidencias sobre un
documento), que hasta el 2026-09-28 se llamaba gd_registros.

Un modelo describe la forma (un JSON Schema) y cada registro guarda sus
valores en JSON, validados contra ese esquema antes de guardarse.

**Un modelo con registros no se toca nunca más** (decisión del usuario): para
cambiar el esquema se crea una fila nueva, la versión siguiente, enlazada a
la primera por `id_modelo_raiz`. Así cada registro sigue apuntando a la
versión exacta con la que se validó y la trazabilidad se lee sola: qué forma
tenía el parte el día que se rellenó, y en qué cambió después.

Las tablas se relacionan solo entre sí: `id_entidad` y el `id_documento`
de gd_registros_documentos van sin clave ajena a propósito (ver el
comentario de cada una), así el esquema se puede aplicar en un servidor
real registrando únicamente las tablas de este fichero."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_MODELOS_REGISTRO = "gd_modelos_registro"
NOMBRE_TABLA_REGISTROS = "gd_registros"
NOMBRE_TABLA_REGISTROS_DOCUMENTOS = "gd_registros_documentos"
__DB_NAME__ = get_db_name("gestion_documental")

#: Cada cuánto se espera un registro de este modelo. Solo informativo hoy;
#: es lo que haría falta para avisar de "falta el registro de hoy".
PERIODICIDADES = ["diaria", "semanal", "mensual", "puntual"]

CAMPOS_MODELOS_REGISTRO = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno del modelo"),
    Columna(nombre="nombre", tipo="VARCHAR", longitud=100, not_null=True,
            comentario='Cómo se cita este modelo, p.ej. "temperaturas_camaras". Identifica a la '
                       "FAMILIA, no a la fila: todas las versiones de un modelo comparten nombre "
                       "(único junto con version, ver INDICES). Es lo que se nombra al anotar un "
                       "registro y lo que puede citar una regla de comportamiento; sin decir "
                       "versión, se entiende la última activa"),
    Columna(nombre="titulo", tipo="VARCHAR", longitud=255, not_null=True,
            comentario='Cómo se llama para una persona, p.ej. "Control diario de temperaturas"'),
    Columna(nombre="descripcion", tipo="MEDIUMTEXT", not_null=True,
            comentario="Qué se anota, cuándo y quién — lo que lee la IA antes de rellenar uno"),
    Columna(nombre="esquema", tipo="MEDIUMTEXT", not_null=True,
            comentario="JSON Schema al que deben ajustarse los valores del registro (texto con el "
                       "JSON: el ORM no tiene tipo JSON, igual que gd_aprendizajes.sustituciones). "
                       "Se valida con la librería jsonschema antes de guardar nada"),
    Columna(nombre="version", tipo="INT", not_null=True, default=1,
            comentario="1, 2, 3... dentro de la familia. No se edita a mano: la pone "
                       "nueva_version_modelo() al crear la siguiente"),
    Columna(nombre="id_modelo_raiz", tipo="INT",
            comentario="Primera versión de esta familia (→ gd_modelos_registro.id). NULL en la "
                       "propia primera versión. Con esto, todas las versiones de un modelo salen "
                       "en una consulta (id = raiz OR id_modelo_raiz = raiz) y en orden de version, "
                       "que es el mismo en que se fueron creando"),
    Columna(nombre="motivo_version", tipo="MEDIUMTEXT",
            comentario="Qué cambia respecto a la versión anterior y por qué — NULL en la primera. "
                       "Es la mitad de la trazabilidad: la otra mitad es el esquema en sí"),
    Columna(nombre="periodicidad", tipo="VARCHAR", longitud=20, enum_opciones=PERIODICIDADES,
            comentario="Cada cuánto se espera un registro de este modelo — opcional, NULL si no "
                       "aplica. Hoy es informativo; sirve para avisar de los que falten"),
    Columna(nombre="id_estilo", tipo="INT",
            comentario="Estilo de informe (→ gd_estilos.id) con el que se imprimen sus registros: "
                       "sus imágenes (logo...) salen arriba del PDF. Opcional. Es de la FAMILIA: "
                       "se pone a la vez en todas las versiones y pasa sola a la siguiente, y "
                       "cambiarlo no cuenta como tocar el modelo (no cambia qué se valida). Sin "
                       "clave ajena, mismo motivo que gd_registros.id_entidad: si el estilo se "
                       "borra, queda un id huérfano que se comprueba al imprimir"),
    Columna(nombre="activo", tipo="BOOLEAN", not_null=True, default=True,
            comentario="Permite retirar una versión sin borrarla ni perder sus registros. Al crear "
                       "la versión siguiente, la anterior se desactiva sola: deja de aceptar "
                       "registros nuevos, pero los suyos siguen ahí y siguen consultándose"),
    Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
]

# Único (nombre, version), no `nombre` a secas: las versiones de un modelo
# comparten nombre. El ORM nombra los índices por sus columnas, así que este
# sale como "nombre_version_uk" y no choca con nada del esquema (a diferencia
# de "nombre_idx", que ya tiene gd_documentos — ver _dep_reglas.py).
INDICES_MODELOS_REGISTRO = [
    Index(columnas=["nombre", "version"], unico=True),
]

FKS_MODELOS_REGISTRO = [
    ForeignKey(columna="id_modelo_raiz", referencia_tabla=NOMBRE_TABLA_MODELOS_REGISTRO,
               referencia_columna="id", on_delete="RESTRICT"),
]

TABLA_MODELOS_REGISTRO = Tabla(
    nombre=NOMBRE_TABLA_MODELOS_REGISTRO, columnas=CAMPOS_MODELOS_REGISTRO,
    indices=INDICES_MODELOS_REGISTRO, foreign_keys=FKS_MODELOS_REGISTRO,
    comentario="Tipos de registro de datos de este cliente, con la forma (JSON Schema) que debe "
               "tener cada uno — una fila por versión, nunca se modifican una vez tienen registros",
    db_name=__DB_NAME__,
)


CAMPOS_REGISTROS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno del registro"),
    Columna(nombre="id_modelo", tipo="INT", not_null=True,
            comentario="Versión EXACTA del modelo con la que se validó (→ gd_modelos_registro.id). "
                       "No la familia: si el modelo cambia, los registros viejos siguen apuntando a "
                       "la versión con la que nacieron, que es lo que hace la trazabilidad"),
    Columna(nombre="valores", tipo="MEDIUMTEXT", not_null=True,
            comentario="Los datos anotados, en JSON, ya validados contra el esquema del modelo. "
                       "Texto, no JSON nativo (el ORM no lo tiene): para filtrar por un campo de "
                       "dentro se convierte en la propia consulta, valores::jsonb ->> 'campo'"),
    Columna(nombre="fecha", tipo="DATE", not_null=True,
            comentario="Día al que se refiere el registro — no cuándo se escribió (eso es "
                       "fecha_alta): un parte de ayer se puede anotar hoy"),
    Columna(nombre="hora", tipo="TIME",
            comentario="Hora a la que se refiere, opcional — en un control de temperaturas importa, "
                       "en un parte diario no"),
    Columna(nombre="creado_por", tipo="VARCHAR", longitud=255, not_null=True,
            comentario="Quién lo anotó — texto libre, igual que gd_notas.creado_por: por MCP no hay "
                       "una identidad de persona fiable, solo la del proyecto"),
    Columna(nombre="conforme", tipo="BOOLEAN",
            comentario="Si el registro está dentro de lo que debe estar. NULL cuando el modelo no "
                       "tiene ese concepto (no todo registro es una comprobación). Es lo que permite "
                       'pedir "los registros no conformes de septiembre" sin abrir ni un JSON'),
    Columna(nombre="observaciones", tipo="MEDIUMTEXT",
            comentario="La desviación y qué se hizo, en palabras — opcional"),
    Columna(nombre="id_entidad", tipo="INT",
            comentario="A qué entidad se refiere (→ gd_entidades.id): el proveedor, el local, el "
                       "equipo. Opcional y SIN clave ajena a propósito — una FK obligaría a "
                       "registrar gd_entidades al aplicar el esquema en un servidor real, y de ahí "
                       "salen ALTER sobre tablas con datos. Si la entidad se borra, queda un id "
                       "huérfano que se comprueba al leer"),
    Columna(nombre="archivo_original", tipo="BLOB",
            comentario="Opcional — el archivo del que salen los datos (la foto del parte, el PDF "
                       "del análisis), guardado tal cual, igual que gd_versiones.archivo_original: "
                       "solo de referencia/descarga, lo que manda son los valores. NULL si no hay. "
                       "Nunca sale en los listados (ver COLUMNAS_SIN_ARCHIVO en el CRUD)"),
    Columna(nombre="archivo_original_nombre", tipo="VARCHAR", longitud=255,
            comentario="Nombre de fichero de archivo_original. NULL si no hay archivo adjunto"),
    Columna(nombre="archivo_original_tipo_mime", tipo="VARCHAR", longitud=100,
            comentario="Tipo MIME de archivo_original (p.ej. 'application/pdf'). NULL si no hay "
                       "archivo adjunto"),
    Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True,
            comentario="Cuándo se guardó de verdad, distinto de fecha/hora"),
]

# Índices compuestos y no por columna suelta, por dos motivos: son las dos
# consultas reales ("los registros de este modelo entre estas fechas" y "los
# de esta entidad"), y los nombres que genera el ORM salen de las columnas —
# "fecha_idx" y "id_entidad_idx" ya están cogidos por otras tablas del mismo
# esquema y no llegarían a crearse (ver _dep_reglas.py).
INDICES_REGISTROS = [
    Index(columnas=["id_modelo", "fecha"]),
    Index(columnas=["id_modelo", "id_entidad"]),
]

FKS_REGISTROS = [
    ForeignKey(columna="id_modelo", referencia_tabla=NOMBRE_TABLA_MODELOS_REGISTRO,
               referencia_columna="id", on_delete="RESTRICT"),
]

TABLA_REGISTROS = Tabla(
    nombre=NOMBRE_TABLA_REGISTROS, columnas=CAMPOS_REGISTROS,
    indices=INDICES_REGISTROS, foreign_keys=FKS_REGISTROS,
    comentario="Registros de datos del cliente: los valores anotados para un modelo concreto",
    db_name=__DB_NAME__,
)


# Documentos vinculados a un registro: varios por registro (p.ej. el
# certificado de calibración del termómetro y el procedimiento de limpieza) y
# un documento en varios registros. Sustituye a gd_registros.id_documento,
# que solo admitía uno (2026-09-28, petición del usuario).
CAMPOS_REGISTROS_DOCUMENTOS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno del vínculo"),
    Columna(nombre="id_registro", tipo="INT", not_null=True,
            comentario="Registro (→ gd_registros.id)"),
    Columna(nombre="id_documento", tipo="INT", not_null=True,
            comentario="Documento vinculado (→ gd_documentos.id). Sin clave ajena, mismo motivo que "
                       "gd_registros.id_entidad: una FK obligaría a registrar gd_documentos al aplicar "
                       "el esquema y de ahí salen ALTER sobre tablas con datos"),
    Columna(nombre="fecha_asignacion", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
]

# Con nombre propio: el que genera el ORM sale de las columnas y
# "id_documento_idx" ya lo usa otra tabla del esquema (ver _dep_reglas.py).
INDICES_REGISTROS_DOCUMENTOS = [
    Index(columnas=["id_registro", "id_documento"], unico=True, nombre="gd_registros_documentos_uk"),
    Index(columnas=["id_documento"], nombre="gd_registros_documentos_id_documento_idx"),
]

FKS_REGISTROS_DOCUMENTOS = [
    ForeignKey(columna="id_registro", referencia_tabla=NOMBRE_TABLA_REGISTROS,
               referencia_columna="id", on_delete="CASCADE"),
]

TABLA_REGISTROS_DOCUMENTOS = Tabla(
    nombre=NOMBRE_TABLA_REGISTROS_DOCUMENTOS, columnas=CAMPOS_REGISTROS_DOCUMENTOS,
    indices=INDICES_REGISTROS_DOCUMENTOS, foreign_keys=FKS_REGISTROS_DOCUMENTOS,
    comentario="Documentos vinculados a cada registro de datos (muchos a muchos)",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_MODELOS_REGISTRO, TABLA_REGISTROS, TABLA_REGISTROS_DOCUMENTOS]
