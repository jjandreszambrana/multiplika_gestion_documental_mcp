"""Programaciones y notificaciones — ver docs/gestion-documental.md →
"Programaciones y notificaciones". Lo usan las tools MCP, el panel y el
cron que las hace saltar (scripts/procesar_programaciones.py), para que
las tres partes compartan las mismas reglas.

Lanza ValueError con mensajes que se pueden enseñar tal cual; cada lado
los convierte en su propio error (ToolError / HTTPException)."""

import asyncio
import html
import json
import os
from datetime import datetime, timedelta

from mtpk_mariadb import AsyncCrudBase as AsyncCrudBaseControl
from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from database.config_db import get_db_config
from database.control.dependencias._dep_usuarios import TABLA_USUARIOS
from database.control.dependencias._dep_usuarios_proyectos_roles import TABLA_USUARIOS_PROYECTOS_ROLES

from ..dependencias._dep_documentos import TABLA_DOCUMENTOS
from ..dependencias._dep_programaciones import (
    TABLA_EJECUCIONES,
    TABLA_NOTIFICACIONES,
    TABLA_PROGRAMACIONES,
    TABLA_PROGRAMACIONES_DESTINATARIOS,
    TABLA_PROGRAMACIONES_DOCUMENTOS,
)
from ._mod_configuracion import ConfiguracionCRUD
from ._mod_envios import mandar_correo
from ._repeticiones import ahora_madrid, describir_regla, siguiente_ejecucion, validar_regla

_T_PROG = TABLA_PROGRAMACIONES.nombre
_T_DOCS = TABLA_PROGRAMACIONES_DOCUMENTOS.nombre
_T_DEST = TABLA_PROGRAMACIONES_DESTINATARIOS.nombre
_T_EJEC = TABLA_EJECUCIONES.nombre
_T_NOTIF = TABLA_NOTIFICACIONES.nombre

_roles_control = AsyncCrudBaseControl(TABLA_USUARIOS_PROYECTOS_ROLES, get_db_config("control"))
_usuarios_control = AsyncCrudBaseControl(TABLA_USUARIOS, get_db_config("control"))


# ---------- Usuarios del proyecto (base de control) ----------

async def usuarios_del_proyecto(id_proyecto: int) -> list[dict]:
    """Usuarios activos con algún rol en el proyecto: id, nombre, email."""
    roles, _ = await _roles_control.listar(filtros={"id_proyecto": {"op": "=", "valor": id_proyecto}}, limit=1000)
    usuarios = []
    for rol in roles:
        usuario = await _usuarios_control.obtener(rol["id_usuario"])
        if usuario and usuario["estado"] == 1:
            usuarios.append({"id": usuario["id"], "nombre": usuario["nombre"], "email": usuario["email"]})
    return sorted(usuarios, key=lambda u: u["nombre"].lower())


# ---------- Programaciones ----------

def _limpiar_datos(datos: dict) -> dict:
    """Valida lo que llega al crear o cambiar una programación. Solo
    comprueba los campos presentes (al cambiar, los demás no se tocan)."""
    limpios = {}
    if "titulo" in datos:
        titulo = (datos["titulo"] or "").strip()
        if not titulo:
            raise ValueError("El título no puede estar vacío")
        limpios["titulo"] = titulo[:255]
    if "descripcion" in datos:
        limpios["descripcion"] = (datos["descripcion"] or "").strip() or None
    if "regla" in datos:
        limpios["regla"] = validar_regla(datos["regla"] or {})
    for campo in ("avisar_por_email", "requiere_hecho"):
        if datos.get(campo) is not None:
            limpios[campo] = bool(datos[campo])
    if "max_recordatorios" in datos:
        maximo = datos["max_recordatorios"]
        if maximo is not None and (not isinstance(maximo, int) or not 0 <= maximo <= 365):
            raise ValueError("El número de recordatorios debe estar entre 0 y 365 (vacío = hasta que se pulse Hecho)")
        limpios["max_recordatorios"] = maximo
    if datos.get("cada_dias_recordatorio") is not None:
        cada = datos["cada_dias_recordatorio"]
        if not isinstance(cada, int) or not 1 <= cada <= 365:
            raise ValueError("Los días entre recordatorios deben estar entre 1 y 365")
        limpios["cada_dias_recordatorio"] = cada
    return limpios


