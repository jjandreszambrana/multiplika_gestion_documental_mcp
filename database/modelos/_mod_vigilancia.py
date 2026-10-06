"""Vigilancia de webs: qué se comprueba, cuándo, dónde se guarda y a quién
se avisa — ver docs/gestion-documental.md → "Webs y redes sociales" (fase 2).
Las comprobaciones en sí están en _mod_comprobaciones_web.py.

- Cada activo con dirección tiene sus comprobaciones (se crean solas la
  primera vez que se miran o en la pasada del cron), cada una con su
  frecuencia. Un activo en pausa o archivado no se vigila.
- Avisos: lo GRAVE avisa en el momento (campanita + email) a todos los que
  pueden escribir en el proyecto, solo al pasar a grave, y otra vez cuando
  se arregla. Lo demás va al resumen semanal (lunes a partir de las 8:00).
- El cron (scripts/procesar_vigilancia.py, cada 5 minutos) reclama cada
  comprobación con un UPDATE condicionado antes de lanzarla: dos pasadas
  que se solapen no la repiten."""

import asyncio
import html
import os
import json
import time
from datetime import datetime, timedelta

from mtpk_postgres.async_adapter import AsyncDatabase

from lib.roles_proyecto import puede_editar_proyecto

from ..dependencias._dep_activos_digitales import TABLA_ACTIVOS, TABLA_CAMBIOS
from ..dependencias._dep_programaciones import TABLA_NOTIFICACIONES
from ..dependencias._dep_vigilancia import TABLA_COMPROBACIONES, TABLA_RESULTADOS, TABLA_RESUMENES_VIGILANCIA
from . import _mod_comprobaciones_web as cw
from . import _mod_cloudflare as cloudflare
from . import _mod_mantenimiento_web as mw
from . import _mod_geo as geo
from . import _mod_seo as seo
from ._mod_google import cuenta_servicio
from ._mod_activos_digitales import ActivosDigitalesCRUD, ajustes_efectivos, es_wordpress
from ._mod_configuracion import ConfiguracionCRUD
from ._mod_credenciales import CredencialesCRUD
from ._mod_envios import mandar_correo
from ._mod_programaciones import usuarios_del_proyecto
from ._mod_vulnerabilidades import NOMBRE_CREDENCIAL as CREDENCIAL_VULNERABILIDADES
from ._repeticiones import ahora_madrid

# tipo -> qué es, cada cuántos minutos por defecto y si necesita entrar en WordPress
TIPOS = {
    "disponibilidad": {"titulo": "La web responde", "cada": 5, "wordpress": False, "funcion": cw.disponibilidad},
    "certificado": {"titulo": "Certificado de seguridad (candado)", "cada": 720, "wordpress": False, "funcion": cw.certificado},
    "dominio": {"titulo": "Caducidad del dominio", "cada": 1440, "wordpress": False, "funcion": cw.dominio},
    "cabeceras": {"titulo": "Protecciones básicas del servidor", "cada": 1440, "wordpress": False, "funcion": cw.cabeceras},
    "archivos_expuestos": {"titulo": "Archivos que no deberían verse", "cada": 1440, "wordpress": False,
                           "funcion": cw.archivos_expuestos},
    "wordpress": {"titulo": "Administradores y plugins", "cada": 360, "wordpress": True, "funcion": cw.wordpress},
    "spam": {"titulo": "Comentarios pendientes y spam", "cada": 1440, "wordpress": True, "funcion": cw.spam},
    # Estas cuatro necesitan el conector de Multiplika instalado en la web
    "integridad": {"titulo": "Archivos modificados (posible hackeo)", "cada": 1440, "wordpress": True, "conector": True,
                   "funcion": mw.integridad},
    "errores": {"titulo": "Errores graves de la web", "cada": 60, "wordpress": True, "conector": True,
                "funcion": mw.errores},
    "actualizaciones": {"titulo": "Actualizaciones", "cada": 720, "wordpress": True, "conector": True,
                        "funcion": mw.actualizaciones, "max_segundos": 3600},
    "copias": {"titulo": "Copias de seguridad", "cada": 1440, "wordpress": True, "conector": True,
               "funcion": mw.copias, "max_segundos": 3600},
    # Solo si en los ajustes de la web hay credencial de Cloudflare
    "cloudflare": {"titulo": "Escudo de Cloudflare", "cada": 360, "wordpress": False, "cloudflare": True,
                   "funcion": cloudflare.comprobacion},
    # SEO (fase 3). Velocidad solo con clave de API de Google en el servidor;
    # tráfico e informe, con la cuenta de servicio de Search Console.
    "velocidad": {"titulo": "Velocidad (Google PageSpeed)", "cada": 1440, "wordpress": False, "google": "clave",
                  "funcion": seo.comprobacion_velocidad, "max_segundos": 180},
    "trafico_google": {"titulo": "Visitas desde Google", "cada": 1440, "wordpress": False, "google": "search_console",
                       "funcion": seo.comprobacion_trafico},
    "auditoria_seo": {"titulo": "Auditoría SEO", "cada": 10080, "wordpress": False, "funcion": seo.comprobacion_auditoria,
                      "max_segundos": 3600},
    "geo": {"titulo": "Presencia en las respuestas de las IAs (GEO)", "cada": 43200, "wordpress": False,
            "funcion": geo.comprobacion, "max_segundos": 3600},
    "informe_seo": {"titulo": "Informe SEO mensual", "cada": 1440, "wordpress": False, "google": "search_console",
                    "informe": True, "funcion": seo.comprobacion_informe},
}
# Las que reciben config e id_proyecto (las demás solo miran la web)
_CON_CONTEXTO = {"integridad", "errores", "actualizaciones", "copias", "cloudflare", "auditoria_seo", "informe_seo", "geo"}
MINIMO_MINUTOS = 5
TIEMPO_MAXIMO_SEGUNDOS = 120
EN_PARALELO = 4
HORA_RESUMEN = 8
GRAVEDAD = {"ok": 0, "sin_datos": 1, "error": 1, "aviso": 2, "grave": 3}


