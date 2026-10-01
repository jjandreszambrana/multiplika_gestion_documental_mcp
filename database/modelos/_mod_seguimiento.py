"""Seguimiento de notas del bloc, documentos y notas de documentos —
ver docs/gestion-documental.md → "Seguimiento". Lo usan las tools MCP, el
panel y el cron (scripts/procesar_programaciones.py), para que los tres
compartan las mismas reglas.

Toda función que mira o cambia un elemento recibe `id_usuario`: la
persona que pregunta, o None si no se sabe (API key de todos, soporte).
Una nota del bloc que no puedes ver no existe (LookupError), igual que en
el bloc de notas. Documentos y notas de documentos los ve todo el proyecto.

Lanza ValueError / LookupError con mensajes que se pueden enseñar tal cual."""

import asyncio
import html
import os
from datetime import date, datetime, time

from mtpk_postgres.async_adapter import AsyncDatabase

from lib.roles_proyecto import puede_editar_proyecto

from ..dependencias._dep_bloc_notas import TABLA_BLOC_NOTAS
from ..dependencias._dep_documentos import TABLA_DOCUMENTOS
from ..dependencias._dep_notas import TABLA_NOTAS
from ..dependencias._dep_programaciones import TABLA_NOTIFICACIONES, TABLA_PROGRAMACIONES
from ..dependencias._dep_seguimiento import (
    COLUMNA_POR_TIPO,
    ESTADOS_SEGUIMIENTO,
    TABLA_SEGUIMIENTO,
    TABLA_SEGUIMIENTO_RESUMENES,
)
from ._mod_bloc_notas import _nota_visible, _visible
from ._mod_configuracion import ConfiguracionCRUD
from ._mod_envios import mandar_correo
from ._mod_programaciones import crear_programacion, eliminar_programacion, usuarios_del_proyecto
from ._repeticiones import ahora_madrid

_T = TABLA_SEGUIMIENTO.nombre
TIPOS = tuple(COLUMNA_POR_TIPO)
NOMBRES_ESTADO = {"pendiente": "Pendiente", "en_curso": "En curso", "realizado": "Realizado", "aplazado": "Aplazado"}
NOMBRES_TIPO = {"nota_bloc": "Nota del bloc", "documento": "Documento", "nota_documento": "Nota de documento"}
NOMBRES_TIPO_NOTA = {
    "comentario": "Comentario", "anotacion": "Anotación", "observacion": "Observación",
    "incidencia": "Incidencia", "resolucion": "Resolución",
}
#: Lo que entra en el resumen diario
ESTADOS_ABIERTOS = ("pendiente", "en_curso")
HORA_RESUMEN = time(8, 0)
MAX_EN_RESUMEN = 100


# ---------- El elemento al que se le pone el estado ----------

def _comprobar_tipo(tipo: str) -> str:
    if tipo not in TIPOS:
        raise ValueError(f"Tipo no válido: '{tipo}' (nota_bloc, documento o nota_documento)")
    return COLUMNA_POR_TIPO[tipo]


def _titulo_nota_documento(tipo_nota: str, texto: str, documento: str) -> str:
    texto = " ".join((texto or "").split())
    texto = f"{texto[:80]}…" if len(texto) > 80 else texto
    return f"{NOMBRES_TIPO_NOTA.get(tipo_nota, tipo_nota)} en «{documento}»: {texto}"


