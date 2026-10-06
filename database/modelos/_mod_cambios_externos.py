"""Cambios en webs y redes: proponer → aprobar → aplicar → comprobar →
deshacer — ver docs/gestion-documental.md → "Webs y redes sociales".

Es el freno común a las tres vías (IA por suscripción, chat del panel y
pantallas del panel) y lo impone el servidor, no las instrucciones a la
IA: nada se aplica sin haber sido propuesto antes (con el antes y el
después guardados), el nivel de permiso del activo decide quién puede
aplicar, y antes de aplicar o deshacer se vuelve a leer la web para no
pisar algo que alguien haya cambiado entretanto.

Errores de uso → ValueError (cada vía lo traduce). Un fallo de la web al
aplicar NO lanza: deja la propuesta en "fallido" con el motivo."""

import json
from datetime import datetime, timedelta

from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_activos_digitales import TABLA_ACTIVOS, TABLA_CAMBIOS
from ._mod_activos_digitales import ActivosDigitalesCRUD, ajustes_efectivos
from . import _mod_bases_datos as bd
from ._mod_cloudflare import NIVELES as NIVELES_CLOUDFLARE, CloudflareError, cliente_de as cloudflare_de
from ._mod_conector import ClienteConector, ConectorError
from ._mod_ficheros import FicherosError, ficheros_de, ruta_segura
from ._mod_publicaciones import PublicacionError, PublicacionesCRUD
from ._mod_redes import RedError, cliente_red
from ._mod_wordpress import ESTADOS_COMENTARIO, ESTADOS_PUBLICACION, ClienteWordPress, WordPressError

OPERACIONES = {
    "wp_crear_entrada": {"tipo": "entradas", "accion": "crear", "texto": "Crear la entrada"},
    "wp_crear_pagina": {"tipo": "paginas", "accion": "crear", "texto": "Crear la página"},
    "wp_editar_entrada": {"tipo": "entradas", "accion": "editar", "texto": "Editar la entrada"},
    "wp_editar_pagina": {"tipo": "paginas", "accion": "editar", "texto": "Editar la página"},
    "wp_moderar_comentario": {"tipo": "comentarios", "accion": "moderar", "texto": "Moderar el comentario"},
    "wp_subir_medio": {"tipo": "medios", "accion": "subir", "texto": "Subir a la biblioteca de medios"},
    # Con el conector de Multiplika instalado. Deshacer = volver a la copia
    # que se hace justo antes de aplicar.
    "wp_actualizar_plugin": {"tipo": "plugin", "accion": "actualizar", "texto": "Actualizar el plugin", "conector": True},
    "wp_actualizar_tema": {"tipo": "tema", "accion": "actualizar", "texto": "Actualizar el tema", "conector": True},
    "wp_restaurar_copia": {"tipo": "copia", "accion": "restaurar", "texto": "Restaurar la copia de seguridad", "conector": True},
    # SEO: título y descripción para Google (con conector) y texto alternativo de imágenes
    "wp_editar_seo": {"tipo": "seo", "accion": "editar", "texto": "Cambiar lo que sale en Google de", "conector": True},
    "wp_editar_medio": {"tipo": "medios", "accion": "editar", "texto": "Editar la imagen"},
    # GEO (fase 6, con conector 1.3): robots de IA, llms.txt y datos estructurados
    "wp_geo": {"tipo": "geo", "accion": "editar", "texto": "Cambiar lo que ven las IAs de", "conector": True},
    # Con credencial de Cloudflare en los ajustes de la web (no necesita WordPress)
    # Bases de datos (fase 4): cambios estructurados, nunca SQL libre
    "bd_actualizar": {"tipo": "bd", "accion": "bd", "texto": "Cambiar filas de la base de datos"},
    "bd_insertar": {"tipo": "bd", "accion": "bd", "texto": "Añadir filas a la base de datos"},
    "bd_borrar": {"tipo": "bd", "accion": "bd", "texto": "Borrar filas de la base de datos"},
    # Webs a medida (fase 6): un archivo por SFTP o Git (deshacer = dejarlo como estaba)
    "fichero_editar": {"tipo": "fichero", "accion": "fichero", "texto": "Cambiar el archivo"},
    # Redes sociales (fase 5): responder a un comentario (deshacer = borrar la respuesta)
    "red_responder": {"tipo": "red", "accion": "red", "texto": "Responder al comentario"},
    "cf_nivel_seguridad": {"tipo": "cloudflare", "accion": "cloudflare", "texto": "Cambiar el nivel de seguridad de Cloudflare"},
}
# Las únicas que un activo en nivel "autonomo" deja aplicar sin aprobación.
OPERACIONES_AUTONOMAS = {"wp_moderar_comentario"}