def tipos_para(activo: dict) -> list[str]:
    if not activo.get("url"):
        return []
    ajustes = ajustes_efectivos(activo)
    google = {"clave": bool(os.environ.get("GD_GOOGLE_API_KEY")), "search_console": bool(cuenta_servicio())}
    return [t for t, d in TIPOS.items()
            if (not d["wordpress"] or es_wordpress(activo)) and (not d.get("conector") or activo.get("conector_instalado"))
            and (not d.get("cloudflare") or ajustes["cloudflare_credencial"])
            and (not d.get("google") or google[d["google"]])
            and (not d.get("informe") or ajustes["seo_informe_mensual"])]


def _cada_minutos(activo: dict, tipo: str) -> int:
    if tipo == "copias":
        return ajustes_efectivos(activo)["copias_cada_horas"] * 60
    return TIPOS[tipo]["cada"]


def _presentar(fila: dict) -> dict:
    return {**fila, "titulo": TIPOS.get(fila["tipo"], {}).get("titulo", fila["tipo"]),
            "detalle": json.loads(fila["detalle"]) if fila.get("detalle") else None}


async def asegurar_comprobaciones(config: dict, activo: dict) -> None:
    """Crea las que falten (las nuevas, para ya). No toca las existentes."""
    db = AsyncDatabase(**config)
    for tipo in tipos_para(activo):
        await db.query(
            f'INSERT INTO "{TABLA_COMPROBACIONES.nombre}" (id_activo, tipo, cada_minutos, proxima) '
            "VALUES (%s, %s, %s, %s) ON CONFLICT (id_activo, tipo) DO NOTHING",
            (activo["id"], tipo, _cada_minutos(activo, tipo), ahora_madrid()),
        )
    # La frecuencia de las copias la manda el ajuste de la web, no la comprobación
    if "copias" in tipos_para(activo):
        await db.query(
            f'UPDATE "{TABLA_COMPROBACIONES.nombre}" SET cada_minutos = %s WHERE id_activo = %s AND tipo = %s '
            "AND cada_minutos <> %s", (_cada_minutos(activo, "copias"), activo["id"], "copias", _cada_minutos(activo, "copias")))


async def listar_estado(config: dict, id_activo: int) -> list[dict]:
    activo = await ActivosDigitalesCRUD(config).obtener_o_error(id_activo)
    await asegurar_comprobaciones(config, activo)
    filas = await AsyncDatabase(**config).query(
        f'SELECT * FROM "{TABLA_COMPROBACIONES.nombre}" WHERE id_activo = %s ORDER BY id', (id_activo,))
    validos = tipos_para(activo)
    return [_presentar(f) for f in filas if f["tipo"] in validos]


