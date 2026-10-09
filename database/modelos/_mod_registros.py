"""CRUD de gd_modelos_registro/gd_registros — registros de datos y sus
modelos (ver docs/gestion-documental.md → "Registros de datos").

Dos reglas que se aplican aquí y no en la capa de arriba, para que valgan
igual por MCP y desde el panel:
1. Los valores de un registro se validan contra el JSON Schema de su modelo
   antes de guardarse. Si no encajan, no se guarda: un registro guardado es
   siempre un registro válido.
2. Un modelo con registros no se modifica. Para cambiarlo se crea la versión
   siguiente (`nueva_version`), que desactiva la anterior — los registros
   viejos siguen apuntando a la versión con la que nacieron. La excepción son
   las leyendas de los campos (`title`), que no cambian qué se valida."""

import json
from decimal import Decimal

from jsonschema import Draft202012Validator
from jsonschema.exceptions import best_match
from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_documentos import TABLA_DOCUMENTOS
from ..dependencias._dep_registros import TABLA_MODELOS_REGISTRO, TABLA_REGISTROS, TABLA_REGISTROS_DOCUMENTOS
from ._mod_documentos_pendientes import DocumentosPendientesCRUD
from ._tipos_archivo import comprobar_tipo_archivo

# minimo: sin paginar — un cliente anota decenas de registros al día, no miles
LIMITE_REGISTROS = 500
LIMITE_MODELOS = 200

_CAMPOS_MODELO = ["nombre", "titulo", "descripcion", "esquema", "periodicidad"]
_CAMPOS_REGISTRO = [
    "id_modelo", "valores", "fecha", "hora", "creado_por", "conforme",
    "observaciones", "id_entidad",
]
#: Todo menos el binario: un listado de 200 registros no debe arrastrar 200
#: fotos. Quien necesite saber si hay archivo mira archivo_original_nombre.
COLUMNAS_SIN_ARCHIVO = [c.nombre for c in TABLA_REGISTROS.columnas if c.nombre != "archivo_original"]


def sin_archivo(fila: dict) -> dict:
    """La fila sin el binario, con los valores ya como objeto — lo que se
    devuelve por MCP y por el panel."""
    return {
        **{k: v for k, v in fila.items() if k != "archivo_original"},
        "valores": json.loads(fila["valores"]) if isinstance(fila["valores"], str) else fila["valores"],
    }


def _como_dict(valor, campo: str) -> dict:
    """Acepta el JSON como texto o ya como objeto — la IA lo manda de las dos
    formas según el cliente MCP."""
    if isinstance(valor, str):
        try:
            valor = json.loads(valor)
        except json.JSONDecodeError as e:
            raise ValueError(f"{campo} no es JSON válido: {e}") from e
    if not isinstance(valor, dict):
        raise ValueError(f"{campo} tiene que ser un objeto JSON, no {type(valor).__name__}")
    return valor


def comprobar_esquema(esquema) -> dict:
    """Que el esquema sea un JSON Schema válido y describa un objeto con
    campos — un esquema roto no se guarda, porque después rechazaría todos
    los registros sin que se entienda por qué."""
    esquema = _como_dict(esquema, "El esquema")
    try:
        Draft202012Validator.check_schema(esquema)
    except Exception as e:
        raise ValueError(f"El esquema no es un JSON Schema válido: {e}") from e
    if esquema.get("type") != "object" or not esquema.get("properties"):
        raise ValueError('El esquema tiene que ser de "type": "object" y traer al menos un campo en "properties"')
    return esquema


def comprobar_valores(esquema: dict, valores) -> dict:
    """Valida los valores contra el esquema. El detalle del fallo lo da la
    librería jsonschema (en inglés), precedido de la ruta del campo — se
    enseña tal cual: dice exactamente qué campo y por qué."""
    valores = _como_dict(valores, "Los valores")
    fallo = best_match(Draft202012Validator(esquema).iter_errors(valores))
    if fallo is not None:
        donde = ".".join(str(p) for p in fallo.absolute_path) or "(el registro)"
        raise ValueError(f"Los valores no encajan con el modelo → {donde}: {fallo.message}")
    return valores


