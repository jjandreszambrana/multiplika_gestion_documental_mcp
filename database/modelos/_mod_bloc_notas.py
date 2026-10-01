"""Bloc de notas — ver docs/gestion-documental.md → "Bloc de notas". Lo
usan las tools MCP y el panel, para que los dos compartan las mismas
reglas de quién ve y quién cambia cada nota.

Toda función recibe `id_usuario`: la persona que pregunta, o None si no
se sabe (una API key de todos, o soporte). Con None solo existen las notas
de todos. Una nota que no puedes ver se trata como si no existiera: no se
dice ni que existe (LookupError, igual que un id que no está).

Quién edita: cualquiera que la vea (permiso de escritura aparte, que lo
comprueba quien llama). Cambiar a quién se enseña, archivar y borrar: solo
el autor, o cualquiera si no tiene autor.

Lanza ValueError / LookupError con mensajes que se pueden enseñar tal cual."""

from datetime import datetime

from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_bloc_notas import (
    TABLA_BLOC_NOTAS,
    TABLA_BLOC_NOTAS_DOCUMENTOS,
    TABLA_BLOC_NOTAS_ETIQUETAS,
    TABLA_BLOC_NOTAS_PERSONAS,
    TABLA_BLOC_NOTAS_REGISTROS,
    TABLA_BLOC_NOTAS_RELACIONES,
    COLORES,
    VISIBILIDADES,
)
from ..dependencias._dep_documentos import TABLA_DOCUMENTOS
from ..dependencias._dep_programaciones import TABLA_PROGRAMACIONES
from ..dependencias._dep_registros import TABLA_MODELOS_REGISTRO, TABLA_REGISTROS
from ._mod_programaciones import usuarios_del_proyecto
from ._repeticiones import ahora_madrid

_T_NOTAS = TABLA_BLOC_NOTAS.nombre
_T_PERSONAS = TABLA_BLOC_NOTAS_PERSONAS.nombre
_T_ETIQUETAS = TABLA_BLOC_NOTAS_ETIQUETAS.nombre
_T_RELACIONES = TABLA_BLOC_NOTAS_RELACIONES.nombre
_T_DOCUMENTOS = TABLA_BLOC_NOTAS_DOCUMENTOS.nombre
_T_REGISTROS = TABLA_BLOC_NOTAS_REGISTROS.nombre

TIPOS_ENLACE = ("nota", "documento", "registro")
MAX_CONTENIDO_LISTADO = 300


# ---------- Quién ve qué ----------

def _visible(alias: str, id_usuario: int | None) -> tuple[str, tuple]:
    """Condición SQL "la nota `alias` la puede ver `id_usuario`"."""
    if id_usuario is None:
        return f"{alias}.visibilidad = 'todos'", ()
    return (
        f"({alias}.visibilidad = 'todos' OR {alias}.id_usuario_autor = %s OR "
        f"({alias}.visibilidad = 'personas' AND EXISTS ("
        f'SELECT 1 FROM "{_T_PERSONAS}" p WHERE p.id_nota = {alias}.id AND p.id_usuario = %s)))',
        (id_usuario, id_usuario),
    )


def puede_gestionar(nota: dict, id_usuario: int | None) -> bool:
    """Cambiar a quién se enseña, archivar y borrar."""
    return nota["id_usuario_autor"] is None or nota["id_usuario_autor"] == id_usuario


async def _nota_visible(db: AsyncDatabase, id_usuario: int | None, id_nota: int) -> dict:
    condicion, params = _visible("n", id_usuario)
    filas = await db.query(f'SELECT n.* FROM "{_T_NOTAS}" n WHERE n.id = %s AND {condicion}', (id_nota, *params))
    if not filas:
        raise LookupError(f"No existe ninguna nota del bloc con id {id_nota}")
    return filas[0]


# ---------- Validación ----------

def _fecha(valor) -> datetime:
    if isinstance(valor, datetime):
        return valor.replace(tzinfo=None, microsecond=0)
    try:
        return datetime.fromisoformat(str(valor).strip()).replace(tzinfo=None, microsecond=0)
    except ValueError as e:
        raise ValueError(f"Fecha no válida: '{valor}' (usa AAAA-MM-DD HH:MM)") from e


