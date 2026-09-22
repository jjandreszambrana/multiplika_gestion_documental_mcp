"""CRUD de gd_certificados y su log de uso — ver
docs/gestion-documental.md → "Certificados de entidades". El archivo y
la contraseña nunca salen de aquí descifrados salvo por
archivo_descifrado(), pensado solo para el endpoint de descarga (que
además registra el uso en CertificadosLogCRUD). Mismo cifrado Fernet
que gd_credenciales (lib.cifrado del repo core, import absoluto — ver
guia_nuevo_proyecto.md)."""

import base64

from cryptography import x509
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID
from mtpk_postgres import AsyncCrudBase
from lib.cifrado import cifrar, descifrar

from ..dependencias._dep_certificados import TABLA_CERTIFICADOS, TABLA_CERTIFICADOS_LOG


def _parsear_certificado(datos: bytes, contrasena: str | None) -> tuple[str, x509.Certificate]:
    """Prueba primero como PKCS12 (.p12/.pfx, con la contraseña dada — un
    .p12 también puede no llevar) y si no, como X.509 suelto (.cer/.pem,
    PEM o DER). Devuelve (formato, certificado); lanza ValueError con un
    mensaje claro si no se pudo leer de ninguna forma."""
    try:
        _, certificado, _ = pkcs12.load_key_and_certificates(
            datos, contrasena.encode() if contrasena else None,
        )
        if certificado is not None:
            return "p12", certificado
    except ValueError:
        pass
    for cargar in (x509.load_pem_x509_certificate, x509.load_der_x509_certificate):
        try:
            return "cer", cargar(datos)
        except ValueError:
            continue
    raise ValueError(
        "No se pudo leer el archivo como certificado (.p12/.pfx ni .cer/.pem) — revisa el "
        "archivo y, si es .p12/.pfx, la contraseña."
    )


def _extraer_datos(certificado: x509.Certificate) -> dict:
    def _atributo(nombre_distinguido, oid):
        valores = nombre_distinguido.get_attributes_for_oid(oid)
        return valores[0].value if valores else None

    return {
        "titular": _atributo(certificado.subject, NameOID.COMMON_NAME),
        # En certificados españoles el NIF suele viajar en subject.serialNumber.
        "nif_titular": _atributo(certificado.subject, NameOID.SERIAL_NUMBER),
        "emisor": _atributo(certificado.issuer, NameOID.COMMON_NAME),
        "numero_serie": format(certificado.serial_number, "X"),
        "fecha_emision": certificado.not_valid_before_utc.date(),
        "fecha_caducidad": certificado.not_valid_after_utc.date(),
    }


def _sin_secretos(fila: dict) -> dict:
    return {k: v for k, v in fila.items() if k not in ("archivo_cifrado", "contrasena_cifrada")}


class CertificadosCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_CERTIFICADOS, config)

    async def listar_metadatos(self) -> list[dict]:
        filas, _ = await self.listar(limit=500, orden="nombre ASC")
        return [_sin_secretos(f) for f in filas]

    async def crear(
        self, nombre: str, descripcion: str | None, id_entidad: int | None,
        datos_archivo: bytes, nombre_fichero: str, contrasena: str | None,
    ) -> dict:
        """Lanza ValueError (el llamador lo traduce a un 400) si el archivo
        no se pudo leer como certificado — no se guarda nada a medias."""
        formato, certificado = _parsear_certificado(datos_archivo, contrasena)
        id_certificado = await self.insert({
            "nombre": nombre,
            "descripcion": descripcion,
            "id_entidad": id_entidad,
            "formato": formato,
            **_extraer_datos(certificado),
            "nombre_fichero": nombre_fichero,
            "archivo_cifrado": cifrar(base64.b64encode(datos_archivo).decode()),
            "contrasena_cifrada": cifrar(contrasena) if contrasena else None,
        })
        return _sin_secretos(await self.obtener(id_certificado))

    async def actualizar_metadatos(
        self, id_certificado: int, nombre: str, descripcion: str | None, id_entidad: int | None,
    ) -> dict | None:
        if not await self.obtener(id_certificado):
            return None
        await self.update(id_certificado, {"nombre": nombre, "descripcion": descripcion, "id_entidad": id_entidad})
        return _sin_secretos(await self.obtener(id_certificado))

    async def archivo_descifrado(self, id_certificado: int) -> tuple[bytes, str] | None:
        """Solo para el endpoint de descarga — cada llamada debe ir
        acompañada de un CertificadosLogCRUD.registrar()."""
        fila = await self.obtener(id_certificado)
        if not fila:
            return None
        contenido = base64.b64decode(descifrar(fila["archivo_cifrado"]))
        nombre_fichero = fila["nombre_fichero"] or f"{fila['nombre']}.{'p12' if fila['formato'] == 'p12' else 'cer'}"
        return contenido, nombre_fichero


class CertificadosLogCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_CERTIFICADOS_LOG, config)

    async def registrar(
        self, id_certificado: int, certificado_nombre: str, id_usuario: int, accion: str,
        detalle: str | None = None,
    ) -> int:
        return await self.insert({
            "id_certificado": id_certificado,
            "certificado_nombre": certificado_nombre,
            "id_usuario": id_usuario,
            "accion": accion,
            "detalle": detalle,
        })

    async def listar_de_certificado(self, id_certificado: int) -> list[dict]:
        filas, _ = await self.listar(
            filtros={"id_certificado": {"op": "=", "valor": id_certificado}}, limit=200, orden="fecha DESC",
        )
        return filas
