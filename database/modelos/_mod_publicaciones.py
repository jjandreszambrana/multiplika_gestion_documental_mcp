"""Calendario editorial: publicaciones en redes sociales (fase 5 de webs y
redes) — ver docs/gestion-documental.md → "Webs y redes sociales". Las
redes en sí están en _mod_redes.py.

El freno es el mismo que el de los cambios en webs: nada se publica sin que
una persona lo apruebe, y el nivel de permiso de cada red manda (en
«proponer», solo se aprueba desde el panel; en «lectura», no se publica).
Publicar también se deshace: «retirar» la borra de las redes."""

import json
import mimetypes
import os
import secrets
from datetime import datetime, timedelta

from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_publicaciones import TABLA_MEDIOS, TABLA_PUBLICACIONES
from ._mod_activos_digitales import ActivosDigitalesCRUD, capacidad
from ._mod_redes import RedError, cliente_red, comprobar_publicable
from ._repeticiones import ahora_madrid

DIAS_MEDIOS = 7
_JSON = ("textos_por_red", "ids_documentos", "ids_activos", "resultados", "metricas")


class PublicacionError(Exception):
    pass


def _salida(fila: dict) -> dict:
    return {**fila, **{k: json.loads(fila[k]) if fila.get(k) else ({} if k in ("resultados", "metricas", "textos_por_red") else [])
                       for k in _JSON}}


def _fecha(valor) -> datetime | None:
    if not valor:
        return None
    if isinstance(valor, datetime):
        return valor
    try:
        return datetime.fromisoformat(str(valor).replace("Z", ""))
    except ValueError:
        raise PublicacionError("Fecha no válida: usa AAAA-MM-DD HH:MM (hora de Madrid)")


class PublicacionesCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_PUBLICACIONES, config)
        self.activos = ActivosDigitalesCRUD(config)

    async def obtener_salida(self, id_publicacion: int) -> dict:
        fila = await self.obtener(id_publicacion)
        if not fila:
            raise PublicacionError(f"No existe la publicación {id_publicacion}")
        salida = _salida(fila)
        nombres = {}
        for i in salida["ids_activos"]:
            a = await self.activos.obtener(i)
            nombres[str(i)] = {"nombre": a["nombre"], "plataforma": a["plataforma"]} if a else {"nombre": "(borrada)", "plataforma": None}
        return {**salida, "redes": nombres}

    async def listar(self, desde: str | None = None, hasta: str | None = None, estado: str | None = None,
                     id_activo: int | None = None, limite: int = 300) -> list[dict]:
        condiciones, params = [], []
        if desde:
            condiciones.append("(fecha_prevista >= %s OR fecha_prevista IS NULL)")
            params.append(_fecha(desde))
        if hasta:
            condiciones.append("(fecha_prevista < %s OR fecha_prevista IS NULL)")
            params.append(_fecha(hasta))
        if estado:
            condiciones.append("estado = %s")
            params.append(estado)
        where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""
        filas = await AsyncDatabase(**self.config).query(
            f'SELECT * FROM "{TABLA_PUBLICACIONES.nombre}" {where} ORDER BY fecha_prevista NULLS LAST, id DESC LIMIT %s',
            (*params, max(1, min(limite, 1000))))
        salida = [_salida(f) for f in filas]
        return [p for p in salida if not id_activo or id_activo in p["ids_activos"]]

    async def _validar(self, datos: dict) -> dict:
        limpios = {}
        if "titulo" in datos and datos["titulo"] is not None:
            limpios["titulo"] = datos["titulo"].strip()[:200]
        if "texto" in datos and datos["texto"] is not None:
            if not datos["texto"].strip():
                raise PublicacionError("El texto no puede estar vacío")
            limpios["texto"] = datos["texto"]
        if datos.get("textos_por_red") is not None:
            limpios["textos_por_red"] = json.dumps({str(k): v for k, v in datos["textos_por_red"].items() if v}, ensure_ascii=False)
        if datos.get("ids_activos") is not None:
            if not datos["ids_activos"]:
                raise PublicacionError("Elige al menos una red")
            for i in datos["ids_activos"]:
                a = await self.activos.obtener(int(i))
                if not a or capacidad(a) != "red" or a["archivado"]:
                    raise PublicacionError(f"El activo {i} no es una red social conectable")
            limpios["ids_activos"] = json.dumps([int(i) for i in datos["ids_activos"]])
        if datos.get("ids_documentos") is not None:
            db = AsyncDatabase(**self.config)
            for i in datos["ids_documentos"]:
                v = await db.query("SELECT archivo_original_tipo_mime AS mime FROM gd_versiones WHERE id_documento = %s "
                                   "AND archivo_original IS NOT NULL ORDER BY id DESC LIMIT 1", (int(i),), uno=True)
                if not v or not (v["mime"] or "").startswith(("image/", "video/")):
                    raise PublicacionError(f"El documento {i} no tiene una imagen o vídeo adjunto")
            limpios["ids_documentos"] = json.dumps([int(i) for i in datos["ids_documentos"]])
        if "enlace" in datos:
            limpios["enlace"] = (datos["enlace"] or None) and datos["enlace"].strip()[:1000]
        if "fecha_prevista" in datos:
            limpios["fecha_prevista"] = _fecha(datos["fecha_prevista"])
        return limpios

    async def crear(self, datos: dict, via: str, quien: str, pedir_aprobacion: bool = False) -> dict:
        if not (datos.get("texto") or "").strip() or not datos.get("ids_activos"):
            raise PublicacionError("Hacen falta el texto y al menos una red")
        limpios = await self._validar({**datos, "titulo": datos.get("titulo") or datos["texto"][:60]})
        id_publicacion = await self.insert({**limpios, "estado": "pendiente" if pedir_aprobacion else "borrador",
                                            "creado_por": quien[:150], "via": via})
        return await self.obtener_salida(id_publicacion)

    async def actualizar(self, id_publicacion: int, datos: dict) -> dict:
        actual = await self.obtener_salida(id_publicacion)
        if actual["estado"] not in ("borrador", "pendiente", "aprobada", "error"):
            raise PublicacionError(f"No se puede cambiar una publicación «{actual['estado']}»")
        limpios = await self._validar(datos)
        if actual["estado"] == "aprobada":
            limpios["estado"] = "pendiente"  # lo aprobado era otra cosa: hay que volver a aprobarlo
        if limpios:
            await self.update(id_publicacion, limpios)
        return await self.obtener_salida(id_publicacion)

    async def pedir_aprobacion(self, id_publicacion: int) -> dict:
        actual = await self.obtener_salida(id_publicacion)
        if actual["estado"] != "borrador":
            raise PublicacionError(f"Solo un borrador pasa a «pendiente de aprobar»; esta está «{actual['estado']}»")
        await self.update(id_publicacion, {"estado": "pendiente"})
        return await self.obtener_salida(id_publicacion)

    async def _comprobar_redes(self, p: dict, via: str) -> list[dict]:
        redes = []
        for i in p["ids_activos"]:
            a = await self.activos.obtener_o_error(i)
            if a["archivado"] or a["estado"] == "pausado":
                raise PublicacionError(f"«{a['nombre']}» está archivada o en pausa")
            if a["nivel_permiso"] == "lectura":
                raise PublicacionError(f"«{a['nombre']}» está en solo lectura: un administrador tiene que subir su permiso para publicar")
            if a["nivel_permiso"] == "proponer" and via != "panel":
                raise PublicacionError(f"En «{a['nombre']}» las publicaciones solo se aprueban desde el panel (nivel «proponer»)")
            texto = p["textos_por_red"].get(str(i)) or p["texto"]
            try:
                comprobar_publicable(a["plataforma"], texto, len(p["ids_documentos"]))
            except RedError as e:
                raise PublicacionError(f"«{a['nombre']}»: {e}")
            redes.append(a)
        return redes

    async def aprobar(self, id_publicacion: int, via: str, quien: str) -> dict:
        p = await self.obtener_salida(id_publicacion)
        if p["estado"] not in ("borrador", "pendiente", "error"):
            raise PublicacionError(f"No se puede aprobar una publicación «{p['estado']}»")
        await self._comprobar_redes(p, via)
        await self.update(id_publicacion, {"estado": "aprobada", "aprobado_por": quien[:150], "fecha_aprobacion": datetime.now()})
        return await self.obtener_salida(id_publicacion)

    async def cancelar(self, id_publicacion: int) -> dict:
        p = await self.obtener_salida(id_publicacion)
        if p["estado"] not in ("borrador", "pendiente", "aprobada", "error"):
            raise PublicacionError(f"No se puede cancelar una publicación «{p['estado']}»: si ya salió, retírala")
        await self.update(id_publicacion, {"estado": "cancelada"})
        return await self.obtener_salida(id_publicacion)

    async def _medios(self, id_proyecto: int, p: dict) -> list[str]:
        """Enlaces públicos temporales a las imágenes, para que las redes las descarguen."""
        url_publica = os.environ.get("GD_URL_PUBLICA")
        if p["ids_documentos"] and not url_publica:
            raise PublicacionError("Este servidor no tiene GD_URL_PUBLICA: las redes no pueden descargar las imágenes. Avisa a soporte.")
        db = AsyncDatabase(**self.config)
        urls = []
        for id_documento in p["ids_documentos"]:
            v = await db.query("SELECT id, archivo_original_nombre FROM gd_versiones WHERE id_documento = %s "
                               "AND archivo_original IS NOT NULL ORDER BY id DESC LIMIT 1", (id_documento,), uno=True)
            token = secrets.token_urlsafe(24)
            await db.query(
                f'INSERT INTO "{TABLA_MEDIOS.nombre}" (token, id_publicacion, id_documento, id_version, caduca) VALUES (%s, %s, %s, %s, %s)',
                (token, p["id"], id_documento, v["id"], datetime.now() + timedelta(days=DIAS_MEDIOS)))
            extension = os.path.splitext(v["archivo_original_nombre"] or "")[1] or ".jpg"
            urls.append(f"{url_publica.rstrip('/')}/v1/medio-publico/{id_proyecto}/{token}{extension}")
        return urls

    async def publicar(self, id_proyecto: int, id_publicacion: int, via: str = "automatica", quien: str = "Publicación programada") -> dict:
        """Publica en todas sus redes. Solo una aprobada; la reserva antes para
        que dos pasadas del cron no la publiquen dos veces."""
        db = AsyncDatabase(**self.config)
        reservada = await db.query(f'UPDATE "{TABLA_PUBLICACIONES.nombre}" SET estado = %s WHERE id = %s AND estado = %s',
                                   ("publicando", id_publicacion, "aprobada"))
        if reservada != 1:
            raise PublicacionError("Solo se publica una publicación aprobada (y que no se esté publicando ya)")
        p = await self.obtener_salida(id_publicacion)
        resultados = dict(p["resultados"])
        try:
            redes = await self._comprobar_redes(p, "panel")  # ya aprobada: se vuelve a mirar que sigan disponibles
            medios = await self._medios(id_proyecto, p)
        except Exception as e:  # nunca dejarla «publicando» para siempre
            await self.update(id_publicacion, {"estado": "error", "resultados": json.dumps({"_": {"ok": False, "error": str(e)}})})
            return await self.obtener_salida(id_publicacion)
        for a in redes:
            if resultados.get(str(a["id"]), {}).get("ok"):
                continue  # ya salió en un intento anterior (publicación parcial)
            texto = p["textos_por_red"].get(str(a["id"])) or p["texto"]
            try:
                hecho = await (await cliente_red(self.config, a)).publicar(texto, medios, p["enlace"])
                resultados[str(a["id"])] = {"ok": True, **hecho}
            except Exception as e:  # RedError o algo inesperado: se apunta y se sigue con las demás redes
                resultados[str(a["id"])] = {"ok": False, "error": str(e)}
        bien = [r for r in resultados.values() if r.get("ok")]
        estado = "publicada" if len(bien) == len(redes) else "parcial" if bien else "error"
        await self.update(id_publicacion, {"estado": estado, "resultados": json.dumps(resultados, ensure_ascii=False),
                                           "fecha_publicada": datetime.now() if bien else None})
        return await self.obtener_salida(id_publicacion)

    async def retirar(self, id_publicacion: int, via: str, quien: str) -> dict:
        """Deshacer: la borra de cada red donde salió."""
        p = await self.obtener_salida(id_publicacion)
        if p["estado"] not in ("publicada", "parcial"):
            raise PublicacionError(f"Solo se retira lo publicado; esta está «{p['estado']}»")
        resultados, fallos = dict(p["resultados"]), []
        for clave, r in resultados.items():
            if not r.get("ok"):
                continue
            a = await self.activos.obtener(int(clave))
            if a and a["nivel_permiso"] == "proponer" and via != "panel":
                raise PublicacionError(f"En «{a['nombre']}» solo se puede retirar desde el panel (nivel «proponer»)")
            try:
                await (await cliente_red(self.config, a)).borrar(r)
                resultados[clave] = {**r, "ok": False, "retirada": True}
            except RedError as e:
                fallos.append(f"{a['nombre'] if a else clave}: {e}")
        await self.update(id_publicacion, {"estado": "retirada" if not fallos else p["estado"], "retirado_por": quien[:150],
                                           "resultados": json.dumps(resultados, ensure_ascii=False)})
        salida = await self.obtener_salida(id_publicacion)
        if fallos:
            raise PublicacionError("No se pudo retirar de: " + "; ".join(fallos))
        return salida

    async def actualizar_metricas(self, id_publicacion: int) -> dict:
        p = await self.obtener_salida(id_publicacion)
        metricas = dict(p["metricas"])
        for clave, r in p["resultados"].items():
            if not r.get("ok"):
                continue
            a = await self.activos.obtener(int(clave))
            try:
                metricas[clave] = await (await cliente_red(self.config, a)).metricas(r)
            except RedError as e:
                metricas[clave] = {"error": str(e)}
        await self.update(id_publicacion, {"metricas": json.dumps(metricas), "fecha_metricas": datetime.now()})
        return await self.obtener_salida(id_publicacion)

    async def comentarios(self, id_publicacion: int, id_activo: int) -> list[dict]:
        p = await self.obtener_salida(id_publicacion)
        r = p["resultados"].get(str(id_activo))
        if not r or not r.get("ok"):
            raise PublicacionError("Esa publicación no está publicada en esa red")
        try:
            return await (await cliente_red(self.config, await self.activos.obtener_o_error(id_activo))).comentarios(r)
        except RedError as e:
            raise PublicacionError(str(e))


