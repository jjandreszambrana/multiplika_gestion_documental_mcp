import { pedir } from './cliente'

/**
 * Bandeja de Codiplika: facturas, cobros y pagos que llegan de otro programa,
 * se revisan aquí y se contabilizan en borrador.
 *
 * Los tipos se declaran a mano, copiados del backend
 * (`apisif/v1/metodos/contabilidad/_api_conta_bandeja.py`): `types.ts` se
 * generó antes de que los esquemas pasaran a llamarse `...Bandeja` y le faltan
 * `leer_erp`, `deshacer_exportacion` y `cuentas_creadas`. Cuando se regenere,
 * estos tipos pueden pasar a leerse de allí.
 */
export const FACTURAS = 'facturas'
export const MOVIMIENTOS = 'movimientos'

export type TipoDocumento = typeof FACTURAS | typeof MOVIMIENTOS

export type EstadoBandeja =
  | 'pendiente'
  | 'duplicada'
  | 'en_conflicto'
  | 'posible_duplicado'
  | 'contabilizada'
  | 'descartada'

/**
 * `sif` y `importada`, solo en conflicto; `recuperar`, solo una descartada;
 * `ya_contabilizado`, solo un posible duplicado (con `importada` se dice que no lo es).
 */
export type Decision = 'sif' | 'importada' | 'descartar' | 'recuperar' | 'ya_contabilizado'

/** Lo que comparten facturas y movimientos. */
interface Comun {
  id: number
  id_lectura?: number | null
  origen: string
  id_origen: string
  estado: EstadoBandeja
  motivo?: string | null
  /** Documento de la facturación con el que coincide. */
  ref_tipo_sif?: string | null
  ref_id_sif?: number | null
  /** 1 = el otro programa lo cambió después de contabilizarlo. */
  cambio_en_origen?: number | null
  /** Qué campos distintos trae el ERP respecto a lo contabilizado; vacío si no se sabe. */
  cambio_en_origen_detalle?: { campo: string; antes?: unknown; ahora?: unknown }[] | null
  /** Apunte del diario con el que parece coincidir (0 si ninguno). */
  diario_ejercicio?: number | null
  diario_asiento?: number | null
  diario_pase?: number | null
  /** 1 = coincide por importe o número de factura; 2 = solo por concepto (el importe no cuadra). */
  diario_criterio?: number | null
  /** Cobros con pagaré, cheque o confirming ([5.47] del canal): cada paso es un documento aparte. */
  fase_pagare?: 'cartera' | 'negociado' | 'devuelto' | '' | null
  medio_pago?: string | null
  medio_pago_tipo?: string | null
  fecha_vencimiento?: string | null
  fecha_negociado?: string | null
  /** Grupo de cobros o pagos que en el diario son un solo apunte ([5.52] del canal); 0 = ninguno. */
  id_grupo?: number | null
  grupo_total?: number | null
  grupo_documentos?: number | null
  /** 1 = bloqueado: no se contabiliza hasta desbloquearlo ([5.42] del canal). */
  bloqueado?: number | null
  /** 1 = un contable lo ha marcado como revisado ([5.44] del canal); no cambia el estado. */
  revisado?: number | null
  revisado_por?: string | null
  revisado_fecha?: string | null
  /** Nota libre de un contable ([5.46] del canal); no cambia el estado. */
  anotacion?: string | null
  anotacion_por?: string | null
  anotacion_fecha?: string | null
  motivo_bloqueo?: string | null
  id_borrador?: number | null
  ejercicio_asiento?: number | null
  asiento?: number | null
  fecha_alta?: string | null
  fecha_modificacion?: string | null
}

export interface TramoIva {
  tipo_iva: number
  base: number
  cuota: number
  tipo_re: number
  cuota_re: number
  cuota_deducible: number
  cuenta_iva?: string | null
  cuenta_re?: string | null
  cuenta_iva_autorepercutido?: string | null
}

export interface CuentaDeFactura {
  /** ventas, gasto o suplido. */
  clase: string
  cuenta?: string | null
  importe: number
  descripcion?: string | null
}

