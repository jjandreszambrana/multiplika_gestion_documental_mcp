#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""Aviso proactivo por email de documentos por caducar — ver
docs/gestion-documental.md → "Fechas de caducidad y avisos proactivos por
email". Recorre cada proyecto de gestión documental activo (Postgres,
`tipo_producto='gestion_documental'` en la base de control) y manda UN
correo si tiene documentos con `fecha_caducidad` dentro de la ventana de
aviso — un solo aviso por documento (`aviso_caducidad_enviado`), no un
recordatorio diario (decisión de producto, 2026-09-10).

Autocontenido a propósito: no importa la capa `database/modelos` de este
repo (evita el lío de que `database.modelos._mod_versiones` use imports
relativos pensados para desplegarse bajo `apps.mcp_server.*`, no para
correr como script suelto) — consulta `gd_versiones`/`gd_documentos`/
`gd_configuracion` con SQL en línea, igual que ya hacen
`VersionesCRUD.listar_por_caducar()`/`buscar_fulltext()` en este mismo
repo. Si el esquema de esas tablas cambia, hay que tocar también aquí.

Pensado para cron, corriendo ya desplegado en
apps/mcp_server/paneles_cliente/multiplika_gestion_documental_mcp/scripts/
(mismo patrón que scripts/procesar_correo_entrante.py) — 5 niveles por
encima está la raíz del repo core, de donde salen `database.config_db`
(resuelve el alias -> credenciales reales, con descifrado) y
`database.control.dependencias._dep_proyectos` (mcpc_proyectos).

Uso: python scripts/avisar_caducidades.py [--dias 30] [--simular]
Necesita ENV_PATH apuntando a env/env.json, igual que el resto de scripts
que corren ya desplegados (ver docs/despliegue.md)."""

import argparse
import asyncio
import os
import smtplib
import sys
from email.mime.text import MIMEText

_RAIZ_CORE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__)))))))
sys.path.insert(0, _RAIZ_CORE)

from mtpk_mariadb import AsyncCrudBase  # noqa: E402
from mtpk_postgres.async_adapter import AsyncDatabase  # noqa: E402

from database.config_db import get_db_config  # noqa: E402
from database.control.dependencias._dep_proyectos import TABLA_PROYECTOS  # noqa: E402

DIAS_POR_DEFECTO = 30
REMITENTE = "avisos-gestion-documental@facturae.multiplika.net"


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


async def _documentos_por_caducar(config: dict, dias: int) -> list[dict]:
    db = AsyncDatabase(**config)
    sql = """
        SELECT v.id AS id_version, d.nombre, d.tipo_documento, v.fecha_caducidad
        FROM gd_versiones v
        JOIN gd_documentos d ON d.id = v.id_documento
        WHERE v.vigente = true AND d.archivado = false
          AND v.fecha_caducidad IS NOT NULL
          AND v.fecha_caducidad <= CURRENT_DATE + %s::int
          AND v.aviso_caducidad_enviado = false
        ORDER BY v.fecha_caducidad ASC
    """
    return await db.query(sql, (dias,))


async def _email_avisos(config: dict) -> str | None:
    db = AsyncDatabase(**config)
    filas = await db.query("SELECT email_avisos FROM gd_configuracion WHERE id = 1")
    return filas[0]["email_avisos"] if filas and filas[0]["email_avisos"] else None


async def _marcar_avisados(config: dict, ids_version: list[int]) -> None:
    db = AsyncDatabase(**config)
    await db.query("UPDATE gd_versiones SET aviso_caducidad_enviado = true WHERE id = ANY(%s)", (ids_version,))


def _enviar_email(destinatario: str, proyecto_nombre: str, documentos: list[dict]) -> None:
    lineas = [f'- "{d["nombre"]}" ({d["tipo_documento"]}) — caduca el {d["fecha_caducidad"]}' for d in documentos]
    cuerpo = (
        f"Documentos de {proyecto_nombre} por caducar:\n\n" + "\n".join(lineas) +
        "\n\nEste es un aviso único por documento — no se repetirá."
    )
    mensaje = MIMEText(cuerpo, _charset="utf-8")
    mensaje["Subject"] = f"[{proyecto_nombre}] Documentos por caducar ({len(documentos)})"
    mensaje["From"] = REMITENTE
    mensaje["To"] = destinatario

    with smtplib.SMTP("localhost", 25) as smtp:
        smtp.send_message(mensaje)


async def _procesar_proyecto(proyecto: dict, dias: int, simular: bool) -> None:
    config = get_db_config(proyecto["slug"])
    documentos = await _documentos_por_caducar(config, dias)
    if not documentos:
        return

    destinatario = await _email_avisos(config)
    if not destinatario:
        print(f"{proyecto['slug']}: {len(documentos)} documento(s) por caducar, sin email_avisos configurado — se omite.")
        return

    print(f"{proyecto['slug']}: avisando de {len(documentos)} documento(s) a {destinatario}.")
    if simular:
        return

    try:
        _enviar_email(destinatario, proyecto["nombre"], documentos)
    except (smtplib.SMTPException, OSError) as e:
        # Un email_avisos mal configurado (buzón inexistente, dominio caído...)
        # de UN cliente no debe tumbar el aviso de todos los demás — sin este
        # try/except, un fallo aquí propagaba hasta main() y abortaba el
        # bucle entero (bug real encontrado al probarlo, 2026-09-10). No se
        # marca aviso_caducidad_enviado: se reintenta solo en la siguiente
        # ejecución diaria, nada se pierde.
        print(f"{proyecto['slug']}: fallo mandando el aviso a {destinatario}: {e}")
        return

    await _marcar_avisados(config, [d["id_version"] for d in documentos])


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dias", type=int, default=DIAS_POR_DEFECTO)
    parser.add_argument("--simular", action="store_true", help="No manda email ni marca nada, solo informa")
    args = parser.parse_args()

    for proyecto in await _proyectos_gestion_documental_activos():
        await _procesar_proyecto(proyecto, args.dias, args.simular)


if __name__ == "__main__":
    asyncio.run(main())
