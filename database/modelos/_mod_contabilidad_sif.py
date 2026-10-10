"""Conexión del asesor contable con la contabilidad de Multiplika SIF — ver
docs/contabilidad/planificacion.md (fase 2).

Dos claves, cada una para una cosa:
- **La de la GD** (credencial reservada NOMBRE_CREDENCIAL_CONTABILIDAD_GD,
  la pone el admin): solo lee. Marca el límite de empresas — en modo
  asesoría, las vinculadas a la asesoría en el SIF (`/obligados/listar` de
  un usuario representante, que el SIF ya filtra por su asesoría); en modo
  empresa, la fijada — y mantiene gd_conta_empresas.
- **La de cada usuario** (credencial privada, `id_usuario_dueno`): con la
  que se trabaja, para que el SIF sepa quién hizo cada cosa y aplique su
  nivel de acceso.

Lo que ve un usuario = sus empresas en `/contabilidad/sesion/empresas` ∩ el
límite. Toda petición a la contabilidad pasa por `pedir()`/`reenviar()`,
que lo comprueban antes de llamar al SIF, así que un `id_obligado` de fuera
nunca llega a salir.

Las sesiones con el SIF se quedan abiertas en memoria del proceso (una por
credencial): el SIF renueva la cookie solo y `ClienteSIF` vuelve a entrar
ante un 401. Lanza ValueError / LookupError con mensajes para enseñar."""

import json
import time

from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_configuracion import NOMBRE_TABLA_CONFIGURACION
from ..dependencias._dep_contabilidad import NOMBRE_TABLA_CONTA_ACCESOS as _T_ACC, NOMBRE_TABLA_CONTA_EMPRESAS as _T_EMP
from ._mod_credenciales import NOMBRE_CREDENCIAL_CONTABILIDAD_GD, CredencialesCRUD
from ._mod_sif import URL_POR_DEFECTO, ClienteSIF, ErrorSIF
from ._repeticiones import ahora_madrid

MODOS = ("asesoria", "empresa")
ROL_REPRESENTANTE = 3
LIMITE_OBLIGADOS = 40000  # el máximo que admite /obligados/listar del SIF
SEGUNDOS_CACHE_EMPRESAS = 300
PREFIJO_PERMITIDO = "/contabilidad/"
RUTAS_PROHIBIDAS = ("/contabilidad/sesion/conmutar",)
NOMBRE_CREDENCIAL_USUARIO = "Acceso a la contabilidad del SIF · usuario {id_usuario}"
CAMPOS_CONFIGURACION = (
    "modo_contable", "url_sif_contable", "id_obligado_sif_fijo", "conta_sin_clave_propia",
    "conta_revision_automatica", "estado_clave_contable", "error_clave_contable",
)

MENSAJE_CLAVE_MALA = "El SIF no acepta ese usuario o esa contraseña"

_sesiones: dict[tuple, ClienteSIF] = {}
_cache_empresas: dict[tuple, tuple[float, list[dict]]] = {}


def _clave(config: dict, id_credencial: int) -> tuple:
    return (config.get("db"), config.get("host"), id_credencial)


def _url(url: str | None) -> str:
    url = (url or URL_POR_DEFECTO).strip().rstrip("/")
    return url if url.startswith(("https://", "http://")) else f"https://{url}"


async def _olvidar(config: dict, id_credencial: int) -> None:
    clave = _clave(config, id_credencial)
    _cache_empresas.pop(clave, None)
    cliente = _sesiones.pop(clave, None)
    if cliente:
        await cliente.http.aclose()


async def _cliente(config: dict, id_credencial: int, url: str) -> ClienteSIF:
    clave = _clave(config, id_credencial)
    if clave not in _sesiones:
        credenciales = CredencialesCRUD(config)
        cred = await credenciales.obtener(id_credencial)
        if not cred:
            raise LookupError("Falta el acceso al SIF: vuelve a escribirlo")
        cliente = ClienteSIF(url, cred["usuario"], await credenciales.valor_descifrado(id_credencial))
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


# ---------- Configuración ----------

