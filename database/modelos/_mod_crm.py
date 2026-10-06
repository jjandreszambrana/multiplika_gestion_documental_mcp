"""CRM: contactos, etapas del embudo y oportunidades de venta — ver
docs/gestion-documental.md → "Ventas (CRM)". Lo usan las tools MCP, el
panel y el resumen diario de seguimiento, para que los tres compartan las
mismas reglas.

Lanza ValueError / LookupError con mensajes que se pueden enseñar tal cual.

Al cambiar, solo se toca lo que viene en `datos`: una clave con None
vacía el campo; una clave que no viene no cambia."""

from datetime import date
from decimal import Decimal, InvalidOperation

from mtpk_postgres.async_adapter import AsyncDatabase

from lib.roles_proyecto import puede_editar_proyecto

from ..dependencias._dep_bloc_notas import NOMBRE_TABLA_BLOC_NOTAS, NOMBRE_TABLA_BLOC_NOTAS_ENTIDADES
from ..dependencias._dep_crm import (
    ETAPAS_POR_DEFECTO,
    NOMBRE_TABLA_CONTACTOS as _T_CONTACTOS,
    NOMBRE_TABLA_ETAPAS as _T_ETAPAS,
    NOMBRE_TABLA_OPORTUNIDADES as _T_OP,
    NOMBRE_TABLA_OPORTUNIDADES_CAMBIOS as _T_CAMBIOS,
    NOMBRE_TABLA_OPORTUNIDADES_DOCUMENTOS as _T_OP_DOCS,
    TIPOS_ETAPA,
)
from ..dependencias._dep_documentos import NOMBRE_TABLA_DOCUMENTOS
from ..dependencias._dep_entidades import NOMBRE_TABLA_DOCUMENTOS_ENTIDADES, NOMBRE_TABLA_ENTIDADES
from ..dependencias._dep_envios import NOMBRE_TABLA_ENVIOS
from ._mod_bloc_notas import _visible
from ._mod_programaciones import usuarios_del_proyecto
from ._repeticiones import ahora_madrid

ESTADOS_OPORTUNIDAD = ("abiertas", "ganadas", "perdidas", "todas")
_TIPO_POR_ESTADO = {"abiertas": "abierta", "ganadas": "ganada", "perdidas": "perdida"}


def _db(config: dict) -> AsyncDatabase:
    return AsyncDatabase(**config)


def _texto(valor, campo: str, obligatorio: bool = False, maximo: int = 255) -> str | None:
    texto = " ".join(str(valor).split()) if valor is not None else ""
    if not texto:
        if obligatorio:
            raise ValueError(f"Falta {campo}")
        return None
    if len(texto) > maximo:
        raise ValueError(f"{campo[0].upper()}{campo[1:]} es demasiado largo (máximo {maximo} caracteres)")
    return texto


def _fecha(valor, campo: str) -> date | None:
    if valor in (None, ""):
        return None
    if isinstance(valor, date):
        return valor
    try:
        return date.fromisoformat(str(valor).strip()[:10])
    except ValueError as e:
        raise ValueError(f"Fecha no válida en {campo}: '{valor}' (usa AAAA-MM-DD)") from e


def _importe(valor) -> Decimal | None:
    if valor in (None, ""):
        return None
    try:
        importe = Decimal(str(valor).replace(" ", "").replace("€", ""))
    except InvalidOperation as e:
        raise ValueError(f"Importe no válido: '{valor}'") from e
    if importe < 0:
        raise ValueError("El importe no puede ser negativo")
    return importe.quantize(Decimal("0.01"))


async def _existe_entidad(db: AsyncDatabase, id_entidad: int) -> dict:
    filas = await db.query(f'SELECT id, nombre FROM "{NOMBRE_TABLA_ENTIDADES}" WHERE id = %s', (id_entidad,))
    if not filas:
        raise LookupError(f"No existe ninguna entidad con id {id_entidad}")
    return filas[0]


async def _insertar(db: AsyncDatabase, tabla: str, valores: dict) -> int:
    columnas = ", ".join(valores)
    await db.query(
        f'INSERT INTO "{tabla}" ({columnas}) VALUES ({", ".join(["%s"] * len(valores))}) RETURNING id',
        tuple(valores.values()),
    )
    return db.ultimo_insert_id