def _limpiar(datos: dict) -> dict:
    """Solo los campos presentes: al cambiar una nota, los demás no se tocan."""
    limpios = {}
    if "titulo" in datos:
        titulo = (datos["titulo"] or "").strip()
        if not titulo:
            raise ValueError("El título no puede estar vacío")
        limpios["titulo"] = titulo[:255]
    if "descripcion" in datos:
        limpios["descripcion"] = (datos["descripcion"] or "").strip()[:500] or None
    if "contenido" in datos:
        limpios["contenido"] = (datos["contenido"] or "").strip() or None
    if datos.get("fecha"):
        limpios["fecha"] = _fecha(datos["fecha"])
    if datos.get("fijada") is not None:
        limpios["fijada"] = bool(datos["fijada"])
    if "color" in datos:
        if datos["color"] and datos["color"] not in COLORES:
            raise ValueError(f"Color no válido: '{datos['color']}' ({', '.join(COLORES)})")
        limpios["color"] = datos["color"] or None
    return limpios


def _limpiar_etiquetas(etiquetas: list[str]) -> list[str]:
    vistas, limpias = set(), []
    for etiqueta in etiquetas or []:
        texto = " ".join((etiqueta or "").split())[:100]
        if texto and texto.lower() not in vistas:
            vistas.add(texto.lower())
            limpias.append(texto)
    return limpias


async def _comprobar_visibilidad(
    id_proyecto: int, id_autor: int | None, visibilidad: str, ids_personas: list[int] | None,
) -> list[int]:
    """Devuelve con quién se comparte (vacío salvo visibilidad 'personas')."""
    if visibilidad not in VISIBILIDADES:
        raise ValueError(f"Visibilidad no válida: '{visibilidad}' (privada, personas o todos)")
    if visibilidad != "todos" and id_autor is None:
        raise ValueError(
            "Desde aquí no se sabe quién eres, así que las notas solo pueden ser de todos. Para "
            "notas privadas, usa el panel o una API key a tu nombre"
        )
    if visibilidad != "personas":
        return []
    personas = sorted(set(ids_personas or []) - {id_autor})
    if not personas:
        raise ValueError("Indica con qué personas se comparte la nota")
    validos = {u["id"] for u in await usuarios_del_proyecto(id_proyecto)}
    ajenos = [i for i in personas if i not in validos]
    if ajenos:
        raise ValueError(f"Estos usuarios no son de este proyecto: {', '.join(map(str, ajenos))}")
    return personas


# ---------- Etiquetas ----------

async def _poner_etiquetas(db: AsyncDatabase, id_nota: int, etiquetas: list[str]) -> None:
    """Sustituye las etiquetas de la nota. Una que ya exista en otra nota
    se guarda como está escrita allí, para no acabar con "Obra" y "obra"."""
    await db.query(f'DELETE FROM "{_T_ETIQUETAS}" WHERE id_nota = %s', (id_nota,))
    for etiqueta in _limpiar_etiquetas(etiquetas):
        existente = await db.query(
            f'SELECT etiqueta FROM "{_T_ETIQUETAS}" WHERE lower(etiqueta) = lower(%s) LIMIT 1', (etiqueta,)
        )
        await db.query(
            f'INSERT INTO "{_T_ETIQUETAS}" (id_nota, etiqueta) VALUES (%s, %s)',
            (id_nota, existente[0]["etiqueta"] if existente else etiqueta),
        )


async def etiquetas_en_uso(config: dict, id_usuario: int | None) -> list[dict]:
    """Etiquetas de las notas que ve `id_usuario`, con cuántas notas tienen cada una."""
    condicion, params = _visible("n", id_usuario)
    return await AsyncDatabase(**config).query(
        f"""
        SELECT e.etiqueta, COUNT(*) AS notas
        FROM "{_T_ETIQUETAS}" e JOIN "{_T_NOTAS}" n ON n.id = e.id_nota
        WHERE {condicion} AND NOT n.archivada
        GROUP BY e.etiqueta ORDER BY lower(e.etiqueta)
        """,
        params,
    )


