"""Inventario de webs, bases de datos y redes sociales (gd_activos_digitales)
— ver docs/gestion-documental.md → "Webs y redes sociales". Lo usan igual
las herramientas MCP y el panel: las reglas (qué nivel de permiso puede
cambiar quién, qué ajustes existen) viven aquí y no en cada vía.

Errores de uso → ValueError con el mensaje para el usuario; cada vía lo
convierte en lo suyo (ToolError, HTTP 400)."""

import json
from datetime import datetime

from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_activos_digitales import (
    NIVELES_PERMISO,
    PLATAFORMAS,
    CAPACIDAD_POR_PLATAFORMA,
    TABLA_ACTIVOS,
    TIPOS_ACTIVO,
)
from ._mod_conector import ClienteConector, ConectorError
from ._mod_credenciales import CredencialesCRUD
from ._mod_entidades import EntidadesCRUD
from ._mod_wordpress import ClienteWordPress, WordPressError

# Ajustes que el cliente elige por cada activo. Solo están los que ya
# hacen algo (así nunca se enseña un interruptor que no hace nada).
# `tipo`: numero, si_no, opcion (con `opciones`), texto o credencial (el
# nombre de una credencial de la GD). `necesita_conector`: solo tiene efecto
# con el conector de Multiplika instalado en la web.
AJUSTES = {
    "caducidad_propuestas_dias": {
        "tipo": "numero", "titulo": "Días que vale una propuesta",
        "descripcion": "Una propuesta sin aprobar en este plazo caduca y hay que volver a pedirla, "
                       "porque la web puede haber cambiado entretanto.",
        "defecto": 7, "minimo": 1, "maximo": 90,
    },
    "conservar_detalle_cambios_dias": {
        "tipo": "numero", "titulo": "Días que se guarda la copia de cada cambio",
        "descripcion": "Pasado este plazo se borra la copia de lo que había antes y de lo que se puso "
                       "(puede llevar datos personales, p.ej. el autor de un comentario) y el cambio "
                       "ya no se puede deshacer. El resumen del cambio se conserva.",
        "defecto": 365, "minimo": 7, "maximo": 3650,
    },
    "conservar_resultados_dias": {
        "para": "web", "tipo": "numero", "titulo": "Días que se guarda el histórico de la vigilancia",
        "descripcion": "Resultados de las comprobaciones (si la web respondía, el certificado...). No lleva "
                       "datos personales; sirve para ver la evolución.",
        "defecto": 365, "minimo": 30, "maximo": 3650,
    },
    "copias_hacer": {
        "para": "wordpress", "tipo": "si_no", "titulo": "Hacer copias de seguridad", "necesita_conector": True,
        "descripcion": "La gestión documental hace copias completas (base de datos y archivos) cada cierto tiempo, "
                       "y siempre antes de actualizar o restaurar. Se guardan en el espacio del cliente, nunca en "
                       "servidores de Multiplika.",
        "defecto": False,
    },
    "copias_cada_horas": {
        "para": "wordpress", "tipo": "numero", "titulo": "Cada cuántas horas se hace una copia", "necesita_conector": True,
        "descripcion": "24 = una al día.", "defecto": 24, "minimo": 1, "maximo": 720,
    },
    "copias_conservar_servidor": {
        "para": "wordpress", "tipo": "numero", "titulo": "Copias que se guardan en el propio servidor de la web", "necesita_conector": True,
        "descripcion": "0 = ninguna (solo en el servidor remoto). Si el servidor se estropea o lo hackean, se pierden "
                       "la web y estas copias a la vez: conviene tener también un destino remoto.",
        "defecto": 7, "minimo": 0, "maximo": 90,
    },
    "copias_credencial_remota": {
        "para": "wordpress", "tipo": "credencial", "titulo": "Servidor remoto para las copias (SFTP)", "necesita_conector": True,
        "descripcion": "Credencial de la gestión documental con el acceso SFTP: usuario, contraseña (o un campo "
                       "«clave_privada») y un campo «host» (y «puerto» si no es el 22). Vacío = sin destino remoto.",
        "defecto": None,
    },
    "copias_carpeta_remota": {
        "para": "wordpress", "tipo": "texto", "titulo": "Carpeta del servidor remoto", "necesita_conector": True,
        "descripcion": "Dónde se dejan las copias en el servidor remoto.", "defecto": "copias-web",
    },
    "copias_conservar_remoto": {
        "para": "wordpress", "tipo": "numero", "titulo": "Copias que se guardan en el servidor remoto", "necesita_conector": True,
        "descripcion": "Las más antiguas se borran al subir una nueva.", "defecto": 14, "minimo": 1, "maximo": 365,
    },
    "copias_borrar_antigua_si_falta_espacio": {
        "para": "wordpress", "tipo": "si_no", "titulo": "Si falta espacio, borrar la copia más antigua del servidor", "necesita_conector": True,
        "descripcion": "Si no se permite y no cabe una copia nueva, no se hace y se avisa.", "defecto": True,
    },
    "actualizaciones": {
        "para": "wordpress", "tipo": "opcion", "titulo": "Actualizaciones de plugins y temas", "necesita_conector": True,
        "opciones": {"avisar": "Solo avisar", "automaticas": "Actualizar automáticamente"},
        "descripcion": "Automáticas: se hace una copia, se actualiza, se comprueba que la web sigue bien y, si no, "
                       "se vuelve a la copia y se avisa. Muchos hackeos entran por plugins sin actualizar, pero a "
                       "veces una actualización rompe algo.",
        "defecto": "avisar",
    },
    "cloudflare_credencial": {
        "para": "web", "tipo": "credencial", "titulo": "Cloudflare (escudo contra ataques)",
        "descripcion": "Credencial de la gestión documental con un token de API de Cloudflare (permiso de leer la zona y "
                       "editar sus ajustes). Con ella se vigila que el escudo esté bien puesto y se puede activar el modo "
                       "«estoy siendo atacado». Vacío = la web no usa Cloudflare.",
        "defecto": None,
    },
    "bd_max_filas": {
        "para": "bd", "tipo": "numero", "titulo": "Filas como máximo en cada cambio",
        "descripcion": "Un cambio en la base de datos que afecte a más filas no se propone (hay que hacerlo por partes). "
                       "Es un freno contra errores grandes.",
        "defecto": 100, "minimo": 1, "maximo": 10000,
    },
    "bd_credencial_ssh": {
        "para": "bd", "tipo": "credencial", "titulo": "Acceso SSH para el túnel",
        "descripcion": "Solo en modo «túnel SSH»: credencial con usuario, contraseña (o «clave_privada») y campos «host» "
                       "y «puerto» del servidor por el que se llega a la base de datos.",
        "defecto": None,
    },
    "bd_id_web": {
        "para": "bd", "tipo": "numero", "titulo": "Web WordPress (número) cuya base de datos es esta",
        "descripcion": "Solo en modo «a través del conector»: el número de la web WordPress (con el conector instalado) "
                       "en la lista de Webs y redes.",
        "defecto": None, "minimo": 1, "maximo": 1000000000,
    },
    "geo_marcas": {
        "para": "web", "tipo": "texto", "titulo": "Nombres con los que buscar la marca en las respuestas de las IAs",
        "descripcion": "Separados por comas (p. ej. «Laboratorios Pérez, LabPérez»). Vacío = el nombre de esta web en la lista.",
        "defecto": "",
    },
    "seo_propiedad_search_console": {
        "para": "web", "tipo": "texto", "titulo": "Propiedad de Google Search Console",
        "descripcion": "Vacío = se busca sola por la dirección de la web. Si tienes varias, pon la buena tal cual sale en "
                       "Search Console (p. ej. «sc-domain:miempresa.es» o «https://www.miempresa.es/»).",
        "defecto": None,
    },
    "seo_paginas_maximo": {
        "para": "web", "tipo": "numero", "titulo": "Páginas como máximo en cada auditoría SEO",
        "descripcion": "La auditoría recorre la web como Google; en webs muy grandes se para en este número.",
        "defecto": 200, "minimo": 10, "maximo": 2000,
    },
    "seo_informe_mensual": {
        "para": "web", "tipo": "si_no", "titulo": "Informe SEO mensual",
        "descripcion": "El día 1 de cada mes se guarda un informe del mes anterior como documento (tipo «Informe SEO»), "
                       "listo para sacar en PDF con tu estilo, y se avisa. Necesita Search Console.",
        "defecto": True,
    },
    "actualizaciones_excluir": {
        "para": "wordpress", "tipo": "texto", "titulo": "No actualizar automáticamente estos plugins o temas", "necesita_conector": True,
        "descripcion": "Nombres separados por comas (p. ej. «WooCommerce, Elementor»): de estos solo se avisa.",
        "defecto": "",
    },
}