async def _actualizar(db: AsyncDatabase, tabla: str, id_fila: int, valores: dict) -> None:
    if valores:
        asignaciones = ", ".join(f"{k} = %s" for k in valores)
        await db.query(f'UPDATE "{tabla}" SET {asignaciones} WHERE id = %s', (*valores.values(), id_fila))


# ---------- Contactos ----------

_CAMPOS_CONTACTO = {"nombre": 255, "cargo": 150, "email": 255, "telefono": 50, "observaciones": 10000}


def _limpiar_contacto(datos: dict, al_crear: bool) -> dict:
    limpios = {}
    for campo, maximo in _CAMPOS_CONTACTO.items():
        if campo in datos:
            limpios[campo] = _texto(datos[campo], f"el {campo}" if campo != "nombre" else "el nombre", campo == "nombre", maximo)
    if al_crear and not limpios.get("nombre"):
        raise ValueError("Falta el nombre del contacto")
    if "principal" in datos:
        limpios["principal"] = bool(datos["principal"])
    return limpios


async def listar_contactos(config: dict, id_entidad: int) -> list[dict]:
    db = _db(config)
    await _existe_entidad(db, id_entidad)
    return await db.query(
        f'SELECT * FROM "{_T_CONTACTOS}" WHERE id_entidad = %s ORDER BY principal DESC, nombre ASC', (id_entidad,)
    )


async def obtener_contacto(config: dict, id_contacto: int) -> dict:
    filas = await _db(config).query(f'SELECT * FROM "{_T_CONTACTOS}" WHERE id = %s', (id_contacto,))
    if not filas:
        raise LookupError(f"No existe ningún contacto con id {id_contacto}")
    return filas[0]


async def _quitar_otro_principal(db: AsyncDatabase, id_entidad: int, id_contacto: int) -> None:
    await db.query(
        f'UPDATE "{_T_CONTACTOS}" SET principal = false WHERE id_entidad = %s AND id <> %s', (id_entidad, id_contacto),
    )


async def crear_contacto(config: dict, id_entidad: int, datos: dict) -> dict:
    db = _db(config)
    await _existe_entidad(db, id_entidad)
    valores = _limpiar_contacto(datos, al_crear=True)
    id_contacto = await _insertar(db, _T_CONTACTOS, {"id_entidad": id_entidad, **valores})
    if valores.get("principal"):
        await _quitar_otro_principal(db, id_entidad, id_contacto)
    return await obtener_contacto(config, id_contacto)


async def actualizar_contacto(config: dict, id_contacto: int, datos: dict) -> dict:
    contacto = await obtener_contacto(config, id_contacto)
    db = _db(config)
    valores = _limpiar_contacto(datos, al_crear=False)
    if "nombre" in valores and not valores["nombre"]:
        raise ValueError("El nombre del contacto no puede quedar vacío")
    await _actualizar(db, _T_CONTACTOS, id_contacto, valores)
    if valores.get("principal"):
        await _quitar_otro_principal(db, contacto["id_entidad"], id_contacto)
    return await obtener_contacto(config, id_contacto)


async def eliminar_contacto(config: dict, id_contacto: int) -> None:
    await obtener_contacto(config, id_contacto)
    await _db(config).query(f'DELETE FROM "{_T_CONTACTOS}" WHERE id = %s', (id_contacto,))


# ---------- Etapas ----------

async def listar_etapas(config: dict) -> list[dict]:
    """Las etapas en orden, con cuántas oportunidades tiene cada una."""
    return await _db(config).query(
        f'SELECT e.*, (SELECT COUNT(*) FROM "{_T_OP}" o WHERE o.id_etapa = e.id) AS oportunidades '
        f'FROM "{_T_ETAPAS}" e ORDER BY e.orden, e.id'
    )


async def sembrar_etapas(config: dict) -> bool:
    """Las de por defecto, solo si no hay ninguna (un cliente que ya las
    cambió no debe verlas reaparecer)."""
    db = _db(config)
    if await db.query(f'SELECT 1 FROM "{_T_ETAPAS}" LIMIT 1'):
        return False
    for orden, (nombre, probabilidad, tipo) in enumerate(ETAPAS_POR_DEFECTO):
        await _insertar(db, _T_ETAPAS, {"nombre": nombre, "orden": orden, "probabilidad": probabilidad, "tipo": tipo})
    return True


