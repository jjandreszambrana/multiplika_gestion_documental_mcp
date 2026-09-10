#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""Ingesta de documentos por email — ver docs/gestion-documental.md →
"Ingesta por email".

**PENDIENTE DE DOMINIO REAL (2026-09-10):** este script está escrito y
probado con un correo sintético por stdin (sin infraestructura de correo
real), pero NO está conectado a ningún buzón de verdad todavía — falta
decidir con el usuario el dominio/buzón compartido de la plataforma
(`<algo-por-cliente>@<dominio-a-decidir>`), darlo de alta en el servidor
de correo (ISPConfig, ver docs/despliegue.md) y configurar `getmail` para
invocar este script en cada correo entrante a ese buzón. Hasta entonces,
nadie llama a este script en producción.

Uso esperado (MDA externo invocado por `getmail`, patrón habitual de
procmail/dovecot-lda): recibe el mensaje completo (RFC822) por stdin, y la
dirección de destino como argumento —

    python procesar_correo_entrante.py <direccion_destino>

(el argumento exacto que pasará `getmail` de verdad depende de cómo quede
configurado ese buzón — puede hacer falta ajustar esta firma cuando se
resuelva el punto de arriba).

Identifica el proyecto por la PARTE LOCAL de `<direccion_destino>` (antes
de la @) contra `gd_configuracion.email_ingesta` de cada cliente, extrae
los adjuntos válidos (imagen o PDF) y los inserta en
`gd_documentos_pendientes` de la base de ESE cliente con `origen='email'`
— igual que la subida masiva del panel, a la espera de que el cliente
hable con su IA para procesarlos (ver docs/gestion-documental.md →
"Documentos pendientes"). Sin proyecto que reconozca la dirección, o sin
adjuntos válidos: no crea nada, solo lo informa por stdout (no se
responde al remitente — evita convertir esto en un vector de spam/
backscatter con un remitente falso).

Autocontenido igual que scripts/avisar_caducidades.py — mismo
razonamiento (ver su docstring) sobre por qué no pasa por
`database/modelos` de este repo."""

import argparse
import asyncio
import email
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


async def _proyecto_por_parte_local(parte_local: str) -> dict | None:
    for proyecto in await _proyectos_gestion_documental_activos():
        config = get_db_config(proyecto["slug"])
        db = AsyncDatabase(**config)
        filas = await db.query("SELECT email_ingesta FROM gd_configuracion WHERE id = 1")
        if filas and filas[0]["email_ingesta"] == parte_local:
            return proyecto
    return None


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


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("destino", help="Dirección de destino del correo (a quién iba)")
    args = parser.parse_args()

    parte_local = args.destino.split("@", 1)[0].strip().lower()
    mensaje = email.message_from_bytes(sys.stdin.buffer.read())

    proyecto = await _proyecto_por_parte_local(parte_local)
    if not proyecto:
        print(f"Sin ningún proyecto con email_ingesta='{parte_local}' — correo ignorado.")
        return

    config = get_db_config(proyecto["slug"])
    guardados = 0
    for parte in mensaje.walk():
        if parte.is_multipart() or not parte.get_filename():
            continue
        if not _es_adjunto_valido(parte):
            continue
        contenido = parte.get_payload(decode=True)
        if not contenido:
            continue
        await _guardar_pendiente(config, contenido, parte.get_content_type(), parte.get_filename())
        guardados += 1

    print(f"{proyecto['slug']}: {guardados} adjunto(s) guardado(s) como pendientes.")


if __name__ == "__main__":
    asyncio.run(main())
