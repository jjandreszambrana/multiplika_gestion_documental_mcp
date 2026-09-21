"""CRUD de gd_credenciales_campos — campos secretos adicionales de una
credencial (OAuth con varios secretos a la vez), ver
_mod_credenciales.py. Mismo mecanismo de cifrado que la tabla padre."""

from mtpk_postgres import AsyncCrudBase
from lib.cifrado import cifrar, descifrar

from ..dependencias._dep_credenciales_campos import TABLA_CREDENCIALES_CAMPOS


class CredencialesCamposCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_CREDENCIALES_CAMPOS, config)

    async def listar_nombres(self, id_credencial: int) -> list[str]:
        """Solo los nombres — igual que gd_credenciales.valor_cifrado, el
        valor de un campo extra nunca se expone a la IA ni al listado del panel."""
        filas, _ = await self.listar(
            filtros={"id_credencial": {"op": "=", "valor": id_credencial}}, limit=200, orden="id ASC",
        )
        return [fila["nombre"] for fila in filas]

    async def reemplazar(self, id_credencial: int, campos: list[dict]) -> None:
        """Sustituye todos los campos extra de la credencial por `campos`
        ([{"nombre": ..., "valor": ...}, ...]) — más simple que un diff
        campo a campo, y es como los envía el panel (todo el bloque
        "Avanzado" junto) tanto al crear como al editar."""
        existentes, _ = await self.listar(
            filtros={"id_credencial": {"op": "=", "valor": id_credencial}}, limit=200,
        )
        for fila in existentes:
            await self.eliminar(fila["id"])
        for campo in campos:
            if not campo.get("nombre") or not campo.get("valor"):
                continue
            await self.insert({
                "id_credencial": id_credencial,
                "nombre": campo["nombre"],
                "valor_cifrado": cifrar(campo["valor"]),
            })

    async def valor_descifrado(self, id_campo: int) -> str | None:
        """Solo para uso interno del backend, igual que
        CredencialesCRUD.valor_descifrado — nunca se expone tal cual."""
        fila = await self.obtener(id_campo)
        return descifrar(fila["valor_cifrado"]) if fila else None
