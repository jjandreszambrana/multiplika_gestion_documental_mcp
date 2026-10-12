"""Conexión del asesor contable con la contabilidad de Multiplika SIF — ver
docs/contabilidad/planificacion.md (fase 2) y la decisión del usuario en
[5.9] del canal compartido.

Una sola regla: **cada usuario de la GD vincula su propio acceso al SIF**
(dirección, usuario y contraseña) y ve lo que ese usuario del SIF puede
ver: una empresa si es el de la empresa, todas las suyas si es el de una
asesoría. El tipo no se elige, sale del rol que devuelve el SIF. Un
usuario puede tener varios accesos, a SIF distintos.

Las empresas se nombran en la GD por `gd_conta_empresas.id` (el id del
SIF se repite entre SIF distintos). La empresa dice con qué acceso se
habla: el del usuario que la ve, y si la ve por varios, el de mayor nivel.
Toda petición pasa por `pedir()`/`reenviar()`, que lo comprueban: una
empresa que el usuario no ve nunca llega a pedirse.

Las sesiones con el SIF se quedan abiertas en memoria del proceso (una por
credencial): el SIF renueva la cookie solo y `ClienteSIF` vuelve a entrar
ante un 401. Lanza ValueError / LookupError con mensajes para enseñar."""

import json

from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_contabilidad import (
    NOMBRE_TABLA_CONTA_ACCESOS as _T_ACC,
    NOMBRE_TABLA_CONTA_ACCESOS_EMPRESAS as _T_AE,
    NOMBRE_TABLA_CONTA_EMPRESAS as _T_EMP,
)
from ..dependencias._dep_credenciales import NOMBRE_TABLA_CREDENCIALES as _T_CRED
from ._mod_credenciales import CredencialesCRUD
from ._mod_sif import URL_POR_DEFECTO, ClienteSIF, ErrorSIF
from ._repeticiones import ahora_madrid

ROL_REPRESENTANTE, ROLES_DE_EMPRESA = 3, (4, 5)
ORDEN_NIVELES = {"consulta": 0, "apuntes": 1, "cierre": 2, "admin": 3}
# Las conexiones externas (Codiplika) van fuera de contabilidad en el SIF, pero
# se configuran desde la pantalla de contabilidad; crearlas, probarlas o
# quitarlas lo sigue decidiendo el SIF (solo su superadministrador).
PREFIJOS_PERMITIDOS = ("/contabilidad/", "/maestros/conexiones_externas/")
RUTAS_PROHIBIDAS = ("/contabilidad/sesion/conmutar",)
NOMBRE_CREDENCIAL = "SIF {url} · {usuario} · usuario GD {id_usuario}"
MENSAJE_CLAVE_MALA = "El SIF no acepta ese usuario o esa contraseña"
MENSAJE_SIN_ACCESO = "Para ver la contabilidad necesitas poner tu propio acceso al SIF en Asesor contable → Mis accesos al SIF"

_sesiones: dict[tuple, ClienteSIF] = {}


def _clave(config: dict, id_credencial: int) -> tuple:
    return (config.get("db"), config.get("host"), id_credencial)


def _url(url: str | None) -> str:
    url = (url or URL_POR_DEFECTO).strip().rstrip("/")
    return url if url.startswith(("https://", "http://")) else f"https://{url}"


def _tipo(rol: int) -> str:
    return "asesoria" if rol == ROL_REPRESENTANTE else "empresa" if rol in ROLES_DE_EMPRESA else "otro"


async def _olvidar(config: dict, id_credencial: int) -> None:
    cliente = _sesiones.pop(_clave(config, id_credencial), None)
    if cliente:
        await cliente.http.aclose()


