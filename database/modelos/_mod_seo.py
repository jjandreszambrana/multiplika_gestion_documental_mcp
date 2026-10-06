"""SEO de una web (fase 3 de webs y redes) — ver docs/gestion-documental.md →
"Webs y redes sociales": auditoría propia (recorre la web), problemas
priorizados por las visitas que trae cada página (con Search Console),
hallazgos convertidos en tareas de seguimiento e informe mensual.

Los arreglos no se hacen aquí: se proponen con el sistema de propuestas de
siempre (wp_editar_seo, wp_editar_medio, wp_editar_entrada...), con su vista
previa, su aprobación y su deshacer."""

import asyncio
import json
import math
from datetime import date, datetime, timedelta

from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_activos_digitales import TABLA_ACTIVOS, TABLA_CAMBIOS
from ..dependencias._dep_seo import TABLA_AUDITORIAS, TABLA_HALLAZGOS
from . import _mod_google as google
from ._mod_activos_digitales import ActivosDigitalesCRUD, ajustes_efectivos
from ._mod_rastreo import rastrear
from ._repeticiones import ahora_madrid

PESO = {"alta": 3, "media": 2, "baja": 1}
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
         "noviembre", "diciembre"]
# Una auditoría «en curso» de hace más de esto se dio por perdida (se reinició el servidor a medias)
AUDITORIA_PERDIDA = timedelta(hours=2)


def _j(valor) -> str:
    return json.dumps(valor, ensure_ascii=False, default=str)


# --- Las reglas: de lo que vio el rastreo, qué es un problema ---