export interface FacturaBandeja extends Comun {
  libro: 'emitida' | 'recibida'
  nif_emisor: string
  numero_factura: string
  fecha_expedicion?: string | null
  fecha_contable?: string | null
  ejercicio: number
  periodo: string
  nif_tercero?: string | null
  nombre_tercero?: string | null
  cuenta_tercero?: string | null
  tipo_factura?: string | null
  tipo_rectificativa?: string | null
  numero_rectificada?: string | null
  clase_operacion: string
  importe_total: number
  retencion: number
  cuenta_retencion?: string | null
  /** Solo en `obtener`. */
  iva?: TramoIva[] | null
  /** Solo en `obtener`. */
  cuentas?: CuentaDeFactura[] | null
}

export interface MovimientoBandeja extends Comun {
  clase: 'cobro' | 'pago'
  fecha?: string | null
  /** Negativo si es una devolución. */
  importe: number
  concepto?: string | null
  cuenta_tesoreria?: string | null
  cuenta_tercero?: string | null
  nif_tercero?: string | null
  nombre_tercero?: string | null
  id_origen_factura?: string | null
  nif_emisor_factura?: string | null
  numero_factura?: string | null
  fecha_factura?: string | null
}

export type DocumentoBandeja = FacturaBandeja | MovimientoBandeja

export interface FiltroBandeja {
  tipo: TipoDocumento
  estado: string
  /** Facturas: emitida o recibida. Movimientos: cobro o pago. Vacío, todos. */
  libro: string
  ejercicio: number
  /** Mes, de 01 a 12. Vacío es el ejercicio entero. */
  periodo: string
  buscar: string
  /** Vacío, todos; '1', solo los bloqueados. */
  bloqueado?: string
  /** Vacío, todos; o `cartera`, `negociado`, `devuelto` (cobros con pagaré, cheque o confirming). */
  fasePagare?: string
  /** Vacío, todos; '1', solo los revisados; '0', solo los sin revisar. */
  revisado?: string
  /** Vacío, todos; '1', solo los que tienen anotación; '0', solo los que no. */
  conAnotacion?: string
  /** Principio de la cuenta del tercero o del banco o caja ([5.51] del canal); vacío = todas. */
  cuenta?: string
  /** Importe de la línea, en valor absoluto; vacío = sin límite. Con coma o punto. */
  importeDesde?: string
  importeHasta?: string
  pagina: number
  porPagina: number
}

export interface ListaBandeja {
  total: number
  pagina: number
  por_pagina: number
  /** Cuántos hay de cada estado con el resto del filtro puesto. */
  por_estado: Record<string, number>
  /** Cuántos bloqueados hay con el resto del filtro puesto. */
  bloqueados: number
  /** Cuántos revisados hay con el resto del filtro puesto. */
  revisados: number
  /** Cuántos tienen anotación con el resto del filtro puesto. */
  con_anotacion: number
  documentos: DocumentoBandeja[]
}

interface RespuestaListar {
  total: number
  pagina: number
  por_pagina: number
  por_estado?: Record<string, number>
  bloqueados?: number
  revisados?: number
  con_anotacion?: number
  facturas?: FacturaBandeja[]
  movimientos?: MovimientoBandeja[]
}

export interface ResultadoContabilizar {
  /** Pasados a borrador. */
  contabilizados: number
  /** No se han podido; el motivo queda en el documento y en `motivos`. */
  apartados: number
  /** Resultaron estar ya en la facturación: cuenta la de allí. */
  duplicados: number
  asientos: { ref_tipo: string; ref_id: number; id_borrador: number; ejercicio: number; asiento: number }[]
  motivos: Record<string, number>
  avisos: string[]
  /** Códigos de las cuentas que no existían en el plan y se han creado. */
  cuentas_creadas: string[]
}

export interface ResultadoDeshacer {
  deshechos: number
  no_se_pueden: { id: number; motivo: string }[]
}

/** Lo que el otro programa dice del documento que no se puede traer, para
 * encontrarlo allí ([5.25] del canal). Todo opcional: lo que no venga no sale. */
export interface DatosIncidencia {
  libro?: string | null
  fecha?: string | null
  numero?: string | null
  tercero?: string | null
  nif?: string | null
  base?: string | number | null
  cuota?: string | number | null
  total?: string | number | null
  factura?: string | null
  forma_pago?: string | null
}

export interface Incidencia {
  tipo: string
  id_origen: string
  faltas: string[]
  datos?: DatosIncidencia | null
}

