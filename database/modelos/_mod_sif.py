"""Conexión con Multiplika SIF (el programa de facturación de Multiplika) —
ver docs/gestion-documental.md → "CRM" y docs/planificacion/crm.md.

Se entra con usuario y contraseña de un obligado (la empresa que factura):
una sesión abierta con api_key solo llega a las rutas de la pasarela
Veri*Factu (apps/middleware/pasarela_middleware.py en multiplika_sif), y
aquí hacen falta clientes y cobros. La sesión es una cookie (access_token)
que SIF renueva en cualquier respuesta: httpx la guarda sola. Un 401 =
volver a entrar y repetir una vez.

Solo lee. Qué se trae:
- Clientes: /obligados/receptores/listar → gd_entidades (por código, NIF o nombre).
- Facturas: /facturas_emitidas/listar, de la más nueva hacia atrás hasta la
  fecha de corte (la API no filtra por fecha) → gd_erp_facturas. El listado
  no trae la base imponible: queda vacía y el resumen usa el total.
- Pendiente de cobro: /ventas/gestion_cobros/recibos/listar (pendientes),
  sumado por factura.

Lanza ValueError / LookupError con mensajes que se pueden enseñar tal cual."""

from datetime import timedelta

import httpx
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_erp import NOMBRE_TABLA_CONEXIONES as _T_CON, NOMBRE_TABLA_FACTURAS as _T_FAC
from lib.roles_proyecto import puede_editar_proyecto

from ..dependencias._dep_programaciones import NOMBRE_TABLA_NOTIFICACIONES
from ._mod_credenciales import CredencialesCRUD
from ._mod_erp import guardar_cliente, guardar_factura, leer_fecha, leer_importe
from ._mod_programaciones import usuarios_del_proyecto
from ._repeticiones import ahora_madrid

URL_POR_DEFECTO = "https://sif2.multiplika.net"
POR_PAGINA = 1000
MAX_REGISTROS = 200000
DIAS_PRIMERA_VEZ = 730
DIAS_CADA_NOCHE = 90
TIEMPO_ESPERA = 60
# Repasar toda la bandeja contra el diario tarda más que una consulta normal
TIEMPO_ESPERA_LARGO = 280  # por debajo de los 300 s de Apache
RUTAS_LARGAS = ("/bandeja/recomprobar", "/bandeja/leer_erp")


class ErrorSIF(ValueError):
    pass


class ClienteSIF:
    """Una sesión con SIF. Usar con `async with`."""

    def __init__(self, url: str, usuario: str, contrasena: str, id_obligado: int | None = None):
        self.url = url.rstrip("/")
        self.usuario, self.contrasena, self.id_obligado = usuario, contrasena, id_obligado
        self.http = httpx.AsyncClient(base_url=f"{self.url}/apisif/v1", timeout=TIEMPO_ESPERA)

    async def __aenter__(self):
        await self.entrar()
        return self

    async def __aexit__(self, *_):
        await self.http.aclose()

    async def entrar(self) -> None:
        try:
            r = await self.http.post("/usuarios/login", json={"username": self.usuario, "password": self.contrasena})
        except httpx.HTTPError as e:
            raise ErrorSIF(f"No se puede llegar a SIF en {self.url}: {e}") from e
        if r.status_code in (401, 403, 422):
            raise ErrorSIF("SIF no acepta el usuario o la contraseña: revísalos en Credenciales")
        if r.status_code >= 400:
            raise ErrorSIF(f"SIF respondió {r.status_code} al entrar: {r.text[:200]}")

    async def crudo(self, metodo: str, ruta: str, **kwargs) -> httpx.Response:
        """La respuesta tal cual (también un error o una descarga), volviendo
        a entrar una vez si la sesión caducó. `kwargs` va a httpx (json,
        content, headers...)."""
        for intento in range(2):
            try:
                if ruta.endswith(RUTAS_LARGAS):
                    kwargs.setdefault("timeout", TIEMPO_ESPERA_LARGO)
                r = await self.http.request(metodo, ruta, **kwargs)
            except httpx.HTTPError as e:
                raise ErrorSIF(f"Fallo de conexión con SIF ({ruta}): {e}") from e
            if r.status_code == 401 and intento == 0:
                await self.entrar()  # la sesión caducó (una semana sin uso)
                continue
            return r
        raise ErrorSIF("SIF no acepta la sesión")

    async def _peticion(self, metodo: str, ruta: str, cuerpo: dict | None = None) -> dict:
        r = await self.crudo(metodo, ruta, json=cuerpo)
        if r.status_code == 401:
            raise ErrorSIF("SIF no acepta la sesión")
        if r.status_code >= 400:
            raise ErrorSIF(f"SIF respondió {r.status_code} en {ruta}: {r.text[:300]}")
        return r.json()

    async def pedir(self, ruta: str, cuerpo: dict | None = None) -> dict:
        return await self._peticion("POST", ruta, cuerpo or {})

    async def yo(self) -> dict:
        datos = await self._peticion("GET", "/usuarios/me")
        return datos.get("usuario", datos) if isinstance(datos, dict) else {}

    async def _paginas(self, ruta: str, cuerpo: dict):
        """Registro a registro, pidiendo de POR_PAGINA en POR_PAGINA."""
        offset = 0
        while offset < MAX_REGISTROS:
            datos = await self._peticion("POST", ruta, {**cuerpo, "id_obligado": self.id_obligado, "offset": offset, "limit": POR_PAGINA})
            registros = datos.get("registros") or []
            for registro in registros:
                yield registro
            if len(registros) < POR_PAGINA:
                return
            offset += POR_PAGINA

    def clientes(self):
        return self._paginas("/obligados/receptores/listar", {})

    def facturas(self):
        """De la más nueva a la más antigua."""
        return self._paginas("/facturas_emitidas/listar", {"orden": "fecha_emision DESC, id DESC"})

    def recibos_pendientes(self):
        return self._paginas("/ventas/gestion_cobros/recibos/listar", {"estado_calculado": "pendientes"})


