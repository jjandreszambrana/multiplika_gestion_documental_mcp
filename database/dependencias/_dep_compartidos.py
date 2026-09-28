"""Enlaces para compartir un documento con alguien de fuera — ver
docs/gestion-documental.md → "Compartir un documento por enlace". Quien
abre el enlace no necesita cuenta: ve el nombre del documento y descarga
el PDF y, si se eligió al crearlo, el archivo original.

Decisiones del usuario (2026-09-28):
  - el contenido queda congelado al compartir: el PDF se genera en ese
    momento y se guarda aquí mismo (si el documento se corrige después,
    quien abre el enlace sigue viendo lo que se le mandó). De paso, abrir
    el enlace no vuelve a generar el PDF cada vez;
  - el enlace caduca a los 7, 30 o 90 días (se elige al crearlo) y se
    puede anular antes;
  - sin protección extra aparte del token: queda apuntado cuántas veces
    se ha descargado.

El token se guarda en claro (no su hash, a diferencia de
gd_solicitudes_credencial) para poder volver a copiar el enlace desde el
panel: quien lee esta tabla ya puede leer el documento mismo, así que el
hash no protegería nada."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

from ._dep_documentos import NOMBRE_TABLA_DOCUMENTOS
from ._dep_versiones import NOMBRE_TABLA_VERSIONES

NOMBRE_TABLA_COMPARTIDOS = "gd_compartidos"
__DB_NAME__ = get_db_name("gestion_documental")

DIAS_VALIDEZ_PERMITIDOS = [7, 30, 90]
ESTADOS_EMAIL = ["enviado", "fallido"]

CAMPOS_COMPARTIDOS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno del enlace"),
    Columna(nombre="token", tipo="VARCHAR", longitud=64, not_null=True,
            comentario="Parte aleatoria de la URL pública — en claro a propósito, ver cabecera"),
    Columna(nombre="id_documento", tipo="INT", not_null=True, comentario="→ gd_documentos.id"),
    Columna(nombre="id_version", tipo="INT", not_null=True,
            comentario="Versión vigente al compartir (→ gd_versiones.id) — de ella sale el "
                       "archivo original, si se incluye"),
    Columna(nombre="nombre_documento", tipo="VARCHAR", longitud=500, not_null=True,
            comentario="Nombre del documento al compartir — lo que ve quien abre el enlace"),
    Columna(nombre="pdf", tipo="BLOB", not_null=True,
            comentario="PDF generado al compartir (contenido congelado)"),
    Columna(nombre="incluir_original", tipo="BOOLEAN", not_null=True, default=False,
            comentario="Si quien abre el enlace puede descargar también el archivo original"),
    Columna(nombre="fecha_expiracion", tipo="TIMESTAMP", not_null=True),
    Columna(nombre="anulado", tipo="BOOLEAN", not_null=True, default=False),
    Columna(nombre="fecha_anulacion", tipo="TIMESTAMP"),
    Columna(nombre="email_destino", tipo="VARCHAR", longitud=255,
            comentario="A quién se mandó el enlace por email desde la cuenta del proyecto — NULL "
                       "si solo se copió"),
    Columna(nombre="estado_email", tipo="VARCHAR", longitud=20, enum_opciones=ESTADOS_EMAIL),
    Columna(nombre="error_email", tipo="MEDIUMTEXT"),
    Columna(nombre="descargas_pdf", tipo="INT", not_null=True, default=0),
    Columna(nombre="descargas_original", tipo="INT", not_null=True, default=0),
    Columna(nombre="fecha_ultima_descarga", tipo="TIMESTAMP"),
    Columna(nombre="creado_por", tipo="VARCHAR", longitud=255, not_null=True,
            comentario="Quién compartió — texto libre, mismo motivo que gd_envios.creado_por"),
    Columna(nombre="fecha_creacion", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
]

INDICES_COMPARTIDOS = [
    Index(columnas=["token"], unico=True, nombre="gd_compartidos_token_idx"),
    Index(columnas=["id_documento"], nombre="gd_compartidos_id_documento_idx"),
]

FKS_COMPARTIDOS = [
    ForeignKey(columna="id_documento", referencia_tabla=NOMBRE_TABLA_DOCUMENTOS,
               referencia_columna="id", on_delete="CASCADE"),
    ForeignKey(columna="id_version", referencia_tabla=NOMBRE_TABLA_VERSIONES,
               referencia_columna="id", on_delete="CASCADE"),
]

TABLA_COMPARTIDOS = Tabla(
    nombre=NOMBRE_TABLA_COMPARTIDOS, columnas=CAMPOS_COMPARTIDOS,
    indices=INDICES_COMPARTIDOS, foreign_keys=FKS_COMPARTIDOS,
    comentario="Enlaces públicos (con caducidad) para descargar un documento en PDF y, "
               "opcionalmente, su archivo original",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_COMPARTIDOS]
