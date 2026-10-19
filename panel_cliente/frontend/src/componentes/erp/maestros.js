// Los maestros del ERP (Multiplika SIF) que se mantienen desde la GD. Cada
// uno dice sus rutas, qué columnas se ven y qué campos tiene la ficha; la
// pantalla (MaestroSif) es la misma para todos.
//
// Campos: `tipo` texto | numero | si_no | lista | nota. `soloAlta`: el SIF no
// deja cambiarlo después. `opciones` de una lista: fija, o una de LISTAS (se
// pide al SIF). `numerico`: el valor de la lista es un id.
// `padre`: el maestro cuelga de otro (los establecimientos, de un cliente):
// se elige arriba y va en listar y crear.
// `limite`: lo más que el SIF devuelve de una vez (se pide por tandas).

const SI_NO = (v) => (v ? "Sí" : "No")

// Listas que se piden al SIF: ruta, campo del valor y campo del texto.
// `vacio`: la opción de "ninguno", con el valor que el SIF entiende así.
export const LISTAS = {
  tipos_medio: { ruta: "/maestros/medios_pago/tipos", valor: "id", etiqueta: "tipo_medio_pago" },
  tipos_serie: { ruta: "/maestros/series/tipos", valor: "id", etiqueta: "tipo_serie" },
  formas_pago: { ruta: "/maestros/formas_pago/listar", valor: "id", etiqueta: "descripcion", vacio: { value: "0", label: "Ninguna" } },
  medios_pago: { ruta: "/maestros/medios_pago/listar", valor: "id", etiqueta: "descripcion", vacio: { value: "0", label: "Ninguno" } },
  tipos_nif: { ruta: "/obligados/receptores/listas/tipos_nif", valor: "tipo", etiqueta: "descripcion" },
  residencias: { ruta: "/obligados/receptores/listas/residencias", valor: "id", etiqueta: "descripcion" },
  paises: { ruta: "/obligados/receptores/listas/paises", valor: "codigo_iso", etiqueta: "pais" },
}

// Lo que comparten clientes, proveedores y establecimientos
const DIRECCION = [
  { campo: "direccion", titulo: "Dirección", tipo: "texto" },
  { campo: "codigo_postal", titulo: "Código postal", tipo: "texto" },
  { campo: "ciudad", titulo: "Ciudad", tipo: "texto" },
  { campo: "provincia", titulo: "Provincia", tipo: "texto" },
  { campo: "codigo_pais", titulo: "País", tipo: "lista", opciones: "paises", ayuda: "Vacío = España" },
]
const CONTACTO = [
  { campo: "telefono", titulo: "Teléfono", tipo: "texto" },
  { campo: "movil", titulo: "Móvil", tipo: "texto" },
  { campo: "email", titulo: "Email", tipo: "texto" },
]
const IDENTIFICACION = [
  { campo: "tipoNIF", titulo: "Tipo de identificación", tipo: "lista", opciones: "tipos_nif", defecto: "02" },
  { campo: "id_residencia", titulo: "Residencia", tipo: "lista", opciones: "residencias", numerico: true, defecto: 0 },
]

