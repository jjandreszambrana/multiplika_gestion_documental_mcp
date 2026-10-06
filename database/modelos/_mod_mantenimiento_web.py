"""Lo que la vigilancia hace con el conector de Multiplika instalado:
comprobar archivos, leer errores, vigilar o hacer copias y avisar de (o
hacer) actualizaciones — ver _mod_conector.py y _mod_vigilancia.py.

Cada función tiene la forma de una comprobación (devuelve estado, resumen,
detalle). Las que cambian algo en la web (hacer copias, actualizar
automáticamente) lo hacen porque el cliente lo ha activado en los ajustes
de esa web, y cada actualización queda apuntada en gd_cambios_externos
como cualquier otro cambio."""

import json
import re
from datetime import datetime, timezone

from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_activos_digitales import TABLA_CAMBIOS
from ._mod_activos_digitales import ajustes_efectivos
from ._mod_comprobaciones_web import es_anterior
from ._mod_conector import PLUGINS_DE_COPIAS, VERSION_CONECTOR, ClienteConector, ConectorError, copiar_a_remoto, listar_remoto

MB = 1024 * 1024


def _mayuscula(texto: str) -> str:
    return texto[:1].upper() + texto[1:]


def _mb(n: int | None) -> str:
    if n is None:
        return "?"
    return f"{n / MB / 1024:.1f} GB" if n >= 1024 * MB else f"{n / MB:.0f} MB"


async def integridad(activo: dict, cliente, previo: dict, **_) -> tuple[str, str, dict]:
    try:
        d = await ClienteConector(cliente).integridad()
    except ConectorError as e:
        return "error", str(e), {}
    problemas = []
    if d["modificados"]:
        problemas.append(f"{len(d['modificados'])} archivo(s) de WordPress modificados")
    if d["sobran"]:
        problemas.append(f"{len(d['sobran'])} archivo(s) PHP que no son de WordPress dentro de sus carpetas")
    if d["php_en_subidas"]:
        problemas.append(f"{len(d['php_en_subidas'])} archivo(s) PHP en la carpeta de subidas (donde solo debería haber imágenes y documentos)")
    if d["faltan"]:
        problemas.append(f"faltan {len(d['faltan'])} archivo(s) de WordPress")
    if problemas:
        return "grave", ("Posible hackeo: " + "; ".join(problemas)
                         + ". Hay que revisarlo o restaurar una copia anterior."), d
    return "ok", f"Los {d['revisados']} archivos de WordPress {d['version']} están intactos", d


_FECHA_LOG = re.compile(r"^\[([^\]]+)\]")


async def errores(activo: dict, cliente, previo: dict, **_) -> tuple[str, str, dict]:
    try:
        d = await ClienteConector(cliente).errores(300)
    except ConectorError as e:
        return "error", str(e), {}
    if not d["hay_registro"]:
        return "sin_datos", "WordPress no guarda registro de errores en esta web (está desactivado)", {}
    fatales = [l for l in d["lineas"] if "PHP Fatal error" in l or "PHP Parse error" in l]
    vista = previo.get("ultima_vista")
    if "ultima_vista" not in previo:
        nuevos = []  # la primera vez solo se toma nota de por dónde va
    elif vista in fatales:  # la última vez que sale: el mismo error puede repetirse igual
        nuevos = fatales[len(fatales) - fatales[::-1].index(vista):]
    else:
        nuevos = fatales  # el registro se vació o la última vista ya no sale en el trozo leído
    detalle = {"ultima_vista": fatales[-1] if fatales else vista, "nuevos": nuevos[-10:], "tamano": d["tamano"]}
    if nuevos:
        return "aviso", f"{len(nuevos)} error(es) graves nuevos de PHP en el registro: alguna página puede no funcionar", detalle
    return "ok", "Sin errores graves nuevos en el registro", detalle


