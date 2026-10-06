"""Herramientas MCP de webs y redes sociales — ver docs/gestion-documental.md
→ "Webs y redes sociales". Las mismas reglas que el panel: viven en
_mod_activos_digitales.py y _mod_cambios_externos.py, aquí solo se
traducen los errores y se averigua quién llama.

Nada de esto está disponible para claves de invitado, ni siquiera leer
(las de lectura están marcadas SOLO_LECTURA para que el chat del panel no
pida confirmación, pero rechazan al invitado por dentro).
proponer_cambio_web_gd también va marcada: no cambia nada fuera, solo
guarda la propuesta, y así el chat enseña la vista previa sin pedir
permiso dos veces; el permiso se pide al aplicar."""

from fastmcp.exceptions import ToolError
from fastmcp.server.dependencies import get_http_headers

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from apps.mcp_server.core.dependencias.auth import clave_actual_es_solo_lectura
from database.config_db import get_db_config

from ._anotaciones import SOLO_LECTURA
from ..database.modelos._mod_activos_digitales import ActivosDigitalesCRUD, catalogo_ajustes
from ..database.modelos._mod_actividad import CABECERA_USUARIO_CHAT, PREFIJO_KEY_CHAT_INTERNO
from ..database.modelos._mod_cambios_externos import CambiosExternosCRUD
from ..database.modelos._mod_ficheros import FicherosError, ficheros_de
from ..database.modelos._mod_vigilancia import peor_estado_por_activo
from ..database.modelos._mod_credenciales import CredencialesCRUD
from ..database.modelos._mod_wordpress import WordPressError


async def _contexto() -> tuple[dict, str, str]:
    """(config, vía, quién). Vía «chat» si llama el chat del panel con su
    key interna; «ia» para cualquier otro cliente MCP."""
    if clave_actual_es_solo_lectura():
        raise ToolError("Las webs y redes sociales no están disponibles para claves de invitado.")
    proyecto = await resolver_proyecto_actual()
    nombre_key = proyecto.get("nombre_api_key") or f"API key n.º {proyecto.get('id_api_key')}"
    via = "chat" if nombre_key.startswith(PREFIJO_KEY_CHAT_INTERNO) and get_http_headers().get(CABECERA_USUARIO_CHAT) else "ia"
    return get_db_config(proyecto["id"]), via, nombre_key


async def _id_credencial(config: dict, nombre_credencial: str | None) -> int | None:
    if not nombre_credencial:
        return None
    credencial = await CredencialesCRUD(config).obtener_por_nombre(nombre_credencial)
    if not credencial:
        raise ToolError(f"No existe ninguna credencial llamada «{nombre_credencial}» (mira listar_credenciales_gd)")
    return credencial["id"]


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_activos_digitales_gd(
    q: str | None = None, tipo: str | None = None, id_entidad: int | None = None, incluir_archivados: bool = False,
) -> list[dict]:
    """Inventario de webs, redes sociales, bases de datos y dominios de la
    empresa, con su nivel de permiso y cuántas propuestas de cambio tienen
    esperando. Úsala antes de cualquier cosa sobre "la web" o "el
    Instagram" para saber de cuál se habla y su id. `q` busca en nombre,
    dirección y descripción; `tipo`: web, red_social, base_datos, dominio,
    otro. `capacidad` dice qué sabe hacer la GD con cada uno: wordpress
    (contenido, conector, copias...), bd (consultas y cambios en la base de
    datos), red (publicar en redes sociales), ficheros (web a medida por
    SFTP o Git); None = solo inventario (Shopify, PrestaShop, Wix...).
    `vigilancia`: el peor estado de sus comprobaciones (ok, aviso, grave...;
    detalle con estado_vigilancia_gd)."""
    config, _, _ = await _contexto()
    peor = await peor_estado_por_activo(config)
    return [{**a, "vigilancia": peor.get(a["id"])}
            for a in await ActivosDigitalesCRUD(config).buscar(q, tipo, id_entidad, incluir_archivados)]