async def _elemento(db: AsyncDatabase, id_usuario: int | None, tipo: str, id_objeto: int) -> dict:
    """{titulo, id_documento, privada}: lo que hace falta para enseñarlo
    y para crear el aviso del aplazado. LookupError si no existe o no se ve."""
    if tipo == "nota_bloc":
        nota = await _nota_visible(db, id_usuario, id_objeto)
        return {"titulo": nota["titulo"], "id_documento": None, "privada": nota["visibilidad"] != "todos"}
    if tipo == "documento":
        filas = await db.query(f'SELECT nombre FROM "{TABLA_DOCUMENTOS.nombre}" WHERE id = %s', (id_objeto,))
        if not filas:
            raise LookupError(f"No existe ningún documento con id {id_objeto}")
        return {"titulo": filas[0]["nombre"], "id_documento": id_objeto, "privada": False}
    filas = await db.query(
        f'SELECT n.tipo, n.texto, n.id_documento, d.nombre FROM "{TABLA_NOTAS.nombre}" n '
        f'JOIN "{TABLA_DOCUMENTOS.nombre}" d ON d.id = n.id_documento WHERE n.id = %s',
        (id_objeto,),
    )
    if not filas:
        raise LookupError(f"No existe ninguna nota de documento con id {id_objeto}")
    f = filas[0]
    return {
        "titulo": _titulo_nota_documento(f["tipo"], f["texto"], f["nombre"]),
        "id_documento": f["id_documento"], "privada": False,
    }


def _presentar(fila: dict | None, nombres: dict[int, str]) -> dict:
    """El seguimiento tal como lo ven la IA y el panel. Sin fila: sin estado."""
    if not fila:
        return {"estado": None, "nombre_estado": "Sin estado", "id_usuario_responsable": None, "responsable": None}
    id_responsable = fila["id_usuario_responsable"]
    return {
        "estado": fila["estado"],
        "nombre_estado": NOMBRES_ESTADO[fila["estado"]],
        "id_usuario_responsable": id_responsable,
        "responsable": nombres.get(id_responsable, f"Usuario n.º {id_responsable} (sin acceso)") if id_responsable else None,
        "aplazado_hasta": fila["aplazado_hasta"],
        "id_programacion": fila["id_programacion"],
        "fecha_cambio": fila["fecha_cambio"],
        "cambiado_por": fila["cambiado_por"],
    }


async def _nombres(id_proyecto: int) -> dict[int, str]:
    return {u["id"]: u["nombre"] for u in await usuarios_del_proyecto(id_proyecto)}


async def obtener_seguimiento(config: dict, id_proyecto: int, id_usuario: int | None, tipo: str, id_objeto: int) -> dict:
    columna = _comprobar_tipo(tipo)
    db = AsyncDatabase(**config)
    await _elemento(db, id_usuario, tipo, id_objeto)
    filas = await db.query(f'SELECT * FROM "{_T}" WHERE {columna} = %s', (id_objeto,))
    return {"tipo": tipo, "id": id_objeto, **_presentar(filas[0] if filas else None, await _nombres(id_proyecto))}


async def seguimientos_de(config: dict, tipo: str, ids: list[int]) -> dict[int, dict]:
    """id del elemento -> {estado, id_usuario_responsable, aplazado_hasta},
    solo de los que tienen estado. Para pintarlo en listados sin una
    consulta por elemento."""
    columna = _comprobar_tipo(tipo)
    if not ids:
        return {}
    marcadores = ", ".join(["%s"] * len(ids))
    filas = await AsyncDatabase(**config).query(
        f'SELECT {columna} AS id_objeto, estado, id_usuario_responsable, aplazado_hasta FROM "{_T}" '
        f"WHERE {columna} IN ({marcadores})",
        tuple(ids),
    )
    return {f.pop("id_objeto"): f for f in filas}


# ---------- Cambiar el estado ----------

def _fecha_aplazado(valor) -> datetime:
    """"AAAA-MM-DD" (a las 9:00) o "AAAA-MM-DD HH:MM", hora de Madrid."""
    texto = str(valor or "").strip()
    try:
        if len(texto) <= 10:
            return datetime.combine(date.fromisoformat(texto), time(9, 0))
        return datetime.fromisoformat(texto).replace(tzinfo=None, second=0, microsecond=0)
    except ValueError as e:
        raise ValueError(f"Fecha de aplazamiento no válida: '{valor}' (usa AAAA-MM-DD o AAAA-MM-DD HH:MM)") from e