async def medio_publico(config: dict, token: str) -> tuple[bytes, str, str] | None:
    """(contenido, tipo, nombre) de la imagen de un enlace público vigente."""
    db = AsyncDatabase(**config)
    m = await db.query(f'SELECT * FROM "{TABLA_MEDIOS.nombre}" WHERE token = %s AND caduca > %s', (token, datetime.now()), uno=True)
    if not m:
        return None
    v = await db.query("SELECT archivo_original, archivo_original_tipo_mime, archivo_original_nombre FROM gd_versiones WHERE id = %s",
                       (m["id_version"],), uno=True)
    if not v or not v["archivo_original"]:
        return None
    tipo = v["archivo_original_tipo_mime"] or mimetypes.guess_type(v["archivo_original_nombre"] or "")[0] or "application/octet-stream"
    return bytes(v["archivo_original"]), tipo, v["archivo_original_nombre"]


async def procesar_publicaciones(config: dict, id_proyecto: int, ahora: datetime | None = None) -> dict:
    """La pasada del cron de cada minuto: publica lo aprobado cuya hora llegó
    y refresca las métricas de lo publicado en los últimos 30 días (unas
    pocas por pasada, una vez al día cada una). Borra enlaces caducados."""
    ahora = ahora or ahora_madrid()
    db = AsyncDatabase(**config)
    if not (await db.query("SELECT to_regclass('gd_publicaciones') IS NOT NULL AS hay", uno=True))["hay"]:
        return {"publicadas": 0, "metricas": 0}
    crud = PublicacionesCRUD(config)
    pendientes = await db.query(
        f"SELECT id FROM \"{TABLA_PUBLICACIONES.nombre}\" WHERE estado = 'aprobada' AND (fecha_prevista IS NULL OR fecha_prevista <= %s)",
        (ahora,))
    publicadas = 0
    for p in pendientes:
        try:
            await crud.publicar(id_proyecto, p["id"])
            publicadas += 1
        except PublicacionError:
            pass  # la ha cogido otra pasada
    viejas = await db.query(
        f"SELECT id FROM \"{TABLA_PUBLICACIONES.nombre}\" WHERE estado IN ('publicada', 'parcial') AND fecha_publicada >= %s "
        "AND (fecha_metricas IS NULL OR fecha_metricas < %s) ORDER BY fecha_metricas NULLS FIRST LIMIT 5",
        (ahora - timedelta(days=30), datetime.now() - timedelta(days=1)))
    for p in viejas:
        await crud.actualizar_metricas(p["id"])
    await db.query(f'DELETE FROM "{TABLA_MEDIOS.nombre}" WHERE caduca < %s', (datetime.now(),))
    return {"publicadas": publicadas, "metricas": len(viejas)}