async def leer_configuracion(config: dict) -> dict:
    filas = await AsyncDatabase(**config).query(
        f'SELECT {", ".join(CAMPOS_CONFIGURACION)} FROM "{NOMBRE_TABLA_CONFIGURACION}" WHERE id = 1'
    )
    datos = dict(filas[0]) if filas else {}
    datos["url_sif_contable"] = _url(datos.get("url_sif_contable"))
    cred = await CredencialesCRUD(config).obtener_por_nombre(NOMBRE_CREDENCIAL_CONTABILIDAD_GD, permitir_reservada=True)
    datos["usuario_clave_gd"] = cred["usuario"] if cred else None
    datos["id_credencial_gd"] = cred["id"] if cred else None
    return datos


async def _guardar_configuracion(config: dict, **valores) -> None:
    asignaciones = ", ".join(f"{k} = %s" for k in valores)
    await AsyncDatabase(**config).query(
        f'UPDATE "{NOMBRE_TABLA_CONFIGURACION}" SET {asignaciones} WHERE id = 1', tuple(valores.values())
    )


async def _vinculadas_asesoria(cliente: ClienteSIF) -> list[dict]:
    datos = await cliente.pedir("/obligados/listar", {"offset": 0, "limit": LIMITE_OBLIGADOS})
    return [
        {"id_obligado": int(r["id"]), "nombre": r.get("NombreRazon") or f"Empresa {r['id']}", "nif": r.get("NIF")}
        for r in datos.get("registros") or [] if r.get("id")
    ]


async def probar_clave_gd(url: str, modo: str, usuario: str, contrasena: str) -> dict:
    """Entra en el SIF con la clave que se va a guardar y dice qué daría:
    en asesoría, cuántas empresas vinculadas y cuántas con contabilidad
    autorizada; en empresa, la lista para elegir."""
    if modo not in MODOS:
        raise ValueError("Elige si la GD es de una asesoría o de una sola empresa")
    cliente = await _entrar(_url(url), usuario, contrasena)
    try:
        yo = (await cliente.pedir("/contabilidad/sesion/me")).get("user") or {}
        autorizadas = (await cliente.pedir("/contabilidad/sesion/empresas")).get("empresas") or []
        if modo == "empresa":
            if not autorizadas:
                raise ValueError("Ese usuario del SIF no tiene acceso a la contabilidad de ninguna empresa")
            return {"empresas": [
                {"id_obligado": e["id_obligado"], "nombre": e.get("NombreRazon"), "nif": e.get("NIF"), "nivel": e.get("nivel")}
                for e in autorizadas
            ]}
        if int(yo.get("id_rol") or 0) != ROL_REPRESENTANTE:
            raise ValueError(
                "Ese acceso no es de un usuario de la asesoría en el SIF (puede ser de un administrador, que ve "
                "empresas de todas las asesorías). Usa el de un usuario de la asesoría."
            )
        vinculadas = await _vinculadas_asesoria(cliente)
    finally:
        await cliente.http.aclose()
    ids_autorizadas = {e["id_obligado"] for e in autorizadas}
    return {
        "vinculadas": len(vinculadas),
        "con_contabilidad": sum(1 for v in vinculadas if v["id_obligado"] in ids_autorizadas),
        "asesoria": yo.get("NombreRazon"),
    }


