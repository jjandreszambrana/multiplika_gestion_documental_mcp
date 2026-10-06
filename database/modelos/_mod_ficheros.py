"""Webs hechas a medida (fase 6 de webs y redes): leer y cambiar sus archivos
— ver docs/gestion-documental.md → "Webs y redes sociales". Dos formas
(modo_conexion del activo):

- sftp: directamente en el servidor. Credencial: usuario + contraseña (o el
  campo «clave_privada») y campos «host», «puerto» y «ruta_web» (la carpeta
  de la web en el servidor).
- git: en el repositorio de la web; cada cambio es un commit (y lo publica el
  sistema de despliegue de la web, si lo tiene). Credencial: el token de
  acceso en el valor y campos «repositorio» (dirección https), «rama» (main
  por defecto) y, si la web está en una subcarpeta, «carpeta_web».

Solo archivos de texto de hasta 1 MB y siempre dentro de la carpeta de la
web: una ruta que intente salir de ella se rechaza. Los cambios van por el
sistema de propuestas (fichero_editar), con vista previa y deshacer."""

import asyncio
import os
import posixpath
import shutil
import stat
import tempfile
from urllib.parse import quote, urlparse

import paramiko

from ._mod_conector import _conectar_sftp
from ._mod_credenciales import CredencialesCRUD
from ._mod_credenciales_campos import CredencialesCamposCRUD
from ._mod_wordpress import _comprobar_destino_publico

TAMANO_MAXIMO = 1024 * 1024


class FicherosError(Exception):
    pass


def ruta_segura(ruta: str) -> str:
    """Ruta relativa a la carpeta de la web, sin poder salir de ella."""
    limpia = posixpath.normpath("/" + (ruta or "").strip().lstrip("/")).lstrip("/")
    if limpia.startswith("..") or "\x00" in limpia:
        raise FicherosError("Ruta no válida")
    return limpia or "."


def _texto(contenido: bytes, ruta: str) -> str:
    if len(contenido) > TAMANO_MAXIMO:
        raise FicherosError(f"«{ruta}» ocupa más de 1 MB: no se edita desde aquí")
    try:
        return contenido.decode("utf-8")
    except UnicodeDecodeError:
        raise FicherosError(f"«{ruta}» no es un archivo de texto")


class ClienteSftp:
    def __init__(self, datos: dict, raiz: str):
        self.datos, self.raiz = datos, raiz.rstrip("/") or "."

    def _abs(self, ruta: str) -> str:
        r = ruta_segura(ruta)
        return self.raiz if r == "." else f"{self.raiz}/{r}"

    def _con(self, fn):
        try:
            ssh, sftp = _conectar_sftp(self.datos)
        except (paramiko.SSHException, OSError) as e:
            raise FicherosError(f"No se puede entrar por SFTP: {e}")
        try:
            return fn(sftp)
        except FileNotFoundError:
            raise FicherosError("No existe ese archivo o carpeta")
        except (IOError, OSError) as e:
            raise FicherosError(f"Error de SFTP: {e}")
        finally:
            sftp.close()
            ssh.close()

    def listar(self, ruta: str = ".") -> list[dict]:
        return self._con(lambda s: sorted(
            ({"nombre": e.filename, "carpeta": stat.S_ISDIR(e.st_mode), "tamano": e.st_size} for e in s.listdir_attr(self._abs(ruta))),
            key=lambda x: (not x["carpeta"], x["nombre"])))

    def leer(self, ruta: str) -> str | None:
        def f(s):
            try:
                with s.open(self._abs(ruta), "rb") as a:
                    return _texto(a.read(TAMANO_MAXIMO + 1), ruta)
            except FileNotFoundError:
                return None
        return self._con(f)

    def escribir(self, ruta: str, contenido: str, mensaje: str) -> None:
        def f(s):
            with s.open(self._abs(ruta), "wb") as a:
                a.write(contenido.encode("utf-8"))
        self._con(f)

    def borrar(self, ruta: str, mensaje: str) -> None:
        self._con(lambda s: s.remove(self._abs(ruta)))


