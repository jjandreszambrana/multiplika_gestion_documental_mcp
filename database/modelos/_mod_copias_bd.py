"""Copias de seguridad de la base del cliente, desde su panel — ver
docs/gestion-documental.md → "Copias de seguridad de la base de datos".

Distintas del backup diario del núcleo (scripts/backup_diario.py del
repo core, solo para Multiplika): estas las gestiona el propio cliente
(hacer, descargar, borrar, restaurar, programar) y puede pedirlas
cifradas con una contraseña suya.

Todo vive en disco, NO en la base del cliente: una restauración machaca
la base entera, y si la lista de copias o los ajustes estuvieran dentro,
volverían también al estado de la copia (desaparecerían las copias
posteriores de la lista, o los ajustes cambiarían solos). Por proyecto:

    <GD_COPIAS_BD_DIR>/p<id>/
        ajustes.json                      programación, destino SFTP...
        copia-bd-20261007-043000-a1b2.dump    sin cifrar (pg_dump -Fc)
        copia-bd-20261007-043000-a1b2.json    sus datos (origen, cifrada...)
        copia-bd-20261008-101500-c3d4.7z      cifrada: 7z AES-256 con el .dump

Cifrado en .7z (AES-256, clave derivada con 2^19 rondas de SHA-256 y
también los nombres de dentro cifrados): probar contraseñas a ciegas
cuesta unas 500 veces más que con un ZIP cifrado. Se abre con 7-Zip o
WinRAR. La contraseña, mínimo 12 caracteres, vive en el almacén de
credenciales de la GD (NOMBRE_CREDENCIAL_COPIAS_BD, apartada del resto)
y es la misma para todas las copias cifradas: las programadas que se
pidan cifradas, las manuales (que solo se pueden hacer con ella ya
guardada) y la previa a restaurar."""

import asyncio
import fcntl
import json
import os
import re
import secrets
import shutil
import tempfile
from contextlib import contextmanager
from datetime import datetime, timedelta

import py7zr
from mtpk_postgres.core_sync import ManagerDB

from ..dependencias._esquema import tablas_esquema
from ._mod_configuracion import ConfiguracionCRUD
from ._mod_credenciales import NOMBRE_CREDENCIAL_COPIAS_BD, CredencialesCRUD
from ._mod_conector import _asegurar_carpeta, _conectar_sftp, datos_sftp
from ._repeticiones import ahora_madrid, describir_regla, siguiente_ejecucion, validar_regla

DIR_BASE = os.environ.get("GD_COPIAS_BD_DIR", "/opt/multiplika/gd_copias_bd")
PATRON_COPIA = re.compile(r"^copia-bd-\d{8}-\d{6}-[0-9a-f]{4}\.(dump|7z)$")
ORIGENES = {"manual": "Manual", "programada": "Programada", "antes_de_restaurar": "Antes de restaurar"}
TIPOS_REGLA = ("cada_dias", "semanal", "mensual")
LONGITUD_MINIMA_CONTRASENA = 12
# Sin compresión (el .dump ya va comprimido por pg_dump) y cifrando también la cabecera.
_FILTROS_7Z = [{"id": py7zr.FILTER_COPY}, {"id": py7zr.FILTER_CRYPTO_AES256_SHA256}]
CONFIRMACION_RESTAURAR = "RESTAURAR"
MODOS_CONSERVAR = ("copias", "dias")
MAXIMO_PERIODOS = 10
AJUSTES_POR_DEFECTO = {
    "programada": False,
    "periodos": [],
    "cifrar": False,
    "sftp_credencial": None,
    "sftp_carpeta": "copias-gestion-documental",
}
# Lo que se restaura es solo lo del propio cliente: las extensiones
# (vector, unaccent) y la configuración de búsqueda spanish_unaccent las
# crea el superusuario al aprovisionar la base, el usuario del cliente no
# puede borrarlas ni recrearlas, y ya están en la base de destino.
_TIPOS_FUERA_DE_RESTAURAR = re.compile(r"^\d+; \d+ \d+ (EXTENSION|SCHEMA|TEXT SEARCH|COMMENT - (EXTENSION|SCHEMA)) ")


