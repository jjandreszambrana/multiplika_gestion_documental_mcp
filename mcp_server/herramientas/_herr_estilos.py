"""Herramientas MCP de la tabla de estilos — ver docs/gestion-documental.md
→ "Tabla de estilos". Los tipos de informe y sus instrucciones se dan de
alta desde el panel (panel_cliente/servidor.py) o desde aquí, igual que sus
imágenes fijas."""

import asyncio
import base64
import binascii
import ipaddress
import socket
from urllib.parse import urlparse

import httpx
from fastmcp.exceptions import ToolError
from fastmcp.utilities.types import Image

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config

from ._anotaciones import SOLO_LECTURA
from ..database.modelos._mod_documentos import DocumentosCRUD
from ..database.modelos._mod_estilos import EstilosCRUD, EstilosImagenesCRUD

LONGITUD_MAX_NOMBRE_TIPO = 100  # gd_estilos.nombre_tipo es VARCHAR(100)
LONGITUD_MAX_NOMBRE_IMAGEN = 150  # gd_estilos_imagenes.nombre es VARCHAR(150)
LIMITE_BYTES_IMAGEN = 5 * 1024 * 1024
TIMEOUT_DESCARGA_SEGUNDOS = 15
FIRMAS_IMAGEN = [
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
]


def _tipo_mime_imagen(datos: bytes) -> str:
    """Tipo real según los primeros bytes, no según lo que diga quien la envía."""
    for firma, tipo_mime in FIRMAS_IMAGEN:
        if datos.startswith(firma):
            return tipo_mime
    if datos[:4] == b"RIFF" and datos[8:12] == b"WEBP":
        return "image/webp"
    raise ToolError("El archivo no es una imagen PNG, JPEG, GIF o WEBP")


async def _descargar_imagen(url: str) -> bytes:
    """Solo http(s), solo direcciones públicas y sin seguir redirecciones —
    esta tool la puede llamar cualquiera con la clave del proyecto, y no
    debe servir para sondear servicios internos del servidor.
    minimo: la dirección se resuelve aquí y otra vez al descargar, así que
    un DNS malicioso podría cambiarla entre medias; el riesgo es bajo porque
    solo se guarda lo que empiece por la firma de una imagen."""
    partes = urlparse(url)
    if partes.scheme not in ("http", "https") or not partes.hostname:
        raise ToolError("La URL debe empezar por http:// o https://")
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(
            partes.hostname, partes.port or (443 if partes.scheme == "https" else 80)
        )
    except socket.gaierror as e:
        raise ToolError(f"No se pudo resolver {partes.hostname}") from e
    if not all(ipaddress.ip_address(i[4][0].split("%")[0]).is_global for i in infos):
        raise ToolError("La URL apunta a una dirección no pública")

    contenido = b""
    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=TIMEOUT_DESCARGA_SEGUNDOS) as cliente:
            async with cliente.stream("GET", url) as respuesta:
                if respuesta.status_code != 200:
                    raise ToolError(
                        f"La URL respondió {respuesta.status_code} (si es una redirección, usa la URL final)"
                    )
                async for trozo in respuesta.aiter_bytes():
                    contenido += trozo
                    if len(contenido) > LIMITE_BYTES_IMAGEN:
                        raise ToolError(f"La imagen pesa más de {LIMITE_BYTES_IMAGEN // (1024 * 1024)} MB")
    except httpx.HTTPError as e:
        raise ToolError(f"No se pudo descargar la imagen: {e}") from e
    return contenido


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_estilos_informe_gd() -> list[dict]:
    """Tipos de informe disponibles para este proyecto (p.ej. "informe_mensual",
    "memoria_anual"). Usa obtener_estilo_informe_gd(nombre_tipo) para ver
    cómo construir uno en concreto."""
    proyecto = await resolver_proyecto_actual()
    config = get_db_config(proyecto["id"])
    return await EstilosCRUD(config).listar_tipos()


@mcp_app.tool(annotations=SOLO_LECTURA)
async def obtener_estilo_informe_gd(nombre_tipo: str) -> list:
    """Instrucciones de cómo construir un informe de este tipo, seguidas de
    sus imágenes fijas (logo, plantilla...), cada una precedida por su
    nombre y para qué sirve — así sabes cuál es cuál y dónde va cada una
    en el informe."""
    proyecto = await resolver_proyecto_actual()
    config = get_db_config(proyecto["id"])

    estilo = await EstilosCRUD(config).obtener_por_tipo(nombre_tipo)
    if not estilo:
        raise ToolError(f'No existe ningún estilo de informe llamado "{nombre_tipo}"')

    imagenes = await EstilosImagenesCRUD(config).listar_de_estilo(estilo["id"])

    resultado: list = [f'Instrucciones para "{nombre_tipo}":\n{estilo["instrucciones"]}']
    guias = await DocumentosCRUD(config).listar_guia_de_estilo(estilo["id"])
    if guias:
        lista = ", ".join(f'{g["id"]} ("{g["nombre"]}")' for g in guias)
        resultado.append(
            f"Documentos guía de este tipo de informe (léelos con obtener_documento_completo_gd "
            f"antes de redactarlo): {lista}"
        )
    for img in imagenes:
        resultado.append(f'Imagen "{img["nombre"]}" — {img["descripcion_uso"]}:')
        formato = img["tipo_mime"].split("/", 1)[-1]
        resultado.append(Image(data=bytes(img["imagen"]), format=formato))
    return resultado