export interface Lectura {
  id: number
  origen: string
  desde?: string | null
  hasta?: string | null
  /** Número de la exportación en el otro programa. Vacío si no la marcó. */
  referencia_origen?: string | null
  /** guardada o deshecha. */
  estado: string
  leidas: number
  nuevas: number
  actualizadas: number
  sin_cambios: number
  duplicadas: number
  en_conflicto: number
  cambiadas_contabilizadas: number
  incidencias: Incidencia[]
  usuario?: string | null
  fecha_alta?: string | null
}

export interface DocumentoLeido {
  /** facturas o movimientos. */
  tipo: string
  id_origen: string
  id: number
  /** nueva, actualizada, sin_cambios o cambiada_en_origen. */
  accion: string
  estado: string
  motivo?: string | null
}

export interface ResultadoLeerErp {
  /** 0 en ensayo. */
  id_lectura: number
  ensayo: boolean
  leidas: number
  nuevas: number
  actualizadas: number
  sin_cambios: number
  duplicadas: number
  en_conflicto: number
  cambiadas_contabilizadas: number
  incidencias: Incidencia[]
  documentos: DocumentoLeido[]
  avisos: string[]
  /** Si la conexión permite marcar lo leído en Codiplika. */
  marca_autorizada: boolean
  marcados: number
  referencia_origen: string
}

export interface ResultadoDeshacerLectura {
  id_lectura: number
  quitados: number
  se_quedan: number
}

export interface ResultadoDeshacerExportacion {
  id_lectura: number
  exportacion: string
  ensayo: boolean
  se_deshacen: number
  se_quedan: number
  /** 0 en ensayo. */
  devueltos_en_origen: number
  documentos_que_se_quedan: { tipo: string; id: number; id_origen: string; estado: string; motivo: string }[]
}

/**
 * Una página de la bandeja. La respuesta trae los documentos en `facturas` o
 * en `movimientos` según lo pedido; aquí se juntan en una sola lista.
 */
export async function listarBandeja(filtro: FiltroBandeja, senal?: AbortSignal): Promise<ListaBandeja> {
  const respuesta = await pedir<RespuestaListar>(
    '/contabilidad/bandeja/listar',
    {
      tipo: filtro.tipo,
      ejercicio: filtro.ejercicio,
      ...(filtro.estado === '' ? {} : { estado: filtro.estado }),
      ...(filtro.libro === '' ? {} : { libro: filtro.libro }),
      ...(filtro.periodo === '' ? {} : { periodo: filtro.periodo }),
      ...(filtro.buscar.trim() === '' ? {} : { buscar: filtro.buscar.trim() }),
      ...(filtro.bloqueado ? { bloqueado: Number(filtro.bloqueado) } : {}),
      ...(filtro.fasePagare ? { fase_pagare: filtro.fasePagare } : {}),
      ...(filtro.cuenta?.trim() ? { cuenta: filtro.cuenta.trim() } : {}),
      ...(filtro.revisado ? { revisado: Number(filtro.revisado) } : {}),
      ...(filtro.conAnotacion ? { con_anotacion: Number(filtro.conAnotacion) } : {}),
      ...(filtro.importeDesde ? { importe_desde: filtro.importeDesde.replace(',', '.') } : {}),
      ...(filtro.importeHasta ? { importe_hasta: filtro.importeHasta.replace(',', '.') } : {}),
      pagina: filtro.pagina,
      por_pagina: filtro.porPagina,
    },
    senal,
  )
  return {
    total: respuesta.total,
    pagina: respuesta.pagina,
    por_pagina: respuesta.por_pagina,
    por_estado: respuesta.por_estado ?? {},
    bloqueados: respuesta.bloqueados ?? 0,
    revisados: respuesta.revisados ?? 0,
    con_anotacion: respuesta.con_anotacion ?? 0,
    documentos:
      filtro.tipo === FACTURAS ? (respuesta.facturas ?? []) : (respuesta.movimientos ?? []),
  }
}

/** Un documento con su desglose de IVA y sus cuentas, si es factura. */
export async function obtenerDocumento(tipo: TipoDocumento, id: number): Promise<DocumentoBandeja> {
  const respuesta = await pedir<{ factura?: FacturaBandeja | null; movimiento?: MovimientoBandeja | null }>(
    '/contabilidad/bandeja/obtener',
    { tipo, id },
  )
  const documento = tipo === FACTURAS ? respuesta.factura : respuesta.movimiento
  if (!documento) throw new Error('No se ha encontrado el documento.')
  return documento
}

