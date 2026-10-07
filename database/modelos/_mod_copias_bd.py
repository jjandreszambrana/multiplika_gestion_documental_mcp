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
        copia-bd-20261008-101500-c3d4.zip     cifrada: ZIP AES-256 con el .dump

El ZIP cifrado se abre con 7-Zip, WinRAR o similares (el explorador de
Windows no sabe abrir ZIP con AES). La contraseña de una copia manual
no se guarda nunca; la de las programadas sí (cifrada con la clave del
servidor), porque el cron la necesita cada vez."""

import asyncio
import fcntl
import json
import os
import re
import secrets
import shutil
import tempfile
from contextlib import contextmanager
from datetime import datetime

import pyzipper
from mtpk_postgres.core_sync import ManagerDB

from lib.cifrado import cifrar, descifrar

from ..dependencias._esquema import tablas_esquema
from ._mod_configuracion import ConfiguracionCRUD
from ._mod_conector import _asegurar_carpeta, _conectar_sftp, datos_sftp
from ._repeticiones import ahora_madrid, describir_regla, siguiente_ejecucion, validar_regla

DIR_BASE = os.environ.get("GD_COPIAS_BD_DIR", "/opt/multiplika/gd_copias_bd")
PATRON_COPIA = re.compile(r"^copia-bd-\d{8}-\d{6}-[0-9a-f]{4}\.(dump|zip)$")
ORIGENES = {"manual": "Manual", "programada": "Programada", "antes_de_restaurar": "Antes de restaurar"}
TIPOS_REGLA = ("cada_dias", "semanal", "mensual")
LONGITUD_MINIMA_CONTRASENA = 8
CONFIRMACION_RESTAURAR = "RESTAURAR"
AJUSTES_POR_DEFECTO = {
    "programada": False,
    "regla": None,
    "proxima": None,
    "conservar": 14,
    "cifrar": False,
    "contrasena_cifrada": None,
    "sftp_credencial": None,
    "sftp_carpeta": "copias-gestion-documental",
    "sftp_conservar": 14,
    "ultimo_resultado": None,
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
    return {**AJUSTES_POR_DEFECTO, **guardados}


def ajustes_publicos(ajustes: dict) -> dict:
    """Lo que ve el panel: nunca la contraseña, solo si hay una guardada."""
    publicos = {k: v for k, v in ajustes.items() if k != "contrasena_cifrada"}
    publicos["tiene_contrasena"] = bool(ajustes["contrasena_cifrada"])
    publicos["descripcion"] = describir_regla(ajustes["regla"]) if ajustes["regla"] else None
    return publicos


def guardar_ajustes(id_proyecto: int, cambios: dict) -> dict:
    """`cambios` puede traer: programada, regla, conservar, cifrar,
    contrasena (texto; "" o None = conservar la que hubiera),
    sftp_credencial, sftp_carpeta, sftp_conservar."""
    ajustes = leer_ajustes(id_proyecto)
    for campo in ("programada", "cifrar"):
        if campo in cambios:
            ajustes[campo] = bool(cambios[campo])
    for campo in ("conservar", "sftp_conservar"):
        if campo in cambios:
            valor = cambios[campo]
            if not isinstance(valor, int) or not 1 <= valor <= 365:
                raise CopiaBDError("El número de copias a conservar debe estar entre 1 y 365")
            ajustes[campo] = valor
    if "regla" in cambios:
        regla = cambios["regla"]
        if regla is not None:
            try:
                regla = validar_regla(regla)
            except ValueError as e:
                raise CopiaBDError(str(e)) from None
            if regla["tipo"] not in TIPOS_REGLA:
                raise CopiaBDError("La copia programada solo puede ser diaria, semanal o mensual")
            regla["hasta"] = None
        ajustes["regla"] = regla
    if cambios.get("contrasena"):
        _validar_contrasena(cambios["contrasena"])
        ajustes["contrasena_cifrada"] = cifrar(cambios["contrasena"])
    if "sftp_credencial" in cambios:
        ajustes["sftp_credencial"] = (cambios["sftp_credencial"] or "").strip() or None
    if "sftp_carpeta" in cambios:
        carpeta = (cambios["sftp_carpeta"] or "").strip()
        if not carpeta or ".." in carpeta.split("/"):
            raise CopiaBDError("Carpeta remota no válida")
        ajustes["sftp_carpeta"] = carpeta

    if ajustes["programada"] and not ajustes["regla"]:
        raise CopiaBDError("Para programar las copias hay que decir cada cuánto")
    if ajustes["cifrar"] and not ajustes["contrasena_cifrada"]:
        raise CopiaBDError("Para cifrar las copias programadas hay que poner una contraseña")
    ajustes["proxima"] = (
        siguiente_ejecucion(ajustes["regla"], ahora_madrid()).isoformat() if ajustes["programada"] else None
    )
    _escribir_json(os.path.join(_carpeta(id_proyecto), "ajustes.json"), ajustes)
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
            "cifrada": nombre.endswith(".zip"),
            "origen": datos.get("origen", "manual"),
            "remoto": datos.get("remoto"),
            "_orden": (nombre[:24], os.stat(ruta).st_mtime_ns),  # fecha del nombre; dentro del mismo segundo, la del archivo
        })
    copias.sort(key=lambda c: c.pop("_orden"), reverse=True)
    return copias


def espacio_libre() -> int:
    return shutil.disk_usage(DIR_BASE if os.path.isdir(DIR_BASE) else "/").free


def borrar_copia(id_proyecto: int, nombre: str) -> None:
    ruta = ruta_copia(id_proyecto, nombre)
    os.remove(ruta)
    ruta_json = ruta.rsplit(".", 1)[0] + ".json"
    if os.path.isfile(ruta_json):
        os.remove(ruta_json)


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


def _cifrar_zip(ruta_dump: str, ruta_zip: str, contrasena: str) -> None:
    with pyzipper.AESZipFile(ruta_zip, "w", compression=pyzipper.ZIP_STORED, encryption=pyzipper.WZ_AES) as z:
        # ZIP_STORED: el .dump ya va comprimido por pg_dump, volver a
        # comprimirlo solo gasta tiempo.
        z.setpassword(contrasena.encode())
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
            nombre = base + ".zip"
            await asyncio.to_thread(_cifrar_zip, ruta_dump, os.path.join(carpeta, nombre), contrasena)
            os.chmod(os.path.join(carpeta, nombre), 0o600)
            os.remove(ruta_dump)
    except BaseException:
        for resto in (ruta_dump, os.path.join(carpeta, base + ".zip")):
            if os.path.exists(resto):
                os.remove(resto)
        raise
    datos = {"fecha": ahora_madrid().isoformat(), "origen": origen, "remoto": None}
    _escribir_json(os.path.join(carpeta, base + ".json"), datos)
    return {"nombre": nombre, **datos}


async def crear_copia(id_proyecto: int, config: dict, origen: str = "manual", contrasena: str | None = None) -> dict:
    """Hace la copia y, si hay destino SFTP configurado, la sube también
    (un fallo al subir no deshace la copia: queda apuntado en ella)."""
    with _bloqueo(id_proyecto):
        copia = await _copia_sin_bloqueo(id_proyecto, config, origen, contrasena)
    ajustes = leer_ajustes(id_proyecto)
    if ajustes["sftp_credencial"]:
        copia["remoto"] = await _subir_a_sftp(id_proyecto, config, copia["nombre"], ajustes)
        ruta_json = os.path.join(_carpeta(id_proyecto), copia["nombre"].rsplit(".", 1)[0] + ".json")
        _escribir_json(ruta_json, {k: copia[k] for k in ("fecha", "origen", "remoto")})
    return copia


def _subir_y_podar_sftp(d: dict, local: str, carpeta: str, nombre: str, conservar: int) -> None:
    ssh, sftp = _conectar_sftp(d)
    try:
        _asegurar_carpeta(sftp, carpeta)
        sftp.put(local, f"{carpeta.rstrip('/')}/{nombre}")
        copias = sorted(f for f in sftp.listdir(carpeta) if PATRON_COPIA.match(f))
        for viejo in copias[: max(0, len(copias) - conservar)]:
            sftp.remove(f"{carpeta.rstrip('/')}/{viejo}")
    finally:
        sftp.close()
        ssh.close()


async def _subir_a_sftp(id_proyecto: int, config: dict, nombre: str, ajustes: dict) -> dict:
    try:
        d = await datos_sftp(config, ajustes["sftp_credencial"])
        await asyncio.to_thread(_subir_y_podar_sftp, d, ruta_copia(id_proyecto, nombre),
                                ajustes["sftp_carpeta"], nombre, ajustes["sftp_conservar"])
        return {"ok": True, "detalle": f"Subida a {d['host']}:{ajustes['sftp_carpeta']}"}
    except Exception as e:  # credencial mal puesta, servidor caído...: la copia local sigue valiendo
        return {"ok": False, "detalle": f"No se pudo subir al servidor remoto: {e}"}


# --- Restaurar ---

def _descifrar_zip(ruta_zip: str, destino: str, contrasena: str) -> str:
    try:
        with pyzipper.AESZipFile(ruta_zip) as z:
            z.setpassword(contrasena.encode())
            nombre = next(n for n in z.namelist() if n.endswith(".dump"))
            return z.extract(nombre, destino)
    except RuntimeError:  # pyzipper la lanza con la contraseña mala
        raise CopiaBDError("La contraseña no es correcta") from None
    except (StopIteration, pyzipper.BadZipFile):
        raise CopiaBDError("El archivo de la copia está dañado") from None


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


async def restaurar_copia(id_proyecto: int, config: dict, nombre: str, contrasena: str | None) -> dict:
    """Antes de tocar nada hace una copia del estado actual (origen
    "antes_de_restaurar"), por si hay que deshacerlo. La restauración va
    en una sola transacción: si algo falla, la base se queda como estaba.
    Después pone el esquema al día con el código actual, por si la copia
    es de antes de un cambio de tablas."""
    ruta = ruta_copia(id_proyecto, nombre)
    if nombre.endswith(".zip") and not contrasena:
        raise CopiaBDError("Esta copia está cifrada: hace falta su contraseña")
    with _bloqueo(id_proyecto), tempfile.TemporaryDirectory(prefix="gd-restaurar-") as temporal:
        ruta_dump = await asyncio.to_thread(_descifrar_zip, ruta, temporal, contrasena) if nombre.endswith(".zip") else ruta
        previa = await _copia_sin_bloqueo(id_proyecto, config, "antes_de_restaurar", None)
        entorno = _entorno_pg(config)
        lista = await _ejecutar("pg_restore", "-l", ruta_dump, env=entorno)
        ruta_lista = os.path.join(temporal, "lista.txt")
        with open(ruta_lista, "w") as f:
            f.writelines(linea + "\n" for linea in lista.splitlines() if not _TIPOS_FUERA_DE_RESTAURAR.match(linea))
        entorno["PGOPTIONS"] = "-c lock_timeout=60s"
        await _ejecutar("pg_restore", "--clean", "--if-exists", "--no-owner", "--no-privileges",
                        "--single-transaction", "--exit-on-error", "-L", ruta_lista,
                        *_argumentos_conexion(config), ruta_dump, env=entorno)
    proveedor = await ConfiguracionCRUD(config).obtener_proveedor_embedding()
    await asyncio.to_thread(_aplicar_esquema_actual, config, proveedor)
    return {"restaurada": nombre, "copia_previa": previa["nombre"]}


# --- Programadas (cron) ---

def _podar_programadas(id_proyecto: int, conservar: int) -> list[str]:
    programadas = [c["nombre"] for c in listar_copias(id_proyecto) if c["origen"] == "programada"]
    sobrantes = programadas[conservar:]  # listar_copias ya viene de la más nueva a la más vieja
    for nombre in sobrantes:
        borrar_copia(id_proyecto, nombre)
    return sobrantes


async def procesar_programada(id_proyecto: int, config: dict) -> str | None:
    """Si a este proyecto le toca copia programada, la hace. Devuelve una
    línea para el log del cron, o None si no tocaba."""
    ajustes = leer_ajustes(id_proyecto)
    ahora = ahora_madrid()
    if not ajustes["programada"] or not ajustes["proxima"] or datetime.fromisoformat(ajustes["proxima"]) > ahora:
        return None
    contrasena = descifrar(ajustes["contrasena_cifrada"]) if ajustes["cifrar"] else None
    try:
        copia = await crear_copia(id_proyecto, config, "programada", contrasena)
        borradas = _podar_programadas(id_proyecto, ajustes["conservar"])
        resultado = {"ok": True, "fecha": ahora.isoformat(), "detalle": f"Copia {copia['nombre']} hecha"
                     + (f"; {copia['remoto']['detalle']}" if copia.get("remoto") else "")}
        linea = resultado["detalle"] + (f"; borradas por antigüedad: {', '.join(borradas)}" if borradas else "")
    except Exception as e:  # que un fallo quede a la vista y no se reintente cada 5 minutos
        resultado = {"ok": False, "fecha": ahora.isoformat(), "detalle": str(e)}
        linea = f"error: {e}"
    # Releer: mientras se hacía la copia alguien pudo cambiar los ajustes desde el panel.
    ajustes = leer_ajustes(id_proyecto)
    ajustes["ultimo_resultado"] = resultado
    if ajustes["programada"] and ajustes["regla"]:
        ajustes["proxima"] = siguiente_ejecucion(ajustes["regla"], ahora).isoformat()
    _escribir_json(os.path.join(_carpeta(id_proyecto), "ajustes.json"), ajustes)
    return linea