def _hallazgos_de(rastreo: dict, url_web: str) -> list[dict]:
    h = []

    def nuevo(tipo, gravedad, texto, url=None, detalle=None, pagina=None):
        objeto = (pagina or {}).get("id_wordpress")
        h.append({"tipo": tipo, "gravedad": gravedad, "texto": texto[:500], "url": url, "detalle": detalle or {},
                  "objeto_tipo": objeto[0] if objeto else None, "objeto_id": objeto[1] if objeto else None})

    sitio = rastreo["sitio"]
    if not sitio["robots_txt"]:
        nuevo("sin_robots", "baja", "La web no tiene robots.txt (el archivo que orienta a Google)")
    if not sitio["sitemap"]:
        nuevo("sin_sitemap", "media", "No se encuentra el mapa del sitio (sitemap.xml): a Google le cuesta más descubrir las páginas")
    if sitio["https_obligado"] is False:
        nuevo("sin_https_obligado", "media", "La versión http:// no redirige a https://: hay dos copias de la web")

    validas = [p for p in rastreo["paginas"] if p.get("codigo") == 200 and "titulo" in p]
    indexables = [p for p in validas if "noindex" not in (p.get("robots") or "").lower()]
    for p in rastreo["paginas"]:
        url = p["url"]
        if p.get("bloqueada_robots"):
            continue
        if p.get("codigo") is None:
            nuevo("pagina_no_responde", "alta", f"La página no responde: {p.get('error')}", url, pagina=p)
        elif p["codigo"] >= 400:
            desde = p.get("enlazada_desde") or []
            nuevo("pagina_rota", "alta",
                  f"Página rota (error {p['codigo']})" + (f", enlazada desde {len(desde)} página(s)" if desde else "")
                  + (" y presente en el sitemap" if p.get("en_sitemap") else ""), url, {"enlazada_desde": desde}, p)
        if len(p.get("redirecciones") or []) >= 2:
            nuevo("redireccion_en_cadena", "baja", f"Llega tras {len(p['redirecciones'])} redirecciones seguidas (hace la web más lenta)", url, pagina=p)
        if p.get("ms") and p["ms"] > 3000 and p.get("codigo") == 200:
            nuevo("respuesta_lenta", "media", f"El servidor tarda {p['ms'] / 1000:.1f} s en contestar esta página", url, {"ms": p["ms"]}, p)

    for p in validas:
        url, noindex = p["url"], "noindex" in (p.get("robots") or "").lower()
        if noindex:
            nuevo("noindex", "alta" if p.get("en_sitemap") else "baja",
                  "La página pide a Google que no la muestre (noindex)" + (" pero está en el sitemap" if p.get("en_sitemap") else ""),
                  url, pagina=p)
            continue
        titulo, descripcion = p.get("titulo") or "", (p.get("descripcion") or "").strip()
        if not titulo:
            nuevo("sin_titulo", "alta", "La página no tiene título", url, pagina=p)
        elif len(titulo) > 65:
            nuevo("titulo_largo", "baja", f"Título de {len(titulo)} caracteres: Google lo corta a partir de unos 60", url, {"titulo": titulo}, p)
        elif len(titulo) < 20:
            nuevo("titulo_corto", "baja", f"Título muy corto ({len(titulo)} caracteres): «{titulo}»", url, {"titulo": titulo}, p)
        if not descripcion:
            nuevo("sin_descripcion", "media", "Sin meta descripción: Google se inventa el texto que sale bajo el título", url, pagina=p)
        elif len(descripcion) > 165:
            nuevo("descripcion_larga", "baja", f"Descripción de {len(descripcion)} caracteres: Google la corta a partir de unos 160", url, {"descripcion": descripcion}, p)
        elif len(descripcion) < 70:
            nuevo("descripcion_corta", "baja", f"Descripción muy corta ({len(descripcion)} caracteres)", url, {"descripcion": descripcion}, p)
        if not p.get("h1"):
            nuevo("sin_h1", "media", "La página no tiene encabezado principal (H1)", url, pagina=p)
        elif len(p["h1"]) > 1:
            nuevo("varios_h1", "baja", f"Tiene {len(p['h1'])} encabezados principales (H1); lo normal es uno", url, {"h1": p["h1"]}, p)
        if p.get("imagenes_sin_alt"):
            nuevo("imagenes_sin_alt", "baja", f"{len(p['imagenes_sin_alt'])} imagen(es) sin texto alternativo (ayuda a Google y a personas con discapacidad visual)",
                  url, {"imagenes": p["imagenes_sin_alt"]}, p)
        if p.get("palabras", 0) < 150:
            nuevo("poco_contenido", "baja", f"Muy poco texto ({p.get('palabras', 0)} palabras): a Google le cuesta saber de qué trata", url, pagina=p)
        if p.get("canonical") and p["canonical"].rstrip("/") != p.get("url_final", url).rstrip("/"):
            nuevo("canonical_a_otra", "baja", "La página dice que la versión buena es otra dirección (canonical)", url, {"canonical": p["canonical"]}, p)
        if p.get("en_sitemap") is False and p.get("enlaces_internos") is not None and url.rstrip("/") != url_web.rstrip("/") and sitio["sitemap"]:
            nuevo("fuera_del_sitemap", "baja", "La página no está en el mapa del sitio", url, pagina=p)

    # Duplicados entre páginas indexables
    for campo, tipo, gravedad, que in (("titulo", "titulo_duplicado", "media", "título"),
                                       ("descripcion", "descripcion_duplicada", "baja", "descripción")):
        grupos: dict[str, list] = {}
        for p in indexables:
            if p.get(campo):
                grupos.setdefault(p[campo].strip().lower(), []).append(p)
        for valor, paginas in grupos.items():
            if len(paginas) > 1:
                for p in paginas:
                    nuevo(tipo, gravedad, f"Mismo {que} que otras {len(paginas) - 1} página(s): Google no sabe cuál mostrar",
                          p["url"], {"iguales": [x["url"] for x in paginas if x is not p][:10]}, p)

    portada = next((p for p in validas if p["url"].rstrip("/") == url_web.rstrip("/")), None)
    if portada:
        if not portada.get("datos_estructurados"):
            nuevo("sin_datos_estructurados", "media", "La portada no tiene datos estructurados (schema.org): ayudan a Google y a las IAs a entender quién eres",
                  portada["url"], pagina=portada)
        if not portada.get("lang"):
            nuevo("sin_idioma", "baja", "La web no dice en qué idioma está", portada["url"], pagina=portada)
    return h