export function resolverDocumento(
  tipo: TipoDocumento,
  id: number,
  decision: Decision,
): Promise<{ id: number; estado: string; motivo?: string | null }> {
  return pedir('/contabilidad/bandeja/resolver', { tipo, id, decision })
}

/**
 * Pasa a borrador los pendientes: los elegidos, o todos los del ejercicio y
 * el mes si no se eligen. Cada uno por su cuenta.
 */
export function contabilizarBandeja(
  tipo: TipoDocumento,
  cuales: { ids: number[] } | { ejercicio: number; periodo: string },
): Promise<ResultadoContabilizar> {
  const cuerpo =
    'ids' in cuales
      ? { tipo, ids: cuales.ids }
      : { tipo, ejercicio: cuales.ejercicio, ...(cuales.periodo === '' ? {} : { periodo: cuales.periodo }) }
  return pedir<ResultadoContabilizar>('/contabilidad/bandeja/contabilizar', cuerpo)
}

/** Bloquea o desbloquea documentos: un bloqueado no se contabiliza, ni uno a uno ni en bloque. */
export function bloquearDocumentos(
  tipo: TipoDocumento,
  ids: number[],
  bloquear: boolean,
  motivo?: string,
): Promise<{ cambiados: number; no_se_pueden: { id: number; motivo: string }[] }> {
  return pedir('/contabilidad/bandeja/bloquear', { tipo, ids, bloquear, ...(motivo ? { motivo } : {}) })
}

/** Marca o desmarca como revisados: solo informa, no cambia el estado ni impide contabilizar. */
export function revisarDocumentos(
  tipo: TipoDocumento,
  ids: number[],
  revisado: boolean,
): Promise<{ cambiados: number; no_se_pueden: { id: number; motivo: string }[] }> {
  return pedir('/contabilidad/bandeja/revisar', { tipo, ids, revisado })
}

/** Escribe (o, con texto vacío, borra) la anotación de un documento. */
export function anotarDocumento(
  tipo: TipoDocumento,
  id: number,
  texto: string,
): Promise<{ anotacion: string; anotacion_por: string; anotacion_fecha: string | null }> {
  return pedir('/contabilidad/bandeja/anotar', { tipo, id, texto })
}

/** Devuelve a pendiente lo que siga en borrador. Lo confirmado no se toca. */
export function deshacerContabilizacion(tipo: TipoDocumento, ids: number[]): Promise<ResultadoDeshacer> {
  return pedir<ResultadoDeshacer>('/contabilidad/bandeja/deshacer', { tipo, ids })
}

export async function listarLecturas(): Promise<Lectura[]> {
  const respuesta = await pedir<{ lecturas?: Lectura[] }>('/contabilidad/bandeja/lecturas/listar', {})
  return respuesta.lecturas ?? []
}

/** Quita de la bandeja lo que trajo una lectura y no tiene asiento. */
export function deshacerLectura(idLectura: number): Promise<ResultadoDeshacerLectura> {
  return pedir<ResultadoDeshacerLectura>('/contabilidad/bandeja/lecturas/deshacer', {
    id_lectura: idLectura,
  })
}

/**
 * Como deshacer la lectura, y además lo devuelve a pendiente en Codiplika.
 * Con `ensayo` solo dice qué pasaría.
 */
export function deshacerExportacion(
  idLectura: number,
  ensayo: boolean,
): Promise<ResultadoDeshacerExportacion> {
  return pedir<ResultadoDeshacerExportacion>('/contabilidad/bandeja/deshacer_exportacion', {
    id_lectura: idLectura,
    ensayo,
  })
}

/**
 * Trae de Codiplika lo pendiente entre dos fechas (`aaaa-mm-dd`). Con `ensayo`
 * solo dice qué traería; sin él lo guarda y, si la conexión lo permite, lo
 * marca allí para que no vuelva a salir.
 */
/** `marcar`: si se marca en Codiplika lo que se trae, decidido al traer ([5.24]
 * del canal). Sin él, manda la opción de la conexión. */
