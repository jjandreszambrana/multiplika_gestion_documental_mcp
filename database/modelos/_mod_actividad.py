"""CRUD de gd_actividad — ver docs/gestion-documental.md → "Registro de
actividad". Lo usan los dos sitios que apuntan (el middleware MCP de
mcp_server/herramientas/_herr_actividad.py y el del panel,
panel_cliente/actividad_panel.py) y los que lo consultan.

Apuntar nunca debe tumbar la acción que se está apuntando: si falla, se
avisa por la salida del proceso y se sigue (ver `registrar_sin_fallar`)."""

import json
import re

from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_actividad import TABLA_ACTIVIDAD

# El chat del panel llama al MCP con una key interna (nombre "Chat interno
# (operador)"/"(invitado)", ver panel_cliente/chat_ia.py) y manda en esta
# cabecera qué usuario está chateando, para apuntarle a él y no a la key.
CABECERA_USUARIO_CHAT = "x-gd-id-usuario"
PREFIJO_KEY_CHAT_INTERNO = "Chat interno"

# tipo_objeto -> (tabla, columna con el nombre legible)
NOMBRE_POR_TIPO = {
    "documento": ("gd_documentos", "nombre"),
    "documento_pendiente": ("gd_documentos_pendientes", "nombre_original"),
    "entidad": ("gd_entidades", "nombre"),
    "grupo": ("gd_grupos", "nombre"),
    "script": ("gd_scripts", "titulo"),
    "regla": ("gd_reglas", "nombre"),
    "modelo_registro": ("gd_modelos_registro", "titulo"),
    "estilo": ("gd_estilos", "nombre_tipo"),
    "credencial": ("gd_credenciales", "nombre"),
    "certificado": ("gd_certificados", "nombre"),
    "tipo_documento": ("gd_tipos_documento", "nombre"),
    "enlace": ("gd_enlaces", "nombre"),
    "envio": ("gd_envios", "asunto"),
    "compartido": ("gd_compartidos", "nombre_documento"),
    "nota": ("gd_notas", "texto"),
    "aprendizaje": ("gd_aprendizajes", "nombre"),
    "pregunta_pendiente": ("gd_preguntas_pendientes", "pregunta"),
    "programacion": ("gd_programaciones", "titulo"),
    "nota_bloc": ("gd_bloc_notas", "titulo"),
}

# Tipos que pueden ser privados: el registro lo ve todo el proyecto, así que
# solo se nombran si son de todos, y nunca se guarda su detalle (llevaría
# el texto). Ver docs/gestion-documental.md → "Bloc de notas".
TIPOS_PRIVADOS = {"nota_bloc"}

# Nunca se guarda el valor de un campo cuyo nombre encaje aquí: claves,
# contraseñas, tokens, archivos en base64...
_CAMPO_SENSIBLE = re.compile(r"api_key|password|contrasena|secret|token|clave|base64|cifrad|pem|p12", re.I)
_MAX_TEXTO = 300
_MAX_DETALLE = 4000
_MAX_NOMBRE = 120


def _recortar(texto: str, maximo: int) -> str:
    return texto if len(texto) <= maximo else texto[: maximo - 1] + "…"


def _limpiar(valor):
    if isinstance(valor, dict):
        return {k: ("(oculto)" if _CAMPO_SENSIBLE.search(k) else _limpiar(v)) for k, v in valor.items()}
    if isinstance(valor, list):
        return [_limpiar(v) for v in valor[:50]]
    if isinstance(valor, str):
        return _recortar(valor, _MAX_TEXTO)
    return valor


def limpiar_detalle(datos: dict | None) -> str | None:
    """JSON de los datos de la acción, sin secretos y con los textos
    largos recortados — para que el registro no sea otra copia de los
    datos privados."""
    if not datos:
        return None
    texto = json.dumps(_limpiar(datos), ensure_ascii=False, default=str)
    return _recortar(texto, _MAX_DETALLE)