# ---------- Conexiones ----------

async def _credencial(config: dict, nombre_o_id) -> tuple[dict, str]:
    credenciales = CredencialesCRUD(config)
    cred = await credenciales.obtener(nombre_o_id) if isinstance(nombre_o_id, int) else await credenciales.obtener_por_nombre(nombre_o_id)
    if not cred:
        raise LookupError(f"No existe la credencial «{nombre_o_id}»: guárdala antes (usuario y contraseña de SIF)")
    if not cred.get("usuario"):
        raise ValueError(f"La credencial «{cred['nombre']}» no tiene usuario: el usuario de SIF va en «usuario»")
    return cred, await credenciales.valor_descifrado(cred["id"])


def _publica(conexion: dict) -> dict:
    return {k: v for k, v in conexion.items()}


async def listar_conexiones(config: dict) -> list[dict]:
    filas = await AsyncDatabase(**config).query(f'SELECT * FROM "{_T_CON}" ORDER BY id')
    return [_publica(f) for f in filas]


async def obtener_conexion(config: dict, id_conexion: int | None) -> dict:
    db = AsyncDatabase(**config)
    if id_conexion is None:
        filas = await db.query(f'SELECT * FROM "{_T_CON}" ORDER BY id')
        if not filas:
            raise LookupError("No hay ninguna conexión con Multiplika SIF")
        if len(filas) > 1:
            raise ValueError("Hay varias conexiones con SIF: di cuál (id_conexion)")
        return filas[0]
    filas = await db.query(f'SELECT * FROM "{_T_CON}" WHERE id = %s', (id_conexion,))
    if not filas:
        raise LookupError(f"No existe ninguna conexión con SIF con id {id_conexion}")
    return filas[0]


async def _marcar(config: dict, id_conexion: int, **valores) -> None:
    asignaciones = ", ".join(f"{k} = %s" for k in valores)
    await AsyncDatabase(**config).query(f'UPDATE "{_T_CON}" SET {asignaciones} WHERE id = %s', (*valores.values(), id_conexion))


async def probar_conexion(config: dict, id_conexion: int) -> dict:
    """Entra en SIF, saca el obligado si falta y deja el estado apuntado."""
    conexion = await obtener_conexion(config, id_conexion)
    cred, contrasena = await _credencial(config, conexion["id_credencial"])
    try:
        async with ClienteSIF(conexion["url"], cred["usuario"], contrasena, conexion["id_obligado"]) as cliente:
            yo = await cliente.yo()
    except ErrorSIF as e:
        await _marcar(config, id_conexion, estado="error", ultimo_error=str(e))
        raise
    id_obligado = conexion["id_obligado"] or yo.get("id_obligado")
    if not id_obligado:
        mensaje = "Ese usuario de SIF no es de un obligado (una empresa que factura): usa el usuario del obligado"
        await _marcar(config, id_conexion, estado="error", ultimo_error=mensaje)
        raise ValueError(mensaje)
    await _marcar(config, id_conexion, estado="ok", ultimo_error=None, id_obligado=int(id_obligado))
    return {**await obtener_conexion(config, id_conexion), "empresa": yo.get("NombreRazon")}


