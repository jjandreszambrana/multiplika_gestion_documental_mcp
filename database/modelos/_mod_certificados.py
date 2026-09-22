"""CRUD de gd_certificados y su log de uso — ver
docs/gestion-documental.md → "Certificados de entidades". Al subir un
archivo se separa en certificado y clave privada (si la hay); cada uno
se guarda cifrado por su lado, nunca el archivo original tal cual. Una
copia descargable se reconstruye al vuelo en generar_copia() — cada
llamada debe ir acompañada de un CertificadosLogCRUD.registrar(). Mismo
cifrado Fernet que gd_credenciales (lib.cifrado del repo core, import
absoluto — ver guia_nuevo_proyecto.md)."""

from cryptography import x509
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.types import PrivateKeyTypes
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID
from mtpk_postgres import AsyncCrudBase
from lib.cifrado import cifrar, descifrar

from ..dependencias._dep_certificados import TABLA_CERTIFICADOS, TABLA_CERTIFICADOS_LOG


def _parsear_certificado(
    datos: bytes, contrasena: str | None,
) -> tuple[str, x509.Certificate, PrivateKeyTypes | None]:
    """Prueba primero como PKCS12 (.p12/.pfx, con la contraseña dada — un
    .p12 también puede no llevar) y si no, como X.509 suelto (.cer/.pem,
    PEM o DER). Devuelve (formato, certificado, clave_privada) — la clave
    solo viene de un .p12, un .cer/.pem nunca la lleva. Lanza ValueError
    con un mensaje claro si no se pudo leer de ninguna forma."""
    try:
        clave, certificado, _ = pkcs12.load_key_and_certificates(
            datos, contrasena.encode() if contrasena else None,
        )
        if certificado is not None:
            return "p12", certificado, clave
    except ValueError:
        pass
    for cargar in (x509.load_pem_x509_certificate, x509.load_der_x509_certificate):
        try:
            return "cer", cargar(datos), None
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
    return {k: v for k, v in fila.items() if k not in ("certificado_cifrado", "clave_cifrada", "contrasena_cifrada")}


class CertificadosCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_CERTIFICADOS, config)

    async def listar_metadatos(self) -> list[dict]:
        filas, _ = await self.listar(limit=500, orden="nombre ASC")
        return [_sin_secretos(f) for f in filas]

    async def crear(
        self, nombre: str, descripcion: str | None, id_entidad: int | None,
        datos_archivo: bytes, contrasena: str | None,
    ) -> dict:
        """Lanza ValueError (el llamador lo traduce a un 400) si el archivo
        no se pudo leer como certificado — no se guarda nada a medias."""
        formato, certificado, clave_privada = _parsear_certificado(datos_archivo, contrasena)
        certificado_pem = certificado.public_bytes(serialization.Encoding.PEM).decode("ascii")
        clave_pem = None
        if clave_privada is not None:
            clave_pem = clave_privada.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption(),
            ).decode("ascii")
        id_certificado = await self.insert({
            "nombre": nombre,
            "descripcion": descripcion,
            "id_entidad": id_entidad,
            "formato": formato,
            **_extraer_datos(certificado),
            "certificado_cifrado": cifrar(certificado_pem),
            "clave_cifrada": cifrar(clave_pem) if clave_pem else None,
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

    async def generar_copia(self, id_certificado: int) -> tuple[bytes, str] | None:
        """Reconstruye el archivo descargable al vuelo a partir del
        certificado y (si la hay) la clave privada guardados por separado
        — nunca se guarda un .p12 ya armado. Solo para el endpoint de
        descarga, cada llamada debe ir acompañada de un
        CertificadosLogCRUD.registrar()."""
        fila = await self.obtener(id_certificado)
        if not fila:
            return None
        certificado = x509.load_pem_x509_certificate(descifrar(fila["certificado_cifrado"]).encode())

        if fila["formato"] != "p12":
            contenido = certificado.public_bytes(serialization.Encoding.PEM)
            return contenido, f"{fila['nombre']}.pem"

        clave_privada = serialization.load_pem_private_key(descifrar(fila["clave_cifrada"]).encode(), password=None)
        contrasena = descifrar(fila["contrasena_cifrada"]) if fila["contrasena_cifrada"] else None
        cifrado_p12 = (
            serialization.BestAvailableEncryption(contrasena.encode())
            if contrasena else serialization.NoEncryption()
        )
        contenido = pkcs12.serialize_key_and_certificates(
            fila["nombre"].encode(), clave_privada, certificado, None, cifrado_p12,
        )
        return contenido, f"{fila['nombre']}.p12"


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
