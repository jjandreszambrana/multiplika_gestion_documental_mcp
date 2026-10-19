// Los maestros del ERP (Multiplika SIF) que se mantienen desde la GD. Cada
// uno dice sus rutas, qué columnas se ven y qué campos tiene la ficha; la
// pantalla (MaestroSif) es la misma para todos.
//
// Campos: `tipo` texto | numero | si_no | lista. `soloAlta`: el SIF no deja
// cambiarlo después. `opciones`: lista fija, o `tipos` para pedirla al SIF.

const SI_NO = (v) => (v ? "Sí" : "No")

export const MAESTROS = [
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
    tipos: { ruta: "/maestros/medios_pago/tipos", etiqueta: "tipo_medio_pago" },
    campos: [
      { campo: "descripcion", titulo: "Descripción", tipo: "texto", obligatorio: true },
      { campo: "id_tipo", titulo: "Tipo", tipo: "lista", opciones: "tipos", obligatorio: true },
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
    columnas: [
      { campo: "serie", titulo: "Serie", ancho: 90 },
      { campo: "descripcion", titulo: "Descripción", crece: true },
      { campo: "tipo_serie", titulo: "Tipo", ancho: 200 },
      { campo: "separador_serie", titulo: "Separador", ancho: 100 },
      { campo: "incluir_ejercicio", titulo: "Con el año", ancho: 100, ver: SI_NO },
      { campo: "irpf", titulo: "% IRPF", ancho: 90 },
    ],
    tipos: { ruta: "/maestros/series/tipos", etiqueta: "tipo_serie" },
    campos: [
      { campo: "serie", titulo: "Serie", tipo: "texto", obligatorio: true, soloAlta: true, ayuda: "Letra o número, sin separador" },
      { campo: "descripcion", titulo: "Descripción", tipo: "texto" },
      { campo: "id_tipo_serie", titulo: "Tipo", tipo: "lista", opciones: "tipos", defecto: 0, soloAlta: true },
      { campo: "separador_serie", titulo: "Separador", tipo: "lista", opciones: ["/", "-", "_", "."], defecto: "/", soloAlta: true },
      { campo: "incluir_ejercicio", titulo: "Añadir los dos últimos dígitos del año", tipo: "si_no", defecto: 1, soloAlta: true },
      { campo: "irpf", titulo: "% IRPF", tipo: "numero", decimales: 2, defecto: 0 },
      { campo: "cta_contable_ventas", titulo: "Cuenta de ventas", tipo: "texto", soloAlta: true },
      { campo: "descripcion_operacion", titulo: "Descripción de la operación (Verifactu)", tipo: "texto", soloAlta: true },
    ],
  },
]
