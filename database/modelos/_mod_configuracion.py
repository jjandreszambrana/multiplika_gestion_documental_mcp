"""CRUD de gd_configuracion (fila única, id=1 — ver
docs/gestion-documental.md → "Configuración de búsqueda")."""

from mtpk_postgres import AsyncCrudBase
from lib.cifrado import cifrar, descifrar

from ..dependencias._dep_configuracion import TABLA_CONFIGURACION

CAMPOS_CUENTA_EMAIL_METADATOS = (
    "email_cuenta_direccion", "email_cuenta_usuario",
    "email_cuenta_smtp_host", "email_cuenta_smtp_port",
    "email_cuenta_imap_host", "email_cuenta_imap_port",
)


class ConfiguracionCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_CONFIGURACION, config)

    async def obtener_modo_busqueda(self) -> str:
        fila = await self.obtener(1)
        return fila["modo_busqueda"] if fila else "fulltext"

    async def obtener_proveedor_embedding(self) -> str:
        fila = await self.obtener(1)
        return fila["proveedor_embedding"] if fila else "mistral:mistral-embed"

    async def obtener_email_avisos(self) -> str | None:
        fila = await self.obtener(1)
        return fila["email_avisos"] if fila else None

    async def actualizar_email_avisos(self, email: str | None) -> None:
        await self.update(1, {"email_avisos": email})

    async def obtener_cuenta_email_metadatos(self) -> dict:
        """Como obtener_cuenta_email(), sin la contraseña — para mostrar
        en el panel (nunca se vuelve a mostrar la contraseña ya guardada,
        igual que gd_credenciales)."""
        fila = await self.obtener(1)
        return {campo: (fila.get(campo) if fila else None) for campo in CAMPOS_CUENTA_EMAIL_METADATOS}

    async def actualizar_cuenta_email(
        self, direccion: str | None, usuario: str | None, password: str | None,
        smtp_host: str | None, smtp_port: int | None, imap_host: str | None, imap_port: int | None,
    ) -> None:
        """Todos los parámetros son opcionales: solo se actualiza lo que
        se manda (no None), igual que CredencialesCRUD.actualizar — así se
        puede corregir un solo campo (p.ej. el host SMTP) sin tener que
        volver a escribir el resto ni la contraseña. Bug real encontrado
        al probarlo (2026-09-10): antes escribía los None literalmente,
        así que un PUT parcial borraba todo lo demás ya guardado."""
        posibles = {
            "email_cuenta_direccion": direccion,
            "email_cuenta_usuario": usuario,
            "email_cuenta_smtp_host": smtp_host,
            "email_cuenta_smtp_port": smtp_port,
            "email_cuenta_imap_host": imap_host,
            "email_cuenta_imap_port": imap_port,
        }
        cambios = {campo: valor for campo, valor in posibles.items() if valor is not None}
        if password:
            cambios["email_cuenta_password_cifrada"] = cifrar(password)
        if cambios:
            await self.update(1, cambios)

    async def obtener_cuenta_email(self) -> dict | None:
        """Uso interno del backend (scripts de avisos/ingesta) — incluye
        la contraseña descifrada, nunca se expone tal cual por la API.
        None si la cuenta no está configurada del todo (dirección y
        contraseña son obligatorias; el resto puede completarse con
        valores por defecto razonables)."""
        fila = await self.obtener(1)
        if not fila or not fila.get("email_cuenta_direccion") or not fila.get("email_cuenta_password_cifrada"):
            return None
        return {
            "direccion": fila["email_cuenta_direccion"],
            "usuario": fila["email_cuenta_usuario"] or fila["email_cuenta_direccion"],
            "password": descifrar(fila["email_cuenta_password_cifrada"]),
            "smtp_host": fila["email_cuenta_smtp_host"],
            "smtp_port": fila["email_cuenta_smtp_port"] or 587,
            "imap_host": fila["email_cuenta_imap_host"],
            "imap_port": fila["email_cuenta_imap_port"] or 993,
        }