def _sin_leyendas(esquema):
    """El esquema sin los `title` (las leyendas de los campos), para ver si dos
    esquemas validan lo mismo. Las claves de `properties` son nombres de
    campo, no palabras del esquema: un campo que se llame "title" se queda."""
    if isinstance(esquema, list):
        return [_sin_leyendas(x) for x in esquema]
    if not isinstance(esquema, dict):
        return esquema
    return {
        k: {c: _sin_leyendas(d) for c, d in v.items()} if k == "properties" and isinstance(v, dict) else _sin_leyendas(v)
        for k, v in esquema.items() if k != "title"
    }


def plantilla_de_valores(esquema: dict) -> dict:
    """Un ejemplo de los valores que espera este modelo, campo por campo, para
    que la IA vea la forma exacta sin tener que interpretar el JSON Schema
    (que también recibe). Valores de muestra, no datos reales."""
    muestra = {}
    for campo, definicion in (esquema.get("properties") or {}).items():
        if definicion.get("enum"):
            muestra[campo] = definicion["enum"][0]
            continue
        tipo = definicion.get("type")
        if tipo == "number" or tipo == "integer":
            minimo, maximo = definicion.get("minimum"), definicion.get("maximum")
            muestra[campo] = minimo if minimo is not None else (maximo if maximo is not None else 0)
        elif tipo == "boolean":
            muestra[campo] = True
        elif tipo == "array":
            muestra[campo] = []
        elif tipo == "object":
            muestra[campo] = {}
        else:
            formato = definicion.get("format")
            muestra[campo] = {"date": "AAAA-MM-DD", "time": "HH:MM", "date-time": "AAAA-MM-DDTHH:MM"}.get(
                formato, formato or "texto"
            )
    return muestra


class ModelosRegistroCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_MODELOS_REGISTRO, config)

    async def obtener_por_nombre(self, nombre: str, version: int | None = None) -> dict | None:
        """Sin `version`, la última activa — es lo que se entiende cuando
        alguien dice "el modelo temperaturas_camaras"."""
        db = AsyncDatabase(**self.config)
        if version is not None:
            return await db.query(
                f'SELECT * FROM "{TABLA_MODELOS_REGISTRO.nombre}" WHERE nombre = %s AND version = %s',
                (nombre.strip(), version), uno=True,
            )
        return await db.query(
            f'SELECT * FROM "{TABLA_MODELOS_REGISTRO.nombre}" WHERE nombre = %s AND activo = true '
            f"ORDER BY version DESC LIMIT 1",
            (nombre.strip(),), uno=True,
        )

    async def listar_versiones(self, nombre: str) -> list[dict]:
        """Toda la historia de un modelo, de la primera versión a la última."""
        db = AsyncDatabase(**self.config)
        return await db.query(
            f'SELECT * FROM "{TABLA_MODELOS_REGISTRO.nombre}" WHERE nombre = %s ORDER BY version ASC',
            (nombre.strip(),),
        )

    async def listar_modelos(self, incluir_inactivos: bool = False) -> list[dict]:
        """La última versión de cada modelo (una fila por familia)."""
        db = AsyncDatabase(**self.config)
        condicion = "" if incluir_inactivos else "WHERE activo = true"
        return await db.query(
            f"""
            SELECT DISTINCT ON (nombre) * FROM "{TABLA_MODELOS_REGISTRO.nombre}"
            {condicion}
            ORDER BY nombre ASC, version DESC
            LIMIT %s
            """,
            (LIMITE_MODELOS,),
        )

    async def tiene_registros(self, id_modelo: int) -> bool:
        db = AsyncDatabase(**self.config)
        fila = await db.query(
            f'SELECT 1 FROM "{TABLA_REGISTROS.nombre}" WHERE id_modelo = %s LIMIT 1', (id_modelo,), uno=True,
        )
        return bool(fila)

    async def crear(self, datos: dict) -> int:
        """Primera versión de un modelo nuevo. Si ya existe uno con ese
        nombre, se versiona (nueva_version), no se crea otro."""
        limpios = {k: v for k, v in datos.items() if k in _CAMPOS_MODELO}
        for campo in ("nombre", "titulo", "descripcion"):
            if not (limpios.get(campo) or "").strip():
                raise ValueError(f"El campo '{campo}' de un modelo de registro no puede quedar en blanco")
            limpios[campo] = limpios[campo].strip()
        if await self.listar_versiones(limpios["nombre"]):  # cubre también las versiones retiradas
            raise ValueError(
                f'Ya existe un modelo llamado "{limpios["nombre"]}" — para cambiarlo, crea la versión siguiente'
            )
        limpios["esquema"] = json.dumps(comprobar_esquema(limpios.get("esquema")), ensure_ascii=False)
        return await self.insert({**limpios, "version": 1})

    async def actualizar(self, id_modelo: int, datos: dict) -> dict | None:
        """Solo mientras el modelo no tenga ningún registro: es un borrador
        que nadie ha usado. En cuanto tiene el primero, hay que versionar."""
        modelo = await self.obtener(id_modelo)
        if not modelo:
            return None
        cambios = {k: v for k, v in datos.items() if k in _CAMPOS_MODELO and v is not None}
        if "esquema" in cambios:
            cambios["esquema"] = comprobar_esquema(cambios["esquema"])
        if await self.tiene_registros(id_modelo) and not self._solo_leyendas(modelo, cambios):
            raise ValueError(
                f'El modelo "{modelo["nombre"]}" (versión {modelo["version"]}) ya tiene registros, así que no se '
                f"toca: crea la versión siguiente con el esquema nuevo (solo las leyendas de los campos se "
                f"pueden cambiar sin versionar)"
            )
        if "esquema" in cambios:
            cambios["esquema"] = json.dumps(cambios["esquema"], ensure_ascii=False)
        if cambios:
            await self.update(id_modelo, cambios)
        return await self.obtener(id_modelo)

    @staticmethod
    def _solo_leyendas(modelo: dict, cambios: dict) -> bool:
        """Si lo único que cambia son las leyendas (`title`) de los campos: no
        cambia qué se valida, así que vale también con registros."""
        for campo, valor in cambios.items():
            if campo == "esquema":
                if _sin_leyendas(valor) != _sin_leyendas(json.loads(modelo["esquema"])):
                    return False
            elif valor != modelo[campo]:
                return False
        return True

    async def nueva_version(self, id_modelo: int, esquema, motivo: str, cambios: dict | None = None) -> dict:
        """Crea la versión siguiente y desactiva la anterior. Los registros ya
        anotados siguen apuntando a la versión vieja: eso es la trazabilidad."""
        anterior = await self.obtener(id_modelo)
        if not anterior:
            raise ValueError(f"No existe ningún modelo de registro con id {id_modelo}")
        if not (motivo or "").strip():
            raise ValueError("Hace falta decir qué cambia en esta versión y por qué (motivo_version)")
        cambios = {k: v for k, v in (cambios or {}).items() if k in _CAMPOS_MODELO and v is not None}
        cambios.pop("nombre", None)  # el nombre identifica a la familia: no cambia entre versiones

        db = AsyncDatabase(**self.config)
        ultima = await db.query(
            f'SELECT MAX(version) AS v FROM "{TABLA_MODELOS_REGISTRO.nombre}" WHERE nombre = %s',
            (anterior["nombre"],), uno=True,
        )
        id_nuevo = await self.insert({
            "nombre": anterior["nombre"],
            "titulo": cambios.get("titulo", anterior["titulo"]),
            "descripcion": cambios.get("descripcion", anterior["descripcion"]),
            "periodicidad": cambios.get("periodicidad", anterior["periodicidad"]),
            "esquema": json.dumps(comprobar_esquema(esquema), ensure_ascii=False),
            "version": (ultima["v"] or anterior["version"]) + 1,
            "id_modelo_raiz": anterior["id_modelo_raiz"] or anterior["id"],
            "motivo_version": motivo.strip(),
        })
        await self.update(id_modelo, {"activo": False})
        return await self.obtener(id_nuevo)

    async def cambiar_activo(self, id_modelo: int, activo: bool) -> dict | None:
        if not await self.obtener(id_modelo):
            return None
        await self.update(id_modelo, {"activo": activo})
        return await self.obtener(id_modelo)


class RegistrosCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_REGISTROS, config)

    async def crear(self, modelo: dict, datos: dict) -> int:
        """`modelo` es la fila del modelo (ya resuelta por quien llama, que es
        quien sabe si venía por nombre o por id)."""
        if not modelo["activo"]:
            raise ValueError(
                f'La versión {modelo["version"]} del modelo "{modelo["nombre"]}" está retirada: anota el '
                f"registro en la versión vigente"
            )
        valores = comprobar_valores(json.loads(modelo["esquema"]), datos.get("valores"))
        limpios = {k: v for k, v in datos.items() if k in _CAMPOS_REGISTRO}
        limpios["id_modelo"] = modelo["id"]
        limpios["valores"] = json.dumps(valores, ensure_ascii=False)
        return await self.insert(limpios)

    async def corregir(self, id_registro: int, modelo: dict, datos: dict) -> dict | None:
        """Corrige un registro mal anotado. Si tocan los valores, se vuelven a
        validar contra el esquema de SU versión del modelo, no contra la
        vigente."""
        if not await self.obtener(id_registro):
            return None
        cambios = {k: v for k, v in datos.items() if k in _CAMPOS_REGISTRO and v is not None}
        cambios.pop("id_modelo", None)  # un registro no cambia de modelo: eso sería otro registro
        if "valores" in cambios:
            cambios["valores"] = json.dumps(
                comprobar_valores(json.loads(modelo["esquema"]), cambios["valores"]), ensure_ascii=False
            )
        if cambios:
            await self.update(id_registro, cambios)
        return await self.obtener(id_registro)

    async def guardar_archivo_original(
        self, id_registro: int, contenido: bytes, tipo_mime: str, nombre: str
    ) -> None:
        """Adjunta (o sustituye) el archivo del que salen los datos — se
        guarda tal cual, solo como referencia/descarga."""
        comprobar_tipo_archivo(tipo_mime, nombre)
        await self.update(
            id_registro,
            {"archivo_original": contenido, "archivo_original_tipo_mime": tipo_mime, "archivo_original_nombre": nombre},
        )

    async def adjuntar_pendiente(self, id_registro: int, id_pendiente: int) -> None:
        """El archivo de un documento pendiente (subido al panel o llegado por
        correo) pasa a ser el archivo original del registro y sale de la
        cola — igual que un documento guardado desde la cola. Así el archivo
        nunca viaja por la conversación con la IA."""
        pendientes = DocumentosPendientesCRUD(self.config)
        pendiente = await pendientes.obtener(id_pendiente)
        if not pendiente:
            raise ValueError(f"No existe ningún documento pendiente con id {id_pendiente}")
        await self.guardar_archivo_original(
            id_registro, bytes(pendiente["archivo"]),
            pendiente["tipo_mime"] or "application/octet-stream", pendiente["nombre_original"],
        )
        await pendientes.eliminar(id_pendiente)

    async def buscar(
        self, ids_modelo: list[int] | None = None, desde: str | None = None, hasta: str | None = None,
        id_entidad: int | None = None, conforme: bool | None = None, filtros: dict | None = None,
        limite: int = LIMITE_REGISTROS, id_documento: int | None = None,
    ) -> list[dict]:
        """`ids_modelo` son todas las versiones de la familia que se consulta
        (las resuelve quien llama). `filtros` mira dentro del JSON: el ORM no
        tiene tipo JSON, así que la columna es texto y se convierte en la
        propia consulta — sin índice, que para el volumen de una GD sobra."""
        condiciones, params = [], []
        if ids_modelo:
            condiciones.append(f"r.id_modelo IN ({', '.join(['%s'] * len(ids_modelo))})")
            params += list(ids_modelo)
        if desde:
            condiciones.append("r.fecha >= %s")
            params.append(desde)
        if hasta:
            condiciones.append("r.fecha <= %s")
            params.append(hasta)
        if id_entidad is not None:
            condiciones.append("r.id_entidad = %s")
            params.append(id_entidad)
        if conforme is not None:
            condiciones.append("r.conforme = %s")
            params.append(conforme)
        if id_documento is not None:
            condiciones.append(
                f'r.id IN (SELECT id_registro FROM "{TABLA_REGISTROS_DOCUMENTOS.nombre}" WHERE id_documento = %s)'
            )
            params.append(id_documento)
        for campo, valor in (filtros or {}).items():
            condiciones.append("(r.valores::jsonb ->> %s) = %s")
            params += [campo, str(valor)]
        where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""

        db = AsyncDatabase(**self.config)
        params.append(limite)
        filas = await db.query(
            f"""
            SELECT {', '.join(f'r.{c}' for c in COLUMNAS_SIN_ARCHIVO)}, m.nombre AS modelo, m.version AS version_modelo
            FROM "{TABLA_REGISTROS.nombre}" r
            JOIN "{TABLA_MODELOS_REGISTRO.nombre}" m ON m.id = r.id_modelo
            {where}
            ORDER BY r.fecha DESC, r.hora DESC NULLS LAST, r.id DESC
            LIMIT %s
            """,
            tuple(params),
        )
        documentos = await RegistrosDocumentosCRUD(self.config).documentos_de_registros([f["id"] for f in filas])
        return [{**f, "valores": json.loads(f["valores"]), "documentos": documentos.get(f["id"], [])} for f in filas]

    async def resumen(
        self, ids_modelo: list[int], campo: str, desde: str | None = None, hasta: str | None = None
    ) -> dict:
        """Cuántos, mínimo, máximo y media de un campo numérico del JSON — para
        no traerse 500 registros a la conversación solo para hacer una media.
        Los registros donde ese campo no sea un número quedan fuera del
        cálculo, pero se cuentan en `registros`."""
        condiciones = [f"id_modelo IN ({', '.join(['%s'] * len(ids_modelo))})"]
        params = list(ids_modelo)
        if desde:
            condiciones.append("fecha >= %s")
            params.append(desde)
        if hasta:
            condiciones.append("fecha <= %s")
            params.append(hasta)
        db = AsyncDatabase(**self.config)
        fila = await db.query(
            f"""
            SELECT COUNT(*) AS registros,
                   COUNT(valor) AS con_valor,
                   MIN(valor) AS minimo, MAX(valor) AS maximo, ROUND(AVG(valor), 4) AS media
            FROM (
                SELECT CASE WHEN (valores::jsonb ->> %s) ~ '^-?[0-9]+(\\.[0-9]+)?$'
                            THEN (valores::jsonb ->> %s)::numeric END AS valor
                FROM "{TABLA_REGISTROS.nombre}"
                WHERE {' AND '.join(condiciones)}
            ) x
            """,
            tuple([campo, campo] + params), uno=True,
        )
        # Postgres devuelve NUMERIC como Decimal y de ahí sale como texto al
        # otro lado de MCP; números, que es lo que se espera para hacer cuentas.
        return {"campo": campo, **{k: float(v) if isinstance(v, Decimal) else v for k, v in fila.items()}}