async def guardar_clave_gd(
    config: dict, modo: str, url: str, usuario: str, contrasena: str | None,
    id_obligado_fijo: int | None, sin_clave_propia: bool, id_usuario_mio: int | None = None,
) -> dict:
    """Guarda (o cambia) la clave de la GD y la configuración, y pone al día
    la lista de empresas. Sin contraseña nueva, se vuelve a probar la ya
    guardada. Con `id_usuario_mio` (quien la configura dice que ese usuario
    del SIF es el suyo), se guarda también como su acceso propio: así no se
    le pide dos veces la misma clave."""
    credenciales = CredencialesCRUD(config)
    cred = await credenciales.obtener_por_nombre(NOMBRE_CREDENCIAL_CONTABILIDAD_GD, permitir_reservada=True)
    if contrasena is None:
        if not cred:
            raise ValueError("Falta la contraseña del SIF")
        contrasena = await credenciales.valor_descifrado(cred["id"])
    prueba = await probar_clave_gd(url, modo, usuario, contrasena)
    if modo == "empresa":
        disponibles = {e["id_obligado"] for e in prueba["empresas"]}
        if id_obligado_fijo is None and len(disponibles) == 1:
            id_obligado_fijo = next(iter(disponibles))
        if id_obligado_fijo not in disponibles:
            raise ValueError("Elige la empresa de la lista")
    else:
        id_obligado_fijo = None

    descripcion = "Acceso de solo lectura de la GD a la contabilidad del SIF (lo pone el administrador en Asesor contable)"
    if cred:
        await credenciales.actualizar(cred["id"], descripcion, contrasena, usuario)
        await _olvidar(config, cred["id"])
    else:
        await credenciales.crear(NOMBRE_CREDENCIAL_CONTABILIDAD_GD, descripcion, contrasena, usuario, permitir_reservada=True)
    await _guardar_configuracion(
        config, modo_contable=modo, url_sif_contable=_url(url), id_obligado_sif_fijo=id_obligado_fijo,
        conta_sin_clave_propia=bool(sin_clave_propia),
        estado_clave_contable="activo", error_clave_contable=None,
    )
    await sincronizar_empresas(config)
    aviso = None
    if id_usuario_mio:
        try:
            await guardar_acceso_usuario(config, id_usuario_mio, usuario, contrasena)
        except (ValueError, LookupError) as e:
            aviso = f"La conexión se ha guardado, pero no tu acceso propio: {e}"
    return {**await estado(config, id_usuario_mio), "aviso": aviso}


async def usar_clave_gd_como_mia(config: dict, id_usuario: int) -> dict:
    """Para quien conectó la GD con su propio usuario del SIF y no lo dijo:
    guarda esa misma clave como su acceso propio."""
    datos = await leer_configuracion(config)
    if not datos["id_credencial_gd"]:
        raise ValueError("Esta GD todavía no está conectada con el SIF")
    contrasena = await CredencialesCRUD(config).valor_descifrado(datos["id_credencial_gd"])
    return await guardar_acceso_usuario(config, id_usuario, datos["usuario_clave_gd"], contrasena)


async def guardar_opciones(config: dict, sin_clave_propia: bool | None = None, revision_automatica: bool | None = None) -> None:
    valores = {}
    if sin_clave_propia is not None:
        valores["conta_sin_clave_propia"] = sin_clave_propia
    if revision_automatica is not None:
        valores["conta_revision_automatica"] = revision_automatica
    if valores:
        await _guardar_configuracion(config, **valores)


async def desconectar(config: dict) -> None:
    """Quita la conexión con el SIF. Las empresas, propuestas y accesos de
    los usuarios se conservan (no se ven sin conexión)."""
    datos = await leer_configuracion(config)
    if datos["id_credencial_gd"]:
        await _olvidar(config, datos["id_credencial_gd"])
        await CredencialesCRUD(config).eliminar(datos["id_credencial_gd"])
    await _guardar_configuracion(config, modo_contable=None, id_obligado_sif_fijo=None, estado_clave_contable=None)


# ---------- Lista de empresas (el límite) ----------