@mcp_app.tool()
async def crear_estilo_informe_gd(nombre_tipo: str, instrucciones: str) -> dict:
    """Da de alta un tipo de informe nuevo (p.ej. "informe_mensual"): su
    nombre único y las instrucciones de cómo construirlo (estructura, tono,
    apartados). Las imágenes fijas (logo, plantilla...) se suben después
    desde el panel. Confirma con el cliente el nombre y las instrucciones
    antes de crearlo."""
    nombre_tipo = nombre_tipo.strip()
    if not nombre_tipo or len(nombre_tipo) > LONGITUD_MAX_NOMBRE_TIPO:
        raise ToolError(f"nombre_tipo debe tener entre 1 y {LONGITUD_MAX_NOMBRE_TIPO} caracteres")
    proyecto = await resolver_proyecto_actual()
    estilos = EstilosCRUD(get_db_config(proyecto["id"]))
    if await estilos.obtener_por_tipo(nombre_tipo):
        raise ToolError(f'Ya existe un estilo de informe llamado "{nombre_tipo}"')
    id_estilo = await estilos.insert({"nombre_tipo": nombre_tipo, "instrucciones": instrucciones})
    return await estilos.obtener(id_estilo)


@mcp_app.tool()
async def actualizar_estilo_informe_gd(nombre_tipo: str, instrucciones: str) -> dict:
    """Reemplaza las instrucciones COMPLETAS de un tipo de informe ya
    existente. Lee antes las actuales con obtener_estilo_informe_gd y
    conserva lo que siga valiendo — lo que no repitas aquí se pierde."""
    proyecto = await resolver_proyecto_actual()
    estilos = EstilosCRUD(get_db_config(proyecto["id"]))
    estilo = await estilos.obtener_por_tipo(nombre_tipo)
    if not estilo:
        raise ToolError(f'No existe ningún estilo de informe llamado "{nombre_tipo}"')
    await estilos.update(estilo["id"], {"instrucciones": instrucciones})
    return await estilos.obtener(estilo["id"])


@mcp_app.tool()
async def asignar_estilo_documento_gd(id_documento: int, nombre_tipo: str | None = None) -> dict:
    """Vincula un documento a un tipo de informe (uno de
    listar_estilos_informe_gd) cuando ese documento explica cómo elaborar
    informes de ese tipo: al pedir después obtener_estilo_informe_gd, la IA
    ve el documento como guía y puede leerlo. Un documento solo puede
    vincularse a un tipo, pero un tipo puede tener varios documentos guía.
    Sin `nombre_tipo`, quita el vínculo que tuviera."""
    proyecto = await resolver_proyecto_actual()
    config = get_db_config(proyecto["id"])
    id_estilo = None
    if nombre_tipo:
        estilo = await EstilosCRUD(config).obtener_por_tipo(nombre_tipo)
        if not estilo:
            raise ToolError(f'No existe ningún estilo de informe llamado "{nombre_tipo}"')
        id_estilo = estilo["id"]
    documento = await DocumentosCRUD(config).asignar_estilo(id_documento, id_estilo)
    if not documento:
        raise ToolError(f"No existe ningún documento con id {id_documento}")
    return documento


@mcp_app.tool()
async def subir_imagen_estilo_gd(
    nombre_tipo: str,
    nombre: str,
    descripcion_uso: str,
    imagen_base64: str | None = None,
    url: str | None = None,
) -> dict:
    """Sube una imagen fija (logo, plantilla...) a un tipo de informe
    existente. Indica la imagen en `imagen_base64` (el contenido del
    archivo codificado en base64 — solo viable si tienes el archivo al
    alcance, p.ej. en Claude Code; una imagen adjunta al chat no la puedes
    leer así) o en `url` (dirección pública directa a la imagen, sin
    redirecciones). PNG, JPEG, GIF o WEBP, hasta 5 MB. `nombre` la
    identifica dentro del estilo (p.ej. "logo_cabecera"): si ya hay una con
    ese nombre, se reemplaza. `descripcion_uso` explica cuándo y cómo
    usarla en el informe — es lo que leerá la IA al construirlo."""
    if bool(imagen_base64) == bool(url):
        raise ToolError("Indica la imagen en `imagen_base64` o en `url` (una de las dos, no ambas)")
    nombre = nombre.strip()
    if not nombre or len(nombre) > LONGITUD_MAX_NOMBRE_IMAGEN:
        raise ToolError(f"nombre debe tener entre 1 y {LONGITUD_MAX_NOMBRE_IMAGEN} caracteres")

    if url:
        datos = await _descargar_imagen(url)
    else:
        try:
            datos = base64.b64decode("".join(imagen_base64.split()), validate=True)
        except binascii.Error as e:
            raise ToolError("imagen_base64 no es base64 válido") from e
        if len(datos) > LIMITE_BYTES_IMAGEN:
            raise ToolError(f"La imagen pesa más de {LIMITE_BYTES_IMAGEN // (1024 * 1024)} MB")
    tipo_mime = _tipo_mime_imagen(datos)

    proyecto = await resolver_proyecto_actual()
    config = get_db_config(proyecto["id"])
    estilo = await EstilosCRUD(config).obtener_por_tipo(nombre_tipo)
    if not estilo:
        raise ToolError(f'No existe ningún estilo de informe llamado "{nombre_tipo}"')

    imagenes = EstilosImagenesCRUD(config)
    valores = {"descripcion_uso": descripcion_uso, "imagen": datos, "tipo_mime": tipo_mime}
    existente = next(
        (i for i in await imagenes.listar_metadatos_de_estilo(estilo["id"]) if i["nombre"] == nombre), None
    )
    if existente:
        id_imagen = existente["id"]
        await imagenes.update(id_imagen, valores)
    else:
        id_imagen = await imagenes.insert({"id_estilo": estilo["id"], "nombre": nombre, **valores})
    fila = await imagenes.obtener(id_imagen)
    return {k: v for k, v in fila.items() if k != "imagen"}
