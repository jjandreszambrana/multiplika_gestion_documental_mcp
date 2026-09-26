"""CRUD de gd_tipos_documento — catálogo abierto, no una lista cerrada (ver
docs/gestion-documental.md → "Tipos de documento configurables")."""

import unicodedata

from mtpk_postgres import AsyncCrudBase

from ..dependencias._dep_tipos_documento import TABLA_TIPOS_DOCUMENTO


def _normalizar_tipo(nombre: str) -> str:
    """Forma comparable de un nombre de tipo: sin mayúsculas, sin tildes y
    en singular (heurística simple, no un lematizador) — para que
    "Procedimientos" y "procedimiento" cuenten como el mismo tipo."""
    sin_acentos = "".join(
        c for c in unicodedata.normalize("NFKD", nombre.strip().lower()) if not unicodedata.combining(c)
    )
    if sin_acentos.endswith("es") and len(sin_acentos) > 3:
        return sin_acentos[:-2]
    if sin_acentos.endswith("s") and len(sin_acentos) > 2:
        return sin_acentos[:-1]
    return sin_acentos


class TiposDocumentoCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_TIPOS_DOCUMENTO, config)

    async def listar_nombres(self) -> list[dict]:
        filas, _ = await self.listar(limit=200, orden="nombre ASC")
        return filas

    async def crear(self, nombre: str) -> int:
        return await self.insert({"nombre": nombre})

    async def obtener_por_nombre(self, nombre: str) -> dict | None:
        filas, _ = await self.listar(filtros={"nombre": {"op": "=", "valor": nombre}}, limit=1)
        return filas[0] if filas else None

    async def actualizar_requisitos(
        self, id_tipo: int, formato_requerido: str | None, normativa_aplicable: str | None
    ) -> None:
        await self.update(id_tipo, {"formato_requerido": formato_requerido, "normativa_aplicable": normativa_aplicable})

    async def asegurar_existe(self, nombre: str) -> None:
        """Si el tipo no está todavía en el catálogo, lo añade — así se va
        completando solo con el uso, sin que nadie tenga que darlo de alta
        a mano antes de poder usarlo (ver actualizar_metadatos_documento en
        panel_cliente/servidor.py)."""
        filas, _ = await self.listar(filtros={"nombre": {"op": "=", "valor": nombre}}, limit=1)
        if not filas:
            await self.crear(nombre)

    async def resolver_o_crear(self, nombre: str) -> str:
        """Como asegurar_existe, pero antes de crear un tipo nuevo lo
        compara (sin distinguir mayúsculas, tildes ni singular/plural) con
        los ya existentes: si alguno equivale, se reutiliza su nombre tal
        cual está guardado en vez de dar de alta un duplicado por una
        simple variación de escritura (ver guardar_documento en
        _mod_versiones.py, que llama a esto al crear un documento)."""
        existentes = await self.listar_nombres()
        objetivo = _normalizar_tipo(nombre)
        for existente in existentes:
            if _normalizar_tipo(existente["nombre"]) == objetivo:
                return existente["nombre"]
        await self.crear(nombre)
        return nombre