_CAMPOS_EDITABLES = ["nombre", "tipo", "plataforma", "url", "descripcion", "id_credencial", "id_entidad",
                     "nivel_permiso", "estado", "archivado", "modo_conexion"]
# Formas de conectar según lo que es el activo
MODOS_CONEXION = {"bd": ["directo", "tunel_ssh", "conector"], "red": ["intermediario", "directo"],
                  "ficheros": ["sftp", "git"]}


def ajustes_efectivos(activo: dict) -> dict:
    """{clave: valor} de todos los ajustes, con el defecto donde el cliente
    no ha elegido nada."""
    guardados = json.loads(activo.get("ajustes") or "{}")
    return {clave: guardados.get(clave, d["defecto"]) for clave, d in AJUSTES.items()}


def catalogo_ajustes() -> list[dict]:
    return [{"clave": clave, **d} for clave, d in AJUSTES.items()]


def nivel_mayor(a: str, b: str) -> bool:
    return NIVELES_PERMISO.index(a) > NIVELES_PERMISO.index(b)


def capacidad(activo: dict) -> str | None:
    """wordpress, bd, red, ficheros o None (solo inventario)."""
    return CAPACIDAD_POR_PLATAFORMA.get(activo["plataforma"])


def es_wordpress(activo: dict) -> bool:
    return capacidad(activo) == "wordpress"


