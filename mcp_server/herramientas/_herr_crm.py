"""Herramientas MCP del CRM: personas de contacto de cada entidad, etapas
del embudo de ventas y oportunidades — ver docs/gestion-documental.md →
"Ventas (CRM)". Las reglas viven en _mod_crm.py (las comparte el panel).

Quién es "yo": como en el bloc de notas (ver _contexto en
_herr_bloc_notas.py)."""

from typing import Literal

from apps.mcp_server.core import mcp_app
from fastmcp.exceptions import ToolError

from ._anotaciones import SOLO_LECTURA
from ._herr_bloc_notas import _contexto, _ejecutar
from ..database.modelos import _mod_crm as crm

EstadoOportunidad = Literal["abiertas", "ganadas", "perdidas", "todas"]


def _pasados(**campos) -> dict:
    """Solo lo que se ha pasado: lo que viene a None no se toca."""
    return {k: v for k, v in campos.items() if v is not None}


# ---------- Contactos ----------

@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_contactos_gd(id_entidad: int) -> list[dict]:
    """Personas de contacto de una entidad (cliente, proveedor...): nombre,
    cargo, email y teléfono. La principal sale primero."""
    config, *_ = await _contexto()
    return await _ejecutar(crm.listar_contactos(config, id_entidad))


@mcp_app.tool()
async def crear_contacto_gd(
    id_entidad: int,
    nombre: str,
    cargo: str | None = None,
    email: str | None = None,
    telefono: str | None = None,
    observaciones: str | None = None,
    principal: bool = False,
) -> dict:
    """Añade una persona de contacto a una entidad ("Ana, de compras").
    Antes, mira con listar_contactos_gd que no exista ya. Los datos que no
    te den, no los inventes. `principal`: la persona de referencia (si ya
    había otra, deja de serlo)."""
    config, *_ = await _contexto()
    return await _ejecutar(crm.crear_contacto(config, id_entidad, _pasados(
        nombre=nombre, cargo=cargo, email=email, telefono=telefono, observaciones=observaciones, principal=principal,
    )))


@mcp_app.tool()
async def actualizar_contacto_gd(
    id_contacto: int,
    nombre: str | None = None,
    cargo: str | None = None,
    email: str | None = None,
    telefono: str | None = None,
    observaciones: str | None = None,
    principal: bool | None = None,
) -> dict:
    """Cambia los datos que se pasen de un contacto; los que no se pasan no
    se tocan. Para vaciar un campo, pásalo como cadena vacía."""
    config, *_ = await _contexto()
    return await _ejecutar(crm.actualizar_contacto(config, id_contacto, _pasados(
        nombre=nombre, cargo=cargo, email=email, telefono=telefono, observaciones=observaciones, principal=principal,
    )))


@mcp_app.tool()
async def eliminar_contacto_gd(id_contacto: int) -> dict:
    """Borra un contacto. Las oportunidades que lo tenían se quedan sin
    contacto, no se borran."""
    config, *_ = await _contexto()
    await _ejecutar(crm.eliminar_contacto(config, id_contacto))
    return {"id_contacto": id_contacto, "eliminado": True}


# ---------- Etapas ----------

@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_etapas_gd() -> list[dict]:
    """Etapas del embudo de ventas en orden (p.ej. Contacto, Propuesta,
    Negociación, Ganada, Perdida), con su probabilidad, su tipo (abierta,
    ganada o perdida) y cuántas oportunidades tiene cada una."""
    config, *_ = await _contexto()
    return await crm.listar_etapas(config)


@mcp_app.tool()
async def configurar_etapas_gd(etapas: list[dict]) -> list[dict]:
    """Deja el embudo exactamente con estas etapas y en este orden. Cada
    una: {"id" (solo las que ya existen), "nombre", "probabilidad" (0-100),
    "tipo": "abierta" | "ganada" | "perdida"}. Las existentes que no
    vengan se borran (solo si no tienen oportunidades). Tiene que quedar al
    menos una de cada tipo. Llama antes a listar_etapas_gd y confirma el
    cambio con el usuario: afecta a todo el equipo."""
    config, *_ = await _contexto()
    return await _ejecutar(crm.guardar_etapas(config, etapas))


# ---------- Oportunidades ----------