async def guardar_etapas(config: dict, etapas: list[dict]) -> list[dict]:
    """Deja el embudo exactamente así, en este orden: las que traen `id` se
    cambian, las que no se crean y las que faltan se borran (solo si no
    tienen oportunidades). Tiene que quedar al menos una de cada tipo."""
    limpias, nombres = [], set()
    for etapa in etapas:
        nombre = _texto(etapa.get("nombre"), "el nombre de la etapa", True, 100)
        if nombre.lower() in nombres:
            raise ValueError(f"La etapa «{nombre}» está repetida")
        nombres.add(nombre.lower())
        tipo = etapa.get("tipo") or "abierta"
        if tipo not in TIPOS_ETAPA:
            raise ValueError(f"Tipo de etapa no válido: '{tipo}' (abierta, ganada o perdida)")
        try:
            probabilidad = int(etapa.get("probabilidad", 0) or 0)
        except (TypeError, ValueError) as e:
            raise ValueError(f"Probabilidad no válida en «{nombre}»") from e
        if not 0 <= probabilidad <= 100:
            raise ValueError(f"La probabilidad de «{nombre}» tiene que ir de 0 a 100")
        limpias.append({"id": etapa.get("id"), "nombre": nombre, "probabilidad": probabilidad, "tipo": tipo})
    for tipo in TIPOS_ETAPA:
        if not any(e["tipo"] == tipo for e in limpias):
            raise ValueError(f"Hace falta al menos una etapa de tipo «{tipo}»")

    db = _db(config)
    actuales = {e["id"]: e for e in await listar_etapas(config)}
    for etapa in limpias:
        if etapa["id"] is not None and etapa["id"] not in actuales:
            raise LookupError(f"No existe ninguna etapa con id {etapa['id']}")
    quedan = {e["id"] for e in limpias if e["id"] is not None}
    for id_etapa, etapa in actuales.items():
        if id_etapa not in quedan and etapa["oportunidades"]:
            raise ValueError(
                f"No se puede quitar la etapa «{etapa['nombre']}»: tiene {etapa['oportunidades']} oportunidad(es). "
                "Muévelas antes a otra etapa"
            )
    async with db.transaccion() as cx:
        for id_etapa in set(actuales) - quedan:
            await db.query(f'DELETE FROM "{_T_ETAPAS}" WHERE id = %s', (id_etapa,), conexion=cx)
        for orden, etapa in enumerate(limpias):
            valores = {"nombre": etapa["nombre"], "orden": orden, "probabilidad": etapa["probabilidad"], "tipo": etapa["tipo"]}
            if etapa["id"] is None:
                await db.query(
                    f'INSERT INTO "{_T_ETAPAS}" (nombre, orden, probabilidad, tipo) VALUES (%s, %s, %s, %s)',
                    tuple(valores.values()), conexion=cx,
                )
            else:
                await db.query(
                    f'UPDATE "{_T_ETAPAS}" SET nombre = %s, orden = %s, probabilidad = %s, tipo = %s WHERE id = %s',
                    (*valores.values(), etapa["id"]), conexion=cx,
                )
    return await listar_etapas(config)


async def _etapa(db: AsyncDatabase, id_etapa: int) -> dict:
    filas = await db.query(f'SELECT * FROM "{_T_ETAPAS}" WHERE id = %s', (id_etapa,))
    if not filas:
        raise LookupError(f"No existe ninguna etapa con id {id_etapa}")
    return filas[0]


async def _primera_etapa_abierta(db: AsyncDatabase) -> dict:
    filas = await db.query(f"""SELECT * FROM "{_T_ETAPAS}" WHERE tipo = 'abierta' ORDER BY orden, id LIMIT 1""")
    if not filas:
        raise ValueError("El embudo no tiene ninguna etapa abierta: configura las etapas antes")
    return filas[0]


# ---------- Oportunidades ----------