def ajustes_disponibles(activo: dict) -> list[str]:
    """Los ajustes que tienen sentido para este activo (ver `para` en AJUSTES):
    «todos», «web» (tiene dirección) o una capacidad."""
    tiene = {"todos", capacidad(activo)} | ({"web"} if activo.get("url") else set())
    return [clave for clave, d in AJUSTES.items() if d.get("para", "todos") in tiene]


def _url_normalizada(url: str | None) -> str | None:
    if not url:
        return None
    url = url.strip().rstrip("/")
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


class ActivosDigitalesCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_ACTIVOS, config)

    async def buscar(self, q: str | None = None, tipo: str | None = None, id_entidad: int | None = None,
                     incluir_archivados: bool = False) -> list[dict]:
        condiciones, params = [], []
        if q:
            condiciones.append("(a.nombre ILIKE %s OR a.url ILIKE %s OR a.descripcion ILIKE %s)")
            params += [f"%{q}%"] * 3
        if tipo:
            condiciones.append("a.tipo = %s")
            params.append(tipo)
        if id_entidad:
            condiciones.append("a.id_entidad = %s")
            params.append(id_entidad)
        if not incluir_archivados:
            condiciones.append("a.archivado = false")
        where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""
        sql = f"""
            SELECT a.*,
                   (SELECT count(*) FROM gd_cambios_externos c
                     WHERE c.id_activo = a.id AND c.estado = 'propuesto') AS propuestas_pendientes
            FROM "{TABLA_ACTIVOS.nombre}" a
            {where}
            ORDER BY a.archivado ASC, a.nombre ASC
        """
        filas = await AsyncDatabase(**self.config).query(sql, tuple(params))
        return [await self.con_nombres(f) for f in filas]

    async def con_nombres(self, activo: dict) -> dict:
        """El activo tal cual + nombre de su credencial y entidad + ajustes
        efectivos — lo que necesitan la IA y el panel para entenderlo."""
        credencial = await CredencialesCRUD(self.config).obtener(activo["id_credencial"]) if activo["id_credencial"] else None
        entidad = await EntidadesCRUD(self.config).obtener(activo["id_entidad"]) if activo["id_entidad"] else None
        salida = {k: v for k, v in activo.items() if k != "ajustes"}
        salida.update({
            "nombre_credencial": credencial["nombre"] if credencial else None,
            "nombre_entidad": entidad["nombre"] if entidad else None,
            "ajustes": ajustes_efectivos(activo),
            "conectable": capacidad(activo) is not None,
            "capacidad": capacidad(activo),
            "ajustes_disponibles": ajustes_disponibles(activo),
        })
        return salida

    async def obtener_o_error(self, id_activo: int) -> dict:
        activo = await self.obtener(id_activo)
        if not activo:
            raise ValueError(f"No existe ninguna web o cuenta con id {id_activo}")
        return activo

    async def _validar(self, datos: dict) -> dict:
        limpios = {k: v for k, v in datos.items() if k in _CAMPOS_EDITABLES and v is not None}
        if "tipo" in limpios and limpios["tipo"] not in TIPOS_ACTIVO:
            raise ValueError(f"Tipo no válido. Opciones: {', '.join(TIPOS_ACTIVO)}")
        if "plataforma" in limpios and limpios["plataforma"] not in PLATAFORMAS:
            raise ValueError(f"Plataforma no válida. Opciones: {', '.join(PLATAFORMAS)}")
        if "nivel_permiso" in limpios and limpios["nivel_permiso"] not in NIVELES_PERMISO:
            raise ValueError(f"Nivel de permiso no válido. Opciones: {', '.join(NIVELES_PERMISO)}")
        if "estado" in limpios and limpios["estado"] not in ("activo", "pausado"):
            raise ValueError("El estado solo se puede poner en activo o pausado")
        if "url" in limpios:
            limpios["url"] = _url_normalizada(limpios["url"])
        if "modo_conexion" in limpios:
            permitidos = MODOS_CONEXION.get(CAPACIDAD_POR_PLATAFORMA.get(limpios.get("plataforma") or ""), [])
            if limpios["modo_conexion"] not in permitidos:
                raise ValueError("Forma de conectar no válida" + (f". Opciones: {', '.join(permitidos)}" if permitidos else " para esta plataforma"))
        if limpios.get("id_credencial") and not await CredencialesCRUD(self.config).obtener(limpios["id_credencial"]):
            raise ValueError(f"No existe ninguna credencial con id {limpios['id_credencial']}")
        if limpios.get("id_entidad") and not await EntidadesCRUD(self.config).obtener(limpios["id_entidad"]):
            raise ValueError(f"No existe ninguna entidad con id {limpios['id_entidad']}")
        return limpios

    async def crear(self, datos: dict, nivel_maximo: str | None = None) -> dict:
        """`nivel_maximo`: desde la IA, un activo nuevo no puede nacer con
        más permiso que este (ver actualizar)."""
        limpios = await self._validar(datos)
        if not limpios.get("nombre") or not limpios.get("tipo") or not limpios.get("plataforma"):
            raise ValueError("Hacen falta al menos el nombre, el tipo y la plataforma")
        nivel = limpios.get("nivel_permiso", "lectura")
        if nivel_maximo and nivel_mayor(nivel, nivel_maximo):
            raise ValueError("Desde la IA un activo nuevo solo puede crearse en solo lectura; el permiso "
                             "se sube desde el panel de la gestión documental")
        id_activo = await self.insert(limpios)
        return await self.con_nombres(await self.obtener(id_activo))

    async def actualizar(self, id_activo: int, datos: dict, puede_subir_nivel: bool) -> dict:
        """`puede_subir_nivel`: solo el panel (un administrador) puede dar
        más permiso; la IA puede bajarlo, nunca subirlo — el freno lo pone
        el servidor, no las instrucciones a la IA."""
        actual = await self.obtener_o_error(id_activo)
        limpios = await self._validar({"plataforma": actual["plataforma"], **{k: v for k, v in datos.items() if v is not None}})
        if limpios.get("plataforma") == actual["plataforma"] and "plataforma" not in {k for k, v in datos.items() if v is not None}:
            limpios.pop("plataforma")
        nuevo_nivel = limpios.get("nivel_permiso")
        if nuevo_nivel and not puede_subir_nivel and nivel_mayor(nuevo_nivel, actual["nivel_permiso"]):
            raise ValueError("Desde la IA solo se puede bajar el nivel de permiso; para subirlo, un "
                             "administrador tiene que hacerlo desde el panel de la gestión documental")
        if limpios:
            await self.update(id_activo, limpios)
        return await self.con_nombres(await self.obtener(id_activo))

    async def actualizar_ajustes(self, id_activo: int, cambios: dict) -> dict:
        activo = await self.obtener_o_error(id_activo)
        guardados = json.loads(activo.get("ajustes") or "{}")
        for clave, valor in cambios.items():
            if clave not in AJUSTES:
                raise ValueError(f"No existe el ajuste «{clave}». Disponibles: {', '.join(AJUSTES)}")
            valor = await self._validar_ajuste(AJUSTES[clave], valor)
            if valor is None or valor == AJUSTES[clave]["defecto"]:
                guardados.pop(clave, None)
            else:
                guardados[clave] = valor
        await self.update(id_activo, {"ajustes": json.dumps(guardados) if guardados else None})
        return await self.con_nombres(await self.obtener(id_activo))

    async def _validar_ajuste(self, d: dict, valor):
        if valor is None or valor == "":
            return None
        if d["tipo"] == "numero":
            try:
                valor = int(valor)
            except (TypeError, ValueError):
                raise ValueError(f"«{d['titulo']}» tiene que ser un número")
            if not d["minimo"] <= valor <= d["maximo"]:
                raise ValueError(f"«{d['titulo']}» tiene que estar entre {d['minimo']} y {d['maximo']}")
        elif d["tipo"] == "si_no":
            if not isinstance(valor, bool):
                raise ValueError(f"«{d['titulo']}» tiene que ser sí o no (true/false)")
        elif d["tipo"] == "opcion":
            if valor not in d["opciones"]:
                raise ValueError(f"«{d['titulo']}»: opciones {', '.join(d['opciones'])}")
        elif d["tipo"] == "credencial":
            if not await CredencialesCRUD(self.config).obtener_por_nombre(str(valor)):
                raise ValueError(f"No existe ninguna credencial llamada «{valor}»")
        else:
            valor = str(valor).strip()[:500]
        return valor

    async def cliente_wordpress(self, activo: dict) -> ClienteWordPress:
        """Cliente listo para hablar con la web — la contraseña se descifra
        aquí dentro y nunca sale hacia la IA ni el panel."""
        if not es_wordpress(activo):
            raise ValueError(f"«{activo['nombre']}» no es una web WordPress ({activo['plataforma']}): esto solo vale para WordPress")
        if not activo["url"]:
            raise ValueError("Falta la dirección de la web")
        if not activo["id_credencial"]:
            raise ValueError("Falta elegir la credencial con el usuario y la contraseña de aplicación de WordPress")
        credenciales = CredencialesCRUD(self.config)
        credencial = await credenciales.obtener(activo["id_credencial"])
        if not credencial:
            raise ValueError("La credencial elegida ya no existe")
        if not credencial["usuario"]:
            raise ValueError(f"La credencial «{credencial['nombre']}» no tiene usuario: WordPress necesita el "
                             "usuario y la contraseña de aplicación")
        contrasena = await credenciales.valor_descifrado(credencial["id"])
        return ClienteWordPress(activo["url"], credencial["usuario"], contrasena)

    async def probar_conexion(self, id_activo: int) -> dict:
        activo = await self.obtener_o_error(id_activo)
        if capacidad(activo) == "ficheros":
            from ._mod_ficheros import FicherosError, ficheros_de  # aquí: ese módulo usa este
            try:
                entradas = await (await ficheros_de(self.config, activo)).listar(".")
            except FicherosError as e:
                await self.marcar_error(id_activo, str(e))
                return {"ok": False, "error": str(e)}
            await self.update(id_activo, {"ultimo_error": None, "fecha_ultima_conexion": datetime.now(),
                                          **({"estado": "activo"} if activo["estado"] == "error" else {})})
            return {"ok": True, "mensaje": f"Conectado: la carpeta de la web tiene {len(entradas)} elementos"}
        if capacidad(activo) == "red":
            from ._mod_redes import RedError, cliente_red  # aquí: ese módulo usa este
            try:
                mensaje = await (await cliente_red(self.config, activo)).comprobar()
            except RedError as e:
                await self.marcar_error(id_activo, str(e))
                return {"ok": False, "error": str(e)}
            await self.update(id_activo, {"ultimo_error": None, "fecha_ultima_conexion": datetime.now(),
                                          **({"estado": "activo"} if activo["estado"] == "error" else {})})
            return {"ok": True, "mensaje": mensaje}
        if capacidad(activo) == "bd":
            from ._mod_bases_datos import BaseDatosError, esquema  # aquí: ese módulo usa este
            try:
                tablas = await esquema(self.config, id_activo)
            except (ValueError, BaseDatosError) as e:
                await self.marcar_error(id_activo, str(e))
                return {"ok": False, "error": str(e)}
            await self.update(id_activo, {"ultimo_error": None, "fecha_ultima_conexion": datetime.now(),
                                          **({"estado": "activo"} if activo["estado"] == "error" else {})})
            return {"ok": True, "tablas": len(tablas)}
        try:
            cliente = await self.cliente_wordpress(activo)
            sitio = await cliente.sitio()
            yo = await cliente.yo()
        except (ValueError, WordPressError) as e:
            await self.update(id_activo, {"estado": "error", "ultimo_error": str(e),
                                          "fecha_ultima_conexion": datetime.now()})
            return {"ok": False, "error": str(e)}
        # ¿Tiene el conector de Multiplika? Solo lo ve un administrador.
        try:
            conector = await ClienteConector(cliente).estado()
        except ConectorError:
            conector = None
        cambios = {"ultimo_error": None, "fecha_ultima_conexion": datetime.now(), "conector_instalado": bool(conector)}
        if activo["estado"] == "error":
            cambios["estado"] = "activo"
        await self.update(id_activo, cambios)
        return {"ok": True, "sitio": sitio, "usuario": yo,
                "conector": {"version": conector["conector"], "wordpress": conector["wordpress"]} if conector else None}

    async def marcar_error(self, id_activo: int, error: str) -> None:
        await self.update(id_activo, {"estado": "error", "ultimo_error": error,
                                      "fecha_ultima_conexion": datetime.now()})