class CopiaBDError(Exception):
    pass


# --- Rutas y bloqueo ---

def _carpeta(id_proyecto: int) -> str:
    ruta = os.path.join(DIR_BASE, f"p{int(id_proyecto)}")
    os.makedirs(ruta, mode=0o700, exist_ok=True)
    return ruta


def ruta_copia(id_proyecto: int, nombre: str) -> str:
    if not PATRON_COPIA.match(nombre or ""):
        raise CopiaBDError("Nombre de copia no válido")
    ruta = os.path.join(_carpeta(id_proyecto), nombre)
    if not os.path.isfile(ruta):
        raise CopiaBDError("Esa copia no existe")
    return ruta


@contextmanager
def _bloqueo(id_proyecto: int):
    """Una sola copia o restauración a la vez por proyecto (el panel y el
    cron pueden coincidir)."""
    with open(os.path.join(_carpeta(id_proyecto), ".bloqueo"), "w") as f:
        try:
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise CopiaBDError("Ya hay una copia o una restauración en marcha; espera a que termine") from None
        try:
            yield
        finally:
            fcntl.flock(f, fcntl.LOCK_UN)


def _escribir_json(ruta: str, datos: dict) -> None:
    temporal = ruta + ".tmp"
    with open(os.open(temporal, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w") as f:
        json.dump(datos, f, ensure_ascii=False, indent=1)
    os.replace(temporal, ruta)


# --- Ajustes (programación y destino remoto) ---

def leer_ajustes(id_proyecto: int) -> dict:
    ruta = os.path.join(_carpeta(id_proyecto), "ajustes.json")
    guardados = {}
    if os.path.isfile(ruta):
        with open(ruta) as f:
            guardados = json.load(f)
    if "regla" in guardados:  # formato de la primera versión: una sola programación
        regla = guardados.pop("regla")
        guardados["periodos"] = [] if not regla else [{
            "id": 1, "regla": regla, "conservar_modo": "copias", "conservar": guardados.get("conservar", 14),
            "proxima": guardados.get("proxima"), "ultimo_resultado": guardados.get("ultimo_resultado"),
        }]
        for viejo in ("conservar", "proxima", "ultimo_resultado", "sftp_conservar"):
            guardados.pop(viejo, None)
    guardados.pop("contrasena_cifrada", None)  # ahora vive en el almacén de credenciales
    return {**AJUSTES_POR_DEFECTO, **guardados}


def _escribir_ajustes(id_proyecto: int, ajustes: dict) -> None:
    _escribir_json(os.path.join(_carpeta(id_proyecto), "ajustes.json"), ajustes)


def describir_periodo(periodo: dict) -> str:
    """En palabras: "Todos los días a las 03:00 · se guardan las 7 últimas"."""
    if periodo["conservar_modo"] == "copias":
        guardar = f"se guardan las {periodo['conservar']} últimas"
    else:
        guardar = f"se guardan {periodo['conservar']} días"
    regla = periodo["regla"]
    cuando = f"Todos los días a las {regla['hora']}" if regla["tipo"] == "cada_dias" else describir_regla(regla)
    return f"{cuando} · {guardar}"


# --- Contraseña, en el almacén de credenciales de la GD ---

async def contrasena_guardada(config: dict) -> str | None:
    credenciales = CredencialesCRUD(config)
    fila = await credenciales.obtener_por_nombre(NOMBRE_CREDENCIAL_COPIAS_BD, permitir_reservada=True)
    return await credenciales.valor_descifrado(fila["id"]) if fila else None


async def _guardar_contrasena(config: dict, contrasena: str) -> None:
    credenciales = CredencialesCRUD(config)
    fila = await credenciales.obtener_por_nombre(NOMBRE_CREDENCIAL_COPIAS_BD, permitir_reservada=True)
    if fila:
        await credenciales.actualizar(fila["id"], None, contrasena)
    else:
        await credenciales.crear(
            NOMBRE_CREDENCIAL_COPIAS_BD,
            "Con esta contraseña se cifran las copias de seguridad de la base. Solo la usa el sistema de copias; "
            "se cambia desde la pantalla Copias de seguridad.",
            contrasena, permitir_reservada=True,
        )


async def ajustes_publicos(ajustes: dict, config: dict) -> dict:
    """Lo que ve el panel: nunca la contraseña, solo si hay una guardada,
    y si ya se pueden hacer copias manuales."""
    publicos = dict(ajustes)
    publicos["tiene_contrasena"] = bool(await contrasena_guardada(config))
    publicos["puede_copia_manual"] = bool(ajustes["programada"] and ajustes["periodos"] and publicos["tiene_contrasena"])
    publicos["periodos"] = [{**p, "descripcion": describir_periodo(p)} for p in ajustes["periodos"]]
    return publicos


def _validar_periodo(periodo: dict, anterior: dict | None, ahora: datetime) -> dict:
    try:
        regla = validar_regla(periodo.get("regla") or {})
    except ValueError as e:
        raise CopiaBDError(str(e)) from None
    if regla["tipo"] not in TIPOS_REGLA:
        raise CopiaBDError("Cada periodo solo puede ser diario, semanal o mensual")
    regla["hasta"] = None
    modo = periodo.get("conservar_modo", "copias")
    if modo not in MODOS_CONSERVAR:
        raise CopiaBDError("Hay que decir si se conservan un número de copias o un número de días")
    conservar = periodo.get("conservar")
    if not isinstance(conservar, int) or not 1 <= conservar <= (365 if modo == "copias" else 3650):
        raise CopiaBDError("Copias a conservar: entre 1 y 365; días: entre 1 y 3650")
    misma_regla = anterior and anterior["regla"] == regla
    return {
        "id": anterior["id"] if anterior else None,
        "regla": regla,
        "conservar_modo": modo,
        "conservar": conservar,
        # Si no cambia cuándo, se respeta la próxima ya calculada (no se salta la que estuviera a punto).
        "proxima": anterior["proxima"] if misma_regla and anterior.get("proxima")
        else siguiente_ejecucion(regla, ahora).isoformat(),
        "ultimo_resultado": anterior.get("ultimo_resultado") if anterior else None,
    }


async def guardar_ajustes(id_proyecto: int, config: dict, cambios: dict) -> dict:
    """`cambios` puede traer: programada, periodos (lista de {id?, regla,
    conservar_modo, conservar}; los que no vengan se quitan), cifrar,
    contrasena (texto; "" o None = conservar la que hubiera),
    sftp_credencial, sftp_carpeta."""
    ajustes = leer_ajustes(id_proyecto)
    ahora = ahora_madrid()
    for campo in ("programada", "cifrar"):
        if campo in cambios:
            ajustes[campo] = bool(cambios[campo])
    if "periodos" in cambios:
        nuevos = cambios["periodos"] or []
        if len(nuevos) > MAXIMO_PERIODOS:
            raise CopiaBDError(f"Como mucho {MAXIMO_PERIODOS} periodos")
        anteriores = {p["id"]: p for p in ajustes["periodos"]}
        periodos = [_validar_periodo(p, anteriores.get(p.get("id")), ahora) for p in nuevos]
        siguiente_id = max([0, *anteriores], default=0) + 1
        for p in periodos:
            if p["id"] is None:
                p["id"] = siguiente_id
                siguiente_id += 1
        ajustes["periodos"] = periodos
    if cambios.get("contrasena"):
        _validar_contrasena(cambios["contrasena"])
    if "sftp_credencial" in cambios:
        ajustes["sftp_credencial"] = (cambios["sftp_credencial"] or "").strip() or None
    if "sftp_carpeta" in cambios:
        carpeta = (cambios["sftp_carpeta"] or "").strip()
        if not carpeta or ".." in carpeta.split("/"):
            raise CopiaBDError("Carpeta remota no válida")
        ajustes["sftp_carpeta"] = carpeta

    if ajustes["programada"] and not ajustes["periodos"]:
        raise CopiaBDError("Para programar las copias hay que añadir al menos un periodo")
    if ajustes["cifrar"] and not cambios.get("contrasena") and not await contrasena_guardada(config):
        raise CopiaBDError("Para cifrar las copias programadas hay que poner una contraseña")
    if cambios.get("contrasena"):
        await _guardar_contrasena(config, cambios["contrasena"])
    _escribir_ajustes(id_proyecto, ajustes)
    return ajustes


def _validar_contrasena(contrasena: str) -> None:
    if len(contrasena or "") < LONGITUD_MINIMA_CONTRASENA:
        raise CopiaBDError(f"La contraseña debe tener al menos {LONGITUD_MINIMA_CONTRASENA} caracteres")


# --- Listado ---

def listar_copias(id_proyecto: int) -> list[dict]:
    carpeta = _carpeta(id_proyecto)
    copias = []
    for nombre in os.listdir(carpeta):
        if not PATRON_COPIA.match(nombre):
            continue
        ruta = os.path.join(carpeta, nombre)
        datos = {}
        ruta_json = ruta.rsplit(".", 1)[0] + ".json"
        if os.path.isfile(ruta_json):
            with open(ruta_json) as f:
                datos = json.load(f)
        copias.append({
            "nombre": nombre,
            "fecha": datos.get("fecha") or datetime.fromtimestamp(os.path.getmtime(ruta)).isoformat(timespec="seconds"),
            "tamano": os.path.getsize(ruta),
            "cifrada": nombre.endswith(".7z"),
            "origen": datos.get("origen", "manual"),
            "periodos": datos.get("periodos", []),
            "remoto": datos.get("remoto"),
            "_orden": (nombre[:24], os.stat(ruta).st_mtime_ns),  # fecha del nombre; dentro del mismo segundo, la del archivo
        })
    copias.sort(key=lambda c: c.pop("_orden"), reverse=True)
    return copias


def espacio_libre() -> int:
    return shutil.disk_usage(DIR_BASE if os.path.isdir(DIR_BASE) else "/").free


def _ruta_datos(id_proyecto: int, nombre: str) -> str:
    return os.path.join(_carpeta(id_proyecto), nombre.rsplit(".", 1)[0] + ".json")


def _borrar_local(id_proyecto: int, nombre: str) -> None:
    os.remove(ruta_copia(id_proyecto, nombre))
    if os.path.isfile(_ruta_datos(id_proyecto, nombre)):
        os.remove(_ruta_datos(id_proyecto, nombre))


async def borrar_copia(id_proyecto: int, config: dict, nombre: str) -> None:
    """Borra la copia aquí y, si se subió al otro servidor, también allí."""
    subida = next((c for c in listar_copias(id_proyecto) if c["nombre"] == nombre), {}).get("remoto")
    _borrar_local(id_proyecto, nombre)
    if subida and subida.get("ok"):
        await _borrar_remoto(config, [nombre], leer_ajustes(id_proyecto))


# --- Hacer una copia ---

def _entorno_pg(config: dict) -> dict:
    return {**os.environ, "PGPASSWORD": config["password"]}


def _argumentos_conexion(config: dict) -> list[str]:
    return ["-h", str(config["host"]), "-p", str(config["port"]), "-U", config["user"], "-d", config["db"]]


async def _ejecutar(*args: str, env: dict) -> str:
    proceso = await asyncio.create_subprocess_exec(
        *args, env=env, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    salida, error = await proceso.communicate()
    if proceso.returncode != 0:
        raise CopiaBDError(f"{args[0]} falló: {error.decode(errors='replace').strip()[-500:]}")
    return salida.decode(errors="replace")


def _cifrar_7z(ruta_dump: str, ruta_7z: str, contrasena: str) -> None:
    with py7zr.SevenZipFile(ruta_7z, "w", password=contrasena, filters=_FILTROS_7Z, header_encryption=True) as z:
        z.write(ruta_dump, os.path.basename(ruta_dump))


async def _copia_sin_bloqueo(id_proyecto: int, config: dict, origen: str, contrasena: str | None) -> dict:
    if contrasena is not None:
        _validar_contrasena(contrasena)
    carpeta = _carpeta(id_proyecto)
    base = f"copia-bd-{ahora_madrid():%Y%m%d-%H%M%S}-{secrets.token_hex(2)}"
    ruta_dump = os.path.join(carpeta, base + ".dump")
    try:
        await _ejecutar("pg_dump", "-Fc", "--no-owner", "--no-privileges", "-f", ruta_dump,
                        *_argumentos_conexion(config), env=_entorno_pg(config))
        os.chmod(ruta_dump, 0o600)
        nombre = base + ".dump"
        if contrasena is not None:
            nombre = base + ".7z"
            await asyncio.to_thread(_cifrar_7z, ruta_dump, os.path.join(carpeta, nombre), contrasena)
            os.chmod(os.path.join(carpeta, nombre), 0o600)
            os.remove(ruta_dump)
    except BaseException:
        for resto in (ruta_dump, os.path.join(carpeta, base + ".7z")):
            if os.path.exists(resto):
                os.remove(resto)
        raise
    datos = {"fecha": ahora_madrid().isoformat(), "origen": origen, "periodos": [], "remoto": None}
    _escribir_json(os.path.join(carpeta, base + ".json"), datos)
    return {"nombre": nombre, **datos}


async def crear_copia(id_proyecto: int, config: dict, origen: str = "manual", periodos: list[int] | None = None) -> dict:
    """Hace la copia y, si hay destino SFTP configurado, la sube también
    (un fallo al subir no deshace la copia: queda apuntado en ella).
    Manual: solo con las copias ya programadas y la contraseña guardada, y
    siempre cifrada. Programada: cifrada si así se pidió en los ajustes.
    `periodos`: ids de los periodos programados a los que pertenece."""
    ajustes = leer_ajustes(id_proyecto)
    contrasena = await contrasena_guardada(config)
    if origen == "manual" and not (ajustes["programada"] and ajustes["periodos"] and contrasena):
        raise CopiaBDError("Para hacer una copia manual primero hay que programar las copias y guardar su contraseña")
    if origen == "programada" and not ajustes["cifrar"]:
        contrasena = None
    elif origen == "programada" and not contrasena:
        raise CopiaBDError("Las copias programadas van cifradas, pero su contraseña ya no está en el almacén de credenciales")
    with _bloqueo(id_proyecto):
        copia = await _copia_sin_bloqueo(id_proyecto, config, origen, contrasena)
    copia["periodos"] = periodos or []
    ajustes = leer_ajustes(id_proyecto)
    if ajustes["sftp_credencial"]:
        copia["remoto"] = await _subir_a_sftp(id_proyecto, config, copia["nombre"], ajustes)
    _escribir_json(_ruta_datos(id_proyecto, copia["nombre"]), {k: copia[k] for k in ("fecha", "origen", "periodos", "remoto")})
    return copia


# --- Otro servidor (SFTP): espejo de lo que hay aquí. Lo que se borra
# aquí (a mano o por caducar en su periodo) se borra también allí.

def _subir_sftp(d: dict, local: str, carpeta: str, nombre: str) -> None:
    ssh, sftp = _conectar_sftp(d)
    try:
        _asegurar_carpeta(sftp, carpeta)
        sftp.put(local, f"{carpeta.rstrip('/')}/{nombre}")
    finally:
        sftp.close()
        ssh.close()


def _borrar_sftp(d: dict, carpeta: str, nombres: list[str]) -> None:
    ssh, sftp = _conectar_sftp(d)
    try:
        for nombre in nombres:
            try:
                sftp.remove(f"{carpeta.rstrip('/')}/{nombre}")
            except FileNotFoundError:
                pass
    finally:
        sftp.close()
        ssh.close()


async def _subir_a_sftp(id_proyecto: int, config: dict, nombre: str, ajustes: dict) -> dict:
    try:
        d = await datos_sftp(config, ajustes["sftp_credencial"])
        await asyncio.to_thread(_subir_sftp, d, ruta_copia(id_proyecto, nombre), ajustes["sftp_carpeta"], nombre)
        return {"ok": True, "detalle": f"Subida a {d['host']}:{ajustes['sftp_carpeta']}"}
    except Exception as e:  # credencial mal puesta, servidor caído...: la copia local sigue valiendo
        return {"ok": False, "detalle": f"No se pudo subir al servidor remoto: {e}"}


async def _borrar_remoto(config: dict, nombres: list[str], ajustes: dict) -> None:
    if not nombres or not ajustes["sftp_credencial"]:
        return
    try:
        d = await datos_sftp(config, ajustes["sftp_credencial"])
        await asyncio.to_thread(_borrar_sftp, d, ajustes["sftp_carpeta"], nombres)
    except Exception as e:  # se queda allí de más; no es motivo para fallar
        print(f"[copias-bd] no se pudieron borrar en el servidor remoto {nombres}: {e}")


# --- Restaurar ---

def _descifrar_7z(ruta_7z: str, destino: str, contrasena: str) -> str:
    try:
        with py7zr.SevenZipFile(ruta_7z, "r", password=contrasena) as z:
            nombre = next(n for n in z.getnames() if n.endswith(".dump"))
            z.extract(destino, [nombre])
        return os.path.join(destino, nombre)
    except Exception:  # con la cabecera cifrada, una contraseña mala da errores de todo tipo
        raise CopiaBDError("La contraseña no abre esta copia") from None


def _aplicar_esquema_actual(config: dict, proveedor_embedding: str) -> None:
    manager = ManagerDB(**config)
    try:
        for tabla in tablas_esquema(proveedor_embedding):
            manager.add_tabla(tabla)
        resultado = manager.crear_todo(permitir_drop=False)
    finally:
        manager.cerrar()
    if "error" in resultado:
        raise CopiaBDError(f"La copia se restauró, pero no se pudo poner al día su esquema: {resultado['error']}")


async def restaurar_copia(id_proyecto: int, config: dict, nombre: str, contrasena: str | None = None) -> dict:
    """Antes de tocar nada hace una copia del estado actual (origen
    "antes_de_restaurar"), por si hay que deshacerlo. La restauración va
    en una sola transacción: si algo falla, la base se queda como estaba.
    Después pone el esquema al día con el código actual, por si la copia
    es de antes de un cambio de tablas."""
    ruta = ruta_copia(id_proyecto, nombre)
    # El almacén de credenciales está dentro de la base: la restauración lo
    # devolvería al pasado, y las copias hechas después con la contraseña
    # de ahora no se podrían abrir. Se guarda antes y se vuelve a poner.
    guardada = await contrasena_guardada(config)
    with _bloqueo(id_proyecto), tempfile.TemporaryDirectory(prefix="gd-restaurar-") as temporal:
        ruta_dump = ruta
        if nombre.endswith(".7z"):
            if not (contrasena or guardada):
                raise CopiaBDError("Esta copia está cifrada y no hay contraseña guardada: escríbela")
            try:
                ruta_dump = await asyncio.to_thread(_descifrar_7z, ruta, temporal, contrasena or guardada)
            except CopiaBDError:
                raise CopiaBDError("La contraseña no abre esta copia" if contrasena else
                                   "La contraseña guardada no abre esta copia (seguramente se hizo con una anterior): escríbela") from None
        previa = await _copia_sin_bloqueo(id_proyecto, config, "antes_de_restaurar", guardada)
        entorno = _entorno_pg(config)
        lista = await _ejecutar("pg_restore", "-l", ruta_dump, env=entorno)
        ruta_lista = os.path.join(temporal, "lista.txt")
        with open(ruta_lista, "w") as f:
            f.writelines(linea + "\n" for linea in lista.splitlines() if not _TIPOS_FUERA_DE_RESTAURAR.match(linea))
        entorno["PGOPTIONS"] = "-c lock_timeout=60s"
        await _ejecutar("pg_restore", "--clean", "--if-exists", "--no-owner", "--no-privileges",
                        "--single-transaction", "--exit-on-error", "-L", ruta_lista,
                        *_argumentos_conexion(config), ruta_dump, env=entorno)
    if guardada:
        await _guardar_contrasena(config, guardada)
    proveedor = await ConfiguracionCRUD(config).obtener_proveedor_embedding()
    await asyncio.to_thread(_aplicar_esquema_actual, config, proveedor)
    return {"restaurada": nombre, "copia_previa": previa["nombre"]}


# --- Programadas (cron) ---
#
# Cada periodo (p. ej. diaria guardando 7, semanal guardando 10, mensual
# guardando 12 meses) lleva su cuenta. Si dos tocan a la vez (el lunes a
# las 3:00 la diaria y la semanal) se hace UNA copia que cuenta para los
# dos; el archivo solo se borra cuando ya no lo quiere ningún periodo.

def _sobrantes_de_periodo(copias: list[dict], periodo: dict, ahora: datetime) -> list[str]:
    suyas = [c for c in copias if periodo["id"] in c["periodos"]]  # de la más nueva a la más vieja
    if periodo["conservar_modo"] == "copias":
        return [c["nombre"] for c in suyas[periodo["conservar"]:]]
    limite = ahora - timedelta(days=periodo["conservar"])
    return [c["nombre"] for c in suyas if datetime.fromisoformat(c["fecha"]) < limite]


async def _podar(id_proyecto: int, config: dict, ajustes: dict, ahora: datetime) -> list[str]:
    """Quita cada copia de los periodos que ya no la quieren; borra las
    que se quedan sin ninguno. Las de un periodo que ya no existe se
    tratan como sin periodo y se borran también (salvo manuales y de
    antes de restaurar, que nunca se borran solas)."""
    copias = [c for c in listar_copias(id_proyecto) if c["origen"] == "programada"]
    ids_vivos = {p["id"] for p in ajustes["periodos"]}
    quitar = {}
    for periodo in ajustes["periodos"]:
        for nombre in _sobrantes_de_periodo(copias, periodo, ahora):
            quitar.setdefault(nombre, set()).add(periodo["id"])
    borradas = []
    for copia in copias:
        restantes = [i for i in copia["periodos"] if i in ids_vivos and i not in quitar.get(copia["nombre"], set())]
        if restantes == copia["periodos"]:
            continue
        if restantes:
            ruta = _ruta_datos(id_proyecto, copia["nombre"])
            with open(ruta) as f:
                datos = json.load(f)
            _escribir_json(ruta, {**datos, "periodos": restantes})
        else:
            _borrar_local(id_proyecto, copia["nombre"])
            borradas.append(copia["nombre"])
    await _borrar_remoto(config, borradas, ajustes)
    return borradas


async def procesar_programada(id_proyecto: int, config: dict) -> str | None:
    """Si a algún periodo de este proyecto le toca copia, la hace (una
    para todos los que toquen). Devuelve una línea para el log del cron,
    o None si no tocaba."""
    ajustes = leer_ajustes(id_proyecto)
    ahora = ahora_madrid()
    tocan = [p for p in ajustes["periodos"] if p.get("proxima") and datetime.fromisoformat(p["proxima"]) <= ahora]
    if not ajustes["programada"] or not tocan:
        return None
    ids = [p["id"] for p in tocan]
    try:
        copia = await crear_copia(id_proyecto, config, "programada", ids)
        resultado = {"ok": True, "fecha": ahora.isoformat(), "detalle": f"Copia {copia['nombre']} hecha"
                     + (f"; {copia['remoto']['detalle']}" if copia.get("remoto") else "")}
        linea = resultado["detalle"]
    except Exception as e:  # que un fallo quede a la vista y no se reintente cada 5 minutos
        resultado = {"ok": False, "fecha": ahora.isoformat(), "detalle": str(e)}
        linea = f"error: {e}"
    # Releer: mientras se hacía la copia alguien pudo cambiar los ajustes desde el panel.
    ajustes = leer_ajustes(id_proyecto)
    for periodo in ajustes["periodos"]:
        if periodo["id"] in ids:
            periodo["ultimo_resultado"] = resultado
            periodo["proxima"] = siguiente_ejecucion(periodo["regla"], ahora).isoformat()
    _escribir_ajustes(id_proyecto, ajustes)
    if resultado["ok"]:
        borradas = await _podar(id_proyecto, config, ajustes, ahora)
        if borradas:
            linea += f"; borradas por antigüedad: {', '.join(borradas)}"
    return linea