# --- Auditoría ---

async def _clics_por_pagina(activo: dict) -> dict[str, dict]:
    """{url: {clics, impresiones}} de los últimos 28 días, si hay Search Console."""
    if not google.cuenta_servicio():
        return {}
    try:
        propiedad = await google.propiedad_de(activo["url"], ajustes_efectivos(activo)["seo_propiedad_search_console"])
        hasta = date.today() - timedelta(days=3)
        filas = await google.rendimiento(propiedad, hasta - timedelta(days=27), hasta, "page", 1000)
    except google.GoogleError:
        return {}
    return {f["clave"].rstrip("/"): f for f in filas}


async def auditar(config: dict, id_activo: int, quien: str, esperar: bool = False) -> dict:
    """Lanza una auditoría. Sin `esperar`, vuelve enseguida con la auditoría
    «en curso» y la termina por detrás (una web grande tarda minutos)."""
    activo = await ActivosDigitalesCRUD(config).obtener_o_error(id_activo)
    if not activo["url"]:
        raise ValueError("Esta web no tiene dirección")
    db = AsyncDatabase(**config)
    en_curso = await db.query(
        f'SELECT id, fecha_inicio FROM "{TABLA_AUDITORIAS.nombre}" WHERE id_activo = %s AND estado = %s', (id_activo, "en_curso"), uno=True)
    if en_curso and en_curso["fecha_inicio"] > ahora_madrid() - AUDITORIA_PERDIDA:
        raise ValueError(f"Ya hay una auditoría en marcha (n.º {en_curso['id']}); espera a que termine")
    await db.query(f'UPDATE "{TABLA_AUDITORIAS.nombre}" SET estado = %s, error = %s WHERE id_activo = %s AND estado = %s',
                   ("fallida", "Se quedó a medias (el servidor se reinició)", id_activo, "en_curso"))
    id_auditoria = await AsyncCrudBase(TABLA_AUDITORIAS, config).insert(
        {"id_activo": id_activo, "fecha_inicio": ahora_madrid(), "estado": "en_curso", "lanzada_por": quien[:150]})
    tarea = _hacer_auditoria(config, activo, id_auditoria)
    if esperar:
        await tarea
    else:
        asyncio.get_running_loop().create_task(tarea)
    return await obtener_auditoria(config, id_auditoria)