async def _comprobar_destinatarios(id_proyecto: int, ids_usuarios: list[int]) -> None:
    if not ids_usuarios:
        raise ValueError("Indica al menos una persona a quien avisar")
    validos = {u["id"] for u in await usuarios_del_proyecto(id_proyecto)}
    ajenos = [i for i in ids_usuarios if i not in validos]
    if ajenos:
        raise ValueError(f"Estos usuarios no son de este proyecto: {', '.join(map(str, ajenos))}")


async def _comprobar_documentos(config: dict, ids_documentos: list[int]) -> None:
    documentos = AsyncCrudBase(TABLA_DOCUMENTOS, config)
    for id_documento in ids_documentos:
        if not await documentos.obtener(id_documento):
            raise ValueError(f"No existe ningún documento con id {id_documento}")


async def _reemplazar_relacion(config: dict, tabla: str, campo: str, id_programacion: int, ids: list[int]) -> None:
    db = AsyncDatabase(**config)
    await db.query(f'DELETE FROM "{tabla}" WHERE id_programacion = %s', (id_programacion,))
    for valor in sorted(set(ids)):
        await db.query(
            f'INSERT INTO "{tabla}" (id_programacion, {campo}) VALUES (%s, %s)', (id_programacion, valor)
        )


def _proxima_desde_ahora(regla: dict) -> datetime:
    proxima = siguiente_ejecucion(regla, ahora_madrid())
    if not proxima:
        raise ValueError("Esa fecha y hora ya han pasado: no volvería a avisar nunca")
    return proxima


async def crear_programacion(
    config: dict, id_proyecto: int, datos: dict, ids_usuarios: list[int], ids_documentos: list[int],
    creado_por: str, id_usuario_creador: int | None,
) -> dict:
    """`datos`: titulo, descripcion, regla (ver _repeticiones.py),
    avisar_por_email, requiere_hecho, max_recordatorios, cada_dias_recordatorio."""
    limpios = _limpiar_datos({"titulo": datos.get("titulo"), "regla": datos.get("regla"), **datos})
    await _comprobar_destinatarios(id_proyecto, ids_usuarios)
    await _comprobar_documentos(config, ids_documentos)
    regla = limpios.pop("regla")
    id_programacion = await AsyncCrudBase(TABLA_PROGRAMACIONES, config).insert({
        **limpios,
        "regla_repeticion": json.dumps(regla),
        "proxima_ejecucion": _proxima_desde_ahora(regla),
        "estado": "activa",
        "creado_por": creado_por,
        "id_usuario_creador": id_usuario_creador,
    })
    await _reemplazar_relacion(config, _T_DEST, "id_usuario", id_programacion, ids_usuarios)
    await _reemplazar_relacion(config, _T_DOCS, "id_documento", id_programacion, ids_documentos)
    return await obtener_programacion(config, id_proyecto, id_programacion)


async def actualizar_programacion(
    config: dict, id_proyecto: int, id_programacion: int, datos: dict,
    ids_usuarios: list[int] | None = None, ids_documentos: list[int] | None = None,
) -> dict:
    """Cambia solo lo que venga. Si cambia la repetición, se recalcula la
    próxima vez desde ahora (y una terminada vuelve a estar activa)."""
    crud = AsyncCrudBase(TABLA_PROGRAMACIONES, config)
    actual = await crud.obtener(id_programacion)
    if not actual:
        raise LookupError(f"No existe ninguna programación con id {id_programacion}")
    limpios = _limpiar_datos(datos)
    if ids_usuarios is not None:
        await _comprobar_destinatarios(id_proyecto, ids_usuarios)
    if ids_documentos is not None:
        await _comprobar_documentos(config, ids_documentos)
    if "regla" in limpios:
        regla = limpios.pop("regla")
        limpios["regla_repeticion"] = json.dumps(regla)
        limpios["proxima_ejecucion"] = _proxima_desde_ahora(regla)
        if actual["estado"] == "terminada":
            limpios["estado"] = "activa"
    if limpios:
        await crud.update(id_programacion, limpios)
    if ids_usuarios is not None:
        await _reemplazar_relacion(config, _T_DEST, "id_usuario", id_programacion, ids_usuarios)
    if ids_documentos is not None:
        await _reemplazar_relacion(config, _T_DOCS, "id_documento", id_programacion, ids_documentos)
    return await obtener_programacion(config, id_proyecto, id_programacion)