async def sincronizar_empresas(config: dict) -> dict:
    """Pone al día gd_conta_empresas con la clave de la GD. Lo que ya no
    está en el SIF se marca de baja, no se borra."""
    datos = await leer_configuracion(config)
    if not datos.get("modo_contable") or not datos["id_credencial_gd"]:
        raise ValueError("La contabilidad del SIF no está conectada")
    try:
        cliente = await _cliente(config, datos["id_credencial_gd"], datos["url_sif_contable"])
        autorizadas = {e["id_obligado"]: e for e in (await cliente.pedir("/contabilidad/sesion/empresas")).get("empresas") or []}
        if datos["modo_contable"] == "asesoria":
            empresas = await _vinculadas_asesoria(cliente)
        else:
            fija = autorizadas.get(datos["id_obligado_sif_fijo"])
            if not fija:
                raise ErrorSIF("La clave de la GD ya no llega a la empresa elegida")
            empresas = [{"id_obligado": fija["id_obligado"], "nombre": fija.get("NombreRazon"), "nif": fija.get("NIF")}]
    except (ErrorSIF, LookupError) as e:
        await _guardar_configuracion(config, estado_clave_contable="clave_incorrecta", error_clave_contable=str(e))
        raise ValueError(str(e)) from e

    db = AsyncDatabase(**config)
    ahora = ahora_madrid()
    for e in empresas:
        await db.query(
            f'INSERT INTO "{_T_EMP}" (id_obligado_sif, nif, nombre, contabilidad_autorizada, baja, ultima_sincronizacion) '
            "VALUES (%s, %s, %s, %s, false, %s) ON CONFLICT (id_obligado_sif) DO UPDATE SET "
            "nif = EXCLUDED.nif, nombre = EXCLUDED.nombre, contabilidad_autorizada = EXCLUDED.contabilidad_autorizada, "
            "baja = false, ultima_sincronizacion = EXCLUDED.ultima_sincronizacion",
            (e["id_obligado"], e.get("nif"), (e.get("nombre") or "")[:255], e["id_obligado"] in autorizadas, ahora),
        )
    ids = [e["id_obligado"] for e in empresas]
    await db.query(
        f'UPDATE "{_T_EMP}" SET baja = true WHERE NOT (id_obligado_sif = ANY(%s))', (ids,)
    )
    await _guardar_configuracion(config, estado_clave_contable="activo", error_clave_contable=None)
    _cache_empresas.clear()
    return {"empresas": len(ids), "con_contabilidad": sum(1 for i in ids if i in autorizadas)}


async def _limite(config: dict) -> dict[int, dict]:
    filas = await AsyncDatabase(**config).query(
        f'SELECT id_obligado_sif, nombre, nif FROM "{_T_EMP}" WHERE NOT baja ORDER BY nombre'
    )
    return {f["id_obligado_sif"]: dict(f) for f in filas}


# ---------- Acceso de cada usuario ----------

async def _acceso(config: dict, id_usuario: int) -> dict | None:
    filas = await AsyncDatabase(**config).query(f'SELECT * FROM "{_T_ACC}" WHERE id_usuario = %s', (id_usuario,))
    return dict(filas[0]) if filas else None


async def guardar_acceso_usuario(config: dict, id_usuario: int, usuario: str, contrasena: str) -> dict:
    """Comprueba el acceso al SIF de un usuario y lo guarda en su credencial
    privada. No se guarda si no llega a ninguna empresa del límite."""
    datos = await leer_configuracion(config)
    if not datos.get("modo_contable"):
        raise ValueError("El administrador todavía no ha conectado esta GD con la contabilidad del SIF")
    cliente = await _entrar(datos["url_sif_contable"], usuario, contrasena)
    try:
        yo = (await cliente.pedir("/contabilidad/sesion/me")).get("user") or {}
        suyas = (await cliente.pedir("/contabilidad/sesion/empresas")).get("empresas") or []
    finally:
        await cliente.http.aclose()
    limite = await _limite(config)
    visibles = [e for e in suyas if e["id_obligado"] in limite]
    if not visibles:
        raise ValueError(
            "Tu usuario del SIF no tiene acceso a la contabilidad de ninguna empresa de esta GD. "
            "Pídeselo a tu administrador del SIF."
        )
    credenciales = CredencialesCRUD(config)
    acceso = await _acceso(config, id_usuario)
    descripcion = "Acceso personal a la contabilidad del SIF (privado de este usuario)"
    actual = await credenciales.obtener(acceso["id_credencial"]) if acceso else None
    if actual and actual.get("id_usuario_dueno") == id_usuario:
        await credenciales.actualizar(acceso["id_credencial"], descripcion, contrasena, usuario)
        await _olvidar(config, acceso["id_credencial"])
        id_credencial = acceso["id_credencial"]
    else:
        id_credencial = await credenciales.crear(
            NOMBRE_CREDENCIAL_USUARIO.format(id_usuario=id_usuario), descripcion, contrasena, usuario,
            id_usuario_dueno=id_usuario,
        )
    db = AsyncDatabase(**config)
    await db.query(
        f'INSERT INTO "{_T_ACC}" (id_usuario, id_credencial, id_usuario_sif, estado, ultima_comprobacion, ultimo_error) '
        "VALUES (%s, %s, %s, 'activo', %s, NULL) ON CONFLICT (id_usuario) DO UPDATE SET "
        "id_credencial = EXCLUDED.id_credencial, id_usuario_sif = EXCLUDED.id_usuario_sif, estado = 'activo', "
        "ultima_comprobacion = EXCLUDED.ultima_comprobacion, ultimo_error = NULL",
        (id_usuario, id_credencial, yo.get("id"), ahora_madrid()),
    )
    return {"empresas": len(visibles), "de": len(limite)}