async def _cliente(config: dict, acceso: dict) -> ClienteSIF:
    clave = _clave(config, acceso["id_credencial"])
    if clave not in _sesiones:
        credenciales = CredencialesCRUD(config)
        cred = await credenciales.obtener(acceso["id_credencial"])
        if not cred:
            raise LookupError("Falta la contraseña de ese acceso al SIF: vuelve a ponerla")
        cliente = ClienteSIF(acceso["url_sif"], cred["usuario"], await credenciales.valor_descifrado(acceso["id_credencial"]))
        await cliente.entrar()
        _sesiones[clave] = cliente
    return _sesiones[clave]


async def _entrar(url: str, usuario: str, contrasena: str) -> ClienteSIF:
    """Una sesión nueva con una clave que aún no se ha guardado, con el
    mensaje de error de esta pantalla (el de ClienteSIF manda a Credenciales)."""
    cliente = ClienteSIF(url, usuario, contrasena)
    try:
        await cliente.entrar()
    except ErrorSIF as e:
        await cliente.http.aclose()
        raise ValueError(MENSAJE_CLAVE_MALA if "no acepta" in str(e) else str(e)) from e
    return cliente


async def _lo_que_ve(cliente: ClienteSIF) -> tuple[dict, list[dict]]:
    """(quién es en el SIF, empresas cuya contabilidad puede abrir)."""
    yo = (await cliente.pedir("/contabilidad/sesion/me")).get("user") or {}
    empresas = (await cliente.pedir("/contabilidad/sesion/empresas")).get("empresas") or []
    return yo, empresas


def _datos_de(yo: dict) -> tuple[str, str | None]:
    return _tipo(int(yo.get("id_rol") or 0)), (yo.get("NombreRazon") or "")[:255] or None


# ---------- Los accesos de un usuario ----------

async def _acceso(config: dict, id_usuario: int, id_acceso: int) -> dict:
    filas = await AsyncDatabase(**config).query(
        f'SELECT * FROM "{_T_ACC}" WHERE id = %s AND id_usuario = %s', (id_acceso, id_usuario)
    )
    if not filas:
        raise LookupError("Ese acceso al SIF no existe")
    return dict(filas[0])


async def _guardar_empresas(config: dict, acceso: dict, empresas: list[dict]) -> int:
    """Rehace la lista de empresas que ve un acceso. Devuelve cuántas."""
    db = AsyncDatabase(**config)
    vistas = []
    # AsyncDatabase.query solo devuelve filas en un SELECT: el id se lee aparte.
    for e in empresas:
        await db.query(
            f'INSERT INTO "{_T_EMP}" (url_sif, id_obligado_sif, nif, nombre) VALUES (%s, %s, %s, %s) '
            "ON CONFLICT (url_sif, id_obligado_sif) DO UPDATE SET nif = EXCLUDED.nif, nombre = EXCLUDED.nombre",
            (acceso["url_sif"], int(e["id_obligado"]), e.get("NIF"), (e.get("NombreRazon") or f"Empresa {e['id_obligado']}")[:255]),
        )
        fila = await db.query(
            f'SELECT id FROM "{_T_EMP}" WHERE url_sif = %s AND id_obligado_sif = %s', (acceso["url_sif"], int(e["id_obligado"]))
        )
        vistas.append((fila[0]["id"], e.get("nivel")))
    await db.query(f'DELETE FROM "{_T_AE}" WHERE id_acceso = %s', (acceso["id"],))
    for id_empresa, nivel in vistas:
        await db.query(f'INSERT INTO "{_T_AE}" (id_acceso, id_empresa, nivel) VALUES (%s, %s, %s)', (acceso["id"], id_empresa, nivel))
    return len(vistas)