export const MAESTROS = [
  {
    id: "clientes",
    titulo: "Clientes",
    singular: "cliente",
    ruta: "/obligados/receptores",
    nombre: (f) => f.NombreRazon,
    columnas: [
      { campo: "codigo", titulo: "Código", ancho: 90 },
      { campo: "NombreRazon", titulo: "Nombre o razón social", crece: true },
      { campo: "NIF", titulo: "NIF", ancho: 120 },
      { campo: "ciudad", titulo: "Ciudad", ancho: 150 },
      { campo: "telefono", titulo: "Teléfono", ancho: 120 },
      { campo: "email", titulo: "Email", ancho: 220 },
    ],
    campos: [
      { campo: "codigo", titulo: "Código", tipo: "texto" },
      { campo: "NombreRazon", titulo: "Nombre o razón social", tipo: "texto", obligatorio: true },
      { campo: "nombre_comercial", titulo: "Nombre comercial", tipo: "texto" },
      { campo: "NIF", titulo: "NIF", tipo: "texto", ayuda: "Sin NIF solo se le pueden hacer facturas simplificadas" },
      ...IDENTIFICACION,
      ...DIRECCION,
      ...CONTACTO,
      { campo: "web", titulo: "Web", tipo: "texto" },
      { campo: "id_forma_pago", titulo: "Forma de pago", tipo: "lista", opciones: "formas_pago", numerico: true, defecto: 0 },
      { campo: "id_medio_pago", titulo: "Medio de pago", tipo: "lista", opciones: "medios_pago", numerico: true, defecto: 0 },
      { campo: "iban", titulo: "IBAN", tipo: "texto" },
      { campo: "descuento", titulo: "% Descuento", tipo: "numero", decimales: 2, defecto: 0 },
      { campo: "descuento_pp", titulo: "% Descuento por pronto pago", tipo: "numero", decimales: 2, defecto: 0 },
      { campo: "cta_contable", titulo: "Cuenta contable", tipo: "texto" },
      { campo: "aplicar_iva", titulo: "Se le aplica IVA", tipo: "si_no", defecto: 1 },
      { campo: "aplicar_re", titulo: "Recargo de equivalencia", tipo: "si_no", defecto: 0 },
      { campo: "nota_factura", titulo: "Nota en sus facturas", tipo: "texto" },
      { campo: "observaciones", titulo: "Observaciones", tipo: "nota" },
    ],
  },
  {
    id: "establecimientos",
    titulo: "Establecimientos",
    singular: "establecimiento",
    ruta: "/obligados/receptores/establecimientos",
    padre: { campo: "id_receptor", titulo: "Cliente", ruta: "/obligados/receptores/listar", etiqueta: "NombreRazon" },
    columnas: [
      { campo: "descripcion", titulo: "Descripción", crece: true },
      { campo: "direccion", titulo: "Dirección", ancho: 240 },
      { campo: "ciudad", titulo: "Ciudad", ancho: 150 },
      { campo: "telefono", titulo: "Teléfono", ancho: 120 },
      { campo: "direccion_facturacion", titulo: "Facturación", ancho: 100, ver: SI_NO },
      { campo: "direccion_entrega", titulo: "Entrega", ancho: 90, ver: SI_NO },
    ],
    campos: [
      { campo: "descripcion", titulo: "Descripción", tipo: "texto", obligatorio: true },
      ...DIRECCION,
      { campo: "id_residencia", titulo: "Residencia", tipo: "lista", opciones: "residencias", numerico: true },
      ...CONTACTO,
      { campo: "persona_contacto", titulo: "Persona de contacto", tipo: "texto" },
      { campo: "telefono_contacto", titulo: "Teléfono de contacto", tipo: "texto" },
      { campo: "email_contacto", titulo: "Email de contacto", tipo: "texto" },
      { campo: "id_forma_pago", titulo: "Forma de pago", tipo: "lista", opciones: "formas_pago", numerico: true, defecto: 0 },
      { campo: "id_medio_pago", titulo: "Medio de pago", tipo: "lista", opciones: "medios_pago", numerico: true, defecto: 0 },
      { campo: "direccion_facturacion", titulo: "Dirección de facturación", tipo: "si_no", defecto: 0 },
      { campo: "direccion_entrega", titulo: "Dirección de entrega", tipo: "si_no", defecto: 0 },
      { campo: "observaciones", titulo: "Observaciones", tipo: "nota" },
    ],
  },
  {
    id: "proveedores",
    titulo: "Proveedores",
    singular: "proveedor",
    ruta: "/obligados/emisores",
    nombre: (f) => f.NombreRazon,
    limite: 500,
    columnas: [
      { campo: "codigo", titulo: "Código", ancho: 90 },
      { campo: "NombreRazon", titulo: "Nombre o razón social", crece: true },
      { campo: "NIF", titulo: "NIF", ancho: 120 },
      { campo: "tipo_tercero", titulo: "Tipo", ancho: 100 },
      { campo: "ciudad", titulo: "Ciudad", ancho: 150 },
      { campo: "telefono", titulo: "Teléfono", ancho: 120 },
    ],
    campos: [
      { campo: "codigo", titulo: "Código", tipo: "texto" },
      { campo: "NombreRazon", titulo: "Nombre o razón social", tipo: "texto", obligatorio: true },
      { campo: "nombre_comercial", titulo: "Nombre comercial", tipo: "texto" },
      { campo: "NIF", titulo: "NIF", tipo: "texto", obligatorio: true },
      { campo: "tipo_tercero", titulo: "Tipo", tipo: "lista", opciones: [{ value: "proveedor", label: "Proveedor" }, { value: "acreedor", label: "Acreedor" }], defecto: "proveedor" },
      ...IDENTIFICACION,
      ...DIRECCION,
      ...CONTACTO,
      { campo: "web", titulo: "Web", tipo: "texto" },
      { campo: "cta_contable", titulo: "Cuenta contable", tipo: "texto" },
      { campo: "cuenta_contable_gasto", titulo: "Cuenta de gasto", tipo: "texto" },
      { campo: "cuenta_contable_iva", titulo: "Cuenta de IVA", tipo: "texto" },
      { campo: "cuenta_contable_retencion", titulo: "Cuenta de retención", tipo: "texto" },
      { campo: "observaciones", titulo: "Observaciones", tipo: "nota" },
    ],
  },
  {
    id: "formas_pago",
    titulo: "Formas de pago",
    singular: "forma de pago",
    femenino: true,
    ruta: "/maestros/formas_pago",
    columnas: [
      { campo: "descripcion", titulo: "Descripción", crece: true },
      { campo: "numero_recibos", titulo: "Recibos", ancho: 90 },
      { campo: "dias_recibo_1", titulo: "Días 1.er recibo", ancho: 130 },
      { campo: "dias_entre_recibos", titulo: "Días entre recibos", ancho: 140 },
      { campo: "estado", titulo: "Activa", ancho: 80, ver: SI_NO },
    ],
    campos: [
      { campo: "descripcion", titulo: "Descripción", tipo: "texto", obligatorio: true },
      { campo: "numero_recibos", titulo: "Número de recibos", tipo: "numero", defecto: 1 },
      { campo: "dias_recibo_1", titulo: "Días hasta el primer recibo", tipo: "numero", defecto: 0 },
      { campo: "dias_entre_recibos", titulo: "Días entre recibos", tipo: "numero", defecto: 0 },
      { campo: "estado", titulo: "Activa", tipo: "si_no", defecto: 1 },
      { campo: "aplicar_dto_pp", titulo: "Aplica descuento por pronto pago", tipo: "si_no", defecto: 0 },
      { campo: "permitir_en_tickets", titulo: "Se puede usar en tickets", tipo: "si_no", defecto: 0 },
      { campo: "predeterminada_en_ticket", titulo: "Es la de los tickets por defecto", tipo: "si_no", defecto: 0 },
    ],
  },
  {
    id: "medios_pago",
    titulo: "Medios de pago",
    singular: "medio de pago",
    ruta: "/maestros/medios_pago",
    columnas: [
      { campo: "descripcion", titulo: "Descripción", crece: true },
      { campo: "tipo_medio_pago", titulo: "Tipo", ancho: 170 },
      { campo: "iban", titulo: "IBAN", ancho: 260 },
      { campo: "estado", titulo: "Activo", ancho: 80, ver: SI_NO },
    ],
    campos: [
      { campo: "descripcion", titulo: "Descripción", tipo: "texto", obligatorio: true },
      { campo: "id_tipo", titulo: "Tipo", tipo: "lista", opciones: "tipos_medio", numerico: true, obligatorio: true },
      { campo: "iban", titulo: "IBAN", tipo: "texto" },
      { campo: "bic", titulo: "BIC", tipo: "texto", ayuda: "Si se deja vacío, se saca del IBAN" },
      { campo: "sufijo_acreedor", titulo: "Sufijo de acreedor (SEPA)", tipo: "texto" },
      { campo: "identificador_acreedor", titulo: "Identificador de acreedor (SEPA)", tipo: "texto", ayuda: "Si se deja vacío, se calcula con el NIF de la empresa" },
      { campo: "cta_contable_cobros", titulo: "Cuenta de cobros", tipo: "texto" },
      { campo: "cta_contable_pagos", titulo: "Cuenta de pagos", tipo: "texto" },
      { campo: "cta_contable_gastos", titulo: "Cuenta de gastos", tipo: "texto" },
      { campo: "cta_efectos_cobrar_n3", titulo: "Cuenta de efectos a cobrar", tipo: "texto" },
      { campo: "importe_limite", titulo: "Importe límite", tipo: "numero", decimales: 2 },
      { campo: "estado", titulo: "Activo", tipo: "si_no", defecto: 1 },
      { campo: "permitir_comerciales", titulo: "Lo pueden usar los comerciales", tipo: "si_no", defecto: 0 },
      { campo: "permitir_en_tickets", titulo: "Se puede usar en tickets", tipo: "si_no", defecto: 0 },
      { campo: "permitir_arqueos", titulo: "Entra en los arqueos de caja", tipo: "si_no", defecto: 0 },
      { campo: "prohibir_en_clientes", titulo: "No se puede poner en clientes", tipo: "si_no", defecto: 0 },
    ],
  },
  {
    id: "series",
    titulo: "Series",
    singular: "serie",
    femenino: true,
    ruta: "/maestros/series",
    nombre: (f) => `${f.serie} - ${f.descripcion || ""}`,
    columnas: [
      { campo: "serie", titulo: "Serie", ancho: 90 },
      { campo: "descripcion", titulo: "Descripción", crece: true },
      { campo: "tipo_serie", titulo: "Tipo", ancho: 200 },
      { campo: "separador_serie", titulo: "Separador", ancho: 100 },
      { campo: "incluir_ejercicio", titulo: "Con el año", ancho: 100, ver: SI_NO },
      { campo: "irpf", titulo: "% IRPF", ancho: 90 },
    ],
    campos: [
      { campo: "serie", titulo: "Serie", tipo: "texto", obligatorio: true, soloAlta: true, ayuda: "Letra o número, sin separador" },
      { campo: "descripcion", titulo: "Descripción", tipo: "texto" },
      { campo: "id_tipo_serie", titulo: "Tipo", tipo: "lista", opciones: "tipos_serie", numerico: true, defecto: 0, soloAlta: true },
      { campo: "separador_serie", titulo: "Separador", tipo: "lista", opciones: ["/", "-", "_", "."], defecto: "/", soloAlta: true },
      { campo: "incluir_ejercicio", titulo: "Añadir los dos últimos dígitos del año", tipo: "si_no", defecto: 1, soloAlta: true },
      { campo: "irpf", titulo: "% IRPF", tipo: "numero", decimales: 2, defecto: 0 },
      { campo: "cta_contable_ventas", titulo: "Cuenta de ventas", tipo: "texto", soloAlta: true },
      { campo: "descripcion_operacion", titulo: "Descripción de la operación (Verifactu)", tipo: "texto", soloAlta: true },
    ],
  },
]