_SELECT_OP = f"""
    SELECT o.*, e.nombre AS entidad, c.nombre AS contacto,
           et.nombre AS etapa, et.tipo AS tipo_etapa, et.probabilidad, et.orden AS orden_etapa
    FROM "{_T_OP}" o
    JOIN "{NOMBRE_TABLA_ENTIDADES}" e ON e.id = o.id_entidad
    JOIN "{_T_ETAPAS}" et ON et.id = o.id_etapa
    LEFT JOIN "{_T_CONTACTOS}" c ON c.id = o.id_contacto
"""


async def _nombres(id_proyecto: int) -> dict[int, str]:
    return {u["id"]: u["nombre"] for u in await usuarios_del_proyecto(id_proyecto)}


def _presentar(fila: dict, nombres: dict[int, str]) -> dict:
    id_responsable = fila["id_usuario_responsable"]
    importe = fila["importe"]
    return {
        **fila,
        "importe": float(importe) if importe is not None else None,
        "importe_ponderado": round(float(importe) * fila["probabilidad"] / 100, 2) if importe is not None else None,
        "responsable": nombres.get(id_responsable, f"Usuario n.º {id_responsable} (sin acceso)") if id_responsable else None,
    }


async def _comprobar_responsable(id_proyecto: int, id_responsable: int) -> None:
    if id_responsable not in await _nombres(id_proyecto):
        raise ValueError(f"El usuario n.º {id_responsable} no es de este proyecto")
    if not await puede_editar_proyecto(id_responsable, id_proyecto):
        raise ValueError("Esa persona es invitada (solo lectura): no puede llevar oportunidades")


async def _comprobar_contacto(db: AsyncDatabase, id_contacto: int, id_entidad: int) -> None:
    filas = await db.query(f'SELECT id_entidad FROM "{_T_CONTACTOS}" WHERE id = %s', (id_contacto,))
    if not filas:
        raise LookupError(f"No existe ningún contacto con id {id_contacto}")
    if filas[0]["id_entidad"] != id_entidad:
        raise ValueError("Ese contacto es de otra entidad")


async def _limpiar_oportunidad(db: AsyncDatabase, id_proyecto: int, datos: dict) -> dict:
    limpios = {}
    if "titulo" in datos:
        limpios["titulo"] = _texto(datos["titulo"], "el título", True)
    for campo, nombre, maximo in (
        ("origen", "el origen", 100), ("proximo_paso", "el próximo paso", 255),
        ("motivo_perdida", "el motivo", 255), ("codigo_erp", "el código del ERP", 100),
    ):
        if campo in datos:
            limpios[campo] = _texto(datos[campo], nombre, maximo=maximo)
    if "descripcion" in datos:
        limpios["descripcion"] = (datos["descripcion"] or "").strip() or None
    if "importe" in datos:
        limpios["importe"] = _importe(datos["importe"])
    for campo, nombre in (("fecha_prevista_cierre", "la fecha prevista de cierre"),
                          ("fecha_proximo_paso", "la fecha del próximo paso"), ("fecha_cierre", "la fecha de cierre")):
        if campo in datos:
            limpios[campo] = _fecha(datos[campo], nombre)
    if "id_entidad" in datos:
        if not datos["id_entidad"]:
            raise ValueError("Una oportunidad tiene que ser de una entidad")
        await _existe_entidad(db, int(datos["id_entidad"]))
        limpios["id_entidad"] = int(datos["id_entidad"])
    if "id_etapa" in datos and datos["id_etapa"]:
        limpios["id_etapa"] = (await _etapa(db, int(datos["id_etapa"])))["id"]
    if "id_usuario_responsable" in datos:
        id_responsable = datos["id_usuario_responsable"] or None
        if id_responsable:
            await _comprobar_responsable(id_proyecto, int(id_responsable))
        limpios["id_usuario_responsable"] = int(id_responsable) if id_responsable else None
    if "id_contacto" in datos:
        limpios["id_contacto"] = int(datos["id_contacto"]) if datos["id_contacto"] else None
    return limpios