async def _hacer_auditoria(config: dict, activo: dict, id_auditoria: int) -> None:
    db = AsyncDatabase(**config)
    try:
        maximo = ajustes_efectivos(activo)["seo_paginas_maximo"]
        rastreo = await rastrear(activo["url"], maximo)
        hallazgos = _hallazgos_de(rastreo, activo["url"])
        trafico = await _clics_por_pagina(activo)
        anteriores = await db.query(
            f'SELECT tipo, url, estado, id_nota FROM "{TABLA_HALLAZGOS.nombre}" WHERE id_activo = %s AND estado IN (%s, %s, %s)',
            (activo["id"], "abierto", "en_tarea", "ignorado"))
        previo = {(a["tipo"], a["url"]): a for a in anteriores}
        ahora = ahora_madrid()
        for h in hallazgos:
            t = trafico.get((h["url"] or "").rstrip("/"), {})
            clics, impresiones = t.get("clics"), t.get("impresiones")
            prioridad = PESO[h["gravedad"]] * (1 + math.log10(1 + (clics or 0)) + 0.5 * math.log10(1 + (impresiones or 0)))
            antes = previo.get((h["tipo"], h["url"]))
            estado = antes["estado"] if antes and antes["estado"] in ("ignorado", "en_tarea") else "abierto"
            await db.query(
                f'INSERT INTO "{TABLA_HALLAZGOS.nombre}" (id_auditoria, id_activo, tipo, gravedad, url, texto, detalle, '
                "objeto_tipo, objeto_id, clics, impresiones, prioridad, estado, id_nota, fecha) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (id_auditoria, activo["id"], h["tipo"], h["gravedad"], (h["url"] or None) and h["url"][:1000], h["texto"],
                 _j(h["detalle"]), h["objeto_tipo"], h["objeto_id"], clics, impresiones, round(prioridad, 3), estado,
                 antes["id_nota"] if antes else None, ahora))
        # Lo que estaba abierto en auditorías anteriores y ya no aparece: resuelto
        nuevos = {(h["tipo"], h["url"]) for h in hallazgos}
        for (tipo, url), a in previo.items():
            if (tipo, url) not in nuevos:
                await db.query(
                    f'UPDATE "{TABLA_HALLAZGOS.nombre}" SET estado = %s, fecha_resuelto = %s WHERE id_activo = %s '
                    "AND tipo = %s AND url IS NOT DISTINCT FROM %s AND estado IN (%s, %s)",
                    ("resuelto", ahora, activo["id"], tipo, url, "abierto", "en_tarea"))
        # Los de auditorías anteriores dejan de contar: la lista buena es la de la última
        await db.query(
            f'UPDATE "{TABLA_HALLAZGOS.nombre}" SET estado = %s WHERE id_activo = %s AND id_auditoria <> %s AND estado = %s',
            ("resuelto", activo["id"], id_auditoria, "abierto"))
        resumen = {g: sum(1 for h in hallazgos if h["gravedad"] == g) for g in PESO}
        resumen.update(sitio=rastreo["sitio"], con_trafico=bool(trafico), segundos=rastreo["segundos"])
        await db.query(
            f'UPDATE "{TABLA_AUDITORIAS.nombre}" SET estado = %s, fecha_fin = %s, paginas = %s, limite_alcanzado = %s, '
            "resumen = %s WHERE id = %s",
            ("terminada", ahora_madrid(), len(rastreo["paginas"]), rastreo["limite_alcanzado"], _j(resumen), id_auditoria))
    except Exception as e:  # que una web caída no deje la auditoría «en curso» para siempre
        await db.query(f'UPDATE "{TABLA_AUDITORIAS.nombre}" SET estado = %s, fecha_fin = %s, error = %s WHERE id = %s',
                       ("fallida", ahora_madrid(), str(e)[:1000], id_auditoria))


async def obtener_auditoria(config: dict, id_auditoria: int) -> dict:
    fila = await AsyncDatabase(**config).query(f'SELECT * FROM "{TABLA_AUDITORIAS.nombre}" WHERE id = %s', (id_auditoria,), uno=True)
    if not fila:
        raise ValueError(f"No existe la auditoría {id_auditoria}")
    return {**fila, "resumen": json.loads(fila["resumen"]) if fila.get("resumen") else None}


async def ultima_auditoria(config: dict, id_activo: int) -> dict | None:
    fila = await AsyncDatabase(**config).query(
        f'SELECT id FROM "{TABLA_AUDITORIAS.nombre}" WHERE id_activo = %s ORDER BY id DESC LIMIT 1', (id_activo,), uno=True)
    return await obtener_auditoria(config, fila["id"]) if fila else None


async def hallazgos(config: dict, id_activo: int, estado: str | None = "abierto", gravedad: str | None = None,
                    limite: int = 100) -> list[dict]:
    """Los de la última auditoría terminada, los más prioritarios primero."""
    db = AsyncDatabase(**config)
    ultima = await db.query(
        f'SELECT max(id) AS id FROM "{TABLA_AUDITORIAS.nombre}" WHERE id_activo = %s AND estado = %s', (id_activo, "terminada"), uno=True)
    if not ultima or not ultima["id"]:
        return []
    condiciones, params = ["id_auditoria = %s"], [ultima["id"]]
    if estado:
        condiciones.append("estado = %s")
        params.append(estado)
    if gravedad:
        condiciones.append("gravedad = %s")
        params.append(gravedad)
    filas = await db.query(
        f'SELECT * FROM "{TABLA_HALLAZGOS.nombre}" WHERE {" AND ".join(condiciones)} ORDER BY prioridad DESC, id LIMIT %s',
        (*params, max(1, min(limite, 1000))))
    return [{**f, "detalle": json.loads(f["detalle"]) if f.get("detalle") else None} for f in filas]


