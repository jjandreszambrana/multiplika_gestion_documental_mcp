# Laboratorio

Apartado «Laboratorio» del panel de la GD, **independiente de la contabilidad**
(`src/pages/laboratorio/`, entrada `src/EmbebidoLaboratorio.tsx`, página
`panel_cliente/frontend/src/paginas/Laboratorio.jsx`). Petición [5.54] del canal
con el SIF; guía de la API en
`multiplika_compartida/contabilidad/contexto/api_laboratorio_para_frontend.md`.

## Cuándo se enseña

- En la GD: interruptor propio «Laboratorio» en Contexto de negocio
  (`gd_configuracion.modulo_laboratorio`, apagado por defecto). No depende del
  asesor contable. Si está encendido, sale «Laboratorio» en Negocio y «Mis
  accesos al SIF» (que sirven a los dos módulos).
- En el SIF: `laboratorio/configuracion/obtener` dice si la empresa lo tiene.
  Error (403/404): aviso de que no está habilitado. `activo: false`: botón
  «Poner en marcha el laboratorio». `activo: true`: las cuatro pestañas.

Los operarios (rol 5) no tienen acceso en el SIF.

## Pestañas

- **Muestras**: lista con búsqueda, cliente, estado y fechas de toma, de 50 en
  50. La ficha deja ver y editar los datos, añadir resultados (del catálogo o a
  mano; en rojo si no cumple), emitir, ver y anular el informe, pasar a
  «entregado», cambiar de estado, ocultar y eliminar. Con informe vigente no se
  puede cambiar nada: hay que anularlo.
- **Facturar**: muestras con informe y tarifa sin albarán; se marcan las de un
  solo cliente, se elige la serie y se crea el albarán.
- **Catálogos**: ocho catálogos con una sola pantalla (`catalogos.ts` dice los
  campos de cada uno). Un catálogo ya usado no se borra: se deja sin uso.
- **Portal de clientes**: usuarios del portal, con la clave temporal visible una
  sola vez al crearlos o restablecerles la clave.

## Detalles

- Las fechas con hora se mandan a medianoche si solo se elige el día, y al
  editar solo viajan los campos que han cambiado.
- Los tipos están escritos a mano en `src/api/laboratorio.ts`: `types.ts` se
  genera del OpenAPI de facturae y no los trae todavía.
- Va por su propio proxy (`/proyectos/{id}/laboratorio/sif/proxy/{empresa}/...`),
  que exige solo el módulo de laboratorio y deja pasar únicamente
  `PREFIJOS_LABORATORIO` (`database/modelos/_mod_contabilidad_sif.py`). Su
  conexión (`configurarLaboratorio`) es distinta de la de contabilidad: las dos
  pueden estar abiertas a la vez con empresas distintas.
- Al añadir la columna `modulo_laboratorio` hay que aplicarla en cada servidor
  (ver «Gotchas despliegue panel_cliente»).