async def actualizaciones(activo: dict, cliente, previo: dict, config: dict | None = None, **_) -> tuple[str, str, dict]:
    conector = ClienteConector(cliente)
    try:
        estado = await conector.estado()
    except ConectorError as e:
        return "error", str(e), {}
    pendientes = [{"tipo": "plugin", "elemento": p["plugin"], "nombre": p["nombre"], "version": p["version"],
                   "version_nueva": p["version_nueva"], "activo": p["activo"]}
                  for p in estado["plugins"] if p["version_nueva"]]
    pendientes += [{"tipo": "tema", "elemento": t["tema"], "nombre": t["nombre"], "version": t["version"],
                    "version_nueva": t["version_nueva"], "activo": t["activo"]}
                   for t in estado["temas"] if t["version_nueva"]]
    detalle = {"pendientes": pendientes, "wordpress": estado["wordpress"], "wordpress_nueva": estado["wordpress_nueva"],
               "php": estado["php"]}
    ajustes = ajustes_efectivos(activo)
    hechas = []
    if pendientes and ajustes["actualizaciones"] == "automaticas" and config:
        excluir = {x.strip().lower() for x in (ajustes["actualizaciones_excluir"] or "").split(",") if x.strip()}
        a_actualizar = [p for p in pendientes if p["nombre"].lower() not in excluir]
        if a_actualizar:
            if not estado.get("actualizar_sin_credenciales"):
                detalle["error_automaticas"] = "el servidor pide usuario de FTP para actualizar"
            else:
                hechas = await actualizar_automaticamente(config, activo, conector, a_actualizar)
                detalle["automaticas"] = hechas
                pendientes = [p for p in pendientes if p not in [h["pendiente"] for h in hechas if h["ok"]]]
                detalle["pendientes"] = pendientes
    if any(not h["ok"] and h.get("restaurada") for h in hechas):
        return "grave", ("Una actualización automática rompió la web y se volvió a la copia anterior: "
                         + ", ".join(h["pendiente"]["nombre"] for h in hechas if not h["ok"])), detalle
    texto = []
    if hechas:
        texto.append("actualizado automáticamente: " + ", ".join(
            f"{h['pendiente']['nombre']} {h['pendiente']['version_nueva']}" for h in hechas if h["ok"]))
    if pendientes:
        texto.append(f"{len(pendientes)} actualización(es) pendiente(s): "
                     + ", ".join(f"{p['nombre']} ({p['version']} → {p['version_nueva']})" for p in pendientes[:5]))
    if estado["wordpress_nueva"]:
        texto.append(f"WordPress {estado['wordpress_nueva']} disponible (hay {estado['wordpress']})")
    conector_viejo = es_anterior(estado.get("conector"), VERSION_CONECTOR)
    if conector_viejo:
        texto.append(f"hay una versión nueva del conector de Multiplika ({VERSION_CONECTOR}): descárgala desde la pestaña "
                     "Vigilancia e instálala encima")
        detalle["conector_nuevo"] = VERSION_CONECTOR
    if detalle.get("error_automaticas"):
        texto.append(f"no se pudo actualizar solo: {detalle['error_automaticas']}")
    if pendientes or estado["wordpress_nueva"] or conector_viejo:
        return "aviso", _mayuscula("; ".join(texto)), detalle
    return "ok", (_mayuscula("; ".join(texto)) + ". " if hechas else "") + "Todo actualizado", detalle