async def peor_estado_por_activo(config: dict) -> dict[int, str]:
    """{id_activo: el peor estado de sus comprobaciones activas} — para la lista."""
    filas = await AsyncDatabase(**config).query(
        f'SELECT id_activo, estado FROM "{TABLA_COMPROBACIONES.nombre}" WHERE activa = true AND estado IS NOT NULL')
    peor: dict[int, str] = {}
    for f in filas:
        if GRAVEDAD.get(f["estado"], 0) >= GRAVEDAD.get(peor.get(f["id_activo"]), -1):
            peor[f["id_activo"]] = f["estado"]
    return peor


async def historial(config: dict, id_activo: int, tipo: str | None = None, dias: int = 30,
                    solo_problemas: bool = False, limite: int = 200) -> list[dict]:
    """Los más recientes primero. Con `solo_problemas`, solo los momentos en
    que algo empezó a ir mal o cambió: el mismo aviso repetido en cada pasada
    sale una vez (la primera)."""
    condiciones, params = ["id_activo = %s", "fecha >= %s"], [id_activo, ahora_madrid() - timedelta(days=dias)]
    if tipo:
        condiciones.append("tipo = %s")
        params.append(tipo)
    filas = await AsyncDatabase(**config).query(
        f'SELECT id, tipo, fecha, estado, resumen, duracion_ms FROM "{TABLA_RESULTADOS.nombre}" '
        f"WHERE {' AND '.join(condiciones)} ORDER BY fecha ASC, id ASC", tuple(params))
    if solo_problemas:
        ultimo, cambios = {}, []
        for f in filas:
            if ultimo.get(f["tipo"]) != (f["estado"], f["resumen"]) and f["estado"] != "ok":
                cambios.append(f)
            ultimo[f["tipo"]] = (f["estado"], f["resumen"])
        filas = cambios
    filas = list(reversed(filas))[:max(1, min(limite, 1000))]
    return [{**f, "titulo": TIPOS.get(f["tipo"], {}).get("titulo", f["tipo"])} for f in filas]


async def configurar(config: dict, id_activo: int, tipo: str, activa: bool | None = None,
                     cada_minutos: int | None = None) -> dict:
    activo = await ActivosDigitalesCRUD(config).obtener_o_error(id_activo)
    if tipo not in tipos_para(activo):
        raise ValueError(f"Esta web no tiene la comprobación «{tipo}». Tiene: {', '.join(tipos_para(activo))}")
    await asegurar_comprobaciones(config, activo)
    cambios, params = [], []
    if activa is not None:
        cambios.append("activa = %s")
        params.append(activa)
    if cada_minutos is not None and tipo == "copias":
        raise ValueError("Cada cuánto se hacen las copias se cambia en los ajustes de la web (copias_cada_horas)")
    if cada_minutos is not None:
        if not MINIMO_MINUTOS <= cada_minutos <= 7 * 1440:
            raise ValueError(f"La frecuencia tiene que estar entre {MINIMO_MINUTOS} minutos y 7 días")
        cambios += ["cada_minutos = %s", "proxima = %s"]
        params += [cada_minutos, ahora_madrid()]
    if cambios:
        await AsyncDatabase(**config).query(
            f'UPDATE "{TABLA_COMPROBACIONES.nombre}" SET {", ".join(cambios)} WHERE id_activo = %s AND tipo = %s',
            (*params, id_activo, tipo))
    return next(c for c in await listar_estado(config, id_activo) if c["tipo"] == tipo)