async def _comprobar_responsable(
    db: AsyncDatabase, id_proyecto: int, tipo: str, id_objeto: int, id_responsable: int,
) -> None:
    if id_responsable not in await _nombres(id_proyecto):
        raise ValueError(f"El usuario n.º {id_responsable} no es de este proyecto")
    if not await puede_editar_proyecto(id_responsable, id_proyecto):
        raise ValueError("Esa persona es invitada (solo lectura): no puede encargarse de nada")
    if tipo == "nota_bloc":
        try:
            await _nota_visible(db, id_responsable, id_objeto)
        except LookupError:
            raise ValueError("Esa persona no puede ver esta nota: compártela antes con ella") from None


async def _quitar_aviso(config: dict, fila: dict | None) -> None:
    """Borra el aviso del aplazado si todavía no ha saltado."""
    if not fila or not fila["id_programacion"]:
        return
    filas = await AsyncDatabase(**config).query(
        f'SELECT estado FROM "{TABLA_PROGRAMACIONES.nombre}" WHERE id = %s', (fila["id_programacion"],)
    )
    if filas and filas[0]["estado"] != "terminada":
        await eliminar_programacion(config, fila["id_programacion"])


async def _crear_aviso(
    config: dict, id_proyecto: int, db: AsyncDatabase, tipo: str, id_objeto: int, elemento: dict,
    hasta: datetime, id_responsable: int | None, id_usuario: int | None, quien: str,
) -> int:
    """El aviso programado que salta el día del aplazado. Le llega al
    responsable; si no hay, a quien lo aplazó; y si tampoco se sabe quién
    es (API key de todos, soporte), a todos los que pueden escribir."""
    if id_responsable:
        destinatarios = [id_responsable]
    elif id_usuario:
        destinatarios = [id_usuario]
    else:  # sin quién, una nota del bloc solo puede ser de todos: la ven todos
        destinatarios = [
            u["id"] for u in await usuarios_del_proyecto(id_proyecto)
            if await puede_editar_proyecto(u["id"], id_proyecto)
        ]
    if not destinatarios:
        raise ValueError("No hay nadie en el proyecto a quien avisar cuando acabe el aplazamiento")
    # La lista de avisos la ve todo el proyecto: de una nota que no es de
    # todos no se pone el título (mismo criterio que sus recordatorios)
    titulo = "una nota del bloc" if elemento["privada"] else elemento["titulo"]
    programacion = await crear_programacion(
        config, id_proyecto,
        {
            "titulo": f"Vuelve a estar pendiente: {titulo}"[:255],
            "descripcion": (
                f"{quien} lo aplazó hasta el {hasta:%d/%m/%Y %H:%M}. Desde ahora vuelve a estar pendiente "
                "y entra en el resumen diario de seguimiento."
            ),
            "regla": {"tipo": "una_vez", "fecha": hasta.date().isoformat(), "hora": hasta.strftime("%H:%M")},
            "avisar_por_email": True,
            "requiere_hecho": False,
            **({"id_nota_bloc": id_objeto} if tipo == "nota_bloc" else {}),
        },
        destinatarios, [elemento["id_documento"]] if elemento["id_documento"] else [],
        quien, id_usuario,
    )
    return programacion["id"]


_SIN_CAMBIO = object()


