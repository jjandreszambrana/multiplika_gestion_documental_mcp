import type { Nivel } from '../api/sesion'

export interface Seccion {
  id: string
  etiqueta: string
  /** Nivel mínimo para verla. Se esconde, no se deshabilita. */
  nivelMinimo: Nivel
  /** Cuelga de este apartado del menú. Sin esto, va suelta. */
  grupo?: string
  /** Solo para estos roles del SIF, sea cual sea su nivel. */
  soloRoles?: readonly number[]
}

/**
 * Por dónde se entra al módulo. El diario es lo que se abre cada mañana, no lo
 * primero del menú: si se dejara al orden, cambiar el menú cambiaría por dónde
 * entra todo el mundo.
 */
export const SECCION_DE_ENTRADA = 'asientos'

export const SECCIONES: Seccion[] = [
  { id: 'plan', etiqueta: 'Gestión plan contable', nivelMinimo: 'consulta', grupo: 'Plan contable' },
  {
    id: 'enlace',
    etiqueta: 'Enlace con facturación',
    nivelMinimo: 'consulta',
    grupo: 'Plan contable',
  },
  { id: 'asientos', etiqueta: 'Entrada asientos', nivelMinimo: 'consulta', grupo: 'Diario' },
  { id: 'eliminados', etiqueta: 'Asientos eliminados', nivelMinimo: 'consulta', grupo: 'Diario' },
  {
    id: 'plantillas',
    etiqueta: 'Asientos predefinidos',
    nivelMinimo: 'consulta',
    grupo: 'Diario',
  },
  // Solo en los SIF que lo tienen (hoy, Icomase): en el resto se esconde.
  {
    id: 'diario_b',
    etiqueta: 'Diario B y equivalencias',
    nivelMinimo: 'consulta',
    grupo: 'Diario',
  },
  {
    id: 'traspaso_emitidas',
    etiqueta: 'Facturas emitidas',
    nivelMinimo: 'consulta',
    grupo: 'Traspasos',
  },
  {
    id: 'traspaso_recibidas',
    etiqueta: 'Facturas recibidas',
    nivelMinimo: 'consulta',
    grupo: 'Traspasos',
  },
  // Lo que llega de Codiplika: se revisa y se contabiliza en borrador.
  {
    id: 'bandeja',
    etiqueta: 'Bandeja de Codiplika',
    nivelMinimo: 'consulta',
    grupo: 'Traspasos',
  },
  // Un grupo desde el principio: detrás del mayor vienen sumas y saldos,
  // balance y pérdidas y ganancias, y no se van a colgar sueltos del menú.
  { id: 'mayor', etiqueta: 'Mayor', nivelMinimo: 'consulta', grupo: 'Informes' },
  {
    id: 'balance',
    etiqueta: 'Sumas y saldos',
    nivelMinimo: 'consulta',
    grupo: 'Informes',
  },
  // El balance y pérdidas y ganancias estuvieron sueltos hasta el 01/09/2026:
  // se juntaron en una pantalla de dos pestañas porque el Excel es el mismo.
  {
    id: 'estados_contables',
    etiqueta: 'Estados contables',
    nivelMinimo: 'consulta',
    grupo: 'Informes',
  },
  {
    id: 'fiscal',
    etiqueta: 'IVA y retenciones',
    nivelMinimo: 'consulta',
    grupo: 'Fiscal',
  },
  // Aparte de IVA y retenciones: son documentos guardados, no consultas vivas.
  {
    id: 'declaraciones',
    etiqueta: 'Declaraciones registradas',
    nivelMinimo: 'consulta',
    grupo: 'Fiscal',
  },
  { id: 'inmovilizado', etiqueta: 'Inmovilizado', nivelMinimo: 'consulta', grupo: 'Inmovilizado' },
  {
    id: 'sin_ficha',
    etiqueta: 'Bienes sin ficha',
    nivelMinimo: 'consulta',
    grupo: 'Inmovilizado',
  },
  { id: 'cierre', etiqueta: 'Cierre de ejercicio', nivelMinimo: 'cierre' },
  { id: 'importador', etiqueta: 'Importar datos', nivelMinimo: 'apuntes', grupo: 'Utilidades' },
  { id: 'ejercicios', etiqueta: 'Ejercicios', nivelMinimo: 'cierre', grupo: 'Utilidades' },
  { id: 'configuracion', etiqueta: 'Configuración', nivelMinimo: 'cierre', grupo: 'Utilidades' },
  {
    id: 'conexiones',
    etiqueta: 'Conexión con Codiplika',
    nivelMinimo: 'consulta',
    grupo: 'Utilidades',
    // Superadministrador, administrador y el usuario de la propia empresa: los
    // representantes y los operarios reciben 403 del SIF.
    soloRoles: [1, 2, 4],
  },
  { id: 'accesos', etiqueta: 'Accesos', nivelMinimo: 'admin' },
]