class ClienteGit:
    """Cada operación trabaja sobre un clon temporal de la rama, que se borra al acabar."""

    def __init__(self, repositorio: str, token: str | None, rama: str, carpeta: str):
        self.repositorio, self.token, self.rama, self.carpeta = repositorio, token, rama, ruta_segura(carpeta or ".")

    def _url(self) -> str:
        p = urlparse(self.repositorio)
        if p.scheme == "https" and self.token:
            return p._replace(netloc=f"x-access-token:{quote(self.token, safe='')}@{p.hostname}{f':{p.port}' if p.port else ''}").geturl()
        return self.repositorio

    async def _git(self, *args, cwd: str | None = None) -> str:
        proceso = await asyncio.create_subprocess_exec(
            "git", *args, cwd=cwd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            env={**os.environ, "GIT_TERMINAL_PROMPT": "0"})
        salida, error = await asyncio.wait_for(proceso.communicate(), 300)
        if proceso.returncode != 0:
            texto = (error or salida).decode(errors="replace")
            if self.token:
                texto = texto.replace(self.token, "***")
            raise FicherosError(f"Git ha fallado: {texto.strip()[:300]}")
        return salida.decode(errors="replace")

    async def _clon(self) -> str:
        if urlparse(self.repositorio).scheme == "https":
            await asyncio.to_thread(_comprobar_destino_publico, self.repositorio)
        carpeta = tempfile.mkdtemp(prefix="gd-git-")
        await self._git("clone", "--depth", "1", "--branch", self.rama, self._url(), carpeta)
        return carpeta

    def _abs(self, clon: str, ruta: str) -> str:
        r = posixpath.normpath(posixpath.join(self.carpeta, ruta_segura(ruta)))
        return os.path.join(clon, r)

    async def listar(self, ruta: str = ".") -> list[dict]:
        clon = await self._clon()
        try:
            base = self._abs(clon, ruta)
            if not os.path.isdir(base):
                raise FicherosError("No existe esa carpeta")
            return sorted(({"nombre": n, "carpeta": os.path.isdir(os.path.join(base, n)), "tamano": os.path.getsize(os.path.join(base, n))}
                           for n in os.listdir(base) if n != ".git"), key=lambda x: (not x["carpeta"], x["nombre"]))
        finally:
            shutil.rmtree(clon, ignore_errors=True)

    async def leer(self, ruta: str) -> str | None:
        clon = await self._clon()
        try:
            destino = self._abs(clon, ruta)
            if not os.path.isfile(destino):
                return None
            with open(destino, "rb") as a:
                return _texto(a.read(TAMANO_MAXIMO + 1), ruta)
        finally:
            shutil.rmtree(clon, ignore_errors=True)

    async def _cambiar(self, ruta: str, contenido: str | None, mensaje: str) -> None:
        clon = await self._clon()
        try:
            destino = self._abs(clon, ruta)
            if contenido is None:
                os.remove(destino)
            else:
                os.makedirs(os.path.dirname(destino), exist_ok=True)
                with open(destino, "w", encoding="utf-8", newline="") as a:
                    a.write(contenido)
            await self._git("add", "-A", cwd=clon)
            await self._git("-c", "user.name=Gestión documental Multiplika", "-c", "user.email=gd@multiplika.net",
                            "commit", "-m", mensaje[:200], cwd=clon)
            await self._git("push", "origin", self.rama, cwd=clon)
        finally:
            shutil.rmtree(clon, ignore_errors=True)

    async def escribir(self, ruta: str, contenido: str, mensaje: str) -> None:
        await self._cambiar(ruta, contenido, mensaje)

    async def borrar(self, ruta: str, mensaje: str) -> None:
        await self._cambiar(ruta, None, mensaje)


class Ficheros:
    """Misma interfaz async para los dos (SFTP es síncrono por debajo)."""

    def __init__(self, cliente):
        self.cliente = cliente

    async def _hacer(self, metodo: str, *args):
        f = getattr(self.cliente, metodo)
        return await f(*args) if isinstance(self.cliente, ClienteGit) else await asyncio.to_thread(f, *args)

    async def listar(self, ruta: str = ".") -> list[dict]:
        return await self._hacer("listar", ruta)

    async def leer(self, ruta: str) -> str | None:
        return await self._hacer("leer", ruta)

    async def escribir(self, ruta: str, contenido: str, mensaje: str) -> None:
        await self._hacer("escribir", ruta, contenido, mensaje)

    async def borrar(self, ruta: str, mensaje: str) -> None:
        await self._hacer("borrar", ruta, mensaje)


async def ficheros_de(config: dict, activo: dict) -> Ficheros:
    if not activo["id_credencial"]:
        raise FicherosError("Falta la credencial de acceso a los archivos de la web")
    credenciales = CredencialesCRUD(config)
    credencial = await credenciales.obtener(activo["id_credencial"])
    if not credencial:
        raise FicherosError("La credencial elegida ya no existe")
    valor = await credenciales.valor_descifrado(credencial["id"])
    extra = await CredencialesCamposCRUD(config).valores_descifrados(credencial["id"])
    if (activo.get("modo_conexion") or "sftp") == "git":
        if not extra.get("repositorio"):
            raise FicherosError("Falta en la credencial el campo «repositorio» (dirección https del repositorio)")
        return Ficheros(ClienteGit(extra["repositorio"], valor, extra.get("rama") or "main", extra.get("carpeta_web") or ""))
    if not extra.get("host") or not credencial["usuario"]:
        raise FicherosError("La credencial SFTP necesita usuario y los campos «host» y «ruta_web»")
    datos = {"host": extra["host"], "puerto": int(extra.get("puerto") or 22), "usuario": credencial["usuario"],
             "contrasena": valor, "clave_privada": extra.get("clave_privada")}
    return Ficheros(ClienteSftp(datos, extra.get("ruta_web") or "."))