async def borrar_acceso_usuario(config: dict, id_usuario: int) -> None:
    acceso = await _acceso(config, id_usuario)
    if not acceso:
        return
    await _olvidar(config, acceso["id_credencial"])
    await CredencialesCRUD(config).eliminar(acceso["id_credencial"])
    await AsyncDatabase(**config).query(f'DELETE FROM "{_T_ACC}" WHERE id_usuario = %s', (id_usuario,))


async def _credencial_de_trabajo(config: dict, datos: dict, id_usuario: int | None) -> int:
    """La credencial con la que trabaja este usuario: la suya o, con la
    opción de asesorías pequeñas, la de la GD."""
    acceso = await _acceso(config, id_usuario) if id_usuario else None
    if acceso and acceso["estado"] != "clave_incorrecta":
        return acceso["id_credencial"]
    if datos.get("conta_sin_clave_propia") and datos["id_credencial_gd"]:
        return datos["id_credencial_gd"]
    if acceso:
        raise ValueError("Tu clave del SIF ya no vale (¿la has cambiado?): vuelve a escribirla en Asesor contable → Mi acceso")
    raise ValueError("Para ver la contabilidad tienes que poner tu acceso al SIF en Asesor contable → Mi acceso")


async def _marcar_clave_mala(config: dict, datos: dict, id_credencial: int, error: str) -> None:
    if id_credencial == datos["id_credencial_gd"]:
        await _guardar_configuracion(config, estado_clave_contable="clave_incorrecta", error_clave_contable=error)
    else:
        await AsyncDatabase(**config).query(
            f"UPDATE \"{_T_ACC}\" SET estado = 'clave_incorrecta', ultimo_error = %s, ultima_comprobacion = %s "
            "WHERE id_credencial = %s", (error, ahora_madrid(), id_credencial),
        )


async def empresas_de(config: dict, id_usuario: int | None) -> list[dict]:
    """Empresas que puede abrir este usuario: las suyas en el SIF que
    estén dentro del límite de la GD, con su nivel."""
    datos = await leer_configuracion(config)
    if not datos.get("modo_contable"):
        raise ValueError("Esta GD no está conectada con la contabilidad del SIF")
    id_credencial = await _credencial_de_trabajo(config, datos, id_usuario)
    clave = _clave(config, id_credencial)
    guardadas = _cache_empresas.get(clave)
    if guardadas and time.monotonic() - guardadas[0] < SEGUNDOS_CACHE_EMPRESAS:
        return guardadas[1]
    try:
        cliente = await _cliente(config, id_credencial, datos["url_sif_contable"])
        suyas = (await cliente.pedir("/contabilidad/sesion/empresas")).get("empresas") or []
    except ErrorSIF as e:
        await _olvidar(config, id_credencial)
        await _marcar_clave_mala(config, datos, id_credencial, str(e))
        raise ValueError(f"No se puede entrar en el SIF: {e}") from e
    limite = await _limite(config)
    empresas = [
        {**limite[e["id_obligado"]], "nivel": e.get("nivel")} for e in suyas if e["id_obligado"] in limite
    ]
    _cache_empresas[clave] = (time.monotonic(), empresas)
    return empresas


async def _empresa_permitida(config: dict, id_usuario: int | None, id_obligado: int) -> tuple[dict, ClienteSIF]:
    empresas = {e["id_obligado_sif"]: e for e in await empresas_de(config, id_usuario)}
    if id_obligado not in empresas:
        raise LookupError("No tienes acceso a la contabilidad de esa empresa desde esta GD")
    datos = await leer_configuracion(config)
    id_credencial = await _credencial_de_trabajo(config, datos, id_usuario)
    return empresas[id_obligado], await _cliente(config, id_credencial, datos["url_sif_contable"])