async def actualizar_automaticamente(config: dict, activo: dict, conector: ClienteConector, pendientes: list[dict]) -> list[dict]:
    """Copia → actualiza cada uno → comprueba la portada. Si la web deja de
    responder, vuelve a la copia y para. Cada actualización se apunta como
    un cambio (vía «automatica») para que salga en el historial."""
    try:
        copia = await conector.crear_copia()
    except ConectorError as e:
        return [{"pendiente": p, "ok": False, "error": f"no se pudo hacer la copia previa: {e}"} for p in pendientes]
    db = AsyncDatabase(**config)
    resultados = []
    for p in pendientes:
        try:
            r = await conector.actualizar(p["tipo"], p["elemento"])
            codigo = await conector.wp.portada_responde()
        except ConectorError as e:
            resultados.append({"pendiente": p, "ok": False, "error": str(e)})
            await _apuntar(db, activo, p, "fallido", f"No se pudo actualizar: {e}", copia["nombre"])
            continue
        if codigo is None or codigo >= 500:
            try:
                await conector.restaurar(copia["nombre"])
                restaurada = True
            except ConectorError:
                restaurada = False
            texto = (f"Tras actualizar, la web dejó de responder ({codigo or 'sin respuesta'}); "
                     + ("se volvió a la copia anterior." if restaurada else "Y NO se pudo volver a la copia: revísala ya."))
            resultados.append({"pendiente": p, "ok": False, "restaurada": restaurada, "error": texto})
            await _apuntar(db, activo, p, "fallido", texto, copia["nombre"])
            break
        resultados.append({"pendiente": p, "ok": True, "version": r.get("version_despues")})
        await _apuntar(db, activo, p, "aplicado", f"Actualizado de {p['version']} a {r.get('version_despues')}. "
                       f"La portada sigue respondiendo (código {codigo}).", copia["nombre"])
    return resultados


async def _apuntar(db: AsyncDatabase, activo: dict, p: dict, estado: str, resultado: str, copia: str) -> None:
    ahora = datetime.now()
    await db.query(
        f'INSERT INTO "{TABLA_CAMBIOS.nombre}" (id_activo, operacion, id_objeto, resumen, datos_antes, datos_despues, '
        "datos_aplicados, estado, via_propuesta, propuesto_por, via_resolucion, resuelto_por, fecha_resolucion, resultado) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'automatica', 'Actualización automática', 'automatica', "
        "'Actualización automática', %s, %s)",
        (activo["id"], f"wp_actualizar_{p['tipo']}", p["elemento"],
         f"Actualizar {p['tipo']} «{p['nombre']}» de {p['version']} a {p['version_nueva']}",
         json.dumps({"version": p["version"]}), json.dumps({"version": p["version_nueva"]}),
         json.dumps({"copia_previa": copia}), estado, ahora, resultado))


