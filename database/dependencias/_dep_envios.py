"""Envíos de comunicaciones por email — ver docs/gestion-documental.md →
"Comunicaciones y envíos". Un envío es una instancia concreta de mandar
un documento-plantilla (con variables `{{asi}}` ya resueltas) a una
entidad, por email — de uno en uno, aunque un "lote" cree varios a la vez
(uno por entidad elegida).

Decisión clave: el asunto y el cuerpo (texto y HTML) se resuelven y
guardan YA HECHOS en el momento de crear el envío, no en el momento de
mandarlo. Así:
  - un envío programado para más adelante manda exactamente lo que se
    aprobó al programarlo, aunque el documento plantilla cambie después;
  - el cron que manda los programados (scripts/procesar_envios.py) no
    necesita la librería `markdown` ni la lógica de sustitución de
    variables — solo lee `contenido_html`/`contenido_texto` ya
    resueltos y los manda tal cual, igual de autocontenido que
    avisar_caducidades.py/avisar_incidencias.py."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

from ._dep_documentos import NOMBRE_TABLA_DOCUMENTOS
from ._dep_entidades import NOMBRE_TABLA_ENTIDADES
from ._dep_versiones import NOMBRE_TABLA_VERSIONES

NOMBRE_TABLA_ENVIOS = "gd_envios"
__DB_NAME__ = get_db_name("gestion_documental")

ESTADOS_ENVIO = ["programado", "enviado", "fallido", "cancelado"]

CAMPOS_ENVIOS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno del envío"),
    Columna(nombre="id_documento", tipo="INT", not_null=True,
            comentario="Documento-plantilla usado (→ gd_documentos.id)"),
    Columna(nombre="id_version_origen", tipo="INT",
            comentario="Versión del documento con la que se resolvió este envío (→ "
                       "gd_versiones.id) — solo informativo/trazabilidad, el contenido ya "
                       "resuelto vive en este mismo registro"),
    Columna(nombre="id_entidad", tipo="INT", not_null=True,
            comentario="Entidad destinataria (→ gd_entidades.id)"),
    Columna(nombre="email_destino", tipo="VARCHAR", longitud=255, not_null=True,
            comentario="Email al que se manda — copiado del de la entidad al crear el envío, "
                       "no se vuelve a mirar aunque la entidad cambie el suyo después"),
    Columna(nombre="variables", tipo="MEDIUMTEXT",
            comentario="JSON con los valores usados (auto de la entidad + personalizadas del "
                       "lote) — solo para consulta/auditoría, no se reprocesa al mandar"),
    Columna(nombre="asunto", tipo="VARCHAR", longitud=500, not_null=True,
            comentario="Asunto ya resuelto (nombre del documento con las variables sustituidas)"),
    Columna(nombre="contenido_html", tipo="MEDIUMTEXT", not_null=True,
            comentario="Cuerpo del email ya resuelto y convertido a HTML"),
    Columna(nombre="contenido_texto", tipo="MEDIUMTEXT", not_null=True,
            comentario="Cuerpo ya resuelto en texto plano (markdown sin convertir) — parte "
                       "alternativa del email para clientes que no muestran HTML"),
    Columna(nombre="estado", tipo="VARCHAR", longitud=20, not_null=True, enum_opciones=ESTADOS_ENVIO,
            comentario="programado / enviado / fallido / cancelado"),
    Columna(nombre="fecha_programada", tipo="TIMESTAMP",
            comentario="Cuándo debe mandarse — NULL significa \"ya\" (se manda al crear el "
                       "envío, no espera al cron)"),
    Columna(nombre="fecha_envio", tipo="TIMESTAMP", comentario="Cuándo se mandó de verdad"),
    Columna(nombre="error", tipo="MEDIUMTEXT", comentario="Motivo del fallo, si estado='fallido'"),
    Columna(nombre="creado_por", tipo="VARCHAR", longitud=255, not_null=True,
            comentario="Quién programó/mandó este envío — texto libre, mismo motivo que "
                       "gd_registros.creado_por (no hay identidad de persona fiable por MCP)"),
    Columna(nombre="fecha_creacion", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
]

INDICES_ENVIOS = [
    Index(columnas=["estado", "fecha_programada"]),
    Index(columnas=["id_documento"]),
    Index(columnas=["id_entidad"]),
]

FKS_ENVIOS = [
    ForeignKey(columna="id_documento", referencia_tabla=NOMBRE_TABLA_DOCUMENTOS,
               referencia_columna="id", on_delete="CASCADE"),
    ForeignKey(columna="id_version_origen", referencia_tabla=NOMBRE_TABLA_VERSIONES,
               referencia_columna="id", on_delete="SET NULL"),
    ForeignKey(columna="id_entidad", referencia_tabla=NOMBRE_TABLA_ENTIDADES,
               referencia_columna="id", on_delete="CASCADE"),
]

TABLA_ENVIOS = Tabla(
    nombre=NOMBRE_TABLA_ENVIOS, columnas=CAMPOS_ENVIOS,
    indices=INDICES_ENVIOS, foreign_keys=FKS_ENVIOS,
    comentario="Envíos de comunicaciones (documento-plantilla con variables resueltas) a "
               "entidades, por email — manuales o programados",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_ENVIOS]