class RegistrosDocumentosCRUD(AsyncCrudBase):
    """Documentos vinculados a cada registro — varios por registro y un
    documento en varios registros (ver _dep_registros.py)."""

    def __init__(self, config: dict):
        super().__init__(TABLA_REGISTROS_DOCUMENTOS, config)

    async def vincular(self, id_registro: int, id_documento: int) -> None:
        """No falla si ya estaban vinculados."""
        await AsyncDatabase(**self.config).query(
            f'INSERT INTO "{TABLA_REGISTROS_DOCUMENTOS.nombre}" (id_registro, id_documento) VALUES (%s, %s) '
            "ON CONFLICT (id_registro, id_documento) DO NOTHING",
            (id_registro, id_documento),
        )

    async def desvincular(self, id_registro: int, id_documento: int) -> bool:
        borradas = await AsyncDatabase(**self.config).query(
            f'DELETE FROM "{TABLA_REGISTROS_DOCUMENTOS.nombre}" WHERE id_registro = %s AND id_documento = %s',
            (id_registro, id_documento),
        )
        return borradas > 0

    async def documentos_de_registros(self, ids_registro: list[int]) -> dict[int, list[dict]]:
        """{id_registro: [{id, nombre, tipo_documento, archivado}]} en una sola
        consulta, para acompañar un listado de registros."""
        if not ids_registro:
            return {}
        filas = await AsyncDatabase(**self.config).query(
            f"""
            SELECT rd.id_registro, d.id, d.nombre, d.tipo_documento, d.archivado
            FROM "{TABLA_REGISTROS_DOCUMENTOS.nombre}" rd
            JOIN "{TABLA_DOCUMENTOS.nombre}" d ON d.id = rd.id_documento
            WHERE rd.id_registro IN ({', '.join(['%s'] * len(ids_registro))})
            ORDER BY d.nombre ASC
            """,
            tuple(ids_registro),
        )
        por_registro: dict[int, list[dict]] = {}
        for f in filas:
            por_registro.setdefault(f.pop("id_registro"), []).append(f)
        return por_registro
