"""Reglas de comportamiento — ver docs/gestion-documental.md → "Reglas de
comportamiento". Cómo tiene que actuar la IA en esta GD (datos fijos de la
empresa, estilo, criterios de trabajo), separado de los documentos, que son
el contenido. Una sola tabla sin FKs: se puede aplicar en un servidor real
sin registrar ninguna otra tabla.

`ambito` del modelo de la planificación NO es una columna: una regla de esta
tabla es siempre `propia`; las `heredada` se piden en vivo a las GDs
centrales enlazadas (igual que los documentos, que tampoco se copian — ver
"GDs enlazadas"), así no hay nada que sincronizar ni que quede obsoleto."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_REGLAS = "gd_reglas"
__DB_NAME__ = get_db_name("gestion_documental")

AMBITO_PROPIA = "propia"
AMBITO_HEREDADA = "heredada"

#: Se añade siempre al bloque de reglas globales, tenga el cliente reglas o
#: no: es lo que le dice a la IA que existe el nivel 2 (reglas por categoría
#: bajo demanda) y cómo se resuelven los conflictos.
REGLA_META = (
    "Las reglas globales de esta gestión documental ya están en tu contexto, cada una con su nombre "
    "delante. Antes de empezar cualquier tarea especializada (redactar un tipo de informe, preparar "
    "un envío, facturar...), carga las reglas que hagan falta con obtener_reglas_gd: por categoría "
    "si vas por el tipo de tarea, o por nombre (nombres=[...]) cuando una regla global te remita a "
    "otras por su nombre. listar_reglas_gd() te dice qué reglas y categorías hay. Si una regla de "
    "esta gestión documental contradice a una heredada de una GD central, manda la de esta gestión "
    "documental."
)

#: Reglas del producto, iguales para cualquier cliente: van siempre en el
#: bloque global, antes de la regla meta. Cómo encaja todo en una GD y no
#: duplicar lo que ya existe.
REGLAS_PRODUCTO = (
    "Antes de crear algo nuevo, comprueba que no exista ya y reutilízalo si existe: una entidad "
    "(listar_entidades_gd por nombre, y por código si lo tienes; prueba también variantes del "
    "nombre: con y sin S.L., abreviaturas, sin tildes), un grupo (listar_grupos_gd), un modelo de "
    "registro (listar_modelos_registro_gd), un script (buscar_scripts_gd), una nota del bloc "
    "(buscar_notas_bloc_gd), una regla (listar_reglas_gd), un contacto (listar_contactos_gd), una "
    "oportunidad (listar_oportunidades_gd) o un documento (buscar_documentos_gd). "
    "Si encuentras uno parecido pero no estás seguro de que sea el mismo, pregunta al cliente antes "
    "de crear otro.\n\n"
    "Cómo se vincula todo en esta gestión documental:\n"
    "- Documento: la pieza central. Tiene versiones (la vigente es la que vale) y puede llevar el "
    "archivo original adjunto.\n"
    "- Entidad (cliente, proveedor, empleado...): se relaciona con documentos (un documento puede "
    "tener varias entidades y una entidad varios documentos). Los envíos por email van a entidades, "
    "y los registros de datos pueden indicar una.\n"
    "- Grupo: junta documentos para un fin (una auditoría, un expediente). Un documento puede estar "
    "en varios grupos. Borrar un grupo no borra sus documentos.\n"
    "- Notas de un documento (comentario, anotación, observación, incidencia): cuelgan siempre de un "
    "documento y siguen ahí en todas sus versiones; se pueden relacionar entre sí. Una incidencia se "
    "cierra con resolver_incidencia_gd, que crea la resolución enlazada.\n"
    "- Registro de datos: una anotación con forma fija (temperaturas, partes...) según un modelo de "
    "registro. Puede indicar una entidad y vincularse a varios documentos.\n"
    "- Bloc de notas: notas sueltas de los usuarios (reuniones, llamadas, ideas), enlazables con "
    "otras notas del bloc, con documentos, con registros y con entidades (lo apuntado sobre un "
    "cliente o proveedor, enlázalo con su entidad).\n"
    "- Script: código guardado para reutilizar; se puede relacionar con documentos.\n"
    "- Envío: un documento usado como plantilla ({{variables}}) mandado por email a entidades.\n"
    "- Seguimiento (pendiente, en curso, realizado, aplazado): se pone a un documento, a una nota de "
    "documento o a una nota del bloc.\n"
    "- Programación: aviso o recordatorio en una fecha; puede colgar de una nota del bloc.\n"
    "- Contacto: una persona dentro de una entidad (nombre, cargo, email, teléfono).\n"
    "- Oportunidad de venta: siempre de una entidad, en una etapa del embudo (listar_etapas_gd), "
    "con importe, responsable y próximo paso; se le pueden enlazar documentos (el presupuesto). "
    "Ganarla o perderla es moverla a una etapa ganada o perdida (al perderla, pregunta el motivo). "
    "Para preparar una reunión o saber cómo va un cliente, mira historial_entidad_gd y sus "
    "oportunidades. Lo facturado y lo pendiente de cobro (del ERP: Multiplika SIF o un Excel "
    "importado) está en datos_erp_entidad_gd; di siempre de qué fecha son los datos.\n"
    "Borrar una entidad, un grupo o un script solo quita sus vínculos: los documentos no se tocan. "
    "Cuando crees algo que tiene que ver con otra cosa que ya existe, vincúlalos en el mismo paso "
    "(p.ej. al guardar una factura, relaciónala con su proveedor)."
)

CAMPOS_REGLAS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno de la regla"),
    # `unique=True` en la columna, no un Index(unico=True): el ORM nombra los
    # índices solo por sus columnas ("nombre_idx"), y ese nombre ya lo tiene
    # gd_documentos en el mismo esquema — el índice no llegaba a crearse (los
    # nombres de índice son únicos por esquema en Postgres). Como restricción
    # de columna, Postgres la llama gd_reglas_nombre_key y no choca con nada.
    Columna(nombre="nombre", tipo="VARCHAR", longitud=100, not_null=True, unique=True,
            comentario='Cómo se llama esta regla, p.ej. "boletines_replicas": obligatorio, sin '
                       "repetir y renombrable (igual que el nombre de una API key). Sirve para que "
                       "una regla global remita a otra por su nombre en su propio texto y la IA "
                       "pueda cargarla con obtener_reglas_gd(nombres=[...]) — el nombre va delante "
                       "de cada regla en el bloque que recibe la IA"),
    Columna(nombre="texto", tipo="MEDIUMTEXT", not_null=True,
            comentario="La instrucción, redactada para la IA y en una sola idea por regla "
                       "(cuanto más corta, menos cuesta inyectarla en cada sesión)"),
    Columna(nombre="categoria", tipo="VARCHAR", longitud=100, not_null=True,
            comentario='Agrupa reglas por tipo de tarea, p.ej. "datos_empresa", "boletines", '
                       '"correo", "estilo", "facturacion" — texto libre, catálogo abierto igual '
                       "que gd_scripts.lenguaje, no una lista cerrada"),
    Columna(nombre="es_global", tipo="BOOLEAN", not_null=True, default=False,
            comentario="True = se inyecta en el contexto al abrir sesión, sin que la IA tenga que "
                       "pedirla (nivel 1). Solo para lo que hace falta en casi cualquier tarea; el "
                       'resto se carga por categoría con obtener_reglas_gd. "global" a secas no vale '
                       "de nombre: es palabra reservada en Python y no puede ser parámetro de una tool"),
    Columna(nombre="prioridad", tipo="INT", not_null=True, default=0,
            comentario="Orden en que se le presentan a la IA dentro de su categoría: primero las de "
                       "número más alto. Para poner delante lo que no debe pasarse por alto"),
    Columna(nombre="activa", tipo="BOOLEAN", not_null=True, default=True,
            comentario="Permite desactivar una regla sin borrarla (deja de inyectarse y de salir en "
                       "obtener_reglas_gd, pero se puede recuperar)"),
    Columna(nombre="reservada", tipo="BOOLEAN", not_null=True, default=False,
            comentario="Igual que gd_documentos.reservado: no se comparte con las GDs enlazadas que "
                       "nos consultan. Una regla suele llevar datos de la empresa (correos, "
                       "criterios internos), así que esto es lo que evita que salgan hacia otra"),
    Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
]

INDICES_REGLAS = [
    Index(columnas=["categoria"]),
    Index(columnas=["es_global"]),
]

TABLA_REGLAS = Tabla(
    nombre=NOMBRE_TABLA_REGLAS, columnas=CAMPOS_REGLAS, indices=INDICES_REGLAS,
    comentario="Instrucciones de comportamiento para la IA en esta gestión documental",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_REGLAS]