async def anadir_acceso(config: dict, id_usuario: int, url: str, usuario: str, contrasena: str) -> dict:
    """Prueba un acceso al SIF y lo guarda en una credencial privada del
    usuario. Si ya tenía uno con esa dirección y ese usuario, lo actualiza."""
    url = _url(url)
    cliente = await _entrar(url, usuario, contrasena)
    try:
        yo, empresas = await _lo_que_ve(cliente)
    finally:
        await cliente.http.aclose()
    if not empresas:
        raise ValueError("Ese usuario del SIF no tiene acceso a la contabilidad de ninguna empresa")

    db = AsyncDatabase(**config)
    credenciales = CredencialesCRUD(config)
    previo = None
    for fila in await db.query(f'SELECT * FROM "{_T_ACC}" WHERE id_usuario = %s AND url_sif = %s', (id_usuario, url)):
        cred = await credenciales.obtener(fila["id_credencial"])
        if cred and cred.get("usuario") == usuario and cred.get("id_usuario_dueno") == id_usuario:
            previo = dict(fila)
    descripcion = "Acceso personal a la contabilidad del SIF (privado de este usuario)"
    tipo, nombre_sif = _datos_de(yo)
    if previo:
        await credenciales.actualizar(previo["id_credencial"], descripcion, contrasena, usuario)
        await _olvidar(config, previo["id_credencial"])
        await db.query(
            f"UPDATE \"{_T_ACC}\" SET tipo = %s, nombre_sif = %s, estado = 'activo', ultima_comprobacion = %s, "
            "ultimo_error = NULL WHERE id = %s", (tipo, nombre_sif, ahora_madrid(), previo["id"]),
        )
        id_acceso = previo["id"]
    else:
        id_credencial = await credenciales.crear(
            NOMBRE_CREDENCIAL.format(id_usuario=id_usuario, url=url.split("//")[-1], usuario=usuario)[:100],
            descripcion, contrasena, usuario, id_usuario_dueno=id_usuario,
        )
        await db.query(
            f'INSERT INTO "{_T_ACC}" (id_usuario, url_sif, id_credencial, tipo, nombre_sif, estado, ultima_comprobacion) '
            "VALUES (%s, %s, %s, %s, %s, 'activo', %s) RETURNING id", (id_usuario, url, id_credencial, tipo, nombre_sif, ahora_madrid()),
        )
        id_acceso = db.ultimo_insert_id
    acceso = await _acceso(config, id_usuario, id_acceso)
    return {**_publico(acceso), "empresas": await _guardar_empresas(config, acceso, empresas)}


async def actualizar_acceso(config: dict, acceso: dict) -> dict:
    """Vuelve a preguntar al SIF qué empresas ve este acceso. Si la
    contraseña ya no vale, lo marca (no lo borra) y lanza ValueError."""
    db = AsyncDatabase(**config)
    try:
        yo, empresas = await _lo_que_ve(await _cliente(config, acceso))
    except (ErrorSIF, LookupError) as e:
        await _olvidar(config, acceso["id_credencial"])
        await db.query(
            f"UPDATE \"{_T_ACC}\" SET estado = 'clave_incorrecta', ultimo_error = %s, ultima_comprobacion = %s WHERE id = %s",
            (str(e), ahora_madrid(), acceso["id"]),
        )
        raise ValueError(f"No se puede entrar en el SIF con ese acceso: {e}") from e
    tipo, nombre_sif = _datos_de(yo)
    await db.query(
        f'UPDATE "{_T_ACC}" SET tipo = %s, nombre_sif = %s, estado = %s, ultimo_error = NULL, ultima_comprobacion = %s WHERE id = %s',
        (tipo, nombre_sif, "activo" if empresas else "sin_empresas", ahora_madrid(), acceso["id"]),
    )
    return {"empresas": await _guardar_empresas(config, acceso, empresas)}


async def actualizar_acceso_de(config: dict, id_usuario: int, id_acceso: int) -> dict:
    return await actualizar_acceso(config, await _acceso(config, id_usuario, id_acceso))


async def borrar_acceso(config: dict, id_usuario: int, id_acceso: int) -> None:
    acceso = await _acceso(config, id_usuario, id_acceso)
    await _olvidar(config, acceso["id_credencial"])
    await CredencialesCRUD(config).eliminar(acceso["id_credencial"])
    await AsyncDatabase(**config).query(f'DELETE FROM "{_T_ACC}" WHERE id = %s', (id_acceso,))


