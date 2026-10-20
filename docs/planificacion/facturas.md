# Facturas de venta (Verifactu y SII) y de compra en Gestión SIF

Estado (2026-10-20): fases 1 (ventas Verifactu) y 2 (compras, sin el envío al SII) en código, sin probar contra un SIF real. La fase 3 y el envío al SII de compras esperan a saber el modo de cada empresa (primera petición de abajo). Las peticiones al canal están pendientes de que el usuario las revise.

## Qué se quiere

Dentro de ERP → Gestión SIF, la facturación completa de cada empresa del SIF,
con los accesos al SIF de cada usuario (como los maestros y la contabilidad):

- **Facturas de venta**: crear, revisar, emitir, ver su estado en la AEAT, PDF,
  rectificar y anular.
- **Facturas de compra**: registrar, aprobar, enviar al SII (si la empresa está
  en SII) y ver su estado.

Todo pasa por el proxy de la GD (`/contabilidad/sif/proxy/{id_empresa}/...`),
que impone la empresa. Hay que abrir los prefijos `/facturas_emitidas_borradores/`,
`/facturas_emitidas/`, `/facturas_simplificadas/`, `/facturas_anuladas/`,
`/facturas_comun/`, `/facturas/facturas_emitidas_sii/`,
`/facturas_recibidas/facturas_recibidas_sii/`, `/maestros/tipos_iva/`,
`/maestros/unidades/`, `/maestros/clasificacion_gastos/` (y artículos si se usan
en las líneas).

## Una empresa es Verifactu o SII, no las dos

`msif_obligados.modo_vf_o_sii`: 0 no envía, 1 Verifactu, 2 SII. La pantalla de
ventas se adapta sola a la empresa elegida: el mismo menú "Facturas de venta"
lleva al flujo Verifactu o al SII. Las compras son las mismas para las dos (el
envío al SII de compras solo aparece en las de SII).

Falta una forma limpia de leer ese modo con cualquier rol (`/usuarios/me` solo
lo da a los roles 4 y 5): petición al canal.

## Cómo es cada flujo en el SIF (resumen de lo investigado)

### Ventas Verifactu
- Borrador (`/facturas_emitidas_borradores/crear` + `/detalle/*`): cabecera
  (cliente, serie, fecha, forma/medio de pago, descuentos, IRPF, suplidos,
  nota) y líneas (descripción o artículo, cantidad, precio, descuento, IVA). Los
  importes, el recargo y los totales los calcula el SIF.
- El tipo de factura lo decide la serie (serie de tipo 0 → F1, 1 → R1-R4,
  2 → F2, 3 → F3, 4 → R5).
- Emitir = `/aprobar_factura`: numera, fija la fecha de hoy, genera recibos y
  transmite (el SIF reintenta cada minuto). Irreversible.
- Emitida: solo lectura; estado AEAT (almacenada, enviada, aceptada, con
  errores, rechazada), CSV, huella, QR. PDF de borrador y de emitida.
- Corregir: rectificativa (borrador nuevo con serie de rectificativas y la
  factura de origen) o anulación (`/facturas_emitidas/anular`).
- Simplificadas (tickets): borrador F2, ticket en PDF, canje F2 → F3 y paso a
  F1.

### Ventas SII
- Alta en un paso (`/facturas/facturas_emitidas_sii/ext/crear` con cabecera y
  líneas): sale numerada por la serie y lista para enviar. El "borrador" vive en
  la pantalla de la GD hasta que se guarda.
- Enviar (`/transmitir` con `estados_msif: [1,4,5]`, nunca sin filtro: enviaría
  borradores) y ver la respuesta por factura (`/tx/sii/listar`).
- Aceptada con errores o rechazada: se corrige y se reenvía (el SIF pone A1/A0).
- Datos fiscales propios: clave de régimen, tipo de operación, exenta/no sujeta.

### Compras
- Alta de cabecera (`/facturas_recibidas/facturas_recibidas_sii/crear`) y
  líneas después (`/detalles/crear`); el proveedor se crea solo si llega NIF y
  nombre. Estados: borrador → aprobada → (SII) enviada → aceptada/con
  errores/rechazada.
- Tipo de gasto (`id_tipo_gasto`) solo con `/modificar` tras crear.
- Envío al SII igual que las ventas SII.

## Fases

1. **Ventas Verifactu** (lo más usado): listado de borradores y emitidas con
   filtros, ficha de factura con cabecera + líneas editables y totales del SIF,
   emitir con confirmación, estado AEAT, PDF, rectificativa y anulación.
2. **Compras**: listado, ficha con líneas, aprobar, tipo de gasto y, en
   empresas SII, envío y estado.
3. **Ventas SII**: ficha en la GD que se guarda de una vez, envío y respuesta
   por factura, corrección y reenvío.
4. **Simplificadas** (tickets) y lo que llegue del canal.

Cada fase reutiliza el patrón de MaestroSif (rejilla, ficha en ventana,
errores del SIF tal cual) más una rejilla de líneas editable.

## Lo que falta en el SIF (peticiones al canal)

- Leer el modo Verifactu/SII de la empresa con cualquier rol (por ejemplo en
  `/contabilidad/sesion/empresas`). **Bloquea**: sin él la GD no sabe qué
  pantalla de ventas enseñar, y `/facturas_recibidas/.../transmitir` no exige
  que la empresa vaya por SII (`require_sii_mode=False`), así que un botón de
  "Enviar al SII" en una empresa Verifactu mandaría sus compras al SII. Mejor
  aún: que transmitir lo exija.
- Verifactu: filtros de fecha, estado e importe en `/facturas_emitidas/listar`;
  `motivo_anulacion` se recibe pero no se guarda; envío por email.
- SII ventas: baja/anulación SII, eliminar factura no enviada, PDF, guardar la
  factura rectificada (`uuid_relacionada` se valida pero no se guarda) y una
  forma de aprobar un borrador creado con `/crear`.
- Compras: `/obtener` de una factura (cuentas, forma/medio de pago y
  vencimientos no se pueden leer), `id_tipo_gasto` en `/crear` y en `/listar`,
  control de duplicados en las manuales, adjuntar el PDF de la factura.
- Todas: `numero_registros` de `/listar` no es el total real en la última
  página (SII y compras).