async def marcar_hallazgo(config: dict, id_hallazgo: int, estado: str) -> dict:
    if estado not in ("abierto", "ignorado", "resuelto"):
        raise ValueError("Estado no válido: abierto, ignorado o resuelto")
    db = AsyncDatabase(**config)
    if not await db.query(f'SELECT id FROM "{TABLA_HALLAZGOS.nombre}" WHERE id = %s', (id_hallazgo,), uno=True):
        raise ValueError(f"No existe el hallazgo {id_hallazgo}")
    await db.query(f'UPDATE "{TABLA_HALLAZGOS.nombre}" SET estado = %s, fecha_resuelto = %s WHERE id = %s',
                   (estado, ahora_madrid() if estado == "resuelto" else None, id_hallazgo))
    return await db.query(f'SELECT * FROM "{TABLA_HALLAZGOS.nombre}" WHERE id = %s', (id_hallazgo,), uno=True)


async def hallazgo_a_tarea(config: dict, id_proyecto: int, id_hallazgo: int, id_usuario: int | None, quien: str) -> dict:
    """Crea una nota del bloc con el problema y la pone «pendiente» en el
    seguimiento: así entra en el resumen diario de lo que hay que hacer."""
    from . import _mod_bloc_notas as bloc
    from . import _mod_seguimiento as seguimiento
    db = AsyncDatabase(**config)
    h = await db.query(f'SELECT * FROM "{TABLA_HALLAZGOS.nombre}" WHERE id = %s', (id_hallazgo,), uno=True)
    if not h:
        raise ValueError(f"No existe el hallazgo {id_hallazgo}")
    if h["id_nota"]:
        raise ValueError(f"Este problema ya es una tarea (nota n.º {h['id_nota']})")
    activo = await db.query(f'SELECT nombre FROM "{TABLA_ACTIVOS.nombre}" WHERE id = %s', (h["id_activo"],), uno=True)
    contenido = f"{h['texto']}\n\nPágina: {h['url'] or 'toda la web'}"
    if h["clics"]:
        contenido += f"\n\nEsta página trajo {h['clics']} visitas desde Google en los últimos 28 días."
    nota = await bloc.crear_nota(config, id_proyecto, id_usuario, quien, {
        "titulo": f"SEO {activo['nombre'] if activo else ''}: {h['texto'][:120]}", "contenido": contenido,
        "etiquetas": ["SEO"], "visibilidad": "todos"})
    await seguimiento.cambiar_seguimiento(config, id_proyecto, id_usuario, quien, "nota_bloc", nota["id"], estado="pendiente")
    await db.query(f'UPDATE "{TABLA_HALLAZGOS.nombre}" SET estado = %s, id_nota = %s WHERE id = %s', ("en_tarea", nota["id"], id_hallazgo))
    return {"id_hallazgo": id_hallazgo, "id_nota": nota["id"], "titulo_nota": nota.get("titulo")}


# --- Google: rendimiento y velocidad ---

async def rendimiento_google(config: dict, id_activo: int, dias: int = 28) -> dict:
    activo = await ActivosDigitalesCRUD(config).obtener_o_error(id_activo)
    propiedad = await google.propiedad_de(activo["url"], ajustes_efectivos(activo)["seo_propiedad_search_console"])
    resumen = await google.resumen_periodo(propiedad, dias)
    desde, hasta = date.fromisoformat(resumen["desde"]), date.fromisoformat(resumen["hasta"])
    return {**resumen, "propiedad": propiedad,
            "paginas": await google.rendimiento(propiedad, desde, hasta, "page", 15),
            "busquedas": await google.rendimiento(propiedad, desde, hasta, "query", 15)}