async def aceptar_administradores(config: dict, id_activo: int, quien: str) -> dict:
    """Da por buenos los administradores que hay ahora en la web: deja de
    avisar de los «nuevos». Lo decide una persona, nunca solo."""
    db = AsyncDatabase(**config)
    fila = await db.query(f'SELECT * FROM "{TABLA_COMPROBACIONES.nombre}" WHERE id_activo = %s AND tipo = %s',
                          (id_activo, "wordpress"), uno=True)
    detalle = json.loads(fila["detalle"]) if fila and fila["detalle"] else None
    if not detalle or "administradores" not in detalle:
        raise ValueError("Todavía no se ha revisado ninguna vez esta web: no hay administradores que dar por buenos")
    detalle["administradores_conocidos"] = [a["id"] for a in detalle["administradores"]]
    detalle["nuevos_administradores"] = []  # el resumen y el estado se rehacen en la próxima pasada (ya)
    detalle["aceptados_por"], detalle["fecha_aceptados"] = quien, ahora_madrid().isoformat()
    await db.query(f'UPDATE "{TABLA_COMPROBACIONES.nombre}" SET detalle = %s, proxima = %s WHERE id = %s',
                   (cw.a_json(detalle), ahora_madrid(), fila["id"]))
    return {"administradores": [a["nombre"] for a in detalle["administradores"]], "comprobar_de_nuevo": True}


# --- Ejecutar ---

async def _ejecutar(config: dict, id_proyecto: int, comprobacion: dict, activo: dict, avisar: bool = True) -> dict:
    tipo = comprobacion["tipo"]
    previo = json.loads(comprobacion["detalle"]) if comprobacion.get("detalle") else {}
    inicio = time.monotonic()
    try:
        cliente = None
        if TIPOS[tipo]["wordpress"]:
            try:
                cliente = await ActivosDigitalesCRUD(config).cliente_wordpress(activo)
            except ValueError as e:
                raise _SinCliente(str(e))
        extra = {"config": config, "id_proyecto": id_proyecto} if tipo in _CON_CONTEXTO else {}
        if tipo == "wordpress":
            credencial = await CredencialesCRUD(config).obtener_por_nombre(CREDENCIAL_VULNERABILIDADES)
            extra = {"config": config, "token_vulnerabilidades":
                     await CredencialesCRUD(config).valor_descifrado(credencial["id"]) if credencial else None}
        estado, resumen, detalle = await asyncio.wait_for(
            TIPOS[tipo]["funcion"](activo, cliente, previo, **extra), TIPOS[tipo].get("max_segundos", TIEMPO_MAXIMO_SEGUNDOS))
    except _SinCliente as e:
        estado, resumen, detalle = "error", str(e), {}
    except asyncio.TimeoutError:
        estado, resumen, detalle = "error", f"La comprobación tardó más de {TIPOS[tipo].get('max_segundos', TIEMPO_MAXIMO_SEGUNDOS)} s", {}
    except Exception as e:  # una comprobación rota no debe parar a las demás
        estado, resumen, detalle = "error", f"La comprobación ha fallado: {e}", {}
    if tipo == "wordpress" and "administradores_conocidos" in previo and "administradores_conocidos" not in detalle:
        detalle["administradores_conocidos"] = previo["administradores_conocidos"]  # que un fallo no borre la memoria
    duracion = int((time.monotonic() - inicio) * 1000)
    ahora = ahora_madrid()
    resumen = resumen[:500]
    db = AsyncDatabase(**config)
    await db.query(
        f'INSERT INTO "{TABLA_RESULTADOS.nombre}" (id_comprobacion, id_activo, tipo, fecha, estado, resumen, detalle, duracion_ms) '
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
        (comprobacion["id"], activo["id"], tipo, ahora, estado, resumen, cw.a_json(detalle), duracion))
    await db.query(
        f'UPDATE "{TABLA_COMPROBACIONES.nombre}" SET ultima = %s, estado = %s, resumen = %s, detalle = %s WHERE id = %s',
        (ahora, estado, resumen, cw.a_json(detalle), comprobacion["id"]))
    if avisar:
        await _avisar_si_cambia(config, id_proyecto, comprobacion, activo, estado, resumen)
    return {"tipo": tipo, "titulo": TIPOS[tipo]["titulo"], "estado": estado, "resumen": resumen,
            "detalle": detalle, "duracion_ms": duracion}


class _SinCliente(Exception):
    pass


