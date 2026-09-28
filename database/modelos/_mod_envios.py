"""CRUD y lógica de gd_envios — comunicaciones (documentos-plantilla con
variables `{{asi}}`) enviadas por email a entidades. Ver
docs/gestion-documental.md → "Comunicaciones y envíos"."""

import json
import re
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import markdown as md
from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_documentos import TABLA_DOCUMENTOS
from ..dependencias._dep_entidades import TABLA_ENTIDADES
from ..dependencias._dep_envios import TABLA_ENVIOS
from ._mod_configuracion import ConfiguracionCRUD
from ._mod_documentos import DocumentosCRUD
from ._mod_entidades import EntidadesCRUD
from ._mod_versiones import VersionesCRUD

# Variables que se rellenan solas a partir de la ficha de la entidad
# (mismos nombres que sus columnas, ver _dep_entidades.py) — cualquier
# otra variable que aparezca en la plantilla es "personalizada": la
# escribe quien manda el envío, mismo valor para todas las entidades del
# lote (ver docs/gestion-documental.md, decisión de producto).
CAMPOS_ENTIDAD_AUTO = [
    "nombre", "tipo", "direccion", "localidad", "provincia", "codigo_postal",
    "pais", "telefono", "email", "observaciones", "codigo",
]

_PATRON_VARIABLE = re.compile(r"\{\{\s*(\w+)\s*\}\}")

_CSS_EMAIL = """
body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; line-height: 1.5; }
h1, h2, h3 { font-family: Georgia, serif; }
table { border-collapse: collapse; }
td, th { border: 1px solid #ddd; padding: 6px 10px; }
"""


def detectar_variables(texto: str) -> list[str]:
    """Nombres de variable únicos que aparecen en `texto` (nombre del
    documento y/o su markdown), en el orden en que aparecen."""
    vistas: list[str] = []
    for coincidencia in _PATRON_VARIABLE.finditer(texto):
        nombre = coincidencia.group(1)
        if nombre not in vistas:
            vistas.append(nombre)
    return vistas


def clasificar_variables(variables: list[str]) -> dict:
    """{"auto": [...], "personalizadas": [...]} — las "auto" se resuelven
    solas de la ficha de cada entidad; las "personalizadas" las escribe
    quien crea el envío."""
    return {
        "auto": [v for v in variables if v in CAMPOS_ENTIDAD_AUTO],
        "personalizadas": [v for v in variables if v not in CAMPOS_ENTIDAD_AUTO],
    }


def resolver_variables(texto: str, valores: dict) -> str:
    """Sustituye `{{variable}}` por su valor en `valores`. La que no
    tenga valor (None, o ausente) se deja tal cual en el texto — a
    propósito, para que se note en la vista previa que falta rellenarla
    en vez de desaparecer en silencio."""

    def _sustituir(coincidencia: re.Match) -> str:
        nombre = coincidencia.group(1)
        valor = valores.get(nombre)
        return str(valor) if valor not in (None, "") else coincidencia.group(0)

    return _PATRON_VARIABLE.sub(_sustituir, texto)


def _renderizar_html(cuerpo_markdown: str) -> str:
    cuerpo_html = md.markdown(cuerpo_markdown, extensions=["tables"])
    return f"<html><head><style>{_CSS_EMAIL}</style></head><body>{cuerpo_html}</body></html>"


def mandar_correo(cuenta: dict, destino: str, asunto: str, texto: str, html: str) -> None:
    """Manda un email (texto + HTML) con la cuenta de correo del proyecto
    (ConfiguracionCRUD.obtener_cuenta_email). Lanza SMTPException/OSError
    si falla — el llamador decide qué hacer con el error."""
    mensaje = MIMEMultipart("alternative")
    mensaje["Subject"] = asunto
    mensaje["From"] = cuenta["direccion"]
    mensaje["To"] = destino
    mensaje.attach(MIMEText(texto, "plain", _charset="utf-8"))
    mensaje.attach(MIMEText(html, "html", _charset="utf-8"))

    if cuenta["smtp_seguridad"] == "ssl":
        smtp = smtplib.SMTP_SSL(cuenta["smtp_host"], cuenta["smtp_port"])
    else:
        smtp = smtplib.SMTP(cuenta["smtp_host"], cuenta["smtp_port"])
        if cuenta["smtp_seguridad"] == "starttls":
            smtp.starttls()
    with smtp:
        smtp.login(cuenta["usuario"], cuenta["password"])
        smtp.send_message(mensaje)


class EnviosCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_ENVIOS, config)

    async def listar_de_documento(self, id_documento: int) -> list[dict]:
        """Incluye el nombre de la entidad destinataria (vía JOIN) — el
        panel lo muestra sin pedir cada entidad aparte."""
        db = AsyncDatabase(**self.config)
        sql = f"""
            SELECT env.*, ent.nombre AS entidad_nombre
            FROM "{TABLA_ENVIOS.nombre}" env
            JOIN "{TABLA_ENTIDADES.nombre}" ent ON ent.id = env.id_entidad
            WHERE env.id_documento = %s
            ORDER BY env.fecha_creacion DESC
            LIMIT 500
        """
        return await db.query(sql, (id_documento,))

    async def listar_de_entidad(self, id_entidad: int) -> list[dict]:
        """Incluye el nombre del documento-plantilla (vía JOIN)."""
        db = AsyncDatabase(**self.config)
        sql = f"""
            SELECT env.*, doc.nombre AS documento_nombre
            FROM "{TABLA_ENVIOS.nombre}" env
            JOIN "{TABLA_DOCUMENTOS.nombre}" doc ON doc.id = env.id_documento
            WHERE env.id_entidad = %s
            ORDER BY env.fecha_creacion DESC
            LIMIT 500
        """
        return await db.query(sql, (id_entidad,))

    async def listar_pendientes_de_envio(self) -> list[dict]:
        """Programados cuya fecha ya ha llegado — los usa el cron
        (scripts/procesar_envios.py, consulta equivalente en SQL a
        propósito, ver ese script)."""
        filas, _ = await self.listar(
            filtros={
                "estado": {"op": "=", "valor": "programado"},
                "fecha_programada": {"op": "<=", "valor": datetime.now(timezone.utc)},
            },
            limit=500, orden="fecha_programada ASC",
        )
        return filas


async def detectar_variables_documento(config: dict, id_documento: int) -> dict:
    """Variables detectadas en el nombre + markdown de la versión vigente
    de un documento, ya clasificadas en auto/personalizadas."""
    documento = await DocumentosCRUD(config).obtener(id_documento)
    if not documento:
        raise ValueError(f"No existe ningún documento con id {id_documento}")
    version = await VersionesCRUD(config).obtener_vigente(id_documento)
    texto = documento["nombre"] + "\n" + (version["markdown_actual"] if version else "")
    return clasificar_variables(detectar_variables(texto))