async def obtener_oportunidad(config: dict, id_proyecto: int, id_oportunidad: int) -> dict:
    db = _db(config)
    filas = await db.query(f"{_SELECT_OP} WHERE o.id = %s", (id_oportunidad,))
    if not filas:
        raise LookupError(f"No existe ninguna oportunidad con id {id_oportunidad}")
    oportunidad = _presentar(filas[0], await _nombres(id_proyecto))
    oportunidad["documentos"] = await db.query(
        f'SELECT d.id, d.nombre, d.tipo_documento, d.archivado, od.fecha_asignacion FROM "{NOMBRE_TABLA_DOCUMENTOS}" d '
        f'JOIN "{_T_OP_DOCS}" od ON od.id_documento = d.id WHERE od.id_oportunidad = %s ORDER BY od.fecha_asignacion DESC',
        (id_oportunidad,),
    )
    oportunidad["cambios"] = await db.query(
        f'SELECT nombre_etapa, fecha, quien FROM "{_T_CAMBIOS}" WHERE id_oportunidad = %s ORDER BY fecha DESC, id DESC',
        (id_oportunidad,),
    )
    return oportunidad


async def listar_oportunidades(
    config: dict, id_proyecto: int, estado: str = "abiertas", id_entidad: int | None = None,
    id_etapa: int | None = None, id_responsable: int | None = None, sin_responsable: bool = False,
    texto: str | None = None, cierre_desde=None, cierre_hasta=None, limite: int = 500,
) -> list[dict]:
    """Por defecto, las abiertas. Ordenadas por etapa y, dentro, por fecha
    prevista de cierre (las que no tienen, al final)."""
    if estado not in ESTADOS_OPORTUNIDAD:
        raise ValueError(f"Estado no válido: '{estado}' (abiertas, ganadas, perdidas o todas)")
    condiciones, params = [], []
    if estado != "todas":
        condiciones.append("et.tipo = %s")
        params.append(_TIPO_POR_ESTADO[estado])
    for columna, valor in (("o.id_entidad", id_entidad), ("o.id_etapa", id_etapa), ("o.id_usuario_responsable", id_responsable)):
        if valor:
            condiciones.append(f"{columna} = %s")
            params.append(valor)
    if sin_responsable:
        condiciones.append("o.id_usuario_responsable IS NULL")
    if texto:
        condiciones.append("(o.titulo ILIKE %s OR e.nombre ILIKE %s OR o.descripcion ILIKE %s)")
        params += [f"%{texto.strip()}%"] * 3
    if cierre_desde:
        condiciones.append("o.fecha_prevista_cierre >= %s")
        params.append(_fecha(cierre_desde, "cierre_desde"))
    if cierre_hasta:
        condiciones.append("o.fecha_prevista_cierre <= %s")
        params.append(_fecha(cierre_hasta, "cierre_hasta"))
    donde = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""
    filas = await _db(config).query(
        f"{_SELECT_OP} {donde} ORDER BY et.orden, o.fecha_prevista_cierre NULLS LAST, o.id DESC LIMIT %s",
        (*params, max(1, min(int(limite), 2000))),
    )
    nombres = await _nombres(id_proyecto)
    return [_presentar(f, nombres) for f in filas]


def _al_cambiar_de_etapa(etapa: dict, actual: dict | None, valores: dict) -> None:
    """Cerrar pone la fecha de cierre (hoy si no viene); reabrir la quita
    junto con el motivo de pérdida."""
    if etapa["tipo"] == "abierta":
        valores["fecha_cierre"] = None
        valores["motivo_perdida"] = None
    elif not valores.get("fecha_cierre") and not (actual and actual["tipo_etapa"] == etapa["tipo"] and actual["fecha_cierre"]):
        valores["fecha_cierre"] = ahora_madrid().date()
    if etapa["tipo"] == "ganada":
        valores["motivo_perdida"] = None