export function leerCodiplika(
  desde: string,
  hasta: string,
  ensayo: boolean,
  marcar?: boolean,
): Promise<ResultadoLeerErp> {
  return pedir<ResultadoLeerErp>('/contabilidad/bandeja/leer_erp', {
    origen: 'codiplika',
    desde,
    hasta,
    ensayo,
    ...(marcar === undefined ? {} : { marcar }),
  })
}

export interface CambioRecomprobar {
  tipo: TipoDocumento
  id: number
  estado_antes: string
  estado_despues: string
  motivo?: string | null
}

export interface ResultadoRecomprobar {
  ensayo: boolean
  revisados: number
  pasan_a_posible_duplicado: number
  siguen_posibles_duplicados: number
  vuelven_a_pendiente: number
  siguen_pendientes: number
  cambios: CambioRecomprobar[]
}

/**
 * Repasa lo pendiente contra el diario, sin volver a leer Codiplika ([5.40] del
 * canal). Con `ensayo` solo cuenta; sin él, aplica. Repetirlo no cambia nada.
 */
export function recomprobarBandeja(ensayo: boolean, desde?: string, hasta?: string): Promise<ResultadoRecomprobar> {
  return pedir<ResultadoRecomprobar>('/contabilidad/bandeja/recomprobar', {
    ensayo,
    ...(desde ? { desde } : {}),
    ...(hasta ? { hasta } : {}),
  })
}

/** Cuántos días antes y después de la fecha de un cobro o pago se busca su apunte en el diario ([5.50] del canal). */
export interface MargenDiario {
  margen_dias_antes: number
  margen_dias_despues: number
}

export function obtenerMargenDiario(): Promise<MargenDiario> {
  return pedir<MargenDiario>('/contabilidad/bandeja/margen_diario/obtener', {})
}

/** Se guarda en la empresa. No recalcula nada: lo ya apartado cambia al volver a comprobar. */
export function guardarMargenDiario(margen: MargenDiario): Promise<MargenDiario> {
  return pedir<MargenDiario>('/contabilidad/bandeja/margen_diario/guardar', { ...margen })
}

/** Un apunte del diario que podría ser el de una remesa ([5.52] del canal). `donde`: en el banco o en la cuenta del tercero. */
export interface ApuntePosible {
  ejercicio: number
  asiento: number
  pase: number
  fecha: string
  cuenta: string
  concepto: string
  documento: string
  importe: number
  lado: string
  donde?: 'tesoreria' | 'tercero'
  /** 0 = borrador. */
  contabilizado?: number
  motivo?: string
}

export interface ResultadoBuscarGrupo {
  clase: string
  suma: number
  documentos: number
  desde: string
  hasta: string
  apuntes: ApuntePosible[]
  excluidos: ApuntePosible[]
  avisos: string[]
}

export interface Grupo {
  id_grupo: number
  clase: string
  total: number
  documentos: number
  apunte: ApuntePosible
  usuario: string
  fecha_alta: string
  lista: {
    id: number
    id_origen: string
    fecha: string
    importe: number
    concepto: string
    nombre_tercero: string
    cuenta_tercero: string
    cuenta_tesoreria: string
    numero_factura: string
  }[]
}

export function buscarAgrupacion(ids: number[], desde?: string, hasta?: string): Promise<ResultadoBuscarGrupo> {
  return pedir<ResultadoBuscarGrupo>('/contabilidad/bandeja/agrupar/buscar', {
    ids,
    ...(desde ? { desde } : {}),
    ...(hasta ? { hasta } : {}),
  })
}

export function confirmarAgrupacion(ids: number[], apunte: Pick<ApuntePosible, 'ejercicio' | 'asiento' | 'pase'>): Promise<Grupo> {
  return pedir<Grupo>('/contabilidad/bandeja/agrupar/confirmar', {
    ids,
    ejercicio: apunte.ejercicio,
    asiento: apunte.asiento,
    pase: apunte.pase,
  })
}

export function obtenerGrupo(idGrupo: number): Promise<Grupo> {
  return pedir<Grupo>('/contabilidad/bandeja/grupo/obtener', { id_grupo: idGrupo })
}

export function deshacerGrupo(idGrupo: number): Promise<{ id_grupo: number; deshechos: number; ids: number[] }> {
  return pedir('/contabilidad/bandeja/agrupar/deshacer', { id_grupo: idGrupo })
}