async def cambiar_revision(config: dict, id_usuario: int, id_acceso: int, activa: bool) -> None:
    await _acceso(config, id_usuario, id_acceso)
    await AsyncDatabase(**config).query(f'UPDATE "{_T_ACC}" SET revision_automatica = %s WHERE id = %s', (activa, id_acceso))


def _publico(acceso: dict) -> dict:
    return {k: acceso.get(k) for k in (
        "id", "url_sif", "tipo", "nombre_sif", "estado", "revision_automatica", "ultima_comprobacion", "ultimo_error",
    )}


async def accesos_de(config: dict, id_usuario: int | None) -> list[dict]:
    """Los accesos de un usuario, con su usuario del SIF y cuántas empresas ve."""
    if not id_usuario:
        return []
    filas = await AsyncDatabase(**config).query(
        f'SELECT a.*, c.usuario AS usuario_sif, (SELECT count(*) FROM "{_T_AE}" ae WHERE ae.id_acceso = a.id) AS empresas '
        f'FROM "{_T_ACC}" a LEFT JOIN "{_T_CRED}" c ON c.id = a.id_credencial WHERE a.id_usuario = %s ORDER BY a.id',
        (id_usuario,),
    )
    return [{**_publico(f), "usuario_sif": f["usuario_sif"], "empresas": f["empresas"]} for f in filas]


async def todos_los_accesos(config: dict) -> list[dict]:
    return [dict(f) for f in await AsyncDatabase(**config).query(f'SELECT * FROM "{_T_ACC}" ORDER BY id')]


# ---------- Empresas y peticiones ----------

async def empresas_de(config: dict, id_usuario: int | None) -> list[dict]:
    """Empresas que puede abrir este usuario con sus accesos que funcionan,
    una vez cada una (con el acceso de mayor nivel si la ve por varios)."""
    if not id_usuario:
        raise ValueError(MENSAJE_SIN_ACCESO)
    filas = await AsyncDatabase(**config).query(
        f'SELECT e.id AS id_empresa, e.nombre, e.nif, e.url_sif, e.id_obligado_sif, ae.nivel, a.id AS id_acceso '
        f'FROM "{_T_AE}" ae JOIN "{_T_ACC}" a ON a.id = ae.id_acceso JOIN "{_T_EMP}" e ON e.id = ae.id_empresa '
        f"WHERE a.id_usuario = %s AND a.estado <> 'clave_incorrecta' ORDER BY e.nombre",
        (id_usuario,),
    )
    mejor: dict[int, dict] = {}
    for f in filas:
        actual = mejor.get(f["id_empresa"])
        if not actual or ORDEN_NIVELES.get(f["nivel"], -1) > ORDEN_NIVELES.get(actual["nivel"], -1):
            mejor[f["id_empresa"]] = dict(f)
    if not mejor:
        raise ValueError(MENSAJE_SIN_ACCESO)
    return sorted(mejor.values(), key=lambda e: e["nombre"] or "")


async def _empresa_y_cliente(config: dict, id_usuario: int | None, id_empresa: int) -> tuple[dict, ClienteSIF]:
    empresas = {e["id_empresa"]: e for e in await empresas_de(config, id_usuario)}
    if id_empresa not in empresas:
        raise LookupError("No tienes acceso a la contabilidad de esa empresa")
    empresa = empresas[id_empresa]
    acceso = await _acceso(config, id_usuario, empresa["id_acceso"])
    try:
        return empresa, await _cliente(config, acceso)
    except ErrorSIF:
        await actualizar_acceso(config, acceso)  # marca el acceso y lanza el error claro
        raise


def _ruta_permitida(ruta: str) -> str:
    ruta = "/" + ruta.lstrip("/")
    if not ruta.startswith(PREFIJOS_PERMITIDOS) or ruta in RUTAS_PROHIBIDAS or ".." in ruta:
        raise LookupError("Esa parte del SIF no se puede usar desde la GD")
    return ruta