# --- Informe mensual ---

def _variacion(actual: float, anterior: float) -> str:
    if not anterior:
        return "nuevo" if actual else "="
    cambio = (actual - anterior) / anterior * 100
    return f"{cambio:+.0f} %"


async def informe_mensual(config: dict, id_activo: int, anio: int, mes: int) -> str:
    """El informe del mes en markdown: tráfico desde Google, páginas y
    búsquedas, velocidad, cambios hechos y su efecto, problemas pendientes."""
    activo = await ActivosDigitalesCRUD(config).obtener_o_error(id_activo)
    inicio = date(anio, mes, 1)
    fin = (date(anio + (mes == 12), mes % 12 + 1, 1) - timedelta(days=1))
    inicio_ant = (inicio - timedelta(days=1)).replace(day=1)
    fin_ant = inicio - timedelta(days=1)
    partes = [f"# Informe SEO de «{activo['nombre']}» — {MESES[mes - 1]} de {anio}", "",
              f"Web: {activo['url']}  ", f"Generado el {ahora_madrid():%d/%m/%Y}.", ""]

    try:
        propiedad = await google.propiedad_de(activo["url"], ajustes_efectivos(activo)["seo_propiedad_search_console"])
    except google.GoogleError as e:
        propiedad = None
        partes += ["## Visitas desde Google", "", f"Sin datos de Search Console: {e}", ""]
    if propiedad:
        tot = (await google.rendimiento(propiedad, inicio, fin) or [{"clics": 0, "impresiones": 0, "ctr": 0, "posicion": 0}])[0]
        ant = (await google.rendimiento(propiedad, inicio_ant, fin_ant) or [{"clics": 0, "impresiones": 0, "ctr": 0, "posicion": 0}])[0]
        partes += ["## Visitas desde Google", "",
                   "| | Este mes | Mes anterior | Cambio |", "|---|---:|---:|---:|",
                   f"| Clics (visitas desde Google) | {tot['clics']} | {ant['clics']} | {_variacion(tot['clics'], ant['clics'])} |",
                   f"| Impresiones (veces que salió en Google) | {tot['impresiones']} | {ant['impresiones']} | {_variacion(tot['impresiones'], ant['impresiones'])} |",
                   f"| CTR (de cada 100 que la ven, cuántos entran) | {tot['ctr']} % | {ant['ctr']} % | |",
                   f"| Posición media | {tot['posicion']} | {ant['posicion']} | {'mejor' if tot['posicion'] and ant['posicion'] and tot['posicion'] < ant['posicion'] else 'peor' if tot['posicion'] > ant['posicion'] > 0 else '='} |", ""]
        paginas = await google.rendimiento(propiedad, inicio, fin, "page", 10)
        if paginas:
            partes += ["## Páginas que más visitas traen", "", "| Página | Clics | Impresiones | Posición |", "|---|---:|---:|---:|"]
            partes += [f"| {p['clave']} | {p['clics']} | {p['impresiones']} | {p['posicion']} |" for p in paginas] + [""]
        busquedas = await google.rendimiento(propiedad, inicio, fin, "query", 10)
        if busquedas:
            partes += ["## Búsquedas por las que te encuentran", "", "| Búsqueda | Clics | Impresiones | Posición |", "|---|---:|---:|---:|"]
            partes += [f"| {b['clave']} | {b['clics']} | {b['impresiones']} | {b['posicion']} |" for b in busquedas] + [""]

    # Cambios del mes y su efecto (clics de esa página 28 días antes y después)
    cambios = await AsyncDatabase(**config).query(
        f"SELECT resumen, fecha_resolucion, datos_aplicados FROM \"{TABLA_CAMBIOS.nombre}\" WHERE id_activo = %s "
        "AND estado = 'aplicado' AND fecha_resolucion >= %s AND fecha_resolucion < %s ORDER BY fecha_resolucion",
        (id_activo, inicio, fin + timedelta(days=1)))
    if cambios:
        partes += ["## Cambios hechos en la web", ""]
        for c in cambios:
            linea = f"- {c['fecha_resolucion']:%d/%m}: {c['resumen']}"
            enlace = (json.loads(c["datos_aplicados"]) if c.get("datos_aplicados") else {}).get("enlace")
            dia = c["fecha_resolucion"].date()
            if propiedad and enlace and dia + timedelta(days=14) <= date.today() - timedelta(days=3):
                antes = (await google.rendimiento(propiedad, dia - timedelta(days=28), dia - timedelta(days=1), filtro_pagina=enlace) or [{"clics": 0}])[0]
                despues = (await google.rendimiento(propiedad, dia + timedelta(days=1), min(dia + timedelta(days=28), date.today() - timedelta(days=3)), filtro_pagina=enlace) or [{"clics": 0}])[0]
                linea += f" — clics de esa página: {antes['clics']} antes, {despues['clics']} después"
            partes.append(linea)
        partes.append("")

    from . import _mod_geo as geo  # aquí: geo usa módulos que cargan este
    r_geo = await geo.resultados(config, id_activo)
    if r_geo.get("medido") and r_geo["actual"]["respuestas"]:
        a = r_geo["actual"]
        partes += ["## Presencia en las respuestas de las IAs (GEO)", "",
                   f"De {a['respuestas']} respuestas de IAs a las preguntas de seguimiento, la marca sale en {a['aparece']} "
                   f"y la web aparece citada en {a['enlaza']}.", ""]
        if a["competidores"]:
            partes += ["Otros sitios que citan: " + ", ".join(f"{d} ({n})" for d, n in a["competidores"][:6]), ""]
    pendientes = await hallazgos(config, id_activo, "abierto", limite=10)
    if pendientes:
        partes += ["## Lo que más conviene arreglar", ""]
        partes += [f"- **{h['gravedad'].capitalize()}** — {h['texto']}" + (f" ({h['url']})" if h["url"] else "")
                   + (f" · {h['clics']} clics/28 días" if h["clics"] else "") for h in pendientes] + [""]
    partes.append("_Datos de Google Search Console (Google tarda unos 3 días en tenerlos completos)._")
    return "\n".join(partes)