async def cambiar_pausa(config: dict, id_proyecto: int, id_programacion: int, pausar: bool) -> dict:
    """Al reanudar se calcula la próxima desde ahora: lo que tocaba mientras
    estuvo pausada no se manda de golpe."""
    crud = AsyncCrudBase(TABLA_PROGRAMACIONES, config)
    actual = await crud.obtener(id_programacion)
    if not actual:
        raise LookupError(f"No existe ninguna programación con id {id_programacion}")
    if actual["estado"] == "terminada":
        raise ValueError("Esta programación ya terminó: cambia la fecha para que vuelva a avisar")
    if pausar:
        await crud.update(id_programacion, {"estado": "pausada"})
    else:
        proxima = siguiente_ejecucion(json.loads(actual["regla_repeticion"]), ahora_madrid())
        await crud.update(id_programacion, {
            "estado": "activa" if proxima else "terminada", "proxima_ejecucion": proxima,
        })
    return await obtener_programacion(config, id_proyecto, id_programacion)


async def eliminar_programacion(config: dict, id_programacion: int) -> bool:
    """Se lleva con ella su historial y sus notificaciones (ON DELETE CASCADE)."""
    crud = AsyncCrudBase(TABLA_PROGRAMACIONES, config)
    if not await crud.obtener(id_programacion):
        return False
    await crud.eliminar(id_programacion)
    return True


async def _nombres(id_proyecto: int) -> dict[int, str]:
    return {u["id"]: u["nombre"] for u in await usuarios_del_proyecto(id_proyecto)}


def _presentar(fila: dict) -> dict:
    regla = json.loads(fila["regla_repeticion"])
    datos = {k: v for k, v in fila.items() if k != "regla_repeticion"}
    return {**datos, "regla": regla, "descripcion_repeticion": describir_regla(regla)}


async def obtener_programacion(config: dict, id_proyecto: int, id_programacion: int, limite_historial: int = 20) -> dict | None:
    """Con sus documentos, sus destinatarios y las últimas veces que saltó."""
    fila = await AsyncCrudBase(TABLA_PROGRAMACIONES, config).obtener(id_programacion)
    if not fila:
        return None
    db = AsyncDatabase(**config)
    documentos = await db.query(
        f'SELECT d.id, d.nombre, d.archivado FROM "{_T_DOCS}" pd '
        f'JOIN "{TABLA_DOCUMENTOS.nombre}" d ON d.id = pd.id_documento '
        "WHERE pd.id_programacion = %s ORDER BY d.nombre",
        (id_programacion,),
    )
    ids_usuarios = await db.query(f'SELECT id_usuario FROM "{_T_DEST}" WHERE id_programacion = %s', (id_programacion,))
    nombres = await _nombres(id_proyecto)
    ejecuciones = await db.query(
        f'SELECT * FROM "{_T_EJEC}" WHERE id_programacion = %s ORDER BY fecha DESC LIMIT %s',
        (id_programacion, limite_historial),
    )
    return {
        **_presentar(fila),
        "documentos": documentos,
        "destinatarios": [
            {"id": f["id_usuario"], "nombre": nombres.get(f["id_usuario"], f"Usuario n.º {f['id_usuario']} (sin acceso)")}
            for f in ids_usuarios
        ],
        "ejecuciones": ejecuciones,
    }