async def crear_oportunidad(config: dict, id_proyecto: int, quien: str, datos: dict) -> dict:
    db = _db(config)
    valores = await _limpiar_oportunidad(db, id_proyecto, datos)
    if not valores.get("titulo"):
        raise ValueError("Falta el título de la oportunidad")
    if not valores.get("id_entidad"):
        raise ValueError("Falta la entidad (el cliente o posible cliente)")
    if valores.get("id_contacto"):
        await _comprobar_contacto(db, valores["id_contacto"], valores["id_entidad"])
    etapa = await _etapa(db, valores["id_etapa"]) if valores.get("id_etapa") else await _primera_etapa_abierta(db)
    valores["id_etapa"] = etapa["id"]
    _al_cambiar_de_etapa(etapa, None, valores)
    ahora = ahora_madrid()
    id_oportunidad = await _insertar(db, _T_OP, {
        **valores, "creado_por": quien[:255], "fecha_alta": ahora, "fecha_cambio": ahora,
    })
    await _insertar(db, _T_CAMBIOS, {
        "id_oportunidad": id_oportunidad, "id_etapa_anterior": None, "id_etapa": etapa["id"],
        "nombre_etapa": etapa["nombre"], "fecha": ahora, "quien": quien[:255],
    })
    return await obtener_oportunidad(config, id_proyecto, id_oportunidad)


async def actualizar_oportunidad(config: dict, id_proyecto: int, quien: str, id_oportunidad: int, datos: dict) -> dict:
    db = _db(config)
    actual = await obtener_oportunidad(config, id_proyecto, id_oportunidad)
    valores = await _limpiar_oportunidad(db, id_proyecto, datos)
    if "titulo" in valores and not valores["titulo"]:
        raise ValueError("El título no puede quedar vacío")
    id_entidad = valores.get("id_entidad", actual["id_entidad"])
    if id_entidad != actual["id_entidad"] and "id_contacto" not in valores:
        valores["id_contacto"] = None  # el contacto era de la otra entidad
    if valores.get("id_contacto"):
        await _comprobar_contacto(db, valores["id_contacto"], id_entidad)
    etapa = None
    if valores.get("id_etapa") and valores["id_etapa"] != actual["id_etapa"]:
        etapa = await _etapa(db, valores["id_etapa"])
        _al_cambiar_de_etapa(etapa, actual, valores)
    ahora = ahora_madrid()
    await _actualizar(db, _T_OP, id_oportunidad, {**valores, "fecha_cambio": ahora})
    if etapa:
        await _insertar(db, _T_CAMBIOS, {
            "id_oportunidad": id_oportunidad, "id_etapa_anterior": actual["id_etapa"], "id_etapa": etapa["id"],
            "nombre_etapa": etapa["nombre"], "fecha": ahora, "quien": quien[:255],
        })
    return await obtener_oportunidad(config, id_proyecto, id_oportunidad)


async def eliminar_oportunidad(config: dict, id_proyecto: int, id_oportunidad: int) -> None:
    await obtener_oportunidad(config, id_proyecto, id_oportunidad)
    await _db(config).query(f'DELETE FROM "{_T_OP}" WHERE id = %s', (id_oportunidad,))


async def relacionar_documento(config: dict, id_proyecto: int, id_oportunidad: int, id_documento: int) -> None:
    await obtener_oportunidad(config, id_proyecto, id_oportunidad)
    db = _db(config)
    if not await db.query(f'SELECT 1 FROM "{NOMBRE_TABLA_DOCUMENTOS}" WHERE id = %s', (id_documento,)):
        raise LookupError(f"No existe ningún documento con id {id_documento}")
    await db.query(
        f'INSERT INTO "{_T_OP_DOCS}" (id_oportunidad, id_documento) VALUES (%s, %s) '
        "ON CONFLICT (id_oportunidad, id_documento) DO NOTHING",
        (id_oportunidad, id_documento),
    )


async def quitar_documento(config: dict, id_oportunidad: int, id_documento: int) -> bool:
    return bool(await _db(config).query(
        f'DELETE FROM "{_T_OP_DOCS}" WHERE id_oportunidad = %s AND id_documento = %s', (id_oportunidad, id_documento),
    ))


async def resumen_embudo(config: dict, id_proyecto: int, id_responsable: int | None = None) -> list[dict]:
    """Por etapa: cuántas abiertas, importe y ponderado. Para el tablero y
    para "¿cuánto tenemos en el embudo?"."""
    resumen = []
    oportunidades = await listar_oportunidades(config, id_proyecto, "todas", id_responsable=id_responsable, limite=2000)
    for etapa in await listar_etapas(config):
        de_etapa = [o for o in oportunidades if o["id_etapa"] == etapa["id"]]
        resumen.append({
            "id_etapa": etapa["id"], "etapa": etapa["nombre"], "tipo": etapa["tipo"], "probabilidad": etapa["probabilidad"],
            "oportunidades": len(de_etapa),
            "importe": round(sum(o["importe"] or 0 for o in de_etapa), 2),
            "importe_ponderado": round(sum(o["importe_ponderado"] or 0 for o in de_etapa), 2),
        })
    return resumen