async def crear_conexion(config: dict, nombre: str, url: str, nombre_credencial: str) -> dict:
    url = (url or URL_POR_DEFECTO).strip().rstrip("/")
    if not url.startswith(("https://", "http://")):
        url = f"https://{url}"
    cred, _ = await _credencial(config, nombre_credencial)
    db = AsyncDatabase(**config)
    existentes = await db.query(f'SELECT id FROM "{_T_CON}" WHERE id_credencial = %s', (cred["id"],))
    if existentes:
        id_conexion = existentes[0]["id"]
        await _marcar(config, id_conexion, nombre=nombre[:150], url=url[:255])
    else:
        await db.query(
            f'INSERT INTO "{_T_CON}" (nombre, plataforma, url, id_credencial, activa, estado) '
            "VALUES (%s, 'multiplika_sif', %s, %s, true, 'sin_probar') RETURNING id",
            (nombre[:150], url[:255], cred["id"]),
        )
        id_conexion = db.ultimo_insert_id
    try:
        return await probar_conexion(config, id_conexion)
    except (ValueError, LookupError):
        if not existentes:  # una conexión que nunca funcionó no se queda a medias
            await db.query(f'DELETE FROM "{_T_CON}" WHERE id = %s', (id_conexion,))
        raise


async def actualizar_conexion(config: dict, id_conexion: int, datos: dict) -> dict:
    await obtener_conexion(config, id_conexion)
    valores = {}
    if "activa" in datos:
        valores["activa"] = bool(datos["activa"])
    if datos.get("nombre"):
        valores["nombre"] = str(datos["nombre"])[:150]
    if valores:
        await _marcar(config, id_conexion, **valores)
    return await obtener_conexion(config, id_conexion)


async def eliminar_conexion(config: dict, id_conexion: int) -> None:
    """Las facturas y clientes ya traídos se quedan."""
    await obtener_conexion(config, id_conexion)
    await AsyncDatabase(**config).query(f'DELETE FROM "{_T_CON}" WHERE id = %s', (id_conexion,))


# ---------- Sincronizar ----------

def _cliente_desde_sif(r: dict) -> dict:
    return {
        "codigo": r.get("codigo"), "nombre": r.get("NombreRazon") or r.get("nombre_comercial"), "nif": r.get("NIF"),
        "direccion": r.get("direccion"), "localidad": r.get("ciudad"), "provincia": r.get("provincia"),
        "codigo_postal": r.get("codigo_postal"), "telefono": r.get("telefono") or r.get("movil"), "email": r.get("email"),
    }


def _factura_desde_sif(r: dict) -> dict:
    numero = r.get("numero_factura") or f"{r.get('serie') or ''}{r.get('separador_serie') or ''}{r.get('numero') or ''}"
    return {
        "id_externo": r.get("id"), "numero": numero, "fecha": leer_fecha(r.get("fecha_emision"), "aaaa-mm-dd"),
        "nif_cliente": r.get("NIF_receptor"), "nombre_cliente": r.get("NombreRazon_receptor"),
        "total": leer_importe(r.get("importe_total")), "anulada": bool(r.get("anulada")),
    }