async def guardar_informe(config: dict, id_activo: int, anio: int, mes: int) -> dict:
    """Genera el informe y lo guarda como documento de la GD (tipo «Informe
    SEO»), con nueva versión si ya existía el de ese mes. Desde ahí se saca
    en PDF con el estilo del cliente, como cualquier documento."""
    from ._mod_documentos import DocumentosCRUD
    from ._mod_versiones import guardar_documento
    activo = await ActivosDigitalesCRUD(config).obtener_o_error(id_activo)
    markdown = await informe_mensual(config, id_activo, anio, mes)
    nombre = f"Informe SEO {activo['nombre']} {MESES[mes - 1]} {anio}"
    existentes = [d for d in await DocumentosCRUD(config).buscar(tipo_documento="Informe SEO", limite=500, incluir_archivados=True)
                  if d["nombre"] == nombre]
    fin = date(anio + (mes == 12), mes % 12 + 1, 1) - timedelta(days=1)
    r = await guardar_documento(config, nombre, "Informe SEO", markdown, fin.isoformat(),
                                id_documento_existente=existentes[0]["id"] if existentes else None)
    return {"id_documento": r["id_documento"], "nombre": nombre, "markdown": markdown}


def mes_anterior(hoy: datetime) -> tuple[int, int]:
    primero = hoy.date().replace(day=1) - timedelta(days=1)
    return primero.year, primero.month


