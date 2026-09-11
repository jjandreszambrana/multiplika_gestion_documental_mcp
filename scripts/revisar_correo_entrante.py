#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""Ingesta de documentos por email — ver docs/gestion-documental.md →
"Ingesta por email". Cada cliente conecta SU PROPIA cuenta de correo
(dirección + contraseña, gestionable desde el panel:
GET/PUT /v1/proyectos/{id}/configuracion/cuenta-email) — decisión de
producto, 2026-09-10: se descartó un buzón/dominio compartido de la
plataforma (ver el historial de docs/gestion-documental.md → "Ingesta por
email" para el porqué). Esa misma cuenta sirve también para mandar los
avisos de caducidad, ver scripts/avisar_caducidades.py.

Revisa por IMAP los correos NO LEÍDOS de la cuenta de cada cliente, extrae
los adjuntos válidos (imagen o PDF) de cada uno, los inserta en
gd_documentos_pendientes de ESE cliente con origen='email', y marca el
correo como leído — igual que la subida masiva del panel, a la espera de
que el cliente hable con su IA para procesarlos (ver
docs/gestion-documental.md → "Documentos pendientes"). Un cliente sin
cuenta configurada se salta sin más.

Autocontenido, mismo patrón que scripts/avisar_caducidades.py (ver su
docstring para el razonamiento sobre por qué no pasa por
database/modelos de este repo).

Uso: python scripts/revisar_correo_entrante.py
Necesita ENV_PATH apuntando a env/env.json, igual que el resto de scripts
que corren ya desplegados (ver docs/despliegue.md)."""

import asyncio
import email
import imaplib
import os
import sys
from email.message import Message

_RAIZ_CORE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__)))))))
sys.path.insert(0, _RAIZ_CORE)

from mtpk_mariadb import AsyncCrudBase  # noqa: E402
from mtpk_postgres.async_adapter import AsyncDatabase  # noqa: E402

from database.config_db import get_db_config  # noqa: E402
from database.control.dependencias._dep_proyectos import TABLA_PROYECTOS  # noqa: E402
from lib.cifrado import descifrar  # noqa: E402

TIPOS_MIME_VALIDOS_EXACTOS = ("application/pdf",)  # + cualquier "image/*", ver _es_adjunto_valido


async def _proyectos_gestion_documental_activos() -> list[dict]:
    proyectos = AsyncCrudBase(TABLA_PROYECTOS, get_db_config("control"))
    filas, _ = await proyectos.listar(
        filtros={
            "motor": {"op": "=", "valor": "postgres"},
            "estado": {"op": "=", "valor": 1},
            "tipo_producto": {"op": "=", "valor": "gestion_documental"},
        },
        limit=1000,
    )
    return [p for p in filas if p.get("db_password_cifrada")]


async def _cuenta_email(config: dict) -> dict | None:
    db = AsyncDatabase(**config)
    filas = await db.query(
        "SELECT email_cuenta_direccion, email_cuenta_usuario, email_cuenta_password_cifrada, "
        "email_cuenta_imap_host, email_cuenta_imap_port, email_cuenta_imap_seguridad "
        "FROM gd_configuracion WHERE id = 1"
    )
    if not filas:
        return None
    fila = filas[0]
    if not fila["email_cuenta_direccion"] or not fila["email_cuenta_password_cifrada"]:
        return None
    return {
        "direccion": fila["email_cuenta_direccion"],
        "usuario": fila["email_cuenta_usuario"] or fila["email_cuenta_direccion"],
        "password": descifrar(fila["email_cuenta_password_cifrada"]),
        "imap_host": fila["email_cuenta_imap_host"],
        "imap_port": fila["email_cuenta_imap_port"] or 993,
        "imap_seguridad": fila["email_cuenta_imap_seguridad"] or "ssl",
    }


def _conectar_imap(cuenta: dict) -> imaplib.IMAP4:
    """`imap_seguridad` es explícito, elegido por el cliente en el panel
    — antes siempre se asumía SSL/TLS directo, sin opción de STARTTLS ni
    de una conexión sin cifrar (poco común, pero algún servidor interno
    de cliente podría no tener certificado)."""
    if cuenta["imap_seguridad"] == "ssl":
        return imaplib.IMAP4_SSL(cuenta["imap_host"], cuenta["imap_port"])
    imap = imaplib.IMAP4(cuenta["imap_host"], cuenta["imap_port"])
    if cuenta["imap_seguridad"] == "starttls":
        imap.starttls()
    return imap


def _es_adjunto_valido(parte: Message) -> bool:
    tipo = parte.get_content_type()
    return tipo in TIPOS_MIME_VALIDOS_EXACTOS or tipo.startswith("image/")


async def _guardar_pendiente(config: dict, contenido: bytes, tipo_mime: str, nombre: str) -> None:
    db = AsyncDatabase(**config)
    await db.query(
        "INSERT INTO gd_documentos_pendientes (archivo, tipo_mime, nombre_original, origen) "
        "VALUES (%s, %s, %s, 'email')",
        (contenido, tipo_mime, nombre),
    )


def _leer_adjuntos_no_leidos(cuenta: dict) -> list[tuple[bytes, str, str]]:
    """Bloqueante (imaplib no es async) — se llama vía asyncio.to_thread.
    Marca cada correo como leído según lo procesa, tenga o no adjuntos
    válidos, para no revisarlo otra vez en la siguiente ejecución."""
    adjuntos = []
    imap = _conectar_imap(cuenta)
    try:
        imap.login(cuenta["usuario"], cuenta["password"])
        imap.select("INBOX")
        _, datos = imap.search(None, "UNSEEN")
        for num in datos[0].split():
            _, msg_datos = imap.fetch(num, "(RFC822)")
            mensaje = email.message_from_bytes(msg_datos[0][1])
            for parte in mensaje.walk():
                if parte.is_multipart() or not parte.get_filename():
                    continue
                if not _es_adjunto_valido(parte):
                    continue
                contenido = parte.get_payload(decode=True)
                if contenido:
                    adjuntos.append((contenido, parte.get_content_type(), parte.get_filename()))
            imap.store(num, "+FLAGS", "\\Seen")
    finally:
        try:
            imap.close()
        except imaplib.IMAP4.error:
            pass
        imap.logout()
    return adjuntos


async def _procesar_proyecto(proyecto: dict) -> None:
    config = get_db_config(proyecto["id"])
    cuenta = await _cuenta_email(config)
    if not cuenta:
        return

    try:
        adjuntos = await asyncio.to_thread(_leer_adjuntos_no_leidos, cuenta)
    except (imaplib.IMAP4.error, OSError) as e:
        # Una cuenta mal configurada (contraseña caducada, servidor caído...)
        # de un cliente no debe impedir revisar la de los demás.
        print(f"{proyecto['nombre']}: fallo revisando {cuenta['direccion']}: {e}")
        return

    for contenido, tipo_mime, nombre in adjuntos:
        await _guardar_pendiente(config, contenido, tipo_mime, nombre)

    if adjuntos:
        print(f"{proyecto['nombre']}: {len(adjuntos)} adjunto(s) guardado(s) como pendientes.")


async def main() -> None:
    for proyecto in await _proyectos_gestion_documental_activos():
        await _procesar_proyecto(proyecto)


if __name__ == "__main__":
    asyncio.run(main())