async def cambiar_seguimiento(
    config: dict, id_proyecto: int, id_usuario: int | None, quien: str, tipo: str, id_objeto: int,
    estado=_SIN_CAMBIO, id_responsable=_SIN_CAMBIO, aplazado_hasta: str | None = None,
) -> dict:
    """Pone el estado (None = sin estado: sale del seguimiento) y/o el
    responsable (None = nadie). Lo que no se pasa no cambia. Aplazar exige
    `aplazado_hasta` (salvo si ya estaba aplazado y no cambia la fecha) y
    crea un aviso programado para ese momento; cuando salta, el elemento
    vuelve a pendiente. Salir del aplazado borra ese aviso si no ha saltado."""
    columna = _comprobar_tipo(tipo)
    db = AsyncDatabase(**config)
    elemento = await _elemento(db, id_usuario, tipo, id_objeto)
    filas = await db.query(f'SELECT * FROM "{_T}" WHERE {columna} = %s', (id_objeto,))
    actual = filas[0] if filas else None

    nuevo_estado = (actual["estado"] if actual else None) if estado is _SIN_CAMBIO else (estado or None)
    if nuevo_estado is None:
        if actual:
            await _quitar_aviso(config, actual)
            await db.query(f'DELETE FROM "{_T}" WHERE id = %s', (actual["id"],))
        return await obtener_seguimiento(config, id_proyecto, id_usuario, tipo, id_objeto)
    if nuevo_estado not in ESTADOS_SEGUIMIENTO:
        raise ValueError(f"Estado no válido: '{nuevo_estado}' (pendiente, en_curso, realizado o aplazado)")

    responsable = (actual["id_usuario_responsable"] if actual else None) if id_responsable is _SIN_CAMBIO else id_responsable
    if responsable and (not actual or responsable != actual["id_usuario_responsable"]):
        await _comprobar_responsable(db, id_proyecto, tipo, id_objeto, responsable)

    hasta, id_programacion = None, None
    if nuevo_estado == "aplazado":
        seguia_aplazado = actual and actual["estado"] == "aplazado"
        if aplazado_hasta:
            hasta = _fecha_aplazado(aplazado_hasta)
        elif seguia_aplazado:
            hasta = actual["aplazado_hasta"]
        else:
            raise ValueError("Para aplazarlo, indica hasta cuándo")
        mismo_aviso = (
            seguia_aplazado and hasta == actual["aplazado_hasta"]
            and responsable == actual["id_usuario_responsable"] and actual["id_programacion"]
        )
        if mismo_aviso:
            id_programacion = actual["id_programacion"]
        else:
            if hasta <= ahora_madrid():
                raise ValueError("La fecha del aplazamiento ya ha pasado")
            await _quitar_aviso(config, actual)
            id_programacion = await _crear_aviso(
                config, id_proyecto, db, tipo, id_objeto, elemento, hasta, responsable, id_usuario, quien,
            )
    else:
        await _quitar_aviso(config, actual)

    valores = {
        "estado": nuevo_estado, "id_usuario_responsable": responsable, "aplazado_hasta": hasta,
        "id_programacion": id_programacion, "fecha_cambio": ahora_madrid(), "cambiado_por": quien[:255],
    }
    if actual:
        asignaciones = ", ".join(f"{k} = %s" for k in valores)
        await db.query(f'UPDATE "{_T}" SET {asignaciones} WHERE id = %s', (*valores.values(), actual["id"]))
    else:
        columnas = ", ".join([columna, *valores])
        await db.query(
            f'INSERT INTO "{_T}" ({columnas}) VALUES ({", ".join(["%s"] * (len(valores) + 1))})',
            (id_objeto, *valores.values()),
        )
    return await obtener_seguimiento(config, id_proyecto, id_usuario, tipo, id_objeto)


# ---------- Listado ----------

async def _filas_visibles(db: AsyncDatabase, id_usuario: int | None) -> list[dict]:
    """Todo lo que tiene estado y ve `id_usuario`, con su título."""
    condicion, params = _visible("n", id_usuario)
    comunes = "s.estado, s.id_usuario_responsable, s.aplazado_hasta, s.id_programacion, s.fecha_cambio, s.cambiado_por"
    filas = await db.query(
        f"""
        SELECT * FROM (
            SELECT 'nota_bloc' AS tipo, s.id_nota_bloc AS id, n.titulo, NULL::int AS id_documento,
                   NULL AS tipo_nota, NULL AS texto_nota, n.archivada AS archivado, {comunes}
            FROM "{_T}" s JOIN "{TABLA_BLOC_NOTAS.nombre}" n ON n.id = s.id_nota_bloc
            WHERE {condicion}
            UNION ALL
            SELECT 'documento', s.id_documento, d.nombre, d.id, NULL, NULL, d.archivado, {comunes}
            FROM "{_T}" s JOIN "{TABLA_DOCUMENTOS.nombre}" d ON d.id = s.id_documento
            UNION ALL
            SELECT 'nota_documento', s.id_nota, d.nombre, d.id, t.tipo, LEFT(t.texto, 200), d.archivado, {comunes}
            FROM "{_T}" s JOIN "{TABLA_NOTAS.nombre}" t ON t.id = s.id_nota
            JOIN "{TABLA_DOCUMENTOS.nombre}" d ON d.id = t.id_documento
        ) x
        ORDER BY CASE estado WHEN 'pendiente' THEN 0 WHEN 'en_curso' THEN 1 WHEN 'aplazado' THEN 2 ELSE 3 END,
                 fecha_cambio DESC
        """,
        params,
    )
    for f in filas:
        if f["tipo"] == "nota_documento":
            f["documento"] = f["titulo"]
            f["titulo"] = _titulo_nota_documento(f.pop("tipo_nota"), f.pop("texto_nota"), f["titulo"])
        else:
            f.pop("tipo_nota")
            f.pop("texto_nota")
    return filas


