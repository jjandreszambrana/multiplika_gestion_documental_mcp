#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""Manda los envíos programados cuya fecha ya ha llegado — ver
docs/gestion-documental.md → "Comunicaciones y envíos". Recorre cada
proyecto de gestión documental activo (Postgres,
`tipo_producto='gestion_documental'` en la base de control) y manda por
SMTP (cuenta propia del cliente) cada `gd_envios` en estado 'programado'
con `fecha_programada <= ahora`.

A diferencia de avisar_caducidades.py/avisar_incidencias.py, este script
NO resuelve variables ni convierte markdown a HTML: `asunto`,
`contenido_html` y `contenido_texto` ya vienen resueltos y guardados
desde el momento en que se creó el envío (ver
database/modelos/_mod_envios.py::crear_envios) — este script solo lee
esas columnas y las manda tal cual. Por eso no necesita la librería
`markdown` ni conocer el formato de `{{variable}}`, y sigue siendo
autocontenido igual que los otros dos scripts (SQL en línea, no importa
`database/modelos` de este repo).

Uso: python scripts/procesar_envios.py [--simular]
Necesita ENV_PATH apuntando a env/env.json, igual que el resto de scripts
que corren ya desplegados (ver docs/despliegue.md)."""

import argparse
import asyncio
import os
import smtplib
import sys
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

_RAIZ_CORE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__)))))))
sys.path.insert(0, _RAIZ_CORE)

from mtpk_mariadb import AsyncCrudBase  # noqa: E402
from mtpk_postgres.async_adapter import AsyncDatabase  # noqa: E402

from database.config_db import get_db_config  # noqa: E402
from database.control.dependencias._dep_proyectos import TABLA_PROYECTOS  # noqa: E402
from lib.cifrado import descifrar  # noqa: E402


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


async def _envios_pendientes(config: dict) -> list[dict]:
    db = AsyncDatabase(**config)
    sql = """
        SELECT id, email_destino, asunto, contenido_html, contenido_texto
        FROM gd_envios
        WHERE estado = 'programado' AND fecha_programada <= %s
        ORDER BY fecha_programada ASC
    """
    return await db.query(sql, (datetime.now(timezone.utc),))


async def _cuenta_email(config: dict) -> dict | None:
    db = AsyncDatabase(**config)
    filas = await db.query(
        "SELECT email_cuenta_direccion, email_cuenta_usuario, email_cuenta_password_cifrada, "
        "email_cuenta_smtp_host, email_cuenta_smtp_port, email_cuenta_smtp_seguridad "
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
        "smtp_host": fila["email_cuenta_smtp_host"],
        "smtp_port": fila["email_cuenta_smtp_port"] or 587,
        "smtp_seguridad": fila["email_cuenta_smtp_seguridad"] or "starttls",
    }


def _conectar_smtp(cuenta: dict) -> smtplib.SMTP:
    if cuenta["smtp_seguridad"] == "ssl":
        smtp = smtplib.SMTP_SSL(cuenta["smtp_host"], cuenta["smtp_port"])
    else:
        smtp = smtplib.SMTP(cuenta["smtp_host"], cuenta["smtp_port"])
        if cuenta["smtp_seguridad"] == "starttls":
            smtp.starttls()
    smtp.login(cuenta["usuario"], cuenta["password"])
    return smtp


def _enviar_email(cuenta: dict, envio: dict) -> None:
    mensaje = MIMEMultipart("alternative")
    mensaje["Subject"] = envio["asunto"]
    mensaje["From"] = cuenta["direccion"]
    mensaje["To"] = envio["email_destino"]
    mensaje.attach(MIMEText(envio["contenido_texto"], "plain", _charset="utf-8"))
    mensaje.attach(MIMEText(envio["contenido_html"], "html", _charset="utf-8"))

    with _conectar_smtp(cuenta) as smtp:
        smtp.send_message(mensaje)


async def _marcar(config: dict, id_envio: int, estado: str, error: str | None = None) -> None:
    db = AsyncDatabase(**config)
    if estado == "enviado":
        await db.query(
            "UPDATE gd_envios SET estado = %s, fecha_envio = %s WHERE id = %s",
            (estado, datetime.now(timezone.utc), id_envio),
        )
    else:
        await db.query("UPDATE gd_envios SET estado = %s, error = %s WHERE id = %s", (estado, error, id_envio))


async def _procesar_proyecto(proyecto: dict, simular: bool) -> None:
    config = get_db_config(proyecto["id"])
    envios = await _envios_pendientes(config)
    if not envios:
        return

    cuenta = await _cuenta_email(config)
    if not cuenta:
        print(f"{proyecto['nombre']}: {len(envios)} envío(s) pendiente(s), pero falta la cuenta de correo — se omiten.")
        return

    for envio in envios:
        print(f"{proyecto['nombre']}: mandando envío {envio['id']} a {envio['email_destino']} desde {cuenta['direccion']}.")
        if simular:
            continue
        try:
            _enviar_email(cuenta, envio)
        except (smtplib.SMTPException, OSError) as e:
            # Mismo motivo que avisar_caducidades.py: un destinatario mal
            # configurado no debe tumbar el resto de envíos, ni de este
            # proyecto ni de los demás.
            print(f"{proyecto['nombre']}: fallo mandando el envío {envio['id']}: {e}")
            await _marcar(config, envio["id"], "fallido", str(e))
            continue
        await _marcar(config, envio["id"], "enviado")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--simular", action="store_true", help="No manda ni marca nada, solo informa")
    args = parser.parse_args()

    for proyecto in await _proyectos_gestion_documental_activos():
        await _procesar_proyecto(proyecto, args.simular)


if __name__ == "__main__":
    asyncio.run(main())