@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_oportunidades_gd(
    estado: EstadoOportunidad = "abiertas",
    id_entidad: int | None = None,
    id_etapa: int | None = None,
    id_responsable: int | None = None,
    solo_mias: bool = False,
    sin_responsable: bool = False,
    texto: str | None = None,
    cierre_desde: str | None = None,
    cierre_hasta: str | None = None,
) -> dict:
    """Oportunidades de venta (el embudo): "¿qué tenemos abierto?", "¿qué
    se cierra este mes?", "¿qué perdimos y por qué?", "¿qué hay con
    García?". Devuelve `oportunidades` y `resumen` (por etapa: cuántas,
    importe e importe ponderado por la probabilidad).

    Filtros opcionales: `estado` (por defecto abiertas), `id_entidad`,
    `id_etapa`, `id_responsable` o `solo_mias`, `sin_responsable`, `texto`
    (título, entidad o descripción) y fecha prevista de cierre entre
    `cierre_desde` y `cierre_hasta` (AAAA-MM-DD)."""
    config, id_proyecto, id_usuario, _ = await _contexto()
    if solo_mias:
        if not id_usuario:
            raise ToolError("No sé quién eres (esta clave es de todo el proyecto): di el nombre de la persona")
        id_responsable = id_usuario
    oportunidades = await _ejecutar(crm.listar_oportunidades(
        config, id_proyecto, estado, id_entidad, id_etapa, id_responsable, sin_responsable, texto,
        cierre_desde, cierre_hasta,
    ))
    return {"oportunidades": oportunidades, "resumen": await crm.resumen_embudo(config, id_proyecto, id_responsable)}


@mcp_app.tool(annotations=SOLO_LECTURA)
async def obtener_oportunidad_gd(id_oportunidad: int) -> dict:
    """Una oportunidad entera: entidad, contacto, etapa, importe, próximo
    paso, documentos (presupuestos, propuestas...) y el historial de
    cambios de etapa."""
    config, id_proyecto, *_ = await _contexto()
    return await _ejecutar(crm.obtener_oportunidad(config, id_proyecto, id_oportunidad))


@mcp_app.tool()
async def crear_oportunidad_gd(
    titulo: str,
    id_entidad: int,
    importe: float | None = None,
    id_etapa: int | None = None,
    fecha_prevista_cierre: str | None = None,
    id_contacto: int | None = None,
    id_responsable: int | None = None,
    origen: str | None = None,
    descripcion: str | None = None,
    proximo_paso: str | None = None,
    fecha_proximo_paso: str | None = None,
) -> dict:
    """Crea una oportunidad de venta ("Reforma oficinas Labosur, 12.000 €").
    Tiene que ser de una entidad: búscala antes con listar_entidades_gd y,
    si no existe, pregunta si darla de alta (tipo "posible cliente" si aún
    no compra). Mira también con listar_oportunidades_gd(id_entidad=...)
    que no exista ya la misma.

    - `importe`: sin impuestos. No lo inventes: si no lo dicen, déjalo vacío.
    - `id_etapa`: ver listar_etapas_gd; por defecto la primera abierta.
    - `id_responsable`: quién la lleva (listar_usuarios_proyecto_gd). Si la
      clave es de una persona y no dicen otra cosa, pregunta si es ella.
    - `proximo_paso` + `fecha_proximo_paso` (AAAA-MM-DD): lo siguiente que
      hay que hacer. Ese día entra en el resumen de las 8:00 del
      responsable, y las abiertas sin próximo paso también, para que no se
      quede ninguna parada.
    - `origen`: de dónde vino (web, recomendación, feria...)."""
    config, id_proyecto, _, quien = await _contexto()
    return await _ejecutar(crm.crear_oportunidad(config, id_proyecto, quien, _pasados(
        titulo=titulo, id_entidad=id_entidad, importe=importe, id_etapa=id_etapa,
        fecha_prevista_cierre=fecha_prevista_cierre, id_contacto=id_contacto,
        id_usuario_responsable=id_responsable, origen=origen, descripcion=descripcion,
        proximo_paso=proximo_paso, fecha_proximo_paso=fecha_proximo_paso,
    )))


