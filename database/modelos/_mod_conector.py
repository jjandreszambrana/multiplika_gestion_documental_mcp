"""El conector propio de WordPress (plugin «Multiplika Conector», en
conector_wordpress/ de este repo) y lo que la GD hace con él: copias de
seguridad en el espacio del cliente (su propio servidor y/o un servidor
remoto suyo por SFTP), integridad, registro de errores y actualizaciones —
ver docs/gestion-documental.md → "Webs y redes sociales".

El conector es opcional: una web sin él funciona igual, solo que sin estas
cosas. Habla por la misma API REST que el resto (/wp-json/multiplika/v1),
con la misma contraseña de aplicación, y solo atiende a administradores.

Las copias nunca se guardan en servidores de Multiplika: si el destino es
remoto, la GD las descarga a un archivo temporal, las sube al servidor del
cliente y borra el temporal."""

import asyncio
import io
import os
import re
import stat
import tempfile

import httpx
import paramiko

from ._mod_credenciales import CredencialesCRUD
from ._mod_credenciales_campos import CredencialesCamposCRUD
from ._mod_wordpress import ClienteWordPress, WordPressError, _comprobar_destino_publico

TIMEOUT_LARGO = 1800
PATRON_COPIA = re.compile(r"^copia-\d{8}-\d{6}-[A-Za-z0-9]{12}\.zip$")
VERSION_CONECTOR = "1.3.0"  # la que se descarga del panel; las webs con una anterior reciben aviso
# Plugins de copias conocidos: si el cliente ya tiene uno, se le dice (la
# GD no puede ver cuándo hicieron su última copia).
PLUGINS_DE_COPIAS = ("updraftplus", "backwpup", "duplicator", "all-in-one-wp-migration", "blogvault",
                     "jetpack", "wpvivid", "backup-backup", "backuply")


class ConectorError(Exception):
    pass


class ClienteConector:
    """Las llamadas al plugin. Lanza ConectorError con un mensaje legible."""

    def __init__(self, wordpress: ClienteWordPress):
        self.wp = wordpress

    async def _llamar(self, metodo: str, ruta: str, json: dict | None = None, params: dict | None = None,
                      timeout: int | None = None):
        try:
            return await self.wp._peticion(metodo, f"/multiplika/v1{ruta}", json=json, params=params, timeout=timeout)
        except WordPressError as e:
            texto = str(e)
            if "No route" in texto or "no encontr" in texto.lower():
                raise ConectorError("La web no tiene instalado (o activado) el conector de Multiplika")
            raise ConectorError(texto)

    async def estado(self) -> dict:
        return await self._llamar("GET", "/estado")

    async def integridad(self) -> dict:
        return await self._llamar("GET", "/integridad")

    async def errores(self, lineas: int = 100) -> dict:
        return await self._llamar("GET", "/errores", params={"lineas": lineas})

    async def listar_copias(self) -> dict:
        return await self._llamar("GET", "/copias")

    async def crear_copia(self) -> dict:
        return await self._llamar_largo("POST", "/copias")

    async def borrar_copia(self, nombre: str) -> dict:
        return await self._llamar("DELETE", f"/copias/{_nombre_valido(nombre)}")

    async def restaurar(self, nombre: str) -> dict:
        return await self._llamar_largo("POST", f"/copias/{_nombre_valido(nombre)}/restaurar")

    async def actualizar(self, tipo: str, elemento: str) -> dict:
        return await self._llamar_largo("POST", "/actualizar", json={"tipo": tipo, "elemento": elemento})

    async def leer_seo(self, id_objeto) -> dict:
        try:
            return await self._llamar("GET", f"/seo/{int(id_objeto)}")
        except ConectorError as e:
            if "no tiene instalado" in str(e):
                raise ConectorError("El conector de esta web es de una versión anterior: descarga la nueva desde el panel "
                                    "(Webs y redes → la web → Vigilancia) e instálala encima")
            raise

    async def escribir_seo(self, id_objeto, datos: dict) -> dict:
        return await self._llamar("POST", f"/seo/{int(id_objeto)}", json=datos)

    async def leer_geo(self) -> dict:
        try:
            return await self._llamar("GET", "/geo")
        except ConectorError as e:
            if "no tiene instalado" in str(e):
                raise ConectorError("El conector de esta web es de una versión anterior: descarga la nueva desde el panel e instálala encima")
            raise

    async def escribir_geo(self, datos: dict) -> dict:
        return await self._llamar("POST", "/geo", json=datos)

    async def bd_esquema(self) -> list[dict]:
        return await self._llamar("GET", "/bd/esquema")

    async def bd_transaccion(self, sentencias: list[dict], solo_lectura: bool, limite: int) -> list[dict]:
        return await self._llamar("POST", "/bd/transaccion", json={
            "sentencias": sentencias, "solo_lectura": solo_lectura, "limite": limite})

    async def _llamar_largo(self, metodo: str, ruta: str, json: dict | None = None):
        """Copias, restauraciones y actualizaciones pueden tardar minutos."""
        return await self._llamar(metodo, ruta, json=json, timeout=TIMEOUT_LARGO)

    async def descargar_copia(self, nombre: str, destino: str) -> int:
        """Baja la copia a un archivo local (temporal) sin cargarla en memoria."""
        await asyncio.to_thread(_comprobar_destino_publico, self.wp.url)
        url, extra = self.wp._destino(f"/multiplika/v1/copias/{_nombre_valido(nombre)}/descargar")
        total = 0
        async with httpx.AsyncClient(timeout=TIMEOUT_LARGO, follow_redirects=True, auth=self.wp._auth) as c:
            async with c.stream("GET", url, params=extra) as r:
                if r.status_code != 200 or not r.headers.get("content-type", "").startswith("application/zip"):
                    raise ConectorError(f"No se ha podido descargar la copia (código {r.status_code})")
                with open(destino, "wb") as f:
                    async for bloque in r.aiter_bytes(1024 * 1024):
                        f.write(bloque)
                        total += len(bloque)
        return total