async def _avisar_si_cambia(config: dict, id_proyecto: int, comprobacion: dict, activo: dict,
                            estado: str, resumen: str) -> None:
    antes = comprobacion.get("estado_avisado")
    if estado == "grave" and antes != "grave":
        titulo = f"Problema en «{activo['nombre']}»: {TIPOS[comprobacion['tipo']]['titulo'].lower()}"
    elif estado == "ok" and antes == "grave":
        titulo = f"Resuelto en «{activo['nombre']}»: {TIPOS[comprobacion['tipo']]['titulo'].lower()}"
    else:
        return
    await AsyncDatabase(**config).query(
        f'UPDATE "{TABLA_COMPROBACIONES.nombre}" SET estado_avisado = %s WHERE id = %s', (estado, comprobacion["id"]))
    await notificar(config, id_proyecto, titulo, resumen, email=True)


async def destinatarios(id_proyecto: int) -> list[dict]:
    """Todos los usuarios que pueden escribir en el proyecto (no invitados)."""
    return [u for u in await usuarios_del_proyecto(id_proyecto) if await puede_editar_proyecto(u["id"], id_proyecto)]


async def notificar(config: dict, id_proyecto: int, titulo: str, texto: str, email: bool) -> int:
    db = AsyncDatabase(**config)
    cuenta = await ConfiguracionCRUD(config).obtener_cuenta_email() if email else None
    cuerpo_html = "<p>" + html.escape(texto).replace("\n", "<br>") + "</p>"
    enviados = 0
    for usuario in await destinatarios(id_proyecto):
        estado_email, error_email = ("no_aplica", None) if not email else ("fallido", "el proyecto no tiene cuenta de correo configurada")
        if cuenta:
            try:
                await asyncio.to_thread(mandar_correo, cuenta, usuario["email"], titulo, texto, cuerpo_html)
                estado_email, error_email = "enviado", None
            except Exception as e:  # SMTP, red... no debe parar al resto
                error_email = str(e)[:500]
        await db.query(
            f'INSERT INTO "{TABLA_NOTIFICACIONES.nombre}" (id_usuario, origen, titulo, texto, fecha, estado_email, error_email) '
            "VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (usuario["id"], "vigilancia", titulo[:255], texto, ahora_madrid(), estado_email, error_email))
        enviados += 1
    return enviados


async def comprobar_ahora(config: dict, id_proyecto: int, id_activo: int, tipo: str | None = None) -> list[dict]:
    """Lanza ya las comprobaciones de un activo (todas o una). Avisa igual que
    el cron si algo pasa a grave."""
    activo = await ActivosDigitalesCRUD(config).obtener_o_error(id_activo)
    if not activo["url"]:
        raise ValueError("Esta web o cuenta no tiene dirección: no hay nada que vigilar")
    comprobaciones = [c for c in await listar_estado(config, id_activo) if not tipo or c["tipo"] == tipo]
    if tipo and not comprobaciones:
        raise ValueError(f"Esta web no tiene la comprobación «{tipo}». Tiene: {', '.join(tipos_para(activo))}")
    filas = await AsyncDatabase(**config).query(
        f'SELECT * FROM "{TABLA_COMPROBACIONES.nombre}" WHERE id = ANY(%s)', ([c["id"] for c in comprobaciones],))
    return list(await asyncio.gather(*(_ejecutar(config, id_proyecto, f, activo) for f in filas)))


def es_larga(tipo: str) -> bool:
    """Copias, actualizaciones, auditorías...: pueden tardar mucho."""
    return TIPOS[tipo].get("max_segundos", TIEMPO_MAXIMO_SEGUNDOS) > TIEMPO_MAXIMO_SEGUNDOS


async def procesar_vigilancia(config: dict, id_proyecto: int, ahora: datetime | None = None,
                              incluir_largas: bool = True) -> dict:
    """La pasada del cron: lanza las que toquen y, el lunes, el resumen. Sin
    `incluir_largas` deja las largas para otra pasada (el cron solo deja
    hacerlas a un proceso a la vez, ver scripts/procesar_vigilancia.py)."""
    ahora = ahora or ahora_madrid()
    db = AsyncDatabase(**config)
    activos = await db.query(
        f'SELECT * FROM "{TABLA_ACTIVOS.nombre}" WHERE archivado = false AND estado <> %s AND url IS NOT NULL', ("pausado",))
    por_id = {a["id"]: a for a in activos}
    for activo in activos:
        await asegurar_comprobaciones(config, activo)
    pendientes = await db.query(
        f'SELECT * FROM "{TABLA_COMPROBACIONES.nombre}" WHERE activa = true AND proxima <= %s ORDER BY proxima', (ahora,))
    tareas = []
    for c in pendientes:
        activo = por_id.get(c["id_activo"])
        if not activo or c["tipo"] not in tipos_para(activo) or (es_larga(c["tipo"]) and not incluir_largas):
            continue
        reclamada = await db.query(
            f'UPDATE "{TABLA_COMPROBACIONES.nombre}" SET proxima = %s WHERE id = %s AND proxima = %s',
            (ahora + timedelta(minutes=c["cada_minutos"]), c["id"], c["proxima"]))
        if reclamada == 1:
            tareas.append((c, activo))

    semaforo = asyncio.Semaphore(EN_PARALELO)

    async def una(c, activo):
        async with semaforo:
            return await _ejecutar(config, id_proyecto, c, activo)

    resultados = await asyncio.gather(*(una(c, a) for c, a in tareas))
    return {"hechas": len(resultados), "graves": sum(r["estado"] == "grave" for r in resultados),
            "resumen": await mandar_resumen_semanal(config, id_proyecto, ahora)}


async def texto_resumen(config: dict, desde: datetime) -> str | None:
    """El resumen de la semana: lo que no está bien de cada web y los
    cambios hechos. None si no hay nada vigilado."""
    db = AsyncDatabase(**config)
    activos = await db.query(f'SELECT id, nombre FROM "{TABLA_ACTIVOS.nombre}" WHERE archivado = false ORDER BY nombre')
    if not activos:
        return None
    lineas = []
    for activo in activos:
        comprobaciones = await db.query(
            f'SELECT tipo, estado, resumen FROM "{TABLA_COMPROBACIONES.nombre}" '
            "WHERE id_activo = %s AND activa = true AND estado IS NOT NULL ORDER BY id", (activo["id"],))
        caidas = await db.query(
            f"SELECT count(*) AS n FROM \"{TABLA_RESULTADOS.nombre}\" WHERE id_activo = %s AND tipo = 'disponibilidad' "
            "AND estado = 'grave' AND fecha >= %s", (activo["id"], desde), uno=True)
        cambios = await db.query(
            f"SELECT count(*) AS n FROM \"{TABLA_CAMBIOS.nombre}\" WHERE id_activo = %s AND estado IN ('aplicado', 'deshecho') "
            "AND fecha_resolucion >= %s", (activo["id"], desde), uno=True)
        pendientes = await db.query(
            f"SELECT count(*) AS n FROM \"{TABLA_CAMBIOS.nombre}\" WHERE id_activo = %s AND estado = 'propuesto'",
            (activo["id"],), uno=True)
        if not comprobaciones and not cambios["n"] and not pendientes["n"]:
            continue
        problemas = [f"  - {TIPOS.get(c['tipo'], {}).get('titulo', c['tipo'])}: {c['resumen']}"
                     for c in comprobaciones if c["estado"] != "ok"]
        lineas.append(f"{activo['nombre']}: " + ("todo bien" if not problemas else f"{len(problemas)} cosa(s) que mirar"))
        lineas += problemas
        if caidas["n"]:
            lineas.append(f"  - Se detectó caída {caidas['n']} vez/veces esta semana")
        if cambios["n"]:
            lineas.append(f"  - Cambios hechos en la web esta semana: {cambios['n']}")
        if pendientes["n"]:
            lineas.append(f"  - Propuestas esperando aprobación: {pendientes['n']}")
    return "\n".join(lineas) if lineas else None


async def mandar_resumen_semanal(config: dict, id_proyecto: int, ahora: datetime) -> str | None:
    if ahora.weekday() != 0 or ahora.hour < HORA_RESUMEN:
        return None
    reclamado = await AsyncDatabase(**config).query(
        f'INSERT INTO "{TABLA_RESUMENES_VIGILANCIA.nombre}" (semana, fecha_envio) VALUES (%s, %s) ON CONFLICT (semana) DO NOTHING',
        (ahora.date(), ahora))
    if reclamado != 1:
        return None
    texto = await texto_resumen(config, ahora - timedelta(days=7))
    if not texto:
        return None
    titulo = f"Resumen semanal de tus webs {ahora:%d/%m/%Y}"
    enviados = await notificar(config, id_proyecto, titulo, texto, email=True)
    return f"{enviados} destinatario(s)"