async def nombre_objeto(config: dict, tipo: str | None, id_objeto: int | None) -> str | None:
    if tipo not in NOMBRE_POR_TIPO or not isinstance(id_objeto, int):
        return None
    tabla, columna = NOMBRE_POR_TIPO[tipo]
    solo_si_publico = " AND visibilidad = 'todos'" if tipo in TIPOS_PRIVADOS else ""
    filas = await AsyncDatabase(**config).query(
        f'SELECT "{columna}" AS nombre FROM "{tabla}" WHERE id = %s{solo_si_publico}', (id_objeto,)
    )
    if not filas or not filas[0]["nombre"]:
        return None
    return _recortar(" ".join(str(filas[0]["nombre"]).split()), _MAX_NOMBRE)


def componer_descripcion(verbo: str, nombre: str | None, id_objeto: int | None) -> str:
    if nombre:
        return f"{verbo} «{nombre}»"
    if id_objeto is not None:
        return f"{verbo} n.º {id_objeto}"
    return verbo


class ActividadCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_ACTIVIDAD, config)

    async def registrar(
        self, *, quien: str, origen: str, accion: str, descripcion: str,
        id_usuario: int | None = None, id_api_key: int | None = None,
        tipo_objeto: str | None = None, id_objeto: int | None = None,
        nombre_objeto: str | None = None, detalle: dict | None = None,
    ) -> int:
        return await self.insert({
            "quien": _recortar(quien, 150), "origen": origen, "accion": accion[:100],
            "descripcion": _recortar(descripcion, 500),
            "id_usuario": id_usuario, "id_api_key": id_api_key,
            "tipo_objeto": tipo_objeto, "id_objeto": id_objeto,
            "nombre_objeto": _recortar(nombre_objeto, 255) if nombre_objeto else None,
            "detalle": None if tipo_objeto in TIPOS_PRIVADOS else limpiar_detalle(detalle),
        })

    async def buscar(
        self, *, quien: str | None = None, origen: str | None = None, tipo_objeto: str | None = None,
        id_objeto: int | None = None, desde: str | None = None, hasta: str | None = None,
        q: str | None = None, limite: int = 50, offset: int = 0,
    ) -> tuple[list[dict], int]:
        """Más recientes primero. `hasta` incluye el día entero; `q` busca
        en la frase y en el nombre del elemento, sin distinguir mayúsculas."""
        condiciones, params = [], []
        for campo, valor in (("quien", quien), ("origen", origen), ("tipo_objeto", tipo_objeto), ("id_objeto", id_objeto)):
            if valor is not None and valor != "":
                condiciones.append(f"{campo} = %s")
                params.append(valor)
        if desde:
            condiciones.append("fecha >= %s::date")
            params.append(desde)
        if hasta:
            condiciones.append("fecha < %s::date + 1")
            params.append(hasta)
        if q:
            condiciones.append("(descripcion ILIKE %s OR nombre_objeto ILIKE %s)")
            params += [f"%{q}%", f"%{q}%"]
        where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""

        db = AsyncDatabase(**self.config)
        tabla = TABLA_ACTIVIDAD.nombre
        total = (await db.query(f'SELECT COUNT(*) AS n FROM "{tabla}" {where}', tuple(params)))[0]["n"]
        filas = await db.query(
            f'SELECT * FROM "{tabla}" {where} ORDER BY fecha DESC, id DESC LIMIT %s OFFSET %s',
            (*params, limite, offset),
        )
        return filas, total

    async def quienes(self) -> list[str]:
        """Nombres distintos que aparecen en el registro — para el filtro
        por persona del panel."""
        filas = await AsyncDatabase(**self.config).query(
            f'SELECT DISTINCT quien FROM "{TABLA_ACTIVIDAD.nombre}" ORDER BY quien', (),
        )
        return [f["quien"] for f in filas]


async def registrar_sin_fallar(config: dict, **campos) -> None:
    try:
        await ActividadCRUD(config).registrar(**campos)
    except Exception as error:  # el apunte nunca debe tumbar la acción ya hecha
        print(f"[actividad] no se pudo apuntar {campos.get('accion')}: {error!r}")