async def crear_envios(
    config: dict,
    id_documento: int,
    ids_entidad: list[int],
    variables_personalizadas: dict,
    creado_por: str,
    fecha_programada: datetime | None = None,
) -> list[dict]:
    """Crea un envío por cada entidad de `ids_entidad`, con las variables
    ya resueltas y el cuerpo ya convertido a HTML — uno por entidad
    porque cada una necesita su propio email_destino y sus propias
    variables "auto" (nombre, email...), aunque las personalizadas sean
    las mismas para todo el lote. Si `fecha_programada` es None, quedan
    listos para mandarse ya (el llamador decide cuándo, ver
    enviar_envio); si se indica, quedan `estado='programado'` para que
    los recoja scripts/procesar_envios.py."""
    documento = await DocumentosCRUD(config).obtener(id_documento)
    if not documento:
        raise ValueError(f"No existe ningún documento con id {id_documento}")
    version = await VersionesCRUD(config).obtener_vigente(id_documento)
    if not version:
        raise ValueError(f"El documento {id_documento} no tiene ninguna versión vigente")

    entidades = EntidadesCRUD(config)
    envios = EnviosCRUD(config)
    creados = []

    for id_entidad in ids_entidad:
        entidad = await entidades.obtener(id_entidad)
        if not entidad:
            raise ValueError(f"No existe ninguna entidad con id {id_entidad}")

        valores = {campo: entidad.get(campo) for campo in CAMPOS_ENTIDAD_AUTO}
        valores.update(variables_personalizadas)

        asunto = resolver_variables(documento["nombre"], valores)
        contenido_texto = resolver_variables(version["markdown_actual"], valores)
        contenido_html = _renderizar_html(contenido_texto)
        email_destino = entidad.get("email") or ""

        id_envio = await envios.insert({
            "id_documento": id_documento,
            "id_version_origen": version["id"],
            "id_entidad": id_entidad,
            "email_destino": email_destino,
            "variables": json.dumps(valores, ensure_ascii=False, default=str),
            "asunto": asunto,
            "contenido_html": contenido_html,
            "contenido_texto": contenido_texto,
            "estado": "fallido" if not email_destino else "programado",
            "error": "La entidad no tiene email configurado" if not email_destino else None,
            "fecha_programada": fecha_programada,
            "creado_por": creado_por,
        })
        creados.append(await envios.obtener(id_envio))

    return creados


async def enviar_envio(config: dict, id_envio: int) -> dict:
    """Manda un envío ya creado (estado='programado') por SMTP, con la
    cuenta de correo propia del proyecto — mismo mecanismo que los
    avisos de caducidad/incidencias. Marca 'enviado' o 'fallido' según
    el resultado; no falla la llamada si el envío en sí falla, para que
    un lote con un destinatario problemático no aborte a los demás
    (igual criterio que avisar_caducidades.py)."""
    envios = EnviosCRUD(config)
    envio = await envios.obtener(id_envio)
    if not envio:
        raise ValueError(f"No existe ningún envío con id {id_envio}")
    if envio["estado"] != "programado":
        raise ValueError(f"Este envío ya está en estado '{envio['estado']}', no se puede mandar")

    cuenta = await ConfiguracionCRUD(config).obtener_cuenta_email()
    if not cuenta:
        await envios.update(id_envio, {"estado": "fallido", "error": "No hay cuenta de correo configurada"})
        return await envios.obtener(id_envio)

    try:
        mandar_correo(cuenta, envio["email_destino"], envio["asunto"], envio["contenido_texto"], envio["contenido_html"])
    except (smtplib.SMTPException, OSError) as e:
        await envios.update(id_envio, {"estado": "fallido", "error": str(e)})
        return await envios.obtener(id_envio)

    await envios.update(id_envio, {"estado": "enviado", "fecha_envio": datetime.now(timezone.utc)})
    return await envios.obtener(id_envio)


async def cancelar_envio(config: dict, id_envio: int) -> dict:
    envios = EnviosCRUD(config)
    envio = await envios.obtener(id_envio)
    if not envio:
        raise ValueError(f"No existe ningún envío con id {id_envio}")
    if envio["estado"] != "programado":
        raise ValueError(f"Este envío ya está en estado '{envio['estado']}', no se puede cancelar")
    await envios.update(id_envio, {"estado": "cancelado"})
    return await envios.obtener(id_envio)


async def reintentar_envio(config: dict, id_envio: int) -> dict:
    """Vuelve a poner en 'programado' un envío fallido (con el mismo
    contenido ya resuelto) y lo intenta mandar ahora mismo."""
    envios = EnviosCRUD(config)
    envio = await envios.obtener(id_envio)
    if not envio:
        raise ValueError(f"No existe ningún envío con id {id_envio}")
    if envio["estado"] != "fallido":
        raise ValueError(f"Este envío está en estado '{envio['estado']}', no en 'fallido'")
    if not envio["email_destino"]:
        raise ValueError("Esta entidad sigue sin email — actualízala antes de reintentar")
    await envios.update(id_envio, {"estado": "programado", "error": None})
    return await enviar_envio(config, id_envio)