async def pedir(config: dict, id_usuario: int | None, id_empresa: int, ruta: str, cuerpo: dict | None = None) -> dict:
    """Una petición JSON a la contabilidad del SIF, como este usuario y en
    esta empresa. Devuelve el JSON; un error del SIF, como ValueError."""
    empresa, cliente = await _empresa_y_cliente(config, id_usuario, id_empresa)
    try:
        return await cliente.pedir(_ruta_permitida(ruta), {**(cuerpo or {}), "id_obligado": empresa["id_obligado_sif"]})
    except ErrorSIF as e:
        raise ValueError(str(e)) from e


async def reenviar(
    config: dict, id_usuario: int | None, id_empresa: int, ruta: str,
    contenido: bytes = b"", campos: dict | None = None, ficheros: list | None = None,
):
    """Para el proxy de las pantallas de contabilidad: reenvía la petición
    (JSON en `contenido`, o un formulario con `campos` y `ficheros` como los
    acepta httpx) y devuelve la respuesta del SIF sin tocar, también errores
    y descargas. La empresa se impone aquí, en el cuerpo, que es donde la
    lee el SIF (`obligado_del_cuerpo`)."""
    empresa, cliente = await _empresa_y_cliente(config, id_usuario, id_empresa)
    ruta, id_obligado = _ruta_permitida(ruta), empresa["id_obligado_sif"]
    if campos is not None or ficheros:
        return await cliente.crudo("POST", ruta, data={**(campos or {}), "id_obligado": str(id_obligado)}, files=ficheros)
    cuerpo = json.loads(contenido or b"{}")
    if not isinstance(cuerpo, dict):
        raise ValueError("El cuerpo tiene que ser un objeto JSON")
    return await cliente.crudo("POST", ruta, json={**cuerpo, "id_obligado": id_obligado})


async def pedir_con_errores(config: dict, id_usuario: int | None, id_empresa: int, ruta: str, cuerpo: dict) -> tuple[int, dict]:
    """Como `pedir`, pero un 400 no se convierte en excepción: vuelve con su
    código y su JSON entero. Las plantillas de asiento devuelven ahí la lista
    de errores por campo (`errores`), que `pedir` recortaría."""
    respuesta = await reenviar(config, id_usuario, id_empresa, ruta, json.dumps(cuerpo).encode())
    try:
        datos = respuesta.json()
    except ValueError:
        datos = {"message": respuesta.text[:300]}
    if respuesta.status_code >= 400 and respuesta.status_code != 400:
        raise ValueError(f"SIF respondió {respuesta.status_code} en {ruta}: {datos.get('message') or datos.get('detail') or ''}")
    return respuesta.status_code, datos if isinstance(datos, dict) else {"datos": datos}


async def empresas_del_acceso(config: dict, acceso: dict) -> list[dict]:
    filas = await AsyncDatabase(**config).query(
        f'SELECT e.id AS id_empresa, e.nombre, e.id_obligado_sif FROM "{_T_AE}" ae JOIN "{_T_EMP}" e ON e.id = ae.id_empresa '
        "WHERE ae.id_acceso = %s ORDER BY e.nombre", (acceso["id"],),
    )
    return [dict(f) for f in filas]


async def pedir_con_acceso(config: dict, acceso: dict, empresa: dict, ruta: str, cuerpo: dict | None = None) -> dict:
    """Lectura con un acceso concreto, para lo que la GD hace por su cuenta
    en nombre de quien lo activó (la revisión nocturna, sobre sus empresas)."""
    cliente = await _cliente(config, acceso)
    try:
        return await cliente.pedir(_ruta_permitida(ruta), {**(cuerpo or {}), "id_obligado": empresa["id_obligado_sif"]})
    except ErrorSIF as e:
        raise ValueError(str(e)) from e
