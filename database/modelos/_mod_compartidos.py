"""Enlaces para compartir un documento — ver _dep_compartidos.py y
docs/gestion-documental.md → "Compartir un documento por enlace".
Compartido entre las tools MCP (_herr_compartidos.py) y el panel
(crear/listar/anular y la página pública que abre el destinatario)."""

import html
import os
import secrets
import smtplib
from datetime import datetime, timedelta, timezone

from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_compartidos import DIAS_VALIDEZ_PERMITIDOS, TABLA_COMPARTIDOS
from ._mod_configuracion import ConfiguracionCRUD
from ._mod_documentos import DocumentosCRUD
from ._mod_envios import mandar_correo
from ._mod_pdf import pdf_de_documento
from ._mod_versiones import VersionesCRUD

# Todo menos el PDF en sí (no hace falta para listar, y pesa). El estado
# se calcula en SQL: las fechas son TIMESTAMP sin zona, y compararlas en
# Python con un datetime con zona fallaría.
_COLUMNAS_LISTADO = (
    "id, token, id_documento, id_version, nombre_documento, incluir_original, fecha_expiracion, "
    "anulado, fecha_anulacion, email_destino, estado_email, error_email, descargas_pdf, "
    "descargas_original, fecha_ultima_descarga, creado_por, fecha_creacion, "
    "CASE WHEN anulado THEN 'anulado' WHEN fecha_expiracion <= %s THEN 'caducado' "
    "ELSE 'activo' END AS estado"
)


def url_compartido(id_proyecto: int, token: str) -> str:
    """URL pública del enlace. Lanza ValueError si el servidor no tiene
    GD_URL_PUBLICA (la inyecta sync.py del núcleo en los servicios)."""
    url_publica = os.environ.get("GD_URL_PUBLICA")
    if not url_publica:
        raise ValueError(
            "Este servidor no tiene configurada GD_URL_PUBLICA — no se puede generar el enlace. "
            "Avisa a soporte, no es algo que el cliente pueda arreglar."
        )
    return f"{url_publica.rstrip('/')}/v1/compartido/{id_proyecto}/{token}"


class CompartidosCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_COMPARTIDOS, config)

    async def _listar_donde(self, id_proyecto: int, condicion: str, valor: int) -> list[dict]:
        db = AsyncDatabase(**self.config)
        filas = await db.query(
            f'SELECT {_COLUMNAS_LISTADO} FROM "{TABLA_COMPARTIDOS.nombre}" '
            f"WHERE {condicion} = %s ORDER BY fecha_creacion DESC LIMIT 200",
            (datetime.now(timezone.utc), valor),
        )
        return [{**f, "url": url_compartido(id_proyecto, f["token"])} for f in filas]

    async def listar_de_documento(self, id_proyecto: int, id_documento: int) -> list[dict]:
        return await self._listar_donde(id_proyecto, "id_documento", id_documento)

    async def obtener_sin_pdf(self, id_proyecto: int, id_compartido: int) -> dict | None:
        filas = await self._listar_donde(id_proyecto, "id", id_compartido)
        return filas[0] if filas else None

    async def obtener_vigente(self, token: str) -> dict | None:
        """El enlace de ese token si no está anulado ni caducado — None en
        cualquier otro caso, sin distinguir el motivo de cara a quien lo
        abre."""
        filas, _ = await self.listar(
            filtros={
                "token": {"op": "=", "valor": token},
                "anulado": {"op": "=", "valor": False},
                "fecha_expiracion": {"op": ">", "valor": datetime.now(timezone.utc)},
            },
            limit=1,
        )
        return filas[0] if filas else None

    async def apuntar_descarga(self, id_compartido: int, columna: str) -> None:
        """`columna`: descargas_pdf o descargas_original. Suma en SQL, no
        leyendo y escribiendo, para no perder descargas simultáneas."""
        db = AsyncDatabase(**self.config)
        await db.query(
            f'UPDATE "{TABLA_COMPARTIDOS.nombre}" SET {columna} = {columna} + 1, '
            "fecha_ultima_descarga = %s WHERE id = %s",
            (datetime.now(timezone.utc), id_compartido),
        )