# ---------- Ficha de la entidad: línea de tiempo ----------

async def historial_entidad(
    config: dict, id_proyecto: int, id_usuario: int | None, id_entidad: int, limite: int = 100,
) -> list[dict]:
    """Todo lo de una entidad por fecha, lo último arriba: documentos
    relacionados, notas del bloc que ve quien pregunta, envíos,
    oportunidades y sus cambios de etapa, y contactos dados de alta."""
    db = _db(config)
    await _existe_entidad(db, id_entidad)
    condicion, params_visible = _visible("n", id_usuario)
    filas = await db.query(
        f"""
        SELECT * FROM (
            SELECT 'documento' AS tipo, d.id, de.fecha_asignacion AS fecha, d.nombre AS titulo,
                   d.tipo_documento AS detalle
            FROM "{NOMBRE_TABLA_DOCUMENTOS_ENTIDADES}" de JOIN "{NOMBRE_TABLA_DOCUMENTOS}" d ON d.id = de.id_documento
            WHERE de.id_entidad = %s
            UNION ALL
            SELECT 'nota_bloc', n.id, n.fecha, n.titulo, n.descripcion
            FROM "{NOMBRE_TABLA_BLOC_NOTAS_ENTIDADES}" ne JOIN "{NOMBRE_TABLA_BLOC_NOTAS}" n ON n.id = ne.id_nota
            WHERE ne.id_entidad = %s AND {condicion}
            UNION ALL
            SELECT 'envio', v.id, COALESCE(v.fecha_envio, v.fecha_programada, v.fecha_creacion), v.asunto, v.estado
            FROM "{NOMBRE_TABLA_ENVIOS}" v WHERE v.id_entidad = %s
            UNION ALL
            SELECT CASE WHEN c.id_etapa_anterior IS NULL THEN 'oportunidad' ELSE 'cambio_etapa' END,
                   o.id, c.fecha, o.titulo, c.nombre_etapa || ' · ' || c.quien
            FROM "{_T_CAMBIOS}" c JOIN "{_T_OP}" o ON o.id = c.id_oportunidad
            WHERE o.id_entidad = %s
            UNION ALL
            SELECT 'contacto', k.id, k.fecha_alta, k.nombre, k.cargo
            FROM "{_T_CONTACTOS}" k WHERE k.id_entidad = %s
        ) x
        ORDER BY fecha DESC NULLS LAST
        LIMIT %s
        """,
        (id_entidad, id_entidad, *params_visible, id_entidad, id_entidad, id_entidad, max(1, min(int(limite), 500))),
    )
    return filas


# ---------- Resumen diario ----------

async def ventas_para_resumen(config: dict, id_proyecto: int, id_usuario: int, hoy: date, incluir_de_nadie: bool) -> list[dict]:
    """Oportunidades abiertas de `id_usuario` (y, si se pide, las de nadie)
    que piden atención hoy: el próximo paso es para hoy o se pasó, o no
    tienen próximo paso."""
    abiertas = await listar_oportunidades(config, id_proyecto, "abiertas", limite=2000)
    salida = []
    for o in abiertas:
        responsable = o["id_usuario_responsable"]
        if responsable != id_usuario and not (incluir_de_nadie and responsable is None):
            continue
        if not o["proximo_paso"] and not o["fecha_proximo_paso"]:
            motivo = "sin próximo paso"
        elif o["fecha_proximo_paso"] and o["fecha_proximo_paso"] <= hoy:
            cuando = "hoy" if o["fecha_proximo_paso"] == hoy else f"desde el {o['fecha_proximo_paso']:%d/%m}"
            motivo = f"{o['proximo_paso'] or 'próximo paso'} ({cuando})"
        else:
            continue
        salida.append({"titulo": f"{o['titulo']} — {o['entidad']}", "motivo": motivo, "de_nadie": responsable is None})
    return salida