# campo en castellano -> campo de WordPress (o del conector), según lo que se edita
CAMPOS_PUBLICACION = {"titulo": "title", "contenido": "content", "extracto": "excerpt",
                      "estado": "status", "slug": "slug"}
CAMPOS_POR_TIPO = {
    "entradas": CAMPOS_PUBLICACION, "paginas": CAMPOS_PUBLICACION,
    "medios": {"titulo": "title", "texto_alternativo": "alt_text"},
    "seo": {"titulo_seo": "titulo_seo", "descripcion_seo": "descripcion_seo", "palabra_clave": "palabra_clave"},
    "geo": {"robots": "robots", "llms_txt": "llms_txt", "datos_estructurados": "datos_estructurados"},
}
_NOMBRE_CAMPO = {"titulo": "título", "contenido": "contenido", "extracto": "extracto",
                 "estado": "estado", "slug": "dirección (slug)", "texto_alternativo": "texto alternativo",
                 "titulo_seo": "título para Google", "descripcion_seo": "descripción para Google",
                 "palabra_clave": "palabra clave", "robots": "robots de IA que pueden leer la web",
                 "llms_txt": "llms.txt", "datos_estructurados": "datos estructurados de la empresa"}
_JSON = ("datos_antes", "datos_despues", "datos_aplicados")


def _usa_wordpress(op: dict) -> bool:
    return op["accion"] not in ("cloudflare", "bd", "red", "fichero")


def _a_json(valor) -> str | None:
    return json.dumps(valor, ensure_ascii=False) if valor is not None else None


def _salida(fila: dict) -> dict:
    return {**fila, **{k: json.loads(fila[k]) if fila.get(k) else None for k in _JSON}}


def _wp_publicacion(datos: dict, tipo: str = "entradas") -> dict:
    campos = CAMPOS_POR_TIPO[tipo]
    return {campos[k]: ESTADOS_PUBLICACION[v] if k == "estado" else v for k, v in datos.items()}


def _validar_publicacion(datos: dict, creando: bool, tipo: str = "entradas") -> dict:
    campos = CAMPOS_POR_TIPO[tipo]
    desconocidos = set(datos) - set(campos)
    if desconocidos:
        raise ValueError(f"Campos no válidos: {', '.join(sorted(desconocidos))}. "
                         f"Se pueden usar: {', '.join(campos)}")
    limpios = {k: v for k, v in datos.items() if v is not None}
    if "estado" in limpios and limpios["estado"] not in ESTADOS_PUBLICACION:
        raise ValueError(f"Estado no válido. Opciones: {', '.join(ESTADOS_PUBLICACION)}")
    if creando:
        if not (limpios.get("titulo") or "").strip():
            raise ValueError("Para crear hace falta al menos el título")
        limpios.setdefault("estado", "borrador")
    if not limpios:
        raise ValueError("No hay nada que cambiar")
    return limpios


def _comprobar_activo(activo: dict) -> None:
    if activo["archivado"]:
        raise ValueError(f"«{activo['nombre']}» está archivado")
    if activo["estado"] == "pausado":
        raise ValueError(f"«{activo['nombre']}» está en pausa: no se le hace ningún cambio hasta reanudarlo")


def _comprobar_nivel(activo: dict, via: str, aplicando: bool) -> None:
    nivel = activo["nivel_permiso"]
    if nivel == "lectura":
        raise ValueError(f"«{activo['nombre']}» está en solo lectura. Para poder proponer cambios, un "
                         "administrador tiene que subir su nivel de permiso desde el panel.")
    if aplicando and nivel == "proponer" and via != "panel":
        raise ValueError(f"En «{activo['nombre']}» los cambios solo se aprueban desde el panel de la gestión "
                         "documental (nivel de permiso «proponer»). La propuesta queda esperando allí.")


class CambiosExternosCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_CAMBIOS, config)
        self.activos = ActivosDigitalesCRUD(config)

    async def obtener_salida(self, id_cambio: int) -> dict:
        fila = await self.obtener(id_cambio)
        if not fila:
            raise ValueError(f"No existe ninguna propuesta de cambio con número {id_cambio}")
        activo = await self.activos.obtener(fila["id_activo"])
        return {**_salida(fila), "nombre_activo": activo["nombre"] if activo else None}

    async def buscar(self, id_activo: int | None = None, estado: str | None = None, limite: int = 50) -> list[dict]:
        condiciones, params = [], []
        if id_activo:
            condiciones.append("c.id_activo = %s")
            params.append(id_activo)
        if estado:
            condiciones.append("c.estado = %s")
            params.append(estado)
        where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""
        sql = f"""
            SELECT c.*, a.nombre AS nombre_activo
            FROM "{TABLA_CAMBIOS.nombre}" c
            LEFT JOIN "{TABLA_ACTIVOS.nombre}" a ON a.id = c.id_activo
            {where}
            ORDER BY c.fecha_propuesta DESC, c.id DESC
            LIMIT %s
        """
        params.append(max(1, min(limite, 200)))
        return [_salida(f) for f in await AsyncDatabase(**self.config).query(sql, tuple(params))]

    # --- Proponer ---

    async def proponer(self, id_activo: int, operacion: str, datos: dict, via: str, quien: str,
                       id_objeto: str | int | None = None, motivo: str | None = None,
                       aplicar_ya: bool = False) -> dict:
        """Lee la web, calcula el antes y el después y guarda la propuesta.
        No cambia nada fuera. `aplicar_ya` solo vale en activos «autonomo»
        y para OPERACIONES_AUTONOMAS (p.ej. mandar spam a la papelera)."""
        if operacion not in OPERACIONES:
            raise ValueError(f"Operación no válida. Opciones: {', '.join(OPERACIONES)}")
        activo = await self.activos.obtener_o_error(id_activo)
        _comprobar_activo(activo)
        _comprobar_nivel(activo, via, aplicando=False)
        if OPERACIONES[operacion].get("conector") and not activo["conector_instalado"]:
            raise ValueError(f"Para esto «{activo['nombre']}» necesita el conector de Multiplika instalado (y probar la conexión)")
        if aplicar_ya and not (activo["nivel_permiso"] == "autonomo" and operacion in OPERACIONES_AUTONOMAS):
            raise ValueError("Solo se puede aplicar sin aprobación en activos con nivel «autonomo» y para: "
                             + ", ".join(sorted(OPERACIONES_AUTONOMAS)))
        op = OPERACIONES[operacion]
        cliente = await self.activos.cliente_wordpress(activo) if _usa_wordpress(op) else None
        datos = datos or {}

        try:
            if op["accion"] == "crear":
                despues = _validar_publicacion(datos, creando=True)
                antes, id_objeto = None, None
                resumen = f"{op['texto']} «{despues['titulo']}» ({despues['estado']})"
            elif op["accion"] == "editar":
                if op["tipo"] == "geo":
                    id_objeto = "web"  # es de toda la web
                if not id_objeto:
                    raise ValueError("Falta el id (id_objeto) de lo que hay que editar")
                pedidos = _validar_publicacion(datos, creando=False, tipo=op["tipo"])
                actual = await self._leer(op, cliente, id_objeto)
                if op["tipo"] == "geo" and "robots" in pedidos:
                    # Solo se cambian los robots que se nombran; el resto se queda como está
                    desconocidos = set(pedidos["robots"]) - set(actual["robots"])
                    if desconocidos:
                        raise ValueError(f"Robots desconocidos: {', '.join(desconocidos)}. Son: {', '.join(actual['robots'])}")
                    pedidos["robots"] = {**actual["robots"], **{k: bool(v) for k, v in pedidos["robots"].items()}}
                despues = {k: v for k, v in pedidos.items() if actual.get(k) != v}
                if not despues:
                    raise ValueError("Lo propuesto es igual a lo que ya hay en la web: no hay nada que cambiar")
                antes = {k: actual.get(k) for k in despues}
                cambiados = ", ".join(_NOMBRE_CAMPO[k] for k in despues)
                que = "la web" if op["tipo"] == "geo" else f"«{actual.get('titulo') or actual.get('enlace') or id_objeto}»"
                resumen = f"{op['texto']} {que}: {cambiados}"
            elif op["accion"] == "moderar":
                if not id_objeto:
                    raise ValueError("Falta el id del comentario")
                nuevo = datos.get("estado")
                if nuevo not in ESTADOS_COMENTARIO:
                    raise ValueError(f"Estado de comentario no válido. Opciones: {', '.join(ESTADOS_COMENTARIO)}")
                actual = await cliente.obtener("comentarios", id_objeto)
                if actual["estado"] == nuevo:
                    raise ValueError(f"El comentario ya está en «{nuevo}»")
                antes, despues = {"estado": actual["estado"]}, {"estado": nuevo}
                resumen = f"{op['texto']} de {actual['autor'] or 'anónimo'}: {actual['estado']} → {nuevo}"
            elif op["accion"] == "subir":
                despues = await self._datos_medio(datos)
                antes, id_objeto = None, None
                resumen = f"{op['texto']} «{despues['nombre_archivo']}»"
            elif op["accion"] == "actualizar":
                elemento = await self._pendiente(cliente, op["tipo"], datos.get("elemento"))
                antes, despues, id_objeto = {"version": elemento["version"]}, {"version": elemento["version_nueva"]}, elemento["id"]
                resumen = f"{op['texto']} «{elemento['nombre']}» de {elemento['version']} a {elemento['version_nueva']}"
            elif op["accion"] == "bd":
                ejecutor = await bd.ejecutor_de(self.config, activo)
                antes, despues, resumen, id_objeto = await bd.proponer_bd(
                    ejecutor, operacion, datos, ajustes_efectivos(activo)["bd_max_filas"])
            elif op["accion"] == "fichero":
                ruta = ruta_segura(datos.get("ruta") or "")
                if ruta == "." or datos.get("contenido") is None:
                    raise ValueError("Hacen falta `ruta` (el archivo) y `contenido` (el contenido completo nuevo)")
                actual = await (await ficheros_de(self.config, activo)).leer(ruta)
                if actual == datos["contenido"]:
                    raise ValueError("El archivo ya tiene ese contenido")
                antes, despues, id_objeto = {"contenido": actual}, {"contenido": datos["contenido"]}, ruta
                resumen = f"{'Cambiar' if actual is not None else 'Crear'} el archivo «{ruta}»"
            elif op["accion"] == "red":
                pub = await PublicacionesCRUD(self.config).obtener_salida(int(datos.get("id_publicacion") or 0))
                resultado_red = pub["resultados"].get(str(id_activo))
                if not resultado_red or not resultado_red.get("ok"):
                    raise ValueError("Esa publicación no está publicada en esta red")
                if not (datos.get("texto") or "").strip() or not datos.get("id_comentario"):
                    raise ValueError("Hacen falta id_comentario y texto")
                antes, despues, id_objeto = None, {"id_publicacion": pub["id"], "id_comentario": str(datos["id_comentario"]),
                                                   "texto": datos["texto"].strip(), "resultado_red": resultado_red}, str(datos["id_comentario"])
                autor = datos.get("autor_comentario")
                resumen = f"{op['texto']}{f' de {autor}' if autor else ''} en «{pub['titulo']}»: «{despues['texto'][:80]}»"
            elif op["accion"] == "cloudflare":
                nivel = datos.get("nivel")
                if nivel not in NIVELES_CLOUDFLARE:
                    raise ValueError(f"Nivel no válido. Opciones: {', '.join(NIVELES_CLOUDFLARE)}")
                actual = await (await self._cloudflare(activo)).ajuste("security_level")
                if actual == nivel:
                    raise ValueError(f"Cloudflare ya está en nivel «{NIVELES_CLOUDFLARE[nivel]}»")
                antes, despues, id_objeto = {"nivel": actual}, {"nivel": nivel}, "security_level"
                resumen = f"{op['texto']}: {NIVELES_CLOUDFLARE.get(actual, actual)} → {NIVELES_CLOUDFLARE[nivel]}"
            else:  # restaurar
                copia = await self._copia(cliente, datos.get("nombre"))
                antes, despues, id_objeto = None, {"nombre": copia["nombre"], "fecha": copia["fecha"]}, copia["nombre"]
                resumen = (f"{op['texto']} del {copia['fecha'][:10]} {copia['fecha'][11:16]} UTC: la web vuelve a como "
                           "estaba entonces (contenido, ajustes, plugins y archivos)")
        except (ConectorError, CloudflareError, bd.BaseDatosError, RedError, PublicacionError, FicherosError) as e:
            raise ValueError(f"No se ha podido preparar la propuesta: {e}")
        except WordPressError as e:
            raise ValueError(f"No se ha podido leer la web para preparar la propuesta: {e}")

        id_cambio = await self.insert({
            "id_activo": id_activo, "operacion": operacion,
            "id_objeto": str(id_objeto) if id_objeto is not None else None,
            "resumen": resumen[:500], "motivo": motivo,
            "datos_antes": _a_json(antes), "datos_despues": _a_json(despues),
            "estado": "propuesto", "via_propuesta": via, "propuesto_por": quien,
        })
        if aplicar_ya:
            return await self.aplicar(id_cambio, via, quien)
        return await self.obtener_salida(id_cambio)

    async def _leer(self, op: dict, cliente, id_objeto) -> dict:
        """Cómo está ahora en la web lo que se va a cambiar."""
        if op["tipo"] == "geo":
            return await ClienteConector(cliente).leer_geo()
        if op["tipo"] == "seo":
            return await ClienteConector(cliente).leer_seo(id_objeto)
        return await cliente.obtener(op["tipo"], id_objeto)

    async def _escribir(self, op: dict, cliente, id_objeto, datos: dict) -> dict:
        if op["tipo"] == "geo":
            return await ClienteConector(cliente).escribir_geo(datos)
        if op["tipo"] == "seo":
            return await ClienteConector(cliente).escribir_seo(id_objeto, datos)
        return await cliente.actualizar(op["tipo"], id_objeto, _wp_publicacion(datos, op["tipo"]))

    async def _cloudflare(self, activo: dict):
        nombre = ajustes_efectivos(activo)["cloudflare_credencial"]
        if not nombre:
            raise ValueError(f"«{activo['nombre']}» no tiene Cloudflare configurado en sus ajustes")
        return await cloudflare_de(self.config, activo, nombre)

    async def _pendiente(self, cliente, tipo: str, elemento: str | None) -> dict:
        """El plugin o tema con actualización pendiente. Vale el archivo del
        plugin (contact-form-7/wp-contact-form-7.php), la carpeta del tema o
        el nombre que se ve en WordPress."""
        if not elemento:
            raise ValueError("Falta `elemento`: qué plugin o tema actualizar")
        estado = await ClienteConector(cliente).estado()
        lista = ([{"id": p["plugin"], **p} for p in estado["plugins"]] if tipo == "plugin"
                 else [{"id": t["tema"], **t} for t in estado["temas"]])
        buscado = elemento.strip().lower()
        for x in lista:
            if buscado in (x["id"].lower(), x["nombre"].lower(), x["id"].split("/")[0].lower()):
                if not x["version_nueva"]:
                    raise ValueError(f"«{x['nombre']}» ya está en su última versión ({x['version']})")
                return x
        raise ValueError(f"No hay ningún {tipo} «{elemento}» en la web")

    async def _copia(self, cliente, nombre: str | None) -> dict:
        copias = (await ClienteConector(cliente).listar_copias())["copias"]
        if not copias:
            raise ValueError("Esta web no tiene ninguna copia de seguridad guardada en su servidor")
        if not nombre:
            raise ValueError("Falta `nombre`: qué copia restaurar (mira listar_copias_web_gd)")
        for c in copias:
            if c["nombre"] == nombre:
                return c
        raise ValueError(f"No existe la copia «{nombre}» en el servidor de la web")

    async def _datos_medio(self, datos: dict) -> dict:
        id_documento = datos.get("id_documento")
        if not isinstance(id_documento, int):
            raise ValueError("Para subir un archivo hace falta id_documento: el documento de la GD que lo tiene adjunto")
        fila = await AsyncDatabase(**self.config).query(
            "SELECT id, archivo_original_nombre, archivo_original_tipo_mime FROM gd_versiones "
            "WHERE id_documento = %s AND archivo_original IS NOT NULL ORDER BY id DESC LIMIT 1",
            (id_documento,), uno=True,
        )
        if not fila:
            raise ValueError(f"El documento {id_documento} no tiene ningún archivo original adjunto")
        return {"id_documento": id_documento, "id_version": fila["id"],
                "nombre_archivo": fila["archivo_original_nombre"], "tipo_mime": fila["archivo_original_tipo_mime"],
                "titulo": datos.get("titulo"), "texto_alternativo": datos.get("texto_alternativo")}

    # --- Rechazar ---

    async def rechazar(self, id_cambio: int, via: str, quien: str, motivo: str | None = None) -> dict:
        cambio = await self.obtener_salida(id_cambio)
        if cambio["estado"] != "propuesto":
            raise ValueError(f"La propuesta {id_cambio} ya está «{cambio['estado']}»")
        await self.update(id_cambio, {"estado": "rechazado", "via_resolucion": via, "resuelto_por": quien,
                                      "fecha_resolucion": datetime.now(),
                                      "resultado": f"Rechazada: {motivo}" if motivo else "Rechazada"})
        return await self.obtener_salida(id_cambio)

    # --- Aplicar ---

    async def _reservar(self, id_cambio: int, de: str, a: str) -> bool:
        """Cambia el estado solo si sigue siendo `de`: dos personas aprobando
        a la vez no aplican el cambio dos veces."""
        filas = await AsyncDatabase(**self.config).query(
            f'UPDATE "{TABLA_CAMBIOS.nombre}" SET estado = %s WHERE id = %s AND estado = %s', (a, id_cambio, de),
        )
        return bool(filas)

    async def aplicar(self, id_cambio: int, via: str, quien: str) -> dict:
        cambio = await self.obtener_salida(id_cambio)
        if cambio["estado"] != "propuesto":
            raise ValueError(f"La propuesta {id_cambio} ya está «{cambio['estado']}»: no se puede aplicar")
        activo = await self.activos.obtener_o_error(cambio["id_activo"])
        _comprobar_activo(activo)
        _comprobar_nivel(activo, via, aplicando=True)

        dias = ajustes_efectivos(activo)["caducidad_propuestas_dias"]
        if cambio["fecha_propuesta"] < datetime.now() - timedelta(days=dias):
            await self._cerrar(id_cambio, "caducado", via, quien,
                               f"Caducada: tenía más de {dias} días. Si sigue haciendo falta, vuelve a proponerla.")
            return await self.obtener_salida(id_cambio)

        if not await self._reservar(id_cambio, "propuesto", "aplicando"):
            raise ValueError(f"La propuesta {id_cambio} la está aplicando o la ha resuelto otra persona")

        op = OPERACIONES[cambio["operacion"]]
        antes, despues = cambio["datos_antes"], cambio["datos_despues"]
        try:
            cliente = await self.activos.cliente_wordpress(activo) if _usa_wordpress(op) else None
            conector = ClienteConector(cliente) if cliente else None
            # ¿Ha cambiado la web desde que se propuso?
            if op["accion"] == "bd":
                motivo, hecho = await bd.aplicar_bd(await bd.ejecutor_de(self.config, activo), cambio["operacion"], antes, despues)
                if motivo:
                    await self._cerrar(id_cambio, "caducado", via, quien, motivo)
                    return await self.obtener_salida(id_cambio)
                id_objeto = cambio["id_objeto"]
            elif op["accion"] == "cloudflare":
                cf = await self._cloudflare(activo)
                actual = await cf.ajuste("security_level")
                if actual != antes["nivel"]:
                    await self._cerrar(id_cambio, "caducado", via, quien,
                                       f"Cloudflare ya no está en «{NIVELES_CLOUDFLARE.get(antes['nivel'])}»: no se ha tocado nada.")
                    return await self.obtener_salida(id_cambio)
            elif op["accion"] == "actualizar":
                actual = {"version": (await self._pendiente_o_nada(cliente, op["tipo"], cambio["id_objeto"]))}
                if actual["version"] != antes["version"]:
                    await self._cerrar(id_cambio, "caducado", via, quien,
                                       f"Ya no está en la versión {antes['version']} (ahora {actual['version']}): "
                                       "no se ha tocado nada.")
                    return await self.obtener_salida(id_cambio)
            elif op["accion"] == "fichero":
                pass  # lo comprueba abajo, al aplicar (compara el archivo entero)
            elif antes is not None:
                actual = await self._leer(op, cliente, cambio["id_objeto"])
                distintos = [k for k in antes if actual.get(k) != antes[k]]
                if distintos:
                    await self._cerrar(id_cambio, "caducado", via, quien,
                                       "La web ha cambiado desde que se hizo la propuesta ("
                                       + ", ".join(_NOMBRE_CAMPO.get(k, k) for k in distintos)
                                       + "). No se ha tocado nada; vuelve a proponerlo con lo que hay ahora.")
                    return await self.obtener_salida(id_cambio)

            if op["accion"] == "crear":
                hecho = await cliente.crear(op["tipo"], _wp_publicacion(despues))
                id_objeto = hecho["id"]
            elif op["accion"] == "editar":
                hecho = await self._escribir(op, cliente, cambio["id_objeto"], despues)
                id_objeto = cambio["id_objeto"]
            elif op["accion"] == "moderar":
                hecho = await cliente.actualizar("comentarios", cambio["id_objeto"],
                                                 {"status": ESTADOS_COMENTARIO[despues["estado"]]})
                id_objeto = cambio["id_objeto"]
            elif op["accion"] == "bd":
                pass  # ya aplicado arriba, en la misma comprobación
            elif op["accion"] == "fichero":
                ficheros = await ficheros_de(self.config, activo)
                if await ficheros.leer(cambio["id_objeto"]) != antes["contenido"]:
                    await self._cerrar(id_cambio, "caducado", via, quien,
                                       "El archivo ha cambiado desde que se hizo la propuesta: no se ha tocado nada.")
                    return await self.obtener_salida(id_cambio)
                await ficheros.escribir(cambio["id_objeto"], despues["contenido"], f"GD: {cambio['resumen']}")
                hecho = {"ruta": cambio["id_objeto"], "contenido": await ficheros.leer(cambio["id_objeto"])}
                id_objeto = cambio["id_objeto"]
            elif op["accion"] == "red":
                red = await cliente_red(self.config, activo)
                hecho = await red.responder(despues["resultado_red"], despues["id_comentario"], despues["texto"])
                hecho = {"id_respuesta": hecho.get("id")}
                id_objeto = cambio["id_objeto"]
            elif op["accion"] == "cloudflare":
                hecho = {"nivel": await cf.cambiar_ajuste("security_level", despues["nivel"])}
                id_objeto = cambio["id_objeto"]
            elif op["accion"] in ("actualizar", "restaurar"):
                previa = await conector.crear_copia()
                if op["accion"] == "actualizar":
                    r = await conector.actualizar(op["tipo"], cambio["id_objeto"])
                    hecho = {"version": r["version_despues"], "copia_previa": previa["nombre"]}
                else:
                    r = await conector.restaurar(despues["nombre"])
                    if r.get("fallos"):
                        raise ValueError(f"la base de datos dio {len(r['fallos'])} error(es) al restaurar: {r['fallos'][0]}")
                    hecho = {"restaurada": despues["nombre"], "copia_previa": previa["nombre"]}
                id_objeto = cambio["id_objeto"]
            else:
                version = await AsyncDatabase(**self.config).query(
                    "SELECT archivo_original FROM gd_versiones WHERE id = %s", (despues["id_version"],), uno=True)
                if not version or not version["archivo_original"]:
                    raise ValueError("El archivo del documento ya no está en la GD")
                hecho = await cliente.subir_medio(despues["nombre_archivo"], despues["tipo_mime"],
                                                  bytes(version["archivo_original"]),
                                                  despues.get("titulo"), despues.get("texto_alternativo"))
                id_objeto = hecho["id"]
        except (WordPressError, ValueError, ConectorError, CloudflareError, bd.BaseDatosError, RedError, FicherosError) as e:
            await self._cerrar(id_cambio, "fallido", via, quien, f"No se ha podido aplicar: {e}")
            return await self.obtener_salida(id_cambio)

        if op["accion"] in ("bd", "red", "fichero"):
            aplicados = hecho
        else:
            aplicados = {"id": hecho.get("id"), "enlace": hecho.get("enlace") or hecho.get("direccion"),
                         **{k: hecho[k] for k in ("copia_previa", "restaurada") if k in hecho}}
            aplicados.update({k: hecho.get(k) for k in despues if k in hecho})
        await self.update(id_cambio, {"id_objeto": str(id_objeto), "datos_aplicados": _a_json(aplicados)})
        if activo.get("url"):
            resultado = await self._comprobacion(cliente or ClienteWordPress(activo["url"], "", ""), despues, aplicados)
        else:
            resultado = "Aplicado." + (f" Filas tocadas: {len(aplicados.get('claves') or [])}." if op["accion"] == "bd" else "")
        await self._cerrar(id_cambio, "aplicado", via, quien, resultado)
        return await self.obtener_salida(id_cambio)

    async def _pendiente_o_nada(self, cliente, tipo: str, elemento: str) -> str | None:
        """Versión instalada ahora de un plugin o tema (o None si ya no está)."""
        estado = await ClienteConector(cliente).estado()
        lista = estado["plugins"] if tipo == "plugin" else estado["temas"]
        clave = "plugin" if tipo == "plugin" else "tema"
        return next((x["version"] for x in lista if x[clave] == elemento), None)

    async def _comprobacion(self, cliente, despues: dict, aplicados: dict) -> str:
        notas = ["Aplicado."]
        diferentes = [k for k in despues if k in aplicados and k in _NOMBRE_CAMPO and aplicados[k] != despues[k]]
        if diferentes:
            notas.append("WordPress lo ha guardado con alguna diferencia en: "
                         + ", ".join(_NOMBRE_CAMPO[k] for k in diferentes)
                         + " (es normal si quita etiquetas que ese usuario no puede usar).")
        codigo = await cliente.portada_responde()
        if codigo is None or codigo >= 500:
            notas.append("ATENCIÓN: después del cambio la portada de la web no responde bien "
                         f"({'sin respuesta' if codigo is None else f'error {codigo}'}). Puedes deshacer el cambio.")
        else:
            notas.append(f"La portada sigue respondiendo (código {codigo}).")
        return " ".join(notas)

    async def _cerrar(self, id_cambio: int, estado: str, via: str, quien: str, resultado: str) -> None:
        await self.update(id_cambio, {"estado": estado, "via_resolucion": via, "resuelto_por": quien,
                                      "fecha_resolucion": datetime.now(), "resultado": resultado})

    # --- Deshacer ---

    async def deshacer(self, id_cambio: int, via: str, quien: str) -> dict:
        cambio = await self.obtener_salida(id_cambio)
        if cambio["estado"] != "aplicado":
            raise ValueError(f"Solo se puede deshacer un cambio aplicado; este está «{cambio['estado']}»")
        if cambio["detalle_purgado"]:
            raise ValueError("Este cambio es tan antiguo que ya no se guarda la copia de lo que había: no se "
                             "puede deshacer automáticamente")
        activo = await self.activos.obtener_o_error(cambio["id_activo"])
        _comprobar_activo(activo)
        _comprobar_nivel(activo, via, aplicando=True)
        op = OPERACIONES[cambio["operacion"]]
        antes, aplicados = cambio["datos_antes"], cambio["datos_aplicados"] or {}

        if not await self._reservar(id_cambio, "aplicado", "deshaciendo"):
            raise ValueError("Otra persona está deshaciendo este cambio ahora mismo")
        try:
            cliente = await self.activos.cliente_wordpress(activo) if _usa_wordpress(op) else None
            if op["accion"] == "fichero":
                ficheros = await ficheros_de(self.config, activo)
                if await ficheros.leer(cambio["id_objeto"]) != aplicados.get("contenido"):
                    raise ValueError("el archivo se ha vuelto a cambiar después: deshacerlo pisaría esos cambios")
                if antes["contenido"] is None:
                    await ficheros.borrar(cambio["id_objeto"], f"GD: deshacer {cambio['resumen']}")
                else:
                    await ficheros.escribir(cambio["id_objeto"], antes["contenido"], f"GD: deshacer {cambio['resumen']}")
            elif op["accion"] == "red":
                if not aplicados.get("id_respuesta"):
                    raise ValueError("no se sabe qué respuesta se publicó")
                await (await cliente_red(self.config, activo)).borrar_comentario(aplicados["id_respuesta"])
            elif op["accion"] == "bd":
                await bd.deshacer_bd(await bd.ejecutor_de(self.config, activo), cambio["operacion"], antes, aplicados)
            elif op["accion"] == "cloudflare":
                cf = await self._cloudflare(activo)
                if await cf.ajuste("security_level") != aplicados.get("nivel"):
                    raise ValueError("el nivel de Cloudflare se ha vuelto a cambiar después: deshacerlo pisaría ese cambio")
                await cf.cambiar_ajuste("security_level", antes["nivel"])
            elif op["accion"] in ("editar", "moderar"):
                actual = await self._leer(op, cliente, cambio["id_objeto"])
                distintos = [k for k in antes if k in aplicados and actual.get(k) != aplicados[k]]
                if distintos:
                    raise ValueError("Se ha vuelto a cambiar después ("
                                     + ", ".join(_NOMBRE_CAMPO.get(k, k) for k in distintos)
                                     + "): deshacerlo pisaría esos cambios. Si hace falta, propón el cambio a mano.")
                if op["accion"] == "editar":
                    await self._escribir(op, cliente, cambio["id_objeto"], antes)
                else:
                    if actual["estado"] in ("papelera", "spam"):
                        await cliente.actualizar("comentarios", cambio["id_objeto"],
                                                 {"status": "untrash" if actual["estado"] == "papelera" else "unspam"})
                    await cliente.actualizar("comentarios", cambio["id_objeto"],
                                             {"status": ESTADOS_COMENTARIO[antes["estado"]]})
            elif op["accion"] in ("actualizar", "restaurar"):
                if not aplicados.get("copia_previa"):
                    raise ValueError("no hay copia previa con la que volver atrás")
                r = await ClienteConector(cliente).restaurar(aplicados["copia_previa"])
                if r.get("fallos"):
                    raise ValueError(f"la base de datos dio {len(r['fallos'])} error(es) al restaurar: {r['fallos'][0]}")
            elif op["accion"] == "crear":
                await cliente.borrar(op["tipo"], cambio["id_objeto"])  # a la papelera de WordPress
            else:
                await cliente.borrar("medios", cambio["id_objeto"], definitivo=True)  # los medios no tienen papelera
        except (WordPressError, ValueError, ConectorError, CloudflareError, bd.BaseDatosError, RedError, FicherosError) as e:
            await AsyncDatabase(**self.config).query(
                f'UPDATE "{TABLA_CAMBIOS.nombre}" SET estado = %s WHERE id = %s', ("aplicado", id_cambio))
            raise ValueError(f"No se ha podido deshacer: {e}")

        await self.update(id_cambio, {"estado": "deshecho", "via_deshecho": via, "deshecho_por": quien,
                                      "fecha_deshecho": datetime.now()})
        return await self.obtener_salida(id_cambio)