def _correo_compartido(nombre_documento: str, url: str, expira: datetime, creado_por: str,
                       mensaje: str | None) -> tuple[str, str, str]:
    """(asunto, texto, html) del email que lleva el enlace."""
    fecha = expira.strftime("%d/%m/%Y")
    asunto = f"Documento compartido: {nombre_documento}"
    texto = (
        f"{creado_por} te ha compartido el documento «{nombre_documento}».\n\n"
        + (f"{mensaje}\n\n" if mensaje else "")
        + f"Descárgalo aquí: {url}\n\nEl enlace funciona hasta el {fecha}."
    )
    parrafo_mensaje = f"<p>{html.escape(mensaje).replace(chr(10), '<br>')}</p>" if mensaje else ""
    cuerpo_html = (
        "<html><body style=\"font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; "
        "line-height: 1.5;\">"
        f"<p>{html.escape(creado_por)} te ha compartido el documento "
        f"<strong>{html.escape(nombre_documento)}</strong>.</p>{parrafo_mensaje}"
        f'<p><a href="{html.escape(url)}">Abrir y descargar el documento</a></p>'
        f'<p style="color: #666; font-size: 13px;">El enlace funciona hasta el {fecha}.</p>'
        "</body></html>"
    )
    return asunto, texto, cuerpo_html


async def crear_compartido(
    config: dict,
    id_proyecto: int,
    id_documento: int,
    creado_por: str,
    dias_validez: int = 7,
    incluir_original: bool = False,
    email_destino: str | None = None,
    mensaje: str | None = None,
) -> dict:
    """Genera el PDF de la versión vigente, lo guarda con un token nuevo
    y, si hay `email_destino`, manda el enlace desde la cuenta de correo
    del proyecto. Un fallo al mandar el email no deshace el enlace: queda
    creado igual (con estado_email='fallido' y el motivo) para poder
    copiarlo y mandarlo a mano. Lanza ValueError si algo impide crearlo."""
    if dias_validez not in DIAS_VALIDEZ_PERMITIDOS:
        raise ValueError(f"La validez tiene que ser de {', '.join(map(str, DIAS_VALIDEZ_PERMITIDOS))} días")
    documento = await DocumentosCRUD(config).obtener(id_documento)
    if not documento:
        raise ValueError(f"No existe ningún documento con id {id_documento}")
    if documento["archivado"]:
        raise ValueError("Este documento está archivado — desarchívalo antes de compartirlo")
    version = await VersionesCRUD(config).obtener_vigente(id_documento)
    if not version:
        raise ValueError(f"El documento {id_documento} no tiene ninguna versión vigente")
    if incluir_original and not version["archivo_original"]:
        raise ValueError("Este documento no tiene archivo original adjunto — compártelo solo en PDF")

    token = secrets.token_urlsafe(32)
    url = url_compartido(id_proyecto, token)  # antes de generar el PDF: si falta GD_URL_PUBLICA, falla ya
    try:
        pdf = await pdf_de_documento(config, documento, version)
    except RuntimeError as e:
        raise ValueError(str(e)) from e

    expira = datetime.now(timezone.utc) + timedelta(days=dias_validez)
    compartidos = CompartidosCRUD(config)
    id_compartido = await compartidos.insert({
        "token": token,
        "id_documento": id_documento,
        "id_version": version["id"],
        "nombre_documento": documento["nombre"],
        "pdf": pdf,
        "incluir_original": incluir_original,
        "fecha_expiracion": expira,
        "email_destino": email_destino or None,
        "creado_por": creado_por,
    })

    if email_destino:
        cuenta = await ConfiguracionCRUD(config).obtener_cuenta_email()
        if not cuenta:
            cambios = {"estado_email": "fallido", "error_email": "No hay cuenta de correo configurada"}
        else:
            try:
                mandar_correo(cuenta, email_destino, *_correo_compartido(
                    documento["nombre"], url, expira, creado_por, mensaje,
                ))
                cambios = {"estado_email": "enviado"}
            except (smtplib.SMTPException, OSError) as e:
                cambios = {"estado_email": "fallido", "error_email": str(e)}
        await compartidos.update(id_compartido, cambios)

    return await compartidos.obtener_sin_pdf(id_proyecto, id_compartido)


async def anular_compartido(config: dict, id_proyecto: int, id_compartido: int) -> dict:
    compartidos = CompartidosCRUD(config)
    fila = await compartidos.obtener_sin_pdf(id_proyecto, id_compartido)
    if not fila:
        raise ValueError(f"No existe ningún enlace compartido con id {id_compartido}")
    if fila["anulado"]:
        raise ValueError("Este enlace ya estaba anulado")
    await compartidos.update(id_compartido, {"anulado": True, "fecha_anulacion": datetime.now(timezone.utc)})
    return await compartidos.obtener_sin_pdf(id_proyecto, id_compartido)