async def sincronizar(config: dict, id_conexion: int | None = None) -> dict:
    """Clientes, facturas desde la fecha de corte (dos años la primera vez,
    luego 90 días: así entran anulaciones y rectificativas recientes) y lo
    pendiente de cobro. Si falla, la conexión queda en error con el motivo."""
    conexion = await obtener_conexion(config, id_conexion)
    if not conexion["id_obligado"] or conexion["estado"] != "ok":
        conexion = await probar_conexion(config, conexion["id"])
    cred, contrasena = await _credencial(config, conexion["id_credencial"])
    ahora = ahora_madrid()
    corte = (ahora - timedelta(days=DIAS_CADA_NOCHE if conexion["fecha_ultima_sync"] else DIAS_PRIMERA_VEZ)).date()
    cuenta = {"clientes_creados": 0, "clientes_actualizados": 0, "facturas_nuevas": 0, "facturas_actualizadas": 0,
              "facturas_pendientes": 0, "errores": []}
    db = AsyncDatabase(**config)
    try:
        async with ClienteSIF(conexion["url"], cred["usuario"], contrasena, conexion["id_obligado"]) as sif:
            async with db.transaccion() as cx:
                await db.query("SELECT 1", conexion=cx)  # ver _procesar en _mod_erp.py
                async for r in sif.clientes():
                    try:
                        async with cx.transaction():
                            resultado, _ = await guardar_cliente(db, cx, _cliente_desde_sif(r), ahora, crear_sin_nif=True)
                        cuenta["clientes_creados" if resultado == "creado" else "clientes_actualizados"] += 1
                    except Exception as e:
                        cuenta["errores"].append(f"cliente {r.get('NombreRazon')}: {str(e).splitlines()[0][:150]}")
                async for r in sif.facturas():
                    datos = _factura_desde_sif(r)
                    if datos["fecha"] and datos["fecha"] < corte:
                        break
                    try:
                        async with cx.transaction():
                            resultado, _ = await guardar_factura(db, cx, "sif", datos, ahora, conexion["id"])
                        cuenta["facturas_nuevas" if resultado == "creada" else "facturas_actualizadas"] += 1
                    except Exception as e:
                        cuenta["errores"].append(f"factura {datos['numero']}: {str(e).splitlines()[0][:150]}")
                pendientes: dict[str, float] = {}
                async for r in sif.recibos_pendientes():
                    clave = str(r.get("id_factura"))
                    pendientes[clave] = pendientes.get(clave, 0) + float(leer_importe(r.get("importe_pendiente")) or 0)
                await db.query(
                    f"UPDATE \"{_T_FAC}\" SET pendiente_cobro = 0 WHERE origen = 'sif' AND id_conexion = %s",
                    (conexion["id"],), conexion=cx,
                )
                for id_externo, importe in pendientes.items():
                    cuenta["facturas_pendientes"] += await db.query(
                        f"UPDATE \"{_T_FAC}\" SET pendiente_cobro = %s WHERE origen = 'sif' AND id_conexion = %s AND id_externo = %s",
                        (round(importe, 2), conexion["id"], id_externo), conexion=cx,
                    ) or 0
    except ErrorSIF as e:
        await _marcar(config, conexion["id"], estado="error", ultimo_error=str(e))
        raise
    cuenta["errores"] = cuenta["errores"][:50]
    resumen = (
        f"{cuenta['clientes_creados']} clientes nuevos y {cuenta['clientes_actualizados']} actualizados; "
        f"{cuenta['facturas_nuevas']} facturas nuevas y {cuenta['facturas_actualizadas']} actualizadas desde el "
        f"{corte:%d/%m/%Y}; {cuenta['facturas_pendientes']} con algo pendiente de cobro"
        + (f"; {len(cuenta['errores'])} con error" if cuenta["errores"] else "")
    )
    await _marcar(config, conexion["id"], estado="ok", ultimo_error=None, fecha_ultima_sync=ahora, resumen_ultima_sync=resumen)
    return {"id_conexion": conexion["id"], "resumen": resumen, **cuenta}


HORA_NOCTURNA = 3


async def procesar_nocturno(config: dict, id_proyecto: int, ahora=None) -> list[str]:
    """Desde el cron de cada minuto (scripts/procesar_programaciones.py): a
    partir de las 3:00, una vez al día, cada conexión activa. Si falla, se
    apunta en la conexión y avisa en la campanita a quien puede escribir;
    no se reintenta hasta el día siguiente (o a mano)."""
    ahora = ahora or ahora_madrid()
    if ahora.hour < HORA_NOCTURNA:
        return []
    db = AsyncDatabase(**config)
    salida = []
    for conexion in await listar_conexiones(config):
        intento = conexion["fecha_ultimo_intento"]
        if not conexion["activa"] or (intento and intento.date() >= ahora.date()):
            continue
        await _marcar(config, conexion["id"], fecha_ultimo_intento=ahora)
        try:
            salida.append(f"{conexion['nombre']}: {(await sincronizar(config, conexion['id']))['resumen']}")
        except (ValueError, LookupError) as e:
            salida.append(f"{conexion['nombre']}: ERROR {e}")
            for usuario in await usuarios_del_proyecto(id_proyecto):
                if await puede_editar_proyecto(usuario["id"], id_proyecto):
                    await db.query(
                        f'INSERT INTO "{NOMBRE_TABLA_NOTIFICACIONES}" (id_usuario, origen, titulo, texto, fecha) '
                        "VALUES (%s, 'erp', %s, %s, %s)",
                        (usuario["id"], f"No se pudo sincronizar con {conexion['nombre']}"[:255],
                         f"{e}\n\nLos datos de clientes y facturas siguen siendo los de la última vez. "
                         "Se volverá a intentar mañana; también puedes hacerlo desde CRM → Conexión con el ERP.", ahora),
                    )
    return salida


async def sincronizar_todas(config: dict) -> list[str]:
    """La pasada de cada noche (cron): cada conexión activa. Un fallo no
    para a las demás; queda apuntado en la conexión."""
    salida = []
    for conexion in await listar_conexiones(config):
        if not conexion["activa"]:
            continue
        try:
            salida.append(f"{conexion['nombre']}: {(await sincronizar(config, conexion['id']))['resumen']}")
        except (ValueError, LookupError) as e:
            salida.append(f"{conexion['nombre']}: ERROR {e}")
    return salida