async def listar_seguimiento(
    config: dict, id_proyecto: int, id_usuario: int | None, estados: list[str] | None = None,
    tipo: str | None = None, id_responsable: int | None = None, sin_responsable: bool = False,
    incluir_archivados: bool = False,
) -> list[dict]:
    """Lo que ve `id_usuario` con estado de seguimiento: pendiente primero,
    luego en curso, aplazado y realizado; dentro, lo último cambiado arriba."""
    for e in estados or []:
        if e not in ESTADOS_SEGUIMIENTO:
            raise ValueError(f"Estado no válido: '{e}' (pendiente, en_curso, realizado o aplazado)")
    if tipo:
        _comprobar_tipo(tipo)
    nombres = await _nombres(id_proyecto)
    resultado = []
    for f in await _filas_visibles(AsyncDatabase(**config), id_usuario):
        if estados and f["estado"] not in estados:
            continue
        if tipo and f["tipo"] != tipo:
            continue
        if id_responsable and f["id_usuario_responsable"] != id_responsable:
            continue
        if sin_responsable and f["id_usuario_responsable"]:
            continue
        if f["archivado"] and not incluir_archivados:
            continue
        resultado.append({**f, **_presentar(f, nombres)})
    return resultado


# ---------- Cron: aplazados que vencen y resumen diario ----------

async def volver_a_pendiente(config: dict, ahora: datetime) -> int:
    """Pasa a pendiente lo aplazado cuyo plazo ya llegó. Lo normal es que
    lo haga su aviso al saltar (_saltar en _mod_programaciones.py); esto es
    la red de seguridad por si alguien borró o pausó ese aviso."""
    return await AsyncDatabase(**config).query(
        f'UPDATE "{_T}" SET estado = %s, aplazado_hasta = NULL, id_programacion = NULL, '
        "fecha_cambio = %s, cambiado_por = %s WHERE estado = 'aplazado' AND aplazado_hasta <= %s",
        ("pendiente", ahora, "Fin del aplazamiento", ahora),
    ) or 0


def _correo_resumen(nombre: str, mios: list[dict], de_todos: list[dict]) -> tuple[str, str, str]:
    """(título, texto, html) del resumen de una persona."""
    elementos = mios + de_todos
    pendientes = sum(1 for e in elementos if e["estado"] == "pendiente")
    en_curso = len(elementos) - pendientes
    partes = [f"{pendientes} pendiente{'s' if pendientes != 1 else ''}"] if pendientes else []
    if en_curso:
        partes.append(f"{en_curso} en curso")
    titulo = f"Seguimiento de hoy: {' y '.join(partes)}"

    def lineas(lista: list[dict]) -> list[str]:
        salida = [f"- [{e['nombre_estado']}] {NOMBRES_TIPO[e['tipo']]}: {e['titulo']}" for e in lista[:MAX_EN_RESUMEN]]
        if len(lista) > MAX_EN_RESUMEN:
            salida.append(f"- … y {len(lista) - MAX_EN_RESUMEN} más")
        return salida

    texto = [f"Hola, {nombre}. Esto es lo que sigue abierto:", ""]
    if mios:
        texto += ["De lo que te encargas tú:", *lineas(mios), ""]
    if de_todos:
        texto += ["Sin nadie encargado:", *lineas(de_todos), ""]
    url = os.environ.get("GD_URL_PUBLICA")
    if url:
        texto.append(f"Para cambiar el estado, entra en Seguimiento del panel: {url.rstrip('/')}/")
    texto = "\n".join(texto).strip() + "\n"
    cuerpo = "".join(
        f"<p>{html.escape(parte).replace(chr(10), '<br>')}</p>" for parte in texto.split("\n\n") if parte.strip()
    )
    return titulo, texto, f"<html><body>{cuerpo}</body></html>"