@mcp_app.tool(annotations=SOLO_LECTURA)
async def obtener_activo_digital_gd(id_activo: int) -> dict:
    """Detalle de una web o cuenta: credencial, entidad, nivel de permiso,
    ajustes (con su explicación) y los últimos cambios.

    Niveles de permiso (los sube solo un administrador desde el panel; tú
    solo puedes bajarlos):
    - lectura: solo consultar.
    - proponer: puedes preparar propuestas, pero se aprueban en el panel.
    - aplicar_confirmando: aplicas tú cuando el usuario diga que sí.
    - autonomo: además, ciertas tareas pequeñas (moderar comentarios) se
      pueden aplicar directamente con aplicar_ya."""
    config, _, _ = await _contexto()
    activos = ActivosDigitalesCRUD(config)
    try:
        activo = await activos.con_nombres(await activos.obtener_o_error(id_activo))
    except ValueError as e:
        raise ToolError(str(e))
    return {**activo, "catalogo_ajustes": catalogo_ajustes(),
            "ultimos_cambios": await CambiosExternosCRUD(config).buscar(id_activo=id_activo, limite=5)}


@mcp_app.tool()
async def crear_activo_digital_gd(
    nombre: str, tipo: str, plataforma: str, url: str | None = None, descripcion: str | None = None,
    nombre_credencial: str | None = None, id_entidad: int | None = None,
) -> dict:
    """Da de alta una web, red social, base de datos o dominio en el
    inventario. Nace siempre en solo lectura: subir el permiso lo hace un
    administrador desde el panel.

    `tipo`: web, red_social, base_datos, dominio, otro. `plataforma`:
    wordpress, woocommerce, a_medida, shopify, prestashop, wix, instagram,
    facebook, linkedin, google_business, x, tiktok, youtube, mysql,
    postgres, otra.
    `nombre_credencial`: la credencial de la GD con el acceso (para
    WordPress: usuario = usuario de WordPress, valor = una contraseña de
    aplicación, que se crea en WordPress → Usuarios → Perfil → Contraseñas
    de aplicación; nunca la contraseña normal). Si no existe, pide al
    usuario que la dé de alta (o usa crear_credencial_gd). `id_entidad`:
    opcional, si la web es de una marca o delegación concreta.
    Después, prueba la conexión con probar_conexion_activo_gd."""
    config, _, _ = await _contexto()
    try:
        return await ActivosDigitalesCRUD(config).crear({
            "nombre": nombre, "tipo": tipo, "plataforma": plataforma, "url": url, "descripcion": descripcion,
            "id_credencial": await _id_credencial(config, nombre_credencial), "id_entidad": id_entidad,
        }, nivel_maximo="lectura")
    except ValueError as e:
        raise ToolError(str(e))


@mcp_app.tool()
async def actualizar_activo_digital_gd(
    id_activo: int, nombre: str | None = None, url: str | None = None, descripcion: str | None = None,
    nombre_credencial: str | None = None, id_entidad: int | None = None, quitar_entidad: bool = False,
    nivel_permiso: str | None = None, pausado: bool | None = None, archivado: bool | None = None,
) -> dict:
    """Cambia los datos de una web o cuenta (lo que se deje vacío no se
    toca). `nivel_permiso` solo se puede BAJAR desde aquí (p.ej. a
    "lectura" si el usuario quiere que no se toque nada); para subirlo,
    un administrador lo hace en el panel. `pausado`=true deja de hacerle
    nada hasta reanudarlo. `archivado`=true lo quita del inventario sin
    borrar su historial."""
    config, _, _ = await _contexto()
    datos = {"nombre": nombre, "url": url, "descripcion": descripcion, "nivel_permiso": nivel_permiso,
             "id_credencial": await _id_credencial(config, nombre_credencial), "id_entidad": id_entidad,
             "estado": None if pausado is None else ("pausado" if pausado else "activo"), "archivado": archivado}
    activos = ActivosDigitalesCRUD(config)
    try:
        if quitar_entidad:
            await activos.obtener_o_error(id_activo)
            await activos.update(id_activo, {"id_entidad": None})
        return await activos.actualizar(id_activo, datos, puede_subir_nivel=False)
    except ValueError as e:
        raise ToolError(str(e))