async def listar_programaciones(
    config: dict, id_proyecto: int, estado: str | None = None, id_documento: int | None = None,
) -> list[dict]:
    condiciones, params = [], []
    if estado:
        condiciones.append("p.estado = %s")
        params.append(estado)
    if id_documento:
        condiciones.append(f'p.id IN (SELECT id_programacion FROM "{_T_DOCS}" WHERE id_documento = %s)')
        params.append(id_documento)
    where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""
    db = AsyncDatabase(**config)
    filas = await db.query(
        f"""
        SELECT p.*,
               (SELECT COUNT(*) FROM "{_T_DOCS}" pd WHERE pd.id_programacion = p.id) AS num_documentos,
               (SELECT COUNT(*) FROM "{_T_EJEC}" e WHERE e.id_programacion = p.id AND e.pendiente_hecho)
                   AS pendientes_hecho
        FROM "{_T_PROG}" p {where}
        ORDER BY CASE p.estado WHEN 'activa' THEN 0 WHEN 'pausada' THEN 1 ELSE 2 END,
                 p.proxima_ejecucion ASC NULLS LAST, p.id DESC
        LIMIT 500
        """,
        tuple(params),
    )
    destinatarios = await db.query(f'SELECT id_programacion, id_usuario FROM "{_T_DEST}"')
    nombres = await _nombres(id_proyecto)
    por_programacion: dict[int, list[str]] = {}
    for d in destinatarios:
        por_programacion.setdefault(d["id_programacion"], []).append(nombres.get(d["id_usuario"], "(sin acceso)"))
    return [{**_presentar(f), "destinatarios": sorted(por_programacion.get(f["id"], []))} for f in filas]


# ---------- Hecho ----------

async def marcar_hecho(config: dict, id_ejecucion: int, quien: str) -> dict:
    """Cierra un aviso que esperaba "Hecho": deja de recordarse y las
    notificaciones de todos sus destinatarios pasan a leídas."""
    crud = AsyncCrudBase(TABLA_EJECUCIONES, config)
    ejecucion = await crud.obtener(id_ejecucion)
    if not ejecucion:
        raise LookupError(f"No existe ningún aviso con id {id_ejecucion}")
    if not ejecucion["pendiente_hecho"]:
        if ejecucion["hecho_por"]:
            raise ValueError(f"Ya lo marcó como hecho {ejecucion['hecho_por']}")
        raise ValueError("Este aviso no necesita que se marque como hecho")
    ahora = ahora_madrid()
    await crud.update(id_ejecucion, {
        "pendiente_hecho": False, "proximo_recordatorio": None, "hecho_por": quien[:255], "fecha_hecho": ahora,
    })
    await AsyncDatabase(**config).query(
        f'UPDATE "{_T_NOTIF}" SET leida = true, fecha_leida = %s WHERE id_ejecucion = %s AND NOT leida',
        (ahora, id_ejecucion),
    )
    return await crud.obtener(id_ejecucion)


async def listar_pendientes_hecho(config: dict) -> list[dict]:
    return await AsyncDatabase(**config).query(
        f"""
        SELECT e.id AS id_ejecucion, e.fecha, e.recordatorios_enviados, e.proximo_recordatorio,
               p.id AS id_programacion, p.titulo, p.max_recordatorios
        FROM "{_T_EJEC}" e JOIN "{_T_PROG}" p ON p.id = e.id_programacion
        WHERE e.pendiente_hecho
        ORDER BY e.fecha ASC
        LIMIT 500
        """
    )


# ---------- Notificaciones de cada usuario ----------

async def listar_notificaciones(config: dict, id_usuario: int, solo_no_leidas: bool = False, limite: int = 100) -> list[dict]:
    """Con el estado del "Hecho" de su aviso, para saber si enseñar el botón."""
    filtro = "AND NOT n.leida" if solo_no_leidas else ""
    return await AsyncDatabase(**config).query(
        f"""
        SELECT n.*, e.pendiente_hecho, e.hecho_por, e.fecha_hecho
        FROM "{_T_NOTIF}" n LEFT JOIN "{_T_EJEC}" e ON e.id = n.id_ejecucion
        WHERE n.id_usuario = %s {filtro}
        ORDER BY n.fecha DESC, n.id DESC
        LIMIT %s
        """,
        (id_usuario, limite),
    )


async def contar_no_leidas(config: dict, id_usuario: int) -> int:
    filas = await AsyncDatabase(**config).query(
        f'SELECT COUNT(*) AS total FROM "{_T_NOTIF}" WHERE id_usuario = %s AND NOT leida', (id_usuario,)
    )
    return filas[0]["total"]


