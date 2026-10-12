# Conexión con Codiplika

Para que la bandeja de contabilidad traiga las facturas, cobros y pagos que la
empresa hace en Codiplika. API: `/apisif/v1/maestros/conexiones_externas/*`
(guía en `multiplika_sif/docs/otros/guia_api_conexiones_externas.md`).

## Quién la ve

Superadministrador (1), administrador (2) y usuario de la propia empresa (4),
sea cual sea su nivel en la contabilidad. Representantes y operarios no: el SIF
les da 403. Va en Utilidades → «Conexión con Codiplika». Dentro de la GD el rol
se pregunta a `/contabilidad/sesion/me` con la clave del usuario; si falla, no
se enseña.

## Qué hace

- Sin conexión: un botón «Conectar con Codiplika» abre el formulario. Si
  `/tuneles` viene vacío, en su lugar: «Este servidor no tiene acceso
  configurado a otros programas. Pídelo al administrador de la plataforma.»
- No se escriben máquinas ni llaves: se elige un túnel del desplegable
  (`/tuneles`, los mantiene el administrador de los servidores). Con uno solo,
  viene puesto. Servidor y puerto de la base, por defecto 127.0.0.1 y 3306.
- Con conexión: nombre, si está «En uso» o «Apagada», a dónde se conecta en una
  frase, si hay contraseña guardada y la última prueba.
- El orden es el del SIF: se guarda (nace apagada) → «Probar» → se mira que lo
  que sale (base, última factura, series, cuántas facturas, clientes y
  proveedores) es de esta empresa → «Activar». Si la última prueba de la sesión
  falló, «Activar» está deshabilitado.
- Activar, apagar y quitar piden confirmación. Quitar no toca lo ya traído.
- El formulario sirve para crear y cambiar. La contraseña no se devuelve nunca:
  vacía al cambiar = se deja la que había. Cambiar el destino apaga la conexión
  (lo hace el SIF).
- Una conexión por tipo y empresa; hoy solo existe el tipo `codiplika`.

## Detalles

- El proxy de la GD deja pasar `/maestros/conexiones_externas/` además de
  `/contabilidad/`, y mete el `id_obligado` de la empresa en el cuerpo: al crear
  y listar es justo el que toca; en el resto el SIF lo ignora.