@mcp_app.tool()
async def cambiar_ajustes_activo_gd(id_activo: int, ajustes: dict) -> dict:
    """Cambia los ajustes de una web o cuenta, p.ej.
    {"caducidad_propuestas_dias": 3}, {"copias_hacer": true,
    "copias_conservar_servidor": 7} o {"actualizaciones": "automaticas"}.
    Un valor null vuelve al de por defecto. Son decisiones del cliente:
    cámbialos solo si te lo pide. Los ajustes disponibles y su explicación vienen en
    obtener_activo_digital_gd → catalogo_ajustes."""
    config, _, _ = await _contexto()
    try:
        return await ActivosDigitalesCRUD(config).actualizar_ajustes(id_activo, ajustes)
    except ValueError as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def probar_conexion_activo_gd(id_activo: int) -> dict:
    """Comprueba que la GD puede entrar en la web con su credencial y dice
    con qué usuario y roles entra. Si falla, explica por qué (dirección,
    contraseña de aplicación, plugin de seguridad que bloquea la API...)."""
    config, _, _ = await _contexto()
    try:
        return await ActivosDigitalesCRUD(config).probar_conexion(id_activo)
    except ValueError as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_contenido_web_gd(
    id_activo: int, tipo: str, buscar: str | None = None, estado: str | None = None, pagina: int = 1,
) -> list[dict]:
    """Lee el contenido de una web WordPress. `tipo`: entradas, paginas,
    comentarios, medios, plugins, usuarios.
    `estado`: para entradas/páginas borrador, publicado, pendiente, privado,
    programado (sin estado: todos); para comentarios aprobado (por
    defecto), retenido, spam, papelera; para plugins activo, inactivo.
    De 20 en 20: `pagina` para seguir. Plugins y usuarios solo se ven si
    el usuario de WordPress es administrador."""
    config, _, _ = await _contexto()
    activos = ActivosDigitalesCRUD(config)
    try:
        cliente = await activos.cliente_wordpress(await activos.obtener_o_error(id_activo))
        return await cliente.listar(tipo, buscar, estado, pagina)
    except (ValueError, WordPressError) as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def obtener_contenido_web_gd(id_activo: int, tipo: str, id_objeto: int) -> dict:
    """Una entrada, página, comentario o medio completo, con el contenido
    tal cual está guardado (HTML de WordPress) — léelo antes de proponer
    una edición, para partir de lo que hay."""
    config, _, _ = await _contexto()
    activos = ActivosDigitalesCRUD(config)
    try:
        cliente = await activos.cliente_wordpress(await activos.obtener_o_error(id_activo))
        return await cliente.obtener(tipo, id_objeto)
    except (ValueError, WordPressError) as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def proponer_cambio_web_gd(
    id_activo: int, operacion: str, datos: dict, id_objeto: int | None = None,
    motivo: str | None = None, aplicar_ya: bool = False,
) -> dict:
    """Prepara un cambio en la web SIN aplicarlo: lee lo que hay, guarda
    el antes y el después y devuelve la propuesta con su número (`id`).
    Nada cambia en la web hasta aplicar_cambio_web_gd.

    `operacion` (y lo que lleva `datos`):
    - wp_crear_entrada / wp_crear_pagina: titulo (obligatorio), contenido
      (HTML), extracto, estado (borrador por defecto, publicado,
      pendiente, privado), slug.
    - wp_editar_entrada / wp_editar_pagina (+ id_objeto): solo los campos
      que cambian, de los mismos. Para el contenido, parte de
      obtener_contenido_web_gd y manda el contenido completo nuevo.
    - wp_moderar_comentario (+ id_objeto): estado = aprobado, retenido,
      spam o papelera.
    - wp_subir_medio: id_documento (un documento de la GD con archivo
      adjunto, p.ej. una foto), titulo, texto_alternativo.
    - wp_editar_medio (+ id_objeto, el id del medio): titulo,
      texto_alternativo (describe la imagen; ayuda a Google y a la
      accesibilidad).
    Con el conector de Multiplika instalado en la web:
    - wp_editar_seo (+ id_objeto, el id de la entrada o página):
      titulo_seo (lo que sale en azul en Google, unos 50-60 caracteres),
      descripcion_seo (el texto de debajo, unos 140-160), palabra_clave.
      Lo escribe donde lo lee su plugin de SEO (Yoast, Rank Math,
      SEOPress) o, si no tiene, lo pone el propio conector.
    - wp_actualizar_plugin / wp_actualizar_tema: elemento (el nombre que
      se ve en WordPress o su carpeta). Antes de aplicar se hace una copia.
    - wp_restaurar_copia: nombre (de listar_copias_web_gd). La web entera
      vuelve a como estaba en esa fecha: avisa al usuario de que se pierde
      lo hecho después. Antes de aplicar se hace una copia de lo actual.
    Deshacer una actualización o una restauración vuelve a la copia hecha
    justo antes de aplicar (también se pierde lo hecho desde entonces).
    En una base de datos de la empresa (fase 4; nunca SQL libre, y antes
    mira esquema_bd_gd):
    - bd_actualizar: tabla, cambios {columna: valor nuevo}, donde
      {columna: valor} (solo igualdades; obligatorio).
    - bd_insertar: tabla, filas [{columna: valor}, ...].
    - bd_borrar: tabla, donde {columna: valor}.
    Solo tablas con clave primaria, y como mucho las filas del ajuste
    bd_max_filas. En la vista previa enséñale al usuario cuántas filas y
    cuáles; deshacer las deja como estaban.
    GEO, con el conector de Multiplika 1.3 (mira antes leer_geo_web_gd):
    - wp_geo: robots {"GPTBot": false, ...} (solo los que cambian; true =
      puede leer la web), llms_txt (texto de /llms.txt: quiénes sois, qué
      hacéis, páginas clave), datos_estructurados (objeto JSON-LD de
      schema.org: Organization o LocalBusiness con nombre, dirección,
      teléfono, horario, web, redes). Qué robots bloquear lo decide el
      cliente.
    En una web hecha a medida (capacidad «ficheros»; mira antes
    leer_fichero_web_gd):
    - fichero_editar: ruta, contenido (el archivo completo nuevo). Sirve
      también para robots.txt, llms.txt o el HTML con los datos
      estructurados. Por Git, cada cambio es un commit.
    Con Cloudflare configurado en los ajustes de la web (sirve también para
    webs que no son WordPress):
    - cf_nivel_seguridad: nivel = essentially_off, low, medium, high o
      under_attack («estoy siendo atacado»: frena ataques, pero hace esperar
      unos segundos a cada visitante; para quitarlo, otra propuesta con
      medium o deshacer).
    Después, ENSEÑA al usuario el resumen y el antes/después (en una
    edición larga, lo que cambia, no el HTML entero) y pregúntale si lo
    aplicas. Si dice que sí, aplicar_cambio_web_gd(id). Si el activo está
    en nivel «proponer», dile que la propuesta le espera en el panel
    (Webs y redes → la web → Cambios) para aprobarla allí.

    `aplicar_ya`: solo en activos «autonomo» y para wp_moderar_comentario
    (p.ej. mandar spam a la papelera) — se aplica sin preguntar."""
    config, via, quien = await _contexto()
    try:
        return await CambiosExternosCRUD(config).proponer(
            id_activo, operacion, datos, via, quien, id_objeto=id_objeto, motivo=motivo, aplicar_ya=aplicar_ya)
    except ValueError as e:
        raise ToolError(str(e))