async def mandar_resumen_diario(config: dict, id_proyecto: int, ahora: datetime) -> str | None:
    """A partir de las 8:00, una vez al día: a cada persona, lo pendiente y
    en curso de lo que se encarga más lo que no tiene a nadie encargado (esto
    último no a los invitados). Campanita y email. Quien no tiene nada no
    recibe nada. Devuelve el resumen, o None si hoy ya se mandó o es pronto."""
    if ahora.time() < HORA_RESUMEN:
        return None
    db = AsyncDatabase(**config)
    reclamado = await db.query(
        f'INSERT INTO "{TABLA_SEGUIMIENTO_RESUMENES.nombre}" (fecha, fecha_envio) VALUES (%s, %s) '
        "ON CONFLICT (fecha) DO NOTHING",
        (ahora.date(), ahora),
    )
    if reclamado != 1:
        return None

    cuenta = await ConfiguracionCRUD(config).obtener_cuenta_email()
    partes = []
    for usuario in await usuarios_del_proyecto(id_proyecto):
        abiertos = await listar_seguimiento(config, id_proyecto, usuario["id"], list(ESTADOS_ABIERTOS))
        mios = [e for e in abiertos if e["id_usuario_responsable"] == usuario["id"]]
        de_todos = [e for e in abiertos if not e["id_usuario_responsable"]]
        if de_todos and not await puede_editar_proyecto(usuario["id"], id_proyecto):
            de_todos = []
        if not mios and not de_todos:
            continue
        titulo, texto, cuerpo_html = _correo_resumen(usuario["nombre"], mios, de_todos)
        estado_email, error_email = "fallido", "el proyecto no tiene cuenta de correo configurada"
        if cuenta:
            try:
                await asyncio.to_thread(mandar_correo, cuenta, usuario["email"], titulo, texto, cuerpo_html)
                estado_email, error_email = "enviado", None
            except Exception as e:  # SMTP, red, credenciales... no debe parar al resto
                error_email = str(e)[:500]
        await db.query(
            f'INSERT INTO "{TABLA_NOTIFICACIONES.nombre}" (id_usuario, origen, titulo, texto, fecha, estado_email, error_email) '
            "VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (usuario["id"], "seguimiento", titulo[:255], texto, ahora, estado_email, error_email),
        )
        vias = "panel y email" if estado_email == "enviado" else f"panel; email falló: {error_email}"
        partes.append(f"{usuario['nombre']}: {len(mios) + len(de_todos)} ({vias})")

    resumen = "; ".join(partes) if partes else "Nadie tenía nada pendiente"
    await db.query(
        f'UPDATE "{TABLA_SEGUIMIENTO_RESUMENES.nombre}" SET resumen = %s WHERE fecha = %s', (resumen, ahora.date()),
    )
    return resumen


async def procesar_seguimiento(config: dict, id_proyecto: int, ahora: datetime | None = None) -> dict:
    """La pasada de cada minuto: lo aplazado que ya venció vuelve a
    pendiente, y a su hora, el resumen diario."""
    ahora = ahora or ahora_madrid()
    vueltos = await volver_a_pendiente(config, ahora)
    return {"vueltos_a_pendiente": vueltos, "resumen": await mandar_resumen_diario(config, id_proyecto, ahora)}
