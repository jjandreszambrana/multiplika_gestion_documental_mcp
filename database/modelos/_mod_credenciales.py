"""CRUD de gd_credenciales — el valor cifrado nunca sale de aquí hacia la
IA (ver mcp_server/herramientas/_herr_credenciales.py, que solo expone
listar_metadatos()). El cifrado usa lib.cifrado del repo core (import
absoluto, mismo mecanismo que database.config_db — ver guia_nuevo_proyecto.md)."""

from mtpk_postgres import AsyncCrudBase
from lib.cifrado import cifrar, descifrar

from ..dependencias._dep_credenciales import TABLA_CREDENCIALES


class CredencialesCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_CREDENCIALES, config)

    async def listar_metadatos(self) -> list[dict]:
        """nombre + descripción + fecha de cada credencial — nunca el valor."""
        filas, _ = await self.listar(limit=200, orden="nombre ASC")
        return [{k: v for k, v in fila.items() if k != "valor_cifrado"} for fila in filas]

    async def obtener_por_nombre(self, nombre: str) -> dict | None:
        filas, _ = await self.listar(filtros={"nombre": {"op": "=", "valor": nombre}}, limit=1)
        return filas[0] if filas else None

    async def crear(self, nombre: str, descripcion: str, valor: str) -> int:
        return await self.insert({
            "nombre": nombre,
            "descripcion": descripcion,
            "valor_cifrado": cifrar(valor),
        })

    async def actualizar(self, id_credencial: int, descripcion: str | None, valor: str | None) -> None:
        cambios = {}
        if descripcion is not None:
            cambios["descripcion"] = descripcion
        if valor is not None:
            cambios["valor_cifrado"] = cifrar(valor)
        if cambios:
            await self.update(id_credencial, cambios)

    async def valor_descifrado(self, id_credencial: int) -> str | None:
        """Solo para uso interno del backend (p.ej. una futura herramienta
        que se conecte de verdad a un servicio) — nunca se expone tal cual
        por una API ni una tool MCP."""
        fila = await self.obtener(id_credencial)
        return descifrar(fila["valor_cifrado"]) if fila else None