@mcp_app.tool()
async def aplicar_cambio_web_gd(id_cambio: int) -> dict:
    """Aplica en la web una propuesta ya hecha con proponer_cambio_web_gd.
    Úsala SOLO después de que el usuario haya visto la propuesta y haya
    dicho que sí. Antes de tocar nada se vuelve a leer la web: si alguien
    la ha cambiado entretanto, no se aplica (estado «caducado») y hay que
    volver a proponer. Después comprueba que la web sigue respondiendo.
    Cuéntale al usuario el `resultado`; si es «fallido», el porqué."""
    config, via, quien = await _contexto()
    try:
        return await CambiosExternosCRUD(config).aplicar(id_cambio, via, quien)
    except ValueError as e:
        raise ToolError(str(e))


@mcp_app.tool()
async def rechazar_cambio_web_gd(id_cambio: int, motivo: str | None = None) -> dict:
    """Descarta una propuesta que el usuario no quiere. No toca la web."""
    config, via, quien = await _contexto()
    try:
        return await CambiosExternosCRUD(config).rechazar(id_cambio, via, quien, motivo)
    except ValueError as e:
        raise ToolError(str(e))


@mcp_app.tool()
async def deshacer_cambio_web_gd(id_cambio: int) -> dict:
    """Deja la web como estaba antes de un cambio ya aplicado: una
    edición vuelve a su texto anterior, un comentario a su estado
    anterior, una entrada o página creada va a la papelera de WordPress y
    un archivo subido se borra. Si después alguien volvió a tocar lo
    mismo, no se deshace (para no pisarlo) y se explica. Pregunta al
    usuario antes de usarla."""
    config, via, quien = await _contexto()
    try:
        return await CambiosExternosCRUD(config).deshacer(id_cambio, via, quien)
    except ValueError as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_cambios_web_gd(id_activo: int | None = None, estado: str | None = None, limite: int = 30) -> list[dict]:
    """Historial de propuestas y cambios en webs y redes, los más recientes
    primero. `estado`: propuesto (esperando aprobación), aplicado,
    rechazado, caducado, fallido, deshecho."""
    config, _, _ = await _contexto()
    return await CambiosExternosCRUD(config).buscar(id_activo, estado, limite)