async def marcar_leidas(config: dict, id_usuario: int, id_notificacion: int | None = None) -> None:
    """Una (si se da su id) o todas las del usuario. Solo las suyas."""
    sql = f'UPDATE "{_T_NOTIF}" SET leida = true, fecha_leida = %s WHERE id_usuario = %s AND NOT leida'
    params = [ahora_madrid(), id_usuario]
    if id_notificacion is not None:
        sql += " AND id = %s"
        params.append(id_notificacion)
    await AsyncDatabase(**config).query(sql, tuple(params))


# ---------- Hacer saltar lo que toca (cron) ----------

def _correo(programacion: dict, titulo: str, documentos: list[dict]) -> tuple[str, str]:
    """(texto, html) del email de un aviso."""
    lineas = [titulo, ""]
    if programacion["descripcion"]:
        lineas += [programacion["descripcion"], ""]
    if documentos:
        lineas.append("Documentos relacionados:")
        lineas += [f"- {d['nombre']}" for d in documentos]
        lineas.append("")
    if programacion["requiere_hecho"]:
        lineas.append('Cuando esté hecho, márcalo como "Hecho" en Notificaciones del panel para que deje de recordarse.')
    url = os.environ.get("GD_URL_PUBLICA")
    if url:
        lineas.append(f"Panel: {url.rstrip('/')}/")
    texto = "\n".join(lineas).strip() + "\n"
    cuerpo = "".join(
        f"<p>{html.escape(parte).replace(chr(10), '<br>')}</p>" for parte in texto.split("\n\n") if parte.strip()
    )
    return texto, f"<html><body>{cuerpo}</body></html>"


async def _avisar(
    config: dict, id_proyecto: int, programacion: dict, id_ejecucion: int, titulo: str, ahora: datetime,
) -> str:
    """Crea la notificación de cada destinatario y, si toca, le manda el
    email. Devuelve el resumen legible para el historial."""
    db = AsyncDatabase(**config)
    usuarios = {u["id"]: u for u in await usuarios_del_proyecto(id_proyecto)}
    destinatarios = await db.query(
        f'SELECT id_usuario FROM "{_T_DEST}" WHERE id_programacion = %s', (programacion["id"],)
    )
    documentos = await db.query(
        f'SELECT d.nombre FROM "{_T_DOCS}" pd JOIN "{TABLA_DOCUMENTOS.nombre}" d ON d.id = pd.id_documento '
        "WHERE pd.id_programacion = %s ORDER BY d.nombre",
        (programacion["id"],),
    )
    cuenta = await ConfiguracionCRUD(config).obtener_cuenta_email() if programacion["avisar_por_email"] else None
    texto, cuerpo_html = _correo(programacion, titulo, documentos)
    notificaciones = AsyncCrudBase(TABLA_NOTIFICACIONES, config)

    partes = []
    for fila in destinatarios:
        usuario = usuarios.get(fila["id_usuario"])
        if not usuario:
            partes.append(f"usuario n.º {fila['id_usuario']}: omitido, ya no tiene acceso al proyecto")
            continue
        estado_email, error_email = "no_aplica", None
        if programacion["avisar_por_email"]:
            if not cuenta:
                estado_email, error_email = "fallido", "el proyecto no tiene cuenta de correo configurada"
            else:
                try:
                    await asyncio.to_thread(mandar_correo, cuenta, usuario["email"], titulo, texto, cuerpo_html)
                    estado_email = "enviado"
                except Exception as e:  # SMTP, red, credenciales... no debe parar al resto
                    estado_email, error_email = "fallido", str(e)[:500]
        await notificaciones.insert({
            "id_usuario": usuario["id"], "origen": "programacion", "id_programacion": programacion["id"],
            "id_ejecucion": id_ejecucion, "titulo": titulo[:255], "texto": programacion["descripcion"],
            "fecha": ahora, "estado_email": estado_email, "error_email": error_email,
        })
        vias = {"enviado": "panel y email", "no_aplica": "panel"}.get(estado_email, f"panel; email falló: {error_email}")
        partes.append(f"{usuario['nombre']} ({vias})")
    return "Avisado a " + ", ".join(partes) if partes else "Sin destinatarios"