def _nombre_valido(nombre: str) -> str:
    if not PATRON_COPIA.match(nombre or ""):
        raise ConectorError("Nombre de copia no válido")
    return nombre


# --- Destino remoto por SFTP (servidor del cliente) ---

async def datos_sftp(config: dict, nombre_credencial: str) -> dict:
    """Credencial con usuario + contraseña (o el campo extra «clave_privada»)
    y campos extra «host» y, opcional, «puerto»."""
    credenciales = CredencialesCRUD(config)
    credencial = await credenciales.obtener_por_nombre(nombre_credencial)
    if not credencial:
        raise ConectorError(f"No existe la credencial «{nombre_credencial}» del servidor de copias")
    extra = await CredencialesCamposCRUD(config).valores_descifrados(credencial["id"])
    host = extra.get("host") or extra.get("servidor")
    if not host or not credencial["usuario"]:
        raise ConectorError(f"La credencial «{nombre_credencial}» necesita usuario y un campo «host» con el servidor")
    return {"host": host, "puerto": int(extra.get("puerto") or 22), "usuario": credencial["usuario"],
            "contrasena": await credenciales.valor_descifrado(credencial["id"]), "clave_privada": extra.get("clave_privada")}


def _conectar_sftp(d: dict) -> tuple[paramiko.SSHClient, paramiko.SFTPClient]:
    _comprobar_destino_publico(f"sftp://{d['host']}")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    clave = None
    if d.get("clave_privada"):
        clave = paramiko.PKey.from_private_key(io.StringIO(d["clave_privada"]))
    ssh.connect(d["host"], port=d["puerto"], username=d["usuario"], password=None if clave else d["contrasena"],
                pkey=clave, timeout=30, allow_agent=False, look_for_keys=False)
    return ssh, ssh.open_sftp()


def _asegurar_carpeta(sftp: paramiko.SFTPClient, ruta: str) -> None:
    actual = ""
    for parte in [p for p in ruta.split("/") if p]:
        actual = f"{actual}/{parte}" if (actual or ruta.startswith("/")) else parte
        try:
            sftp.stat(actual)
        except FileNotFoundError:
            sftp.mkdir(actual)


def _subir_y_podar(d: dict, local: str, carpeta: str, nombre: str, conservar: int) -> dict:
    ssh, sftp = _conectar_sftp(d)
    try:
        _asegurar_carpeta(sftp, carpeta)
        sftp.put(local, f"{carpeta.rstrip('/')}/{nombre}")
        copias = sorted(f for f in sftp.listdir(carpeta) if PATRON_COPIA.match(f))
        borradas = []
        for viejo in copias[: max(0, len(copias) - conservar)]:
            sftp.remove(f"{carpeta.rstrip('/')}/{viejo}")
            borradas.append(viejo)
        try:
            libre = sftp.statvfs(carpeta)
            espacio = libre.f_bavail * libre.f_frsize
        except (IOError, AttributeError):
            espacio = None
        return {"subida": nombre, "borradas": borradas, "en_remoto": len(copias) - len(borradas), "espacio_libre": espacio}
    finally:
        sftp.close()
        ssh.close()


def _listar_remoto(d: dict, carpeta: str) -> list[dict]:
    ssh, sftp = _conectar_sftp(d)
    try:
        try:
            entradas = sftp.listdir_attr(carpeta)
        except FileNotFoundError:
            return []
        return sorted(({"nombre": e.filename, "tamano": e.st_size, "fecha": e.st_mtime}
                       for e in entradas if PATRON_COPIA.match(e.filename) and stat.S_ISREG(e.st_mode)),
                      key=lambda x: x["nombre"], reverse=True)
    finally:
        sftp.close()
        ssh.close()


async def listar_remoto(config: dict, nombre_credencial: str, carpeta: str) -> list[dict]:
    return await asyncio.to_thread(_listar_remoto, await datos_sftp(config, nombre_credencial), carpeta)


async def copiar_a_remoto(config: dict, conector: ClienteConector, nombre: str, nombre_credencial: str,
                          carpeta: str, conservar: int) -> dict:
    d = await datos_sftp(config, nombre_credencial)
    fd, temporal = tempfile.mkstemp(prefix="gd-copia-", suffix=".zip")
    os.close(fd)
    try:
        await conector.descargar_copia(nombre, temporal)
        return await asyncio.to_thread(_subir_y_podar, d, temporal, carpeta, nombre, conservar)
    except (paramiko.SSHException, OSError) as e:
        raise ConectorError(f"No se ha podido subir la copia al servidor remoto: {e}")
    finally:
        os.unlink(temporal)
