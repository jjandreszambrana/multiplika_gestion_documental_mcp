"""Bases de datos de la empresa (fase 4 de webs y redes) — ver
docs/gestion-documental.md → "Webs y redes sociales".

Tres formas de llegar (modo_conexion del activo):
- directo: la base de datos admite conexiones desde fuera.
- tunel_ssh: se entra por SSH al servidor y desde ahí a la base de datos.
- conector: la base de datos de una web WordPress, a través del conector de
  Multiplika instalado en ella (sin abrir nada al exterior).

Los frenos los pone aquí el servidor, no la IA:
- Consultar: una sola sentencia de lectura, dentro de una transacción de
  SOLO LECTURA (aunque la sentencia intentara escribir, la base de datos lo
  rechaza), con tope de tiempo y de filas.
- Cambiar: nunca SQL libre. Los cambios son estructurados (tabla, valores,
  condiciones de igualdad) y van por el sistema de propuestas: se leen antes
  las filas afectadas (copia para deshacer), se aplica en una transacción
  que se anula si toca un número de filas distinto del previsto, y nunca
  cambia la estructura (ni crear ni borrar tablas o columnas).

Credencial de la base de datos: usuario + contraseña y campos extra «host»,
«puerto» y «base_datos». Para el túnel, el ajuste bd_credencial_ssh con una
credencial SSH (usuario, contraseña o «clave_privada», «host», «puerto»)."""

import asyncio
import io
import json
import re
import select
import socketserver
import threading
from contextlib import contextmanager

import paramiko
import psycopg
import pymysql
from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_bases_datos import TABLA_CONSULTAS

from ._mod_activos_digitales import ActivosDigitalesCRUD, ajustes_efectivos, capacidad
from ._mod_conector import ClienteConector, ConectorError, datos_sftp
from ._mod_credenciales import CredencialesCRUD
from ._mod_credenciales_campos import CredencialesCamposCRUD
from ._mod_wordpress import _comprobar_destino_publico

SEGUNDOS_MAXIMOS = 30
FILAS_MAXIMAS_CONSULTA = 1000
_LECTURA = re.compile(r"^\s*(select|with|show|explain|describe|desc)\b", re.I)
_NOMBRE = re.compile(r"^[A-Za-z_][A-Za-z0-9_$]{0,63}$")


class BaseDatosError(Exception):
    pass


def _limpiar_sql(sql: str) -> str:
    """Quita comentarios y el ; final, y exige UNA sola sentencia."""
    sin_comentarios = re.sub(r"/\*.*?\*/", " ", sql, flags=re.S)
    sin_comentarios = re.sub(r"(--|#)[^\n]*", " ", sin_comentarios).strip().rstrip(";").strip()
    # Un ; fuera de comillas = varias sentencias
    sin_textos = re.sub(r"'(?:[^'\\]|\\.|'')*'|\"(?:[^\"\\]|\\.)*\"", "''", sin_comentarios)
    if ";" in sin_textos:
        raise BaseDatosError("Solo se admite una sentencia cada vez")
    if not sin_comentarios:
        raise BaseDatosError("La consulta está vacía")
    return sin_comentarios


def validar_lectura(sql: str) -> str:
    limpio = _limpiar_sql(sql)
    if not _LECTURA.match(limpio):
        raise BaseDatosError("Solo se pueden hacer consultas de lectura (SELECT). Los cambios se proponen con "
                             "bd_actualizar, bd_insertar o bd_borrar.")
    return limpio


def _serializable(valor):
    if isinstance(valor, (bytes, bytearray, memoryview)):
        return f"(binario, {len(bytes(valor))} bytes)"
    if hasattr(valor, "isoformat"):
        return valor.isoformat()
    if isinstance(valor, (int, float, str, bool)) or valor is None:
        return valor
    return str(valor)


# --- Túnel SSH (local → servidor SSH → base de datos) ---