# --- Comprobaciones de vigilancia (ver TIPOS en _mod_vigilancia.py) ---

async def comprobacion_velocidad(activo: dict, cliente, previo: dict, **_) -> tuple[str, str, dict]:
    try:
        v = await google.velocidad(activo["url"] + "/", "mobile")
    except google.GoogleError as e:
        return "sin_datos", str(e), {}
    except Exception as e:  # red, tiempo...
        return "error", f"No se ha podido medir la velocidad: {e}", {}
    rendimiento = v["puntuaciones"].get("performance", 0)
    texto = f"Velocidad en móvil: {rendimiento}/100"
    if v["lcp_ms"]:
        texto += f", la parte principal tarda {v['lcp_ms'] / 1000:.1f} s en verse"
    if rendimiento < 50 or (v["lcp_ms"] or 0) > 4000:
        mejoras = "; ".join(o["que"] for o in v["oportunidades"][:3])
        return "aviso", texto + (f". Lo que más ayudaría: {mejoras}" if mejoras else ""), v
    return "ok", texto, v


async def comprobacion_trafico(activo: dict, cliente, previo: dict, **_) -> tuple[str, str, dict]:
    """Visitas desde Google de los últimos 7 días frente a los 7 anteriores."""
    try:
        propiedad = await google.propiedad_de(activo["url"], ajustes_efectivos(activo)["seo_propiedad_search_console"])
        r = await google.resumen_periodo(propiedad, 7)
    except google.GoogleError as e:
        return "sin_datos", str(e), {}
    actual, anterior = r["actual"]["clics"], r["anterior"]["clics"]
    texto = f"{actual} visitas desde Google en 7 días ({_variacion(actual, anterior)} frente a la semana anterior)"
    if anterior >= 20 and actual < anterior * 0.7:
        return "aviso", "Bajan las visitas desde Google: " + texto, r
    return "ok", texto, r


async def comprobacion_auditoria(activo: dict, cliente, previo: dict, config: dict | None = None, **_) -> tuple[str, str, dict]:
    auditoria = await auditar(config, activo["id"], "Vigilancia semanal", esperar=True)
    if auditoria["estado"] != "terminada":
        return "error", f"La auditoría no ha podido terminar: {auditoria.get('error')}", {"id_auditoria": auditoria["id"]}
    abiertos = await hallazgos(config, activo["id"], "abierto", limite=1000)
    altos = [h for h in abiertos if h["gravedad"] == "alta"]
    detalle = {"id_auditoria": auditoria["id"], "paginas": auditoria["paginas"], "abiertos": len(abiertos), "altos": len(altos)}
    texto = f"{auditoria['paginas']} páginas revisadas: {len(abiertos)} cosas que mejorar ({len(altos)} importantes)"
    if altos:
        return "aviso", texto + ". La más prioritaria: " + altos[0]["texto"], detalle
    return "ok", texto, detalle


async def comprobacion_informe(activo: dict, cliente, previo: dict, config: dict | None = None,
                               id_proyecto: int | None = None, **_) -> tuple[str, str, dict]:
    """Una vez al mes guarda el informe del mes anterior como documento y avisa."""
    anio, mes = mes_anterior(ahora_madrid())
    clave = f"{anio}-{mes:02d}"
    if previo.get("ultimo") == clave:
        return "ok", f"Informe de {MESES[mes - 1]} ya generado", previo
    r = await guardar_informe(config, activo["id"], anio, mes)
    if id_proyecto is not None:
        from ._mod_vigilancia import notificar
        await notificar(config, id_proyecto, f"Informe SEO de «{activo['nombre']}»: {MESES[mes - 1]} de {anio}",
                        f"Ya está en tus documentos: «{r['nombre']}». Desde allí puedes sacarlo en PDF con tu estilo.", email=True)
    return "ok", f"Informe de {MESES[mes - 1]} guardado como documento («{r['nombre']}»)", {"ultimo": clave, "id_documento": r["id_documento"]}