def _ruta_permitida(ruta: str) -> str:
    ruta = "/" + ruta.lstrip("/")
    if not ruta.startswith(PREFIJO_PERMITIDO) or ruta in RUTAS_PROHIBIDAS or ".." in ruta:
        raise LookupError("Esa parte del SIF no se puede usar desde la GD")
    return ruta


async def pedir(config: dict, id_usuario: int | None, id_obligado: int, ruta: str, cuerpo: dict | None = None) -> dict:
    """Una petición JSON a la contabilidad del SIF, como este usuario y en
    esta empresa. Devuelve el JSON; un error del SIF, como ValueError."""
    _, cliente = await _empresa_permitida(config, id_usuario, id_obligado)
    try:
        return await cliente.pedir(_ruta_permitida(ruta), {**(cuerpo or {}), "id_obligado": id_obligado})
    except ErrorSIF as e:
        raise ValueError(str(e)) from e


async def reenviar(
    config: dict, id_usuario: int | None, id_obligado: int, ruta: str,
    contenido: bytes = b"", campos: dict | None = None, ficheros: list | None = None,
):
    """Para el proxy de las pantallas de contabilidad: reenvía la petición
    (JSON en `contenido`, o un formulario con `campos` y `ficheros` como los
    acepta httpx) y devuelve la respuesta del SIF sin tocar, también errores
    y descargas. La empresa se impone aquí, en el cuerpo, que es donde la
    lee el SIF (`obligado_del_cuerpo`)."""
    _, cliente = await _empresa_permitida(config, id_usuario, id_obligado)
    ruta = _ruta_permitida(ruta)
    if campos is not None or ficheros:
        return await cliente.crudo("POST", ruta, data={**(campos or {}), "id_obligado": str(id_obligado)}, files=ficheros)
    cuerpo = json.loads(contenido or b"{}")
    if not isinstance(cuerpo, dict):
        raise ValueError("El cuerpo tiene que ser un objeto JSON")
    return await cliente.crudo("POST", ruta, json={**cuerpo, "id_obligado": id_obligado})


async def pedir_como_gd(config: dict, id_obligado: int, ruta: str, cuerpo: dict | None = None) -> dict:
    """Lectura con la clave de la GD, para lo que hace la GD por su cuenta
    (revisión automática): solo empresas del límite y solo rutas de
    consulta, que es lo único que se le pide a esta clave."""
    if id_obligado not in await _limite(config):
        raise LookupError("Esa empresa no está en la lista de esta GD")
    datos = await leer_configuracion(config)
    cliente = await _cliente(config, datos["id_credencial_gd"], datos["url_sif_contable"])
    try:
        return await cliente.pedir(_ruta_permitida(ruta), {**(cuerpo or {}), "id_obligado": id_obligado})
    except ErrorSIF as e:
        raise ValueError(str(e)) from e


async def empresas_del_limite(config: dict) -> list[dict]:
    return list((await _limite(config)).values())


# ---------- Estado, para el panel ----------

async def estado(config: dict, id_usuario: int | None = None) -> dict:
    datos = await leer_configuracion(config)
    db = AsyncDatabase(**config)
    resumen = (await db.query(
        f'SELECT count(*) FILTER (WHERE NOT baja) AS empresas, '
        f'count(*) FILTER (WHERE NOT baja AND contabilidad_autorizada) AS con_contabilidad, '
        f'max(ultima_sincronizacion) AS ultima_sincronizacion FROM "{_T_EMP}"'
    ))[0]
    acceso = await _acceso(config, id_usuario) if id_usuario else None
    return {
        **{k: datos.get(k) for k in CAMPOS_CONFIGURACION},
        "url_sif_contable": datos["url_sif_contable"], "usuario_clave_gd": datos["usuario_clave_gd"],
        **dict(resumen),
        "mi_acceso": acceso and {k: acceso[k] for k in ("estado", "ultima_comprobacion", "ultimo_error")},
        "id_usuario_actual": id_usuario,
    }


async def accesos_usuarios(config: dict) -> list[dict]:
    filas = await AsyncDatabase(**config).query(
        f'SELECT id_usuario, estado, ultima_comprobacion, ultimo_error FROM "{_T_ACC}" ORDER BY id_usuario'
    )
    return [dict(f) for f in filas]