# ---------- Enlaces ----------

async def _comprobar_destino(db: AsyncDatabase, id_usuario: int | None, tipo: str, id_destino: int) -> None:
    if tipo == "nota":
        await _nota_visible(db, id_usuario, id_destino)
        return
    tabla = TABLA_DOCUMENTOS.nombre if tipo == "documento" else TABLA_REGISTROS.nombre
    if not await db.query(f'SELECT 1 FROM "{tabla}" WHERE id = %s', (id_destino,)):
        raise LookupError(f"No existe ningún {tipo} con id {id_destino}")


def _sql_enlace(tipo: str, id_nota: int, id_destino: int) -> tuple[str, str, tuple]:
    """(tabla, condición WHERE, parámetros) del enlace."""
    if tipo == "nota":
        a, b = sorted((id_nota, id_destino))
        return _T_RELACIONES, "id_nota_a = %s AND id_nota_b = %s", (a, b)
    if tipo == "documento":
        return _T_DOCUMENTOS, "id_nota = %s AND id_documento = %s", (id_nota, id_destino)
    return _T_REGISTROS, "id_nota = %s AND id_registro = %s", (id_nota, id_destino)


async def _enlazar(db: AsyncDatabase, id_usuario: int | None, id_nota: int, tipo: str, id_destino: int) -> None:
    if tipo not in TIPOS_ENLACE:
        raise ValueError(f"Tipo de enlace no válido: '{tipo}' (nota, documento o registro)")
    if tipo == "nota" and id_destino == id_nota:
        raise ValueError("Una nota no se puede enlazar consigo misma")
    await _comprobar_destino(db, id_usuario, tipo, id_destino)
    tabla, condicion, params = _sql_enlace(tipo, id_nota, id_destino)
    columnas = condicion.replace(" = %s", "").replace(" AND ", ", ")
    await db.query(
        f'INSERT INTO "{tabla}" ({columnas}) VALUES (%s, %s) ON CONFLICT ({columnas}) DO NOTHING', params
    )


async def enlazar(
    config: dict, id_usuario: int | None, quien: str, id_nota: int, tipo: str, id_destino: int,
    id_proyecto: int | None = None,
) -> dict:
    db = AsyncDatabase(**config)
    await _nota_visible(db, id_usuario, id_nota)
    await _enlazar(db, id_usuario, id_nota, tipo, id_destino)
    await _marcar_modificada(db, id_nota, quien)
    return await obtener_nota(config, id_usuario, id_nota, id_proyecto)


async def desenlazar(
    config: dict, id_usuario: int | None, quien: str, id_nota: int, tipo: str, id_destino: int,
    id_proyecto: int | None = None,
) -> dict:
    if tipo not in TIPOS_ENLACE:
        raise ValueError(f"Tipo de enlace no válido: '{tipo}' (nota, documento o registro)")
    db = AsyncDatabase(**config)
    await _nota_visible(db, id_usuario, id_nota)
    if tipo == "nota":
        # Tampoco se puede quitar el enlace con una nota que no ves: no sabes que está
        await _nota_visible(db, id_usuario, id_destino)
    tabla, condicion, params = _sql_enlace(tipo, id_nota, id_destino)
    await db.query(f'DELETE FROM "{tabla}" WHERE {condicion}', params)
    await _marcar_modificada(db, id_nota, quien)
    return await obtener_nota(config, id_usuario, id_nota, id_proyecto)


async def _marcar_modificada(db: AsyncDatabase, id_nota: int, quien: str) -> None:
    await db.query(
        f'UPDATE "{_T_NOTAS}" SET fecha_modificacion = %s, modificado_por = %s WHERE id = %s',
        (ahora_madrid(), quien[:255], id_nota),
    )


# ---------- Notas ----------