class _Reenvio(socketserver.BaseRequestHandler):
    def handle(self):
        canal = self.server.transporte.open_channel("direct-tcpip", (self.server.destino_host, self.server.destino_puerto),
                                                   self.request.getpeername())
        try:
            while True:
                listos, _, _ = select.select([self.request, canal], [], [], 60)
                if not listos:
                    break
                if self.request in listos:
                    datos = self.request.recv(65536)
                    if not datos:
                        break
                    canal.sendall(datos)
                if canal in listos:
                    datos = canal.recv(65536)
                    if not datos:
                        break
                    self.request.sendall(datos)
        finally:
            canal.close()


class _ServidorReenvio(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True


@contextmanager
def _tunel(ssh: dict, host: str, puerto: int):
    """Abre un puerto local que llega a host:puerto a través del servidor SSH."""
    _comprobar_destino_publico(f"ssh://{ssh['host']}")
    cliente = paramiko.SSHClient()
    cliente.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    clave = None
    if ssh.get("clave_privada"):
        clave = paramiko.PKey.from_private_key(io.StringIO(ssh["clave_privada"]))
    cliente.connect(ssh["host"], port=ssh["puerto"], username=ssh["usuario"], password=None if clave else ssh["contrasena"],
                    pkey=clave, timeout=20, allow_agent=False, look_for_keys=False)
    servidor = _ServidorReenvio(("127.0.0.1", 0), _Reenvio)
    servidor.transporte, servidor.destino_host, servidor.destino_puerto = cliente.get_transport(), host, puerto
    hilo = threading.Thread(target=servidor.serve_forever, daemon=True)
    hilo.start()
    try:
        yield servidor.server_address[1]
    finally:
        servidor.shutdown()
        servidor.server_close()
        cliente.close()


# --- Ejecutores: misma interfaz para MySQL, PostgreSQL y el conector ---

class _EjecutorDirecto:
    """MySQL/MariaDB (pymysql) o PostgreSQL (psycopg), directo o por túnel.
    Síncrono por debajo; se llama desde un hilo."""

    def __init__(self, motor: str, datos: dict, ssh: dict | None):
        self.motor, self.datos, self.ssh = motor, datos, ssh
        self.comillas = "`" if motor == "mysql" else '"'

    @contextmanager
    def _conexion(self, solo_lectura: bool):
        host, puerto = self.datos["host"], self.datos["puerto"]
        if self.ssh:
            gestor = _tunel(self.ssh, host, puerto)
            puerto, host = gestor.__enter__(), "127.0.0.1"
        else:
            _comprobar_destino_publico(f"bd://{host}")
            gestor = None
        try:
            if self.motor == "mysql":
                con = pymysql.connect(host=host, port=puerto, user=self.datos["usuario"], password=self.datos["contrasena"],
                                      database=self.datos["base_datos"], connect_timeout=15, read_timeout=SEGUNDOS_MAXIMOS + 5,
                                      write_timeout=SEGUNDOS_MAXIMOS + 5, autocommit=False, charset="utf8mb4",
                                      cursorclass=pymysql.cursors.DictCursor)
                with con.cursor() as c:
                    for sql in (f"SET SESSION MAX_EXECUTION_TIME={SEGUNDOS_MAXIMOS * 1000}",  # MySQL
                                f"SET SESSION max_statement_time={SEGUNDOS_MAXIMOS}"):  # MariaDB
                        try:
                            c.execute(sql)
                        except pymysql.MySQLError:
                            pass
                    c.execute("START TRANSACTION READ ONLY" if solo_lectura else "START TRANSACTION")
            else:
                con = psycopg.connect(host=host, port=puerto, user=self.datos["usuario"], password=self.datos["contrasena"],
                                      dbname=self.datos["base_datos"], connect_timeout=15, autocommit=False,
                                      row_factory=psycopg.rows.dict_row)
                con.read_only = solo_lectura
                con.execute(f"SET statement_timeout = '{SEGUNDOS_MAXIMOS}s'")
            try:
                yield con
            finally:
                con.close()
        finally:
            if gestor:
                gestor.__exit__(None, None, None)

    def esquema(self) -> list[dict]:
        with self._conexion(True) as con:
            c = con.cursor()
            if self.motor == "mysql":
                c.execute("SELECT c.TABLE_NAME AS tabla, c.COLUMN_NAME AS columna, c.DATA_TYPE AS tipo, c.COLUMN_KEY = 'PRI' AS pk, "
                          "t.TABLE_ROWS AS filas FROM information_schema.COLUMNS c JOIN information_schema.TABLES t "
                          "ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME "
                          "WHERE c.TABLE_SCHEMA = DATABASE() ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION")
            else:
                c.execute("SELECT c.table_name AS tabla, c.column_name AS columna, c.data_type AS tipo, "
                          "EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage k "
                          "ON k.constraint_name = tc.constraint_name AND k.table_schema = tc.table_schema "
                          "WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = c.table_schema "
                          "AND tc.table_name = c.table_name AND k.column_name = c.column_name) AS pk, "
                          "(SELECT reltuples::bigint FROM pg_class WHERE oid = (quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass) AS filas "
                          "FROM information_schema.columns c WHERE c.table_schema = 'public' ORDER BY c.table_name, c.ordinal_position")
            filas = c.fetchall()
            con.rollback()
        return _agrupar_esquema(filas)

    def ejecutar(self, sentencias: list[dict], solo_lectura: bool, limite: int) -> list[dict]:
        resultados = []
        with self._conexion(solo_lectura) as con:
            try:
                c = con.cursor()
                for s in sentencias:
                    c.execute(s["sql"], s.get("params") or None)
                    r = {"afectadas": c.rowcount}
                    if c.description is not None:
                        filas = c.fetchmany(limite + 1)
                        r["filas"] = [{k: _serializable(v) for k, v in f.items()} for f in filas[:limite]]
                        r["cortado"] = len(filas) > limite
                    if self.motor == "mysql" and c.lastrowid:
                        r["ultimo_id"] = c.lastrowid
                    if s.get("esperadas") is not None and c.rowcount != s["esperadas"]:
                        raise BaseDatosError(f"Iba a tocar {c.rowcount} fila(s) y se esperaban {s['esperadas']}: no se ha cambiado nada")
                    resultados.append(r)
                if solo_lectura:
                    con.rollback()
                else:
                    con.commit()
            except Exception:
                con.rollback()
                raise
        return resultados


def _agrupar_esquema(filas: list[dict]) -> list[dict]:
    tablas: dict[str, dict] = {}
    for f in filas:
        t = tablas.setdefault(f["tabla"], {"tabla": f["tabla"], "filas_aprox": f.get("filas"), "columnas": []})
        t["columnas"].append({"nombre": f["columna"], "tipo": f["tipo"], "pk": bool(f["pk"])})
    return list(tablas.values())


class _EjecutorConector:
    """La base de datos de una web WordPress, por el conector."""

    def __init__(self, conector: ClienteConector):
        self.conector = conector
        self.comillas = "`"

    async def esquema(self) -> list[dict]:
        return _agrupar_esquema(await self.conector.bd_esquema())

    async def ejecutar(self, sentencias: list[dict], solo_lectura: bool, limite: int) -> list[dict]:
        return await self.conector.bd_transaccion(sentencias, solo_lectura, limite)


async def ejecutor_de(config: dict, activo: dict):
    """El ejecutor adecuado para un activo de tipo base de datos."""
    if capacidad(activo) != "bd":
        raise BaseDatosError(f"«{activo['nombre']}» no es una base de datos")
    modo = activo.get("modo_conexion") or "directo"
    ajustes = ajustes_efectivos(activo)
    if modo == "conector":
        if not ajustes["bd_id_web"]:
            raise BaseDatosError("Falta elegir en los ajustes la web WordPress (con el conector) de la que es esta base de datos")
        activos = ActivosDigitalesCRUD(config)
        web = await activos.obtener_o_error(int(ajustes["bd_id_web"]))
        if not web["conector_instalado"]:
            raise BaseDatosError(f"La web «{web['nombre']}» no tiene el conector de Multiplika")
        return _EjecutorConector(ClienteConector(await activos.cliente_wordpress(web)))
    if not activo["id_credencial"]:
        raise BaseDatosError("Falta la credencial con el acceso a la base de datos")
    credenciales = CredencialesCRUD(config)
    credencial = await credenciales.obtener(activo["id_credencial"])
    if not credencial:
        raise BaseDatosError("La credencial elegida ya no existe")
    extra = await CredencialesCamposCRUD(config).valores_descifrados(credencial["id"])
    if not extra.get("host") or not extra.get("base_datos") or not credencial["usuario"]:
        raise BaseDatosError(f"La credencial «{credencial['nombre']}» necesita usuario, contraseña y los campos «host» y "
                             "«base_datos» (y «puerto» si no es el normal)")
    motor = "mysql" if activo["plataforma"] == "mysql" else "postgres"
    datos = {"host": extra["host"], "puerto": int(extra.get("puerto") or (3306 if motor == "mysql" else 5432)),
             "base_datos": extra["base_datos"], "usuario": credencial["usuario"],
             "contrasena": await credenciales.valor_descifrado(credencial["id"])}
    ssh = None
    if modo == "tunel_ssh":
        if not ajustes["bd_credencial_ssh"]:
            raise BaseDatosError("Modo túnel SSH: falta la credencial SSH en los ajustes (bd_credencial_ssh)")
        try:
            ssh = await datos_sftp(config, ajustes["bd_credencial_ssh"])
        except ConectorError as e:
            raise BaseDatosError(str(e))
    return _EjecutorDirecto(motor, datos, ssh)


async def _llamar(ejecutor, metodo: str, *args):
    try:
        if isinstance(ejecutor, _EjecutorDirecto):
            return await asyncio.to_thread(getattr(ejecutor, metodo), *args)
        return await getattr(ejecutor, metodo)(*args)
    except BaseDatosError:
        raise
    except (pymysql.MySQLError, psycopg.Error, paramiko.SSHException, OSError, ConectorError) as e:
        raise BaseDatosError(_mensaje(e))


def _mensaje(e: Exception) -> str:
    texto = str(e).strip().splitlines()[0] if str(e).strip() else e.__class__.__name__
    if "read-only" in texto.lower() or "read only" in texto.lower():
        return "La consulta intentaba cambiar datos y no se permite: solo lectura"
    if "timeout" in texto.lower() or "canceling statement" in texto.lower() or "max_execution_time" in texto.lower():
        return f"La consulta ha tardado más de {SEGUNDOS_MAXIMOS} s y se ha cortado"
    return f"La base de datos ha dado un error: {texto}"


async def esquema(config: dict, id_activo: int) -> list[dict]:
    activo = await ActivosDigitalesCRUD(config).obtener_o_error(id_activo)
    return await _llamar(await ejecutor_de(config, activo), "esquema")


async def consultar(config: dict, id_activo: int, sql: str, limite: int = 200) -> dict:
    activo = await ActivosDigitalesCRUD(config).obtener_o_error(id_activo)
    if activo["estado"] == "pausado":
        raise BaseDatosError(f"«{activo['nombre']}» está en pausa")
    limpio = validar_lectura(sql)
    limite = max(1, min(limite, FILAS_MAXIMAS_CONSULTA))
    r = (await _llamar(await ejecutor_de(config, activo), "ejecutar", [{"sql": limpio}], True, limite))[0]
    return {"filas": r.get("filas", []), "cortado": r.get("cortado", False), "total_devueltas": len(r.get("filas", []))}


# --- Cambios estructurados (los usa _mod_cambios_externos.py) ---

def _q(ejecutor, nombre: str) -> str:
    if not _NOMBRE.match(nombre or ""):
        raise BaseDatosError(f"Nombre no válido: «{nombre}»")
    return f"{ejecutor.comillas}{nombre}{ejecutor.comillas}"


async def tabla_de(ejecutor, tabla: str) -> dict:
    """La tabla del esquema, con sus columnas y su clave primaria (sin
    clave primaria no se puede deshacer: no se permite cambiarla)."""
    tablas = {t["tabla"]: t for t in await _llamar(ejecutor, "esquema")}
    if tabla not in tablas:
        raise BaseDatosError(f"No existe la tabla «{tabla}»")
    t = tablas[tabla]
    t["pk"] = [c["nombre"] for c in t["columnas"] if c["pk"]]
    if not t["pk"]:
        raise BaseDatosError(f"La tabla «{tabla}» no tiene clave primaria: no se puede cambiar con seguridad (no se podría deshacer)")
    return t


def _comprobar_columnas(t: dict, columnas) -> None:
    validas = {c["nombre"] for c in t["columnas"]}
    malas = [c for c in columnas if c not in validas]
    if malas:
        raise BaseDatosError(f"La tabla «{t['tabla']}» no tiene la(s) columna(s): {', '.join(malas)}")


def _where(ejecutor, donde: dict) -> tuple[str, list]:
    partes, params = [], []
    for col, valor in donde.items():
        if valor is None:
            partes.append(f"{_q(ejecutor, col)} IS NULL")
        else:
            partes.append(f"{_q(ejecutor, col)} = %s")
            params.append(valor)
    return " AND ".join(partes), params


async def leer_filas(ejecutor, t: dict, donde: dict, maximo: int) -> list[dict]:
    where, params = _where(ejecutor, donde)
    r = await _llamar(ejecutor, "ejecutar", [{"sql": f"SELECT * FROM {_q(ejecutor, t['tabla'])} WHERE {where}", "params": params}],
                      True, maximo + 1)
    return r[0]["filas"]


def clave_de(t: dict, fila: dict) -> dict:
    return {c: fila[c] for c in t["pk"]}


async def leer_por_claves(ejecutor, t: dict, claves: list[dict]) -> list[dict]:
    filas = []
    for clave in claves:
        filas += await leer_filas(ejecutor, t, clave, 1)
    return filas


def sentencias_actualizar(ejecutor, t: dict, cambios: dict, donde: dict, esperadas: int) -> list[dict]:
    asignaciones = ", ".join(f"{_q(ejecutor, c)} = %s" for c in cambios)
    where, params = _where(ejecutor, donde)
    return [{"sql": f"UPDATE {_q(ejecutor, t['tabla'])} SET {asignaciones} WHERE {where}",
             "params": list(cambios.values()) + params, "esperadas": esperadas}]


def sentencias_restaurar(ejecutor, t: dict, filas: list[dict]) -> list[dict]:
    """Deja cada fila (por su clave) con los valores de `filas`."""
    salida = []
    for f in filas:
        valores = {k: v for k, v in f.items() if k not in t["pk"]}
        salida += sentencias_actualizar(ejecutor, t, valores, clave_de(t, f), 1) if valores else []
    return salida


def sentencias_insertar(ejecutor, t: dict, filas: list[dict]) -> list[dict]:
    salida = []
    for f in filas:
        cols = ", ".join(_q(ejecutor, c) for c in f)
        marcas = ", ".join(["%s"] * len(f))
        sql = f"INSERT INTO {_q(ejecutor, t['tabla'])} ({cols}) VALUES ({marcas})"
        if ejecutor.comillas == '"':  # PostgreSQL: devuelve la clave de lo insertado
            sql += " RETURNING " + ", ".join(_q(ejecutor, c) for c in t["pk"])
        salida.append({"sql": sql, "params": list(f.values()), "esperadas": 1})
    return salida


def sentencias_borrar(ejecutor, t: dict, claves: list[dict]) -> list[dict]:
    salida = []
    for clave in claves:
        where, params = _where(ejecutor, clave)
        salida.append({"sql": f"DELETE FROM {_q(ejecutor, t['tabla'])} WHERE {where}", "params": params, "esperadas": 1})
    return salida


def resumen_filas(filas: list[dict], maximo: int = 3) -> str:
    return json.dumps(filas[:maximo], ensure_ascii=False, default=str)[:300]


# --- Proponer, aplicar y deshacer (los llama _mod_cambios_externos.py) ---

def _sin_binarios(filas: list[dict]) -> None:
    for f in filas:
        if any(isinstance(v, str) and v.startswith("(binario, ") for v in f.values()):
            raise BaseDatosError("Las filas tienen datos binarios: no se pueden cambiar con seguridad desde aquí")


async def proponer_bd(ejecutor, operacion: str, datos: dict, maximo: int) -> tuple[dict | None, dict, str, str]:
    """(antes, después, resumen, tabla). No cambia nada."""
    t = await tabla_de(ejecutor, datos.get("tabla") or "")
    if operacion in ("bd_actualizar", "bd_borrar"):
        donde = datos.get("donde") or {}
        if not donde:
            raise BaseDatosError("Hace falta `donde` (qué filas): nunca se cambia o borra una tabla entera de golpe")
        _comprobar_columnas(t, donde)
        filas = await leer_filas(ejecutor, t, donde, maximo)
        if not filas:
            raise BaseDatosError("Ninguna fila cumple esas condiciones: no hay nada que cambiar")
        if len(filas) > maximo:
            raise BaseDatosError(f"Afectaría a más de {maximo} filas (el máximo de los ajustes): hazlo por partes")
        _sin_binarios(filas)
        condiciones = ", ".join(f"{k} = {v!r}" for k, v in donde.items())
        if operacion == "bd_actualizar":
            cambios = datos.get("cambios") or {}
            if not cambios:
                raise BaseDatosError("Hace falta `cambios` (columna: valor nuevo)")
            _comprobar_columnas(t, cambios)
            if set(cambios) & set(t["pk"]):
                raise BaseDatosError("No se cambia la clave primaria de una fila")
            if all(all(str(f.get(c)) == str(v) for c, v in cambios.items()) for f in filas):
                raise BaseDatosError("Esas filas ya tienen esos valores: no hay nada que cambiar")
            return ({"tabla": t["tabla"], "filas": filas}, {"tabla": t["tabla"], "cambios": cambios, "donde": donde, "filas": len(filas)},
                    f"Cambiar {', '.join(cambios)} en {len(filas)} fila(s) de «{t['tabla']}» (donde {condiciones})", t["tabla"])
        return ({"tabla": t["tabla"], "filas": filas}, {"tabla": t["tabla"], "donde": donde, "filas": len(filas)},
                f"Borrar {len(filas)} fila(s) de «{t['tabla']}» (donde {condiciones})", t["tabla"])
    filas = datos.get("filas") or []
    if not filas or not all(isinstance(f, dict) and f for f in filas):
        raise BaseDatosError("Hace falta `filas`: una lista de filas (columna: valor)")
    if len(filas) > maximo:
        raise BaseDatosError(f"Son más de {maximo} filas (el máximo de los ajustes): hazlo por partes")
    for f in filas:
        _comprobar_columnas(t, f)
    return None, {"tabla": t["tabla"], "filas": filas}, f"Añadir {len(filas)} fila(s) a «{t['tabla']}»", t["tabla"]


async def aplicar_bd(ejecutor, operacion: str, antes: dict | None, despues: dict) -> tuple[str | None, dict]:
    """(motivo para no aplicar —la base de datos cambió entretanto— o None,
    lo aplicado). Todo en una transacción: si toca otras filas, nada."""
    t = await tabla_de(ejecutor, despues["tabla"])
    if operacion in ("bd_actualizar", "bd_borrar"):
        claves = [clave_de(t, f) for f in antes["filas"]]
        actuales = await leer_por_claves(ejecutor, t, claves)
        if actuales != antes["filas"]:
            return "Esas filas han cambiado (o ya no están) desde que se hizo la propuesta: no se ha tocado nada.", {}
        if operacion == "bd_actualizar":
            sentencias = []
            for clave in claves:
                sentencias += sentencias_actualizar(ejecutor, t, despues["cambios"], clave, 1)
            await _llamar(ejecutor, "ejecutar", sentencias, False, 1)
            return None, {"tabla": t["tabla"], "claves": claves, "filas": await leer_por_claves(ejecutor, t, claves)}
        await _llamar(ejecutor, "ejecutar", sentencias_borrar(ejecutor, t, claves), False, 1)
        return None, {"tabla": t["tabla"], "claves": claves, "filas": []}
    resultados = await _llamar(ejecutor, "ejecutar", sentencias_insertar(ejecutor, t, despues["filas"]), False, 1)
    claves = []
    for fila, r in zip(despues["filas"], resultados):
        if all(c in fila for c in t["pk"]):
            claves.append({c: fila[c] for c in t["pk"]})
        elif r.get("filas"):
            claves.append(r["filas"][0])
        elif r.get("ultimo_id") and len(t["pk"]) == 1:
            claves.append({t["pk"][0]: r["ultimo_id"]})
    return None, {"tabla": t["tabla"], "claves": claves, "filas": await leer_por_claves(ejecutor, t, claves)}


async def deshacer_bd(ejecutor, operacion: str, antes: dict | None, aplicados: dict) -> None:
    t = await tabla_de(ejecutor, aplicados["tabla"])
    claves = aplicados.get("claves") or []
    actuales = await leer_por_claves(ejecutor, t, claves)
    if actuales != aplicados.get("filas", []):
        raise BaseDatosError("esas filas se han vuelto a cambiar después: deshacerlo pisaría esos cambios")
    if operacion == "bd_actualizar":
        sentencias = sentencias_restaurar(ejecutor, t, antes["filas"])
    elif operacion == "bd_insertar":
        if len(claves) != len(aplicados.get("filas", [])) or not claves:
            raise BaseDatosError("no se sabe qué filas se añadieron: no se puede deshacer automáticamente")
        sentencias = sentencias_borrar(ejecutor, t, claves)
    else:
        sentencias = sentencias_insertar(ejecutor, t, antes["filas"])
    await _llamar(ejecutor, "ejecutar", sentencias, False, 1)


# --- Consultas guardadas ---

async def guardar_consulta(config: dict, id_activo: int, nombre: str, sql: str, descripcion: str | None, quien: str,
                           id_consulta: int | None = None) -> dict:
    await ActivosDigitalesCRUD(config).obtener_o_error(id_activo)
    validar_lectura(sql)
    if not (nombre or "").strip():
        raise BaseDatosError("Hace falta un nombre")
    crud = AsyncCrudBase(TABLA_CONSULTAS, config)
    datos = {"nombre": nombre.strip()[:200], "sql": sql.strip(), "descripcion": descripcion}
    if id_consulta:
        if not await crud.obtener(id_consulta):
            raise BaseDatosError(f"No existe la consulta {id_consulta}")
        await crud.update(id_consulta, datos)
    else:
        id_consulta = await crud.insert({**datos, "id_activo": id_activo, "creado_por": quien[:150]})
    return await crud.obtener(id_consulta)


async def listar_consultas(config: dict, id_activo: int) -> list[dict]:
    return await AsyncDatabase(**config).query(
        "SELECT * FROM gd_consultas_bd WHERE id_activo = %s ORDER BY veces_usada DESC, nombre", (id_activo,))


async def ejecutar_consulta_guardada(config: dict, id_consulta: int, limite: int = 500) -> dict:
    db = AsyncDatabase(**config)
    consulta = await db.query("SELECT * FROM gd_consultas_bd WHERE id = %s", (id_consulta,), uno=True)
    if not consulta:
        raise BaseDatosError(f"No existe la consulta {id_consulta}")
    r = await consultar(config, consulta["id_activo"], consulta["sql"], limite)
    await db.query("UPDATE gd_consultas_bd SET veces_usada = veces_usada + 1, fecha_ultimo_uso = CURRENT_TIMESTAMP WHERE id = %s",
                   (id_consulta,))
    return {**r, "consulta": {k: consulta[k] for k in ("id", "nombre", "descripcion")}}


async def borrar_consulta(config: dict, id_consulta: int) -> None:
    await AsyncDatabase(**config).query("DELETE FROM gd_consultas_bd WHERE id = %s", (id_consulta,))