@mcp_app.tool(annotations=SOLO_LECTURA)
async def obtener_cambio_web_gd(id_cambio: int) -> dict:
    """Una propuesta o cambio completo, con el antes, el después y lo que
    guardó la web de verdad."""
    config, _, _ = await _contexto()
    try:
        return await CambiosExternosCRUD(config).obtener_salida(id_cambio)
    except ValueError as e:
        raise ToolError(str(e))



@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_ficheros_web_gd(id_activo: int, ruta: str = ".") -> list[dict]:
    """Archivos de una web hecha a medida (por SFTP o su repositorio Git),
    dentro de su carpeta. `ruta`: subcarpeta."""
    config, _, _ = await _contexto()
    try:
        return await (await ficheros_de(config, await ActivosDigitalesCRUD(config).obtener_o_error(id_activo))).listar(ruta)
    except (ValueError, FicherosError) as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def leer_fichero_web_gd(id_activo: int, ruta: str) -> dict:
    """El contenido de un archivo de texto de una web hecha a medida (hasta
    1 MB). Para cambiarlo: proponer fichero_editar con el contenido
    completo nuevo."""
    config, _, _ = await _contexto()
    try:
        contenido = await (await ficheros_de(config, await ActivosDigitalesCRUD(config).obtener_o_error(id_activo))).leer(ruta)
    except (ValueError, FicherosError) as e:
        raise ToolError(str(e))
    if contenido is None:
        raise ToolError(f"No existe «{ruta}»")
    return {"ruta": ruta, "contenido": contenido}
