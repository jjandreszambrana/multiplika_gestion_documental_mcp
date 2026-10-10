"""CRUD de gd_credenciales — el valor cifrado nunca sale de aquí hacia la
IA (ver mcp_server/herramientas/_herr_credenciales.py, que solo expone
listar_metadatos()). El cifrado usa lib.cifrado del repo core (import
absoluto, mismo mecanismo que database.config_db — ver guia_nuevo_proyecto.md)."""

from mtpk_postgres import AsyncCrudBase
from lib.cifrado import cifrar, descifrar

from ..dependencias._dep_credenciales import TABLA_CREDENCIALES
from ._mod_credenciales_campos import CredencialesCamposCRUD


# La contraseña con la que se cifran las copias de seguridad de la base
# (ver _mod_copias_bd.py). Vive aquí, en el almacén cifrado, pero apartada:
# ninguna otra función que busque credenciales por nombre (conexiones a
# webs, bases de datos, SFTP... que la IA puede configurar contra cualquier
# servidor) la encuentra, y nadie más puede crear una con ese nombre.
NOMBRE_CREDENCIAL_COPIAS_BD = "Contraseña de las copias de seguridad"
# Igual de apartada: la clave con la que la GD entra en la contabilidad del
# SIF (ver _mod_contabilidad_sif.py) — en una asesoría llega a todas sus
# empresas, así que no se presta a ninguna otra función.
NOMBRE_CREDENCIAL_CONTABILIDAD_GD = "Acceso de la GD a la contabilidad del SIF"
NOMBRES_RESERVADOS = {NOMBRE_CREDENCIAL_COPIAS_BD, NOMBRE_CREDENCIAL_CONTABILIDAD_GD}


class CredencialesCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_CREDENCIALES, config)

    async def listar_metadatos(self) -> list[dict]:
        """nombre + descripción + fecha de cada credencial — nunca el valor.
        `campos_extra` trae solo los NOMBRES de sus campos avanzados
        (Application Key, Consumer Secret...), nunca sus valores."""
        filas, _ = await self.listar(
            filtros={"id_usuario_dueno": {"op": "=", "valor": None}}, limit=200, orden="nombre ASC",
        )
        campos = CredencialesCamposCRUD(self.config)
        return [
            {**{k: v for k, v in fila.items() if k != "valor_cifrado"}, "campos_extra": await campos.listar_nombres(fila["id"])}
            for fila in filas
        ]

    async def obtener_por_nombre(self, nombre: str, permitir_reservada: bool = False) -> dict | None:
        if nombre in NOMBRES_RESERVADOS and not permitir_reservada:
            return None
        filas, _ = await self.listar(filtros={"nombre": {"op": "=", "valor": nombre}}, limit=1)
        return filas[0] if filas and not filas[0].get("id_usuario_dueno") else None

    async def obtener_del_proyecto(self, id_credencial: int) -> dict | None:
        """Como obtener(), pero una credencial privada de un usuario no existe."""
        fila = await self.obtener(id_credencial)
        return fila if fila and not fila.get("id_usuario_dueno") else None

    async def crear(
        self, nombre: str, descripcion: str, valor: str, usuario: str | None = None,
        campos_extra: list[dict] | None = None, permitir_reservada: bool = False,
        id_usuario_dueno: int | None = None,
    ) -> int:
        if nombre in NOMBRES_RESERVADOS and not permitir_reservada:
            raise ValueError(f"«{nombre}» es un nombre reservado: se pone desde la pantalla de copias de seguridad")
        id_credencial = await self.insert({
            "nombre": nombre,
            "descripcion": descripcion,
            "usuario": usuario,
            "valor_cifrado": cifrar(valor),
            "id_usuario_dueno": id_usuario_dueno,
        })
        if campos_extra:
            await CredencialesCamposCRUD(self.config).reemplazar(id_credencial, campos_extra)
        return id_credencial

    async def actualizar(
        self, id_credencial: int, descripcion: str | None, valor: str | None, usuario: str | None = None,
        campos_extra: list[dict] | None = None,
    ) -> None:
        cambios = {}
        if descripcion is not None:
            cambios["descripcion"] = descripcion
        if usuario is not None:
            cambios["usuario"] = usuario
        if valor is not None:
            cambios["valor_cifrado"] = cifrar(valor)
        if cambios:
            await self.update(id_credencial, cambios)
        if campos_extra is not None:
            await CredencialesCamposCRUD(self.config).reemplazar(id_credencial, campos_extra)

    async def valor_descifrado(self, id_credencial: int) -> str | None:
        """Solo para uso interno del backend (p.ej. una futura herramienta
        que se conecte de verdad a un servicio) — nunca se expone tal cual
        por una API ni una tool MCP."""
        fila = await self.obtener(id_credencial)
        return descifrar(fila["valor_cifrado"]) if fila else None