async def copias(activo: dict, cliente, previo: dict, config: dict | None = None, **_) -> tuple[str, str, dict]:
    ajustes = ajustes_efectivos(activo)
    conector = ClienteConector(cliente)
    try:
        estado = await conector.estado()
        locales = (await conector.listar_copias())["copias"]
    except ConectorError as e:
        return "error", str(e), {}
    remotas = []
    if ajustes["copias_credencial_remota"]:
        try:
            remotas = await listar_remoto(config, ajustes["copias_credencial_remota"], ajustes["copias_carpeta_remota"])
        except Exception as e:  # servidor remoto caído o credencial mal: se dice, no se tumba
            return "error", f"No se puede entrar en el servidor remoto de copias: {e}", {}
    plugins_copias = [p["nombre"] for p in estado["plugins"]
                      if p["activo"] and p["plugin"].split("/")[0] in PLUGINS_DE_COPIAS]

    if not ajustes["copias_hacer"]:
        return _vigilar(locales, remotas, plugins_copias, estado)

    detalle = {"espacio_libre": estado["espacio_libre"], "plugins_de_copias": plugins_copias}
    conservar = ajustes["copias_conservar_servidor"]
    remoto = ajustes["copias_credencial_remota"]
    if conservar == 0 and not remoto:
        return "aviso", ("Las copias están activadas pero sin sitio donde guardarlas: hay que permitir guardarlas en el "
                         "servidor o poner un servidor remoto"), detalle
    # ¿Cabe? Se estima con la última copia (+20 %).
    estimado = int((locales[0]["tamano"] if locales else 0) * 1.2)
    libre = estado["espacio_libre"]
    if libre is not None and estimado and libre < estimado:
        if ajustes["copias_borrar_antigua_si_falta_espacio"] and locales:
            while locales and libre < estimado:
                viejo = locales.pop()
                await conector.borrar_copia(viejo["nombre"])
                libre += viejo["tamano"]
            detalle["borradas_por_espacio"] = True
        if libre < estimado:
            return "grave", (f"No cabe una copia nueva en el servidor: quedan {_mb(libre)} y hace falta unos "
                             f"{_mb(estimado)}. Libera espacio o permite borrar copias antiguas."), detalle
    try:
        nueva = await conector.crear_copia()
    except ConectorError as e:
        return "grave", f"No se ha podido hacer la copia de seguridad: {e}", detalle
    detalle["copia"] = nueva
    textos = [f"Copia hecha ({_mb(nueva['tamano'])})"]
    if remoto:
        try:
            r = await copiar_a_remoto(config, conector, nueva["nombre"], remoto, ajustes["copias_carpeta_remota"],
                                      ajustes["copias_conservar_remoto"])
            detalle["remoto"] = r
            textos.append(f"subida al servidor remoto ({r['en_remoto']} allí"
                          + (f", libre {_mb(r['espacio_libre'])}" if r["espacio_libre"] is not None else "") + ")")
        except ConectorError as e:
            detalle["error_remoto"] = str(e)
            textos.append(f"NO se pudo subir al servidor remoto: {e}")
    # Poda en el servidor de la web: deja las N más recientes. Con 0, ninguna
    # (ya están en remoto); pero si la subida falló, se queda al menos la nueva.
    locales = (await conector.listar_copias())["copias"]
    deja = conservar if conservar > 0 else (1 if detalle.get("error_remoto") else 0)
    for viejo in locales[deja:]:
        await conector.borrar_copia(viejo["nombre"])
    locales = (await conector.listar_copias())["copias"]
    libre = (await conector.estado())["espacio_libre"]
    caben = int(libre / max(nueva["tamano"], 1)) if libre is not None else None
    textos.append(f"{len(locales)} en el servidor de la web, libre {_mb(libre)}"
                  + (f" (caben unas {caben} más)" if caben is not None else ""))
    detalle.update({"en_servidor": len(locales), "espacio_libre": libre, "caben": caben})
    if detalle.get("error_remoto"):
        return "aviso", "; ".join(textos), detalle
    if caben is not None and caben < 3:
        return "aviso", "; ".join(textos) + ". Queda poco espacio en el servidor", detalle
    return "ok", "; ".join(textos), detalle


def _vigilar(locales: list, remotas: list, plugins_copias: list, estado: dict) -> tuple[str, str, dict]:
    """Copias activadas en modo «solo vigilar»: mira la última que la GD
    puede ver y los plugins de copias que tenga la web."""
    fechas = []
    for c in locales:
        fechas.append(datetime.fromisoformat(c["fecha"]))
    for c in remotas:
        fechas.append(datetime.fromtimestamp(c["fecha"], tz=timezone.utc))
    detalle = {"en_servidor": len(locales), "en_remoto": len(remotas), "plugins_de_copias": plugins_copias}
    if fechas:
        dias = (datetime.now(timezone.utc) - max(fechas)).days
        detalle["dias_ultima"] = dias
        if dias > 7:
            return "aviso", f"La última copia de seguridad que se ve tiene {dias} días", detalle
        return "ok", f"Última copia de seguridad hace {dias} día(s)", detalle
    if plugins_copias:
        return "sin_datos", (f"La web tiene {', '.join(plugins_copias)} para las copias; la gestión documental no puede "
                             "ver cuándo hizo la última. Si quieres que las haga ella, actívalo en los ajustes."), detalle
    return "aviso", ("No se ve ninguna copia de seguridad de esta web. Puedes activar que la gestión documental las "
                     "haga (ajustes de la web) o confirmar que tu proveedor de hosting las hace."), detalle