async def crear_nota(
    config: dict, id_proyecto: int, id_usuario: int | None, quien: str, datos: dict,
) -> dict:
    """`datos`: titulo, descripcion, contenido, fecha, fijada, color, visibilidad,
    ids_personas, etiquetas, ids_notas, ids_documentos, ids_registros.
    Sin `id_usuario` la nota es de todos y no tiene autor."""
    limpios = _limpiar({"titulo": datos.get("titulo"), **datos})
    visibilidad = datos.get("visibilidad") or "todos"
    personas = await _comprobar_visibilidad(id_proyecto, id_usuario, visibilidad, datos.get("ids_personas"))
    db = AsyncDatabase(**config)
    enlaces = [
        (tipo, id_destino)
        for tipo, clave in (("nota", "ids_notas"), ("documento", "ids_documentos"), ("registro", "ids_registros"))
        for id_destino in sorted(set(datos.get(clave) or []))
    ]
    for tipo, id_destino in enlaces:
        await _comprobar_destino(db, id_usuario, tipo, id_destino)

    ahora = ahora_madrid()
    id_nota = await AsyncCrudBase(TABLA_BLOC_NOTAS, config).insert({
        "fecha": ahora, **limpios,
        "visibilidad": visibilidad,
        "creado_por": quien[:255], "id_usuario_autor": id_usuario,
        "fecha_alta": ahora, "fecha_modificacion": ahora, "modificado_por": quien[:255],
    })
    for id_persona in personas:
        await db.query(f'INSERT INTO "{_T_PERSONAS}" (id_nota, id_usuario) VALUES (%s, %s)', (id_nota, id_persona))
    await _poner_etiquetas(db, id_nota, datos.get("etiquetas") or [])
    for tipo, id_destino in enlaces:
        await _enlazar(db, id_usuario, id_nota, tipo, id_destino)
    return await obtener_nota(config, id_usuario, id_nota, id_proyecto)


async def actualizar_nota(
    config: dict, id_proyecto: int, id_usuario: int | None, quien: str, id_nota: int, datos: dict,
) -> dict:
    """Cambia solo lo que venga: titulo, descripcion, contenido, fecha,
    fijada, etiquetas (sustituyen a las que hubiera) y, solo quien puede
    gestionarla, visibilidad + ids_personas y archivada."""
    db = AsyncDatabase(**config)
    nota = await _nota_visible(db, id_usuario, id_nota)
    limpios = _limpiar(datos)
    # Lo que no cambia no cuenta: así un formulario puede mandarlo todo siempre
    actuales = {
        "visibilidad": nota["visibilidad"], "archivada": nota["archivada"],
        "ids_personas": sorted(f["id_usuario"] for f in await db.query(
            f'SELECT id_usuario FROM "{_T_PERSONAS}" WHERE id_nota = %s', (id_nota,))),
    }
    gestion = {
        k for k in actuales
        if datos.get(k) is not None
        and (sorted(set(datos[k])) if k == "ids_personas" else datos[k]) != actuales[k]
    }
    if gestion and not puede_gestionar(nota, id_usuario):
        raise PermissionError("Solo quien escribió la nota puede cambiar con quién se comparte o archivarla")

    personas = None
    if "visibilidad" in gestion or "ids_personas" in gestion:
        visibilidad = datos.get("visibilidad") or nota["visibilidad"]
        ids_personas = datos["ids_personas"] if datos.get("ids_personas") is not None else actuales["ids_personas"]
        personas = await _comprobar_visibilidad(id_proyecto, nota["id_usuario_autor"], visibilidad, ids_personas)
        limpios["visibilidad"] = visibilidad
    if "archivada" in gestion:
        limpios["archivada"] = bool(datos["archivada"])
        if limpios["archivada"]:
            limpios["fijada"] = False

    await AsyncCrudBase(TABLA_BLOC_NOTAS, config).update(id_nota, {
        **limpios, "fecha_modificacion": ahora_madrid(), "modificado_por": quien[:255],
    })
    if personas is not None:
        await db.query(f'DELETE FROM "{_T_PERSONAS}" WHERE id_nota = %s', (id_nota,))
        for id_persona in personas:
            await db.query(f'INSERT INTO "{_T_PERSONAS}" (id_nota, id_usuario) VALUES (%s, %s)', (id_nota, id_persona))
    if datos.get("etiquetas") is not None:
        await _poner_etiquetas(db, id_nota, datos["etiquetas"])
    return await obtener_nota(config, id_usuario, id_nota, id_proyecto)