async def _saltar(config: dict, id_proyecto: int, programacion: dict, ahora: datetime) -> None:
    requiere_hecho = programacion["requiere_hecho"]
    quedan_recordatorios = requiere_hecho and programacion["max_recordatorios"] != 0
    ejecuciones = AsyncCrudBase(TABLA_EJECUCIONES, config)
    id_ejecucion = await ejecuciones.insert({
        "id_programacion": programacion["id"], "fecha": ahora, "pendiente_hecho": requiere_hecho,
        "proximo_recordatorio": (
            ahora + timedelta(days=programacion["cada_dias_recordatorio"]) if quedan_recordatorios else None
        ),
    })
    resumen = await _avisar(config, id_proyecto, programacion, id_ejecucion, programacion["titulo"], ahora)
    await ejecuciones.update(id_ejecucion, {"resumen": resumen})


async def _recordar(config: dict, id_proyecto: int, ejecucion: dict, programacion: dict, ahora: datetime) -> None:
    numero = ejecucion["recordatorios_enviados"] + 1
    maximo = programacion["max_recordatorios"]
    otra_vez = maximo is None or numero < maximo
    # Reclamarlo: si otra pasada ya lo cogió, proximo_recordatorio ya no coincide.
    reclamado = await AsyncDatabase(**config).query(
        f'UPDATE "{_T_EJEC}" SET recordatorios_enviados = %s, proximo_recordatorio = %s '
        "WHERE id = %s AND pendiente_hecho AND proximo_recordatorio = %s",
        (
            numero,
            ahora + timedelta(days=programacion["cada_dias_recordatorio"]) if otra_vez else None,
            ejecucion["id"], ejecucion["proximo_recordatorio"],
        ),
    )
    if reclamado != 1:
        return
    de_cuantos = f" de {maximo}" if maximo else ""
    titulo = f"Recordatorio {numero}{de_cuantos}: {programacion['titulo']}"
    resumen = await _avisar(config, id_proyecto, programacion, ejecucion["id"], titulo, ahora)
    anterior = ejecucion["resumen"] or ""
    await AsyncCrudBase(TABLA_EJECUCIONES, config).update(
        ejecucion["id"], {"resumen": f"{anterior}\nRecordatorio {numero} ({ahora:%d/%m/%Y %H:%M}): {resumen}".strip()},
    )


async def procesar_pendientes(config: dict, id_proyecto: int, ahora: datetime | None = None) -> dict:
    """Hace saltar las programaciones cuya hora ya llegó y manda los
    recordatorios de avisos sin "Hecho". Si el servidor estuvo parado, cada
    programación salta una sola vez (no una por cada fecha perdida)."""
    ahora = ahora or ahora_madrid()
    db = AsyncDatabase(**config)
    saltadas = recordatorios = 0

    vencidas = await db.query(
        f'SELECT * FROM "{_T_PROG}" WHERE estado = %s AND proxima_ejecucion <= %s ORDER BY proxima_ejecucion LIMIT 200',
        ("activa", ahora),
    )
    for programacion in vencidas:
        siguiente = siguiente_ejecucion(json.loads(programacion["regla_repeticion"]), ahora)
        # Adelantar la próxima ANTES de avisar, y solo si nadie lo hizo ya:
        # si una pasada tarda más de un minuto, la siguiente no la repite.
        reclamada = await db.query(
            f'UPDATE "{_T_PROG}" SET proxima_ejecucion = %s, estado = %s, ultima_ejecucion = %s '
            "WHERE id = %s AND estado = 'activa' AND proxima_ejecucion = %s",
            (siguiente, "activa" if siguiente else "terminada", ahora, programacion["id"], programacion["proxima_ejecucion"]),
        )
        if reclamada == 1:
            await _saltar(config, id_proyecto, programacion, ahora)
            saltadas += 1

    por_recordar = await db.query(
        f'SELECT * FROM "{_T_EJEC}" WHERE pendiente_hecho AND proximo_recordatorio <= %s '
        "ORDER BY proximo_recordatorio LIMIT 200",
        (ahora,),
    )
    programaciones = AsyncCrudBase(TABLA_PROGRAMACIONES, config)
    for ejecucion in por_recordar:
        programacion = await programaciones.obtener(ejecucion["id_programacion"])
        await _recordar(config, id_proyecto, ejecucion, programacion, ahora)
        recordatorios += 1

    return {"saltadas": saltadas, "recordatorios": recordatorios}
