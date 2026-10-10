# Arrancar: entrar, elegir empresa y elegir ejercicio

## Entrar

`POST /usuarios/login` con `username` + `password`, o `username` + `api_key` +
`api_secret`. **El token no viene en el cuerpo**: llega como cookie `access_token`
HttpOnly, `SameSite=strict`, `Secure` en https.

Lo único que tiene que hacer la interfaz es **mandar las cookies en cada
petición**. No se lee el token, no se guarda, no se monta ningún temporizador de
refresco: el servidor lo renueva solo. Ante un 401, a login y ya está.

`SameSite=strict` obliga a servir la interfaz **desde el mismo dominio que la
API**. En un cliente web eso significa un proxy en desarrollo; no hay
alternativa con CORS. En un cliente nativo, el almacén de cookies de la
plataforma.

Salir: `POST /usuarios/logout`, que borra la cookie.

## La secuencia de arranque, en orden

1. `POST /contabilidad/sesion/me` → quién ha entrado y su rol.
2. `POST /contabilidad/sesion/empresas` con cuerpo `{}` →
   `{"activa", "puede_conmutar", "empresas": [{id_obligado, NombreRazon, NIF, nivel}]}`
   - Lista vacía → el usuario no tiene contabilidad: no se pinta el módulo.
   - Una sola y `puede_conmutar: false` → entra directo, sin selector.
   - Varias → selector de empresa.
3. `POST /contabilidad/sesion/conmutar` con el id elegido → reemite la cookie y
   devuelve `{"id_obligado", "nivel"}`. **Se guarda el nivel**: manda en toda la
   interfaz.
4. `POST /contabilidad/configuracion/obtener` → ancho de cuenta, plan vigente,
   diarios, cuentas por defecto y lo que falta por configurar.
5. `POST /contabilidad/ejercicios/listar` → selector de ejercicio.

**La configuración se pide una vez**, al entrar y al conmutar de empresa, y vive
en el estado de la aplicación. No se pide pantalla por pantalla: el ancho de
cuenta y el plan vigente se pasan como propiedad.

## La empresa activa

Va **dentro del token** (`conta_id_obligado`), no en el cuerpo de las
peticiones. No se añade un `id_obligado` a las llamadas de contabilidad: daría
422. La única excepción es activar la contabilidad de una empresa.

**Mientras no se ha conmutado, los endpoints de contabilidad responden 409.** Un
409 significa «falta elegir empresa», nunca un error genérico ni una pantalla
vacía: se lleva al selector.

**Para quien puede conmutar, el nombre y el NIF de la empresa activa tienen que
estar visibles en todas las pantallas del módulo.** Apuntar en la empresa
equivocada es el error humano más caro de esta aplicación.

## El ejercicio

Sale de `/ejercicios/listar`, del más reciente al más antiguo, y se elige en la
cabecera. **Se recuerda entre sesiones**, por usuario y empresa: al volver a
entrar sale el que se dejó, y si ese ya no está en la lista, el más reciente.

Cada ejercicio trae cuatro marcas distintas, que no significan lo mismo:
`cerrado` es definitivo, `bloqueado` es reversible, `cerrando` lo pone y lo
quita el proceso de cierre, y `deshabilitado` es de un periodo ya presentado, no
del ejercicio. La interfaz apaga los botones **antes**, en vez de dejar teclear
un asiento entero y perderlo.

También trae `apertura` y `cierre`, el primer y el último día. El diario los usa
para saber por dónde abrirse.

## Los avisos de configuración

`/configuracion/obtener` devuelve `cuentas_sin_poner` (cuentas obligatorias que
faltan; sin ellas la contabilización automática falla), `avisos` (qué deja de
funcionar por cada cuenta opcional vacía) y `ejercicios_abiertos`. Si es `0`, no
se puede apuntar en ningún sitio.

**No son decorado, pero tampoco pueden ocupar una franja fija en lo alto de
todas las pantallas**: se leen una vez y a partir de ahí solo quitan alto a la
rejilla. Viven detrás de una campana junto al selector de ejercicio, con el
número de avisos encima; si no hay ninguno, la campana no se pinta. El diálogo
se titula «Avisos».

Los títulos y los textos de cada aviso **los escribe el backend**, junto a la
columna que declara: aquí no hay diccionario que mantener, y una cuenta nueva
sale bien escrita sin tocar nada.

## Por dónde se entra

Por el **Diario**, siempre, no por lo primero del menú: es lo que se abre cada
mañana, y dejarlo al orden del menú significaría que cambiar el menú cambia por
dónde entra todo el mundo.

## El menú

Secciones con su nivel mínimo; las que no alcanzan, **no se pintan**. Algunas
cuelgan de un apartado que se despliega, y el apartado sale abierto cuando
dentro está la pantalla que se está viendo.

- **Plan contable**: «Gestión plan contable», «Enlace con facturación».
- **Diario**: «Entrada asientos», «Asientos eliminados».
- Traspasos, Informes, Fiscal, Inmovilizado, Cierre de ejercicio.
- **Utilidades**: «Importar datos», «Ejercicios», «Configuración».
- Accesos (`admin`).