async def eliminar_nota(config: dict, id_usuario: int | None, id_nota: int) -> dict:
    """Se lleva sus enlaces y sus recordatorios (ON DELETE CASCADE).
    Devuelve la nota tal como era, para el registro de actividad."""
    db = AsyncDatabase(**config)
    nota = await _nota_visible(db, id_usuario, id_nota)
    if not puede_gestionar(nota, id_usuario):
        raise PermissionError("Solo quien escribió la nota puede borrarla")
    await AsyncCrudBase(TABLA_BLOC_NOTAS, config).eliminar(id_nota)
    return nota


async def obtener_nota(config: dict, id_usuario: int | None, id_nota: int, id_proyecto: int | None = None) -> dict:
    """La nota con sus etiquetas, con quién se comparte (nombres solo si se
    pasa `id_proyecto`), sus enlaces (de notas, solo las que ves) y sus
    recordatorios."""
    db = AsyncDatabase(**config)
    nota = await _nota_visible(db, id_usuario, id_nota)
    condicion, params = _visible("n", id_usuario)
    notas = await db.query(
        f"""
        SELECT n.id, n.titulo, n.fecha, n.archivada FROM "{_T_RELACIONES}" r
        JOIN "{_T_NOTAS}" n ON n.id = CASE WHEN r.id_nota_a = %s THEN r.id_nota_b ELSE r.id_nota_a END
        WHERE (r.id_nota_a = %s OR r.id_nota_b = %s) AND {condicion}
        ORDER BY n.fecha DESC
        """,
        (id_nota, id_nota, id_nota, *params),
    )
    documentos = await db.query(
        f'SELECT d.id, d.nombre, d.tipo_documento, d.archivado FROM "{_T_DOCUMENTOS}" nd '
        f'JOIN "{TABLA_DOCUMENTOS.nombre}" d ON d.id = nd.id_documento WHERE nd.id_nota = %s ORDER BY d.nombre',
        (id_nota,),
    )
    registros = await db.query(
        f'SELECT r.id, r.fecha, r.conforme, m.titulo AS modelo FROM "{_T_REGISTROS}" nr '
        f'JOIN "{TABLA_REGISTROS.nombre}" r ON r.id = nr.id_registro '
        f'JOIN "{TABLA_MODELOS_REGISTRO.nombre}" m ON m.id = r.id_modelo '
        "WHERE nr.id_nota = %s ORDER BY r.fecha DESC, r.id DESC",
        (id_nota,),
    )
    recordatorios = await db.query(
        f'SELECT id, titulo, estado, proxima_ejecucion FROM "{TABLA_PROGRAMACIONES.nombre}" '
        "WHERE id_nota_bloc = %s ORDER BY proxima_ejecucion ASC NULLS LAST, id DESC",
        (id_nota,),
    )
    etiquetas = await db.query(f'SELECT etiqueta FROM "{_T_ETIQUETAS}" WHERE id_nota = %s ORDER BY lower(etiqueta)', (id_nota,))
    ids_personas = [
        f["id_usuario"] for f in await db.query(f'SELECT id_usuario FROM "{_T_PERSONAS}" WHERE id_nota = %s', (id_nota,))
    ]
    nombres = {u["id"]: u["nombre"] for u in await usuarios_del_proyecto(id_proyecto)} if id_proyecto else {}
    return {
        **nota,
        "etiquetas": [f["etiqueta"] for f in etiquetas],
        "personas": [{"id": i, "nombre": nombres.get(i, f"Usuario n.º {i}")} for i in ids_personas],
        "puede_gestionar": puede_gestionar(nota, id_usuario),
        "notas": notas,
        "documentos": documentos,
        "registros": registros,
        "recordatorios": recordatorios,
    }


