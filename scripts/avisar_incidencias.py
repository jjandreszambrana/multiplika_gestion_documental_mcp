#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""Aviso proactivo por email de incidencias abiertas con responsable
asignado — ver docs/gestion-documental.md → "Registros de seguimiento" /
"Aviso de incidencias". Recorre cada proyecto de gestión documental activo
(Postgres, `tipo_producto='gestion_documental'` en la base de control) y
manda UN correo si tiene incidencias abiertas, con responsable, para las
que no se haya avisado ya de ESE responsable en concreto —
`aviso_responsable_enviado` se reinicia a false cada vez que se cambia el
responsable (ver `RegistrosCRUD.actualizar_responsable`), así que
reasignarla vuelve a avisar. Un aviso por asignación, no un recordatorio
diario mientras siga abierta — mismo motivo que `avisar_caducidades.py`:
evitar saturar de correos por algo que puede tardar en resolverse.

El correo va siempre a `gd_configuracion.email_avisos`, no directamente al
responsable: `responsable` es texto libre (ver
docs/gestion-documental.md → "Registros de seguimiento", decisión de
producto de que no tiene por qué ser un usuario real ni una dirección de
correo), así que no hay a quién escribirle de forma fiable — el correo
menciona el nombre del responsable en cada línea para que quien lo reciba
sepa a quién avisar o reenviárselo.

Autocontenido a propósito, mismo motivo que avisar_caducidades.py: no
importa la capa `database/modelos` de este repo (imports relativos
pensados para desplegarse bajo `apps.mcp_server.*`) — consulta
`gd_registros`/`gd_documentos`/`gd_configuracion` con SQL en línea. Si el
esquema de esas tablas cambia, hay que tocar también aquí.

Pensado para cron, corriendo ya desplegado en
apps/mcp_server/paneles_cliente/multiplika_gestion_documental_mcp/scripts/
(mismo patrón que avisar_caducidades.py/revisar_correo_entrante.py) — 5
niveles por encima está la raíz del repo core, de donde salen
`database.config_db` y `database.control.dependencias._dep_proyectos`.

El correo se manda desde la CUENTA PROPIA de cada cliente
(gd_configuracion.email_cuenta_*), igual que avisar_caducidades.py — sin
cuenta configurada, o sin `email_avisos`, se omite ese proyecto.

Uso: python scripts/avisar_incidencias.py [--simular]
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


async def _incidencias_pendientes_aviso(config: dict) -> list[dict]:
    db = AsyncDatabase(**config)
    sql = """
        SELECT r.id, r.texto, r.responsable, d.nombre AS documento
        FROM gd_registros r
        JOIN gd_documentos d ON d.id = r.id_documento
        WHERE r.tipo = 'incidencia' AND r.estado = 'abierta'
          AND r.responsable IS NOT NULL AND r.responsable <> ''
          AND r.aviso_responsable_enviado = false
        ORDER BY r.fecha_creacion ASC
    """
    return await db.query(sql)


async def _email_avisos(config: dict) -> str | None:
    db = AsyncDatabase(**config)
    filas = await db.query("SELECT email_avisos FROM gd_configuracion WHERE id = 1")
    return filas[0]["email_avisos"] if filas and filas[0]["email_avisos"] else None


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


async def _marcar_avisadas(config: dict, ids_registro: list[int]) -> None:
    db = AsyncDatabase(**config)
    await db.query(
        "UPDATE gd_registros SET aviso_responsable_enviado = true WHERE id = ANY(%s)", (ids_registro,)
    )


def _conectar_smtp(cuenta: dict) -> smtplib.SMTP:
    """`smtp_seguridad` es explícito, elegido por el cliente en el panel —
    ver la misma nota en avisar_caducidades.py."""
    if cuenta["smtp_seguridad"] == "ssl":
        smtp = smtplib.SMTP_SSL(cuenta["smtp_host"], cuenta["smtp_port"])
    else:
        smtp = smtplib.SMTP(cuenta["smtp_host"], cuenta["smtp_port"])
        if cuenta["smtp_seguridad"] == "starttls":
            smtp.starttls()
    smtp.login(cuenta["usuario"], cuenta["password"])
    return smtp


def _enviar_email(cuenta: dict, destinatario: str, proyecto_nombre: str, incidencias: list[dict]) -> None:
    lineas = [f'- "{i["documento"]}" — responsable: {i["responsable"]} — {i["texto"]}' for i in incidencias]
    cuerpo = (
        f"Incidencias abiertas de {proyecto_nombre} con responsable asignado:\n\n" + "\n".join(lineas) +
        "\n\nEste es un aviso único por asignación — si se reasigna a otra persona, se vuelve a avisar; "
        "mientras siga con el mismo responsable, no se repite."
    )
    mensaje = MIMEText(cuerpo, _charset="utf-8")
    mensaje["Subject"] = f"[{proyecto_nombre}] Incidencias abiertas asignadas ({len(incidencias)})"
    mensaje["From"] = cuenta["direccion"]
    mensaje["To"] = destinatario

    with _conectar_smtp(cuenta) as smtp:
        smtp.send_message(mensaje)


async def _procesar_proyecto(proyecto: dict, simular: bool) -> None:
    config = get_db_config(proyecto["id"])
    incidencias = await _incidencias_pendientes_aviso(config)
    if not incidencias:
        return

    destinatario = await _email_avisos(config)
    cuenta = await _cuenta_email(config)
    if not destinatario or not cuenta:
        print(
            f"{proyecto['nombre']}: {len(incidencias)} incidencia(s) por avisar, pero falta "
            f"{'email_avisos' if not destinatario else 'la cuenta de correo'} — se omite."
        )
        return

    print(
        f"{proyecto['nombre']}: avisando de {len(incidencias)} incidencia(s) a {destinatario} "
        f"desde {cuenta['direccion']}."
    )
    if simular:
        return

    try:
        _enviar_email(cuenta, destinatario, proyecto["nombre"], incidencias)
    except (smtplib.SMTPException, OSError) as e:
        # Mismo motivo que avisar_caducidades.py: un email_avisos mal
        # configurado de un cliente no debe tumbar el aviso de los demás.
        # No se marca aviso_responsable_enviado: se reintenta en la
        # siguiente ejecución, nada se pierde.
        print(f"{proyecto['nombre']}: fallo mandando el aviso a {destinatario}: {e}")
        return

    await _marcar_avisadas(config, [i["id"] for i in incidencias])


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--simular", action="store_true", help="No manda email ni marca nada, solo informa")
    args = parser.parse_args()

    for proyecto in await _proyectos_gestion_documental_activos():
        await _procesar_proyecto(proyecto, args.simular)


if __name__ == "__main__":
    asyncio.run(main())