@mcp_app.tool()
async def actualizar_oportunidad_gd(
    id_oportunidad: int,
    titulo: str | None = None,
    importe: float | None = None,
    id_etapa: int | None = None,
    fecha_prevista_cierre: str | None = None,
    id_entidad: int | None = None,
    id_contacto: int | None = None,
    id_responsable: int | None = None,
    quitar_responsable: bool = False,
    origen: str | None = None,
    descripcion: str | None = None,
    proximo_paso: str | None = None,
    fecha_proximo_paso: str | None = None,
    motivo_perdida: str | None = None,
    fecha_cierre: str | None = None,
) -> dict:
    """Cambia lo que se pase de una oportunidad; lo demás no se toca (para
    vaciar un texto o una fecha, pásalo como cadena vacía).

    Mover de etapa es pasar `id_etapa`. Ganarla o perderla es moverla a una
    etapa de tipo ganada o perdida: se pone sola la fecha de cierre (hoy,
    salvo `fecha_cierre`). Al perderla, pregunta el motivo y pásalo en
    `motivo_perdida`: sirve para los informes. Reabrirla (volver a una
    etapa abierta) quita la fecha de cierre y el motivo.

    Cuando se hace el próximo paso, pregunta cuál es el siguiente y
    actualiza `proximo_paso` y `fecha_proximo_paso`."""
    if id_responsable and quitar_responsable:
        raise ToolError("Pasa id_responsable o quitar_responsable, no los dos")
    config, id_proyecto, _, quien = await _contexto()
    datos = _pasados(
        titulo=titulo, importe=importe, id_etapa=id_etapa, fecha_prevista_cierre=fecha_prevista_cierre,
        id_entidad=id_entidad, id_contacto=id_contacto, id_usuario_responsable=id_responsable, origen=origen,
        descripcion=descripcion, proximo_paso=proximo_paso, fecha_proximo_paso=fecha_proximo_paso,
        motivo_perdida=motivo_perdida, fecha_cierre=fecha_cierre,
    )
    if quitar_responsable:
        datos["id_usuario_responsable"] = None
    return await _ejecutar(crm.actualizar_oportunidad(config, id_proyecto, quien, id_oportunidad, datos))


@mcp_app.tool()
async def eliminar_oportunidad_gd(id_oportunidad: int) -> dict:
    """Borra una oportunidad y su historial de etapas (los documentos no se
    tocan). No se puede deshacer: si se perdió, mejor moverla a una etapa
    de tipo perdida, que queda para los informes. Confírmalo antes."""
    config, id_proyecto, *_ = await _contexto()
    await _ejecutar(crm.eliminar_oportunidad(config, id_proyecto, id_oportunidad))
    return {"id_oportunidad": id_oportunidad, "eliminada": True}


@mcp_app.tool()
async def relacionar_documento_oportunidad_gd(id_oportunidad: int, id_documento: int) -> dict:
    """Enlaza un documento (presupuesto, propuesta, contrato...) con una
    oportunidad. No falla si ya estaba."""
    config, id_proyecto, *_ = await _contexto()
    await _ejecutar(crm.relacionar_documento(config, id_proyecto, id_oportunidad, id_documento))
    return {"id_oportunidad": id_oportunidad, "id_documento": id_documento}


@mcp_app.tool()
async def quitar_documento_oportunidad_gd(id_oportunidad: int, id_documento: int) -> dict:
    """Quita el enlace entre un documento y una oportunidad (ninguno de los
    dos se borra)."""
    config, *_ = await _contexto()
    quitado = await crm.quitar_documento(config, id_oportunidad, id_documento)
    return {"id_oportunidad": id_oportunidad, "id_documento": id_documento, "estaba_enlazado": quitado}


@mcp_app.tool(annotations=SOLO_LECTURA)
async def historial_entidad_gd(id_entidad: int, limite: int = 100) -> list[dict]:
    """Todo lo que ha pasado con una entidad, lo último arriba: documentos
    relacionados, notas del bloc (reuniones, llamadas), envíos de correo,
    oportunidades y sus cambios de etapa, y contactos dados de alta. Úsala
    para "prepárame la reunión con García" o "¿cuándo hablamos por última
    vez con X?", junto con listar_oportunidades_gd(id_entidad=...)."""
    config, id_proyecto, id_usuario, _ = await _contexto()
    return await _ejecutar(crm.historial_entidad(config, id_proyecto, id_usuario, id_entidad, limite))