async def buscar_notas(
    config: dict, id_usuario: int | None, texto: str | None = None, etiqueta: str | None = None,
    desde: str | None = None, hasta: str | None = None, id_documento: int | None = None,
    id_registro: int | None = None, id_nota: int | None = None, archivadas: bool | None = False,
    solo_mias: bool = False, limite: int = 50, color: str | None = None,
) -> list[dict]:
    """Las notas que ve `id_usuario`, fijadas primero y luego de la más
    reciente a la más antigua. `texto`: cada palabra tiene que salir en el
    título, la descripción, el contenido o las etiquetas. `archivadas`:
    False (lo normal) solo las no archivadas, True solo las archivadas,
    None todas. El contenido sale recortado: para leerla entera, obtener_nota."""
    condicion, params = _visible("n", id_usuario)
    condiciones, params = [condicion], list(params)
    for palabra in (texto or "").split():
        condiciones.append(
            "(n.titulo ILIKE %s OR n.descripcion ILIKE %s OR n.contenido ILIKE %s OR EXISTS ("
            f'SELECT 1 FROM "{_T_ETIQUETAS}" e WHERE e.id_nota = n.id AND e.etiqueta ILIKE %s))'
        )
        patron = f"%{palabra}%"
        params += [patron] * 4
    if etiqueta:
        condiciones.append(
            f'EXISTS (SELECT 1 FROM "{_T_ETIQUETAS}" e WHERE e.id_nota = n.id AND lower(e.etiqueta) = lower(%s))'
        )
        params.append(etiqueta.strip())
    if desde:
        condiciones.append("n.fecha >= %s")
        params.append(_fecha(desde))
    if hasta:
        fin = _fecha(hasta)
        if len(str(hasta).strip()) <= 10:  # solo el día: incluido entero
            fin = fin.replace(hour=23, minute=59, second=59)
        condiciones.append("n.fecha <= %s")
        params.append(fin)
    if id_documento:
        condiciones.append(f'n.id IN (SELECT id_nota FROM "{_T_DOCUMENTOS}" WHERE id_documento = %s)')
        params.append(id_documento)
    if id_registro:
        condiciones.append(f'n.id IN (SELECT id_nota FROM "{_T_REGISTROS}" WHERE id_registro = %s)')
        params.append(id_registro)
    if id_nota:
        condiciones.append(
            f'n.id IN (SELECT CASE WHEN id_nota_a = %s THEN id_nota_b ELSE id_nota_a END FROM "{_T_RELACIONES}" '
            "WHERE id_nota_a = %s OR id_nota_b = %s)"
        )
        params += [id_nota] * 3
    if color:
        condiciones.append("n.color = %s")
        params.append(color)
    if archivadas is not None:
        condiciones.append("n.archivada = %s")
        params.append(archivadas)
    if solo_mias:
        if id_usuario is None:
            return []
        condiciones.append("n.id_usuario_autor = %s")
        params.append(id_usuario)

    db = AsyncDatabase(**config)
    filas = await db.query(
        f"""
        SELECT n.id, n.fecha, n.titulo, n.descripcion, LEFT(n.contenido, {MAX_CONTENIDO_LISTADO}) AS contenido,
               length(n.contenido) > {MAX_CONTENIDO_LISTADO} AS contenido_recortado,
               n.visibilidad, n.color, n.fijada, n.archivada, n.creado_por, n.id_usuario_autor,
               n.fecha_modificacion, n.modificado_por
        FROM "{_T_NOTAS}" n
        WHERE {' AND '.join(condiciones)}
        ORDER BY n.fijada DESC, n.fecha DESC, n.id DESC
        LIMIT %s
        """,
        (*params, max(1, min(limite, 500))),
    )
    if not filas:
        return []
    marcadores = ", ".join(["%s"] * len(filas))
    etiquetas = await db.query(
        f'SELECT id_nota, etiqueta FROM "{_T_ETIQUETAS}" WHERE id_nota IN ({marcadores}) ORDER BY lower(etiqueta)',
        tuple(f["id"] for f in filas),
    )
    por_nota: dict[int, list[str]] = {}
    for e in etiquetas:
        por_nota.setdefault(e["id_nota"], []).append(e["etiqueta"])
    return [{**f, "etiquetas": por_nota.get(f["id"], [])} for f in filas]

