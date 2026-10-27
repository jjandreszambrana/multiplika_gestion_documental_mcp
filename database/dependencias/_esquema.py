"""Lista completa de tablas de la base de un cliente, en un solo sitio:
la usan update_db.py (aplicar el esquema al dar de alta o migrar) y la
restauración de copias de la base (_mod_copias_bd.py), que tras volver a
una copia antigua pone su esquema al día con el código actual."""

from ._dep_actividad import TABLA_ACTIVIDAD
from ._dep_activos_digitales import __TABLAS__ as TABLAS_ACTIVOS_DIGITALES
from ._dep_aprendizajes import TABLA_APRENDIZAJES
from ._dep_bases_datos import __TABLAS__ as TABLAS_BASES_DATOS
from ._dep_bloc_notas import __TABLAS__ as TABLAS_BLOC_NOTAS
from ._dep_chat import TABLA_CHAT_CONVERSACIONES
from ._dep_chunks import construir_tabla_chunks
from ._dep_compartidos import TABLA_COMPARTIDOS
from ._dep_contabilidad import __TABLAS__ as TABLAS_CONTABILIDAD
from ._dep_conciliacion import __TABLAS__ as TABLAS_CONCILIACION
from ._dep_configuracion import PROVEEDORES_EMBEDDING_SOPORTADOS, construir_tabla_configuracion
from ._dep_credenciales import TABLA_CREDENCIALES
from ._dep_credenciales_campos import TABLA_CREDENCIALES_CAMPOS
from ._dep_crm import __TABLAS__ as TABLAS_CRM
from ._dep_documentos import TABLA_DOCUMENTOS
from ._dep_documentos_pendientes import TABLA_DOCUMENTOS_PENDIENTES
from ._dep_enlaces import TABLA_ENLACES, TABLA_PREGUNTAS_PENDIENTES, TABLA_USO_ENLACES
from ._dep_entidades import TABLA_DOCUMENTOS_ENTIDADES, TABLA_ENTIDADES
from ._dep_envios import TABLA_ENVIOS
from ._dep_erp import __TABLAS__ as TABLAS_ERP
from ._dep_estilos import TABLA_ESTILOS, TABLA_ESTILOS_IMAGENES
from ._dep_geo import __TABLAS__ as TABLAS_GEO
from ._dep_grupos import TABLA_DOCUMENTOS_GRUPOS, TABLA_GRUPOS
from ._dep_historial_ediciones import TABLA_HISTORIAL_EDICIONES
from ._dep_notas import TABLA_NOTAS, TABLA_NOTAS_RELACIONES
from ._dep_programaciones import __TABLAS__ as TABLAS_PROGRAMACIONES
from ._dep_publicaciones import __TABLAS__ as TABLAS_PUBLICACIONES
from ._dep_registros import TABLA_MODELOS_REGISTRO, TABLA_REGISTROS, TABLA_REGISTROS_DOCUMENTOS
from ._dep_reglas import TABLA_REGLAS
from ._dep_scripts import TABLA_DOCUMENTOS_SCRIPTS, TABLA_SCRIPTS
from ._dep_seguimiento import __TABLAS__ as TABLAS_SEGUIMIENTO
from ._dep_seo import __TABLAS__ as TABLAS_SEO
from ._dep_solicitudes_credencial import TABLA_SOLICITUDES_CREDENCIAL
from ._dep_tipos_documento import TABLA_TIPOS_DOCUMENTO
from ._dep_versiones import TABLA_VERSIONES
from ._dep_vigilancia import __TABLAS__ as TABLAS_VIGILANCIA


def tablas_esquema(proveedor_embedding: str) -> list:
    return [
        construir_tabla_configuracion(proveedor_embedding),
        TABLA_DOCUMENTOS,
        TABLA_DOCUMENTOS_PENDIENTES,
        TABLA_VERSIONES,
        TABLA_HISTORIAL_EDICIONES,
        construir_tabla_chunks(PROVEEDORES_EMBEDDING_SOPORTADOS[proveedor_embedding]),
        TABLA_CREDENCIALES,
        TABLA_CREDENCIALES_CAMPOS,
        TABLA_SOLICITUDES_CREDENCIAL,
        TABLA_ESTILOS,
        TABLA_ESTILOS_IMAGENES,
        TABLA_TIPOS_DOCUMENTO,
        TABLA_NOTAS,
        TABLA_NOTAS_RELACIONES,
        TABLA_GRUPOS,
        TABLA_DOCUMENTOS_GRUPOS,
        TABLA_ENTIDADES,
        TABLA_DOCUMENTOS_ENTIDADES,
        TABLA_ENVIOS,
        TABLA_COMPARTIDOS,
        TABLA_CHAT_CONVERSACIONES,
        TABLA_SCRIPTS,
        TABLA_DOCUMENTOS_SCRIPTS,
        TABLA_ENLACES,
        TABLA_PREGUNTAS_PENDIENTES,
        TABLA_USO_ENLACES,
        TABLA_APRENDIZAJES,
        TABLA_REGLAS,
        TABLA_MODELOS_REGISTRO,
        TABLA_REGISTROS,
        TABLA_REGISTROS_DOCUMENTOS,
        TABLA_ACTIVIDAD,
        *TABLAS_BLOC_NOTAS,
        *TABLAS_PROGRAMACIONES,
        *TABLAS_SEGUIMIENTO,
        *TABLAS_ACTIVOS_DIGITALES,
        *TABLAS_VIGILANCIA,
        *TABLAS_SEO,
        *TABLAS_BASES_DATOS,
        *TABLAS_PUBLICACIONES,
        *TABLAS_GEO,
        *TABLAS_CRM,
        *TABLAS_ERP,
        *TABLAS_CONTABILIDAD,
        *TABLAS_CONCILIACION,
    ]
