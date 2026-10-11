import { enviarFormulario, pedir } from './cliente'
import type { components } from './types'

/** Las tres cosas que se pueden traer de un archivo. */
export type Destino = 'plan' | 'diario' | 'inmovilizado'

export type CampoImportable = components['schemas']['CampoImportable']
export type RespuestaSubir = components['schemas']['RespuestaSubir']
export type RespuestaEjecutar = components['schemas']['apps__apisif__v1__metodos__contabilidad___api_conta_importador__RespuestaEjecutar']
export type Incidencia = components['schemas']['Incidencia']
export type AsientoImportado = components['schemas']['AsientoImportado']

/** Campo del sistema → columna del archivo. Vacío = sin asignar. */
export type Mapeo = Record<string, string>

/** Cómo se lee el archivo. La API acepta más claves; estas son las de la pantalla. */
export interface Opciones {
  separador: string
  codificacion: string
  /** `omitir`, `actualizar` o `error`. */
  si_existe: string
  /** La primera fila ya es un dato: las columnas pasan a llamarse por su número. */
  sin_cabecera: boolean
  /** Filas del principio que se tiran antes de leer nada. La cabecera se busca después. */
  filas_a_saltar: number
}

export const OPCIONES_POR_DEFECTO: Opciones = {
  separador: '',
  codificacion: 'utf-8',
  si_existe: 'omitir',
  sin_cabecera: false,
  filas_a_saltar: 0,
}

/**
 * `mapeo` y `opciones` llegan como objetos libres, así que se pasan a texto en
 * un único punto en vez de repartir comprobaciones por los componentes.
 */
function aTextos(suelto: Record<string, unknown> | undefined): Record<string, string> {
  const limpio: Record<string, string> = {}
  for (const [clave, valor] of Object.entries(suelto ?? {})) {
    if (typeof valor === 'string') limpio[clave] = valor
    else if (typeof valor === 'number' || typeof valor === 'boolean') limpio[clave] = String(valor)
  }
  return limpio
}

/** Qué campos admite un destino, sin subir nada. Nivel `consulta`. */
export async function camposDe(destino: Destino): Promise<Record<string, CampoImportable>> {
  const respuesta = await pedir<components['schemas']['RespuestaCampos']>(
    '/contabilidad/importador/campos',
    { destino },
  )
  return respuesta.campos ?? {}
}

/**
 * Sube el archivo y lo lee con el modelo elegido. No escribe nada en la
 * contabilidad: el mapeo y las opciones salen del modelo, no de la pantalla.
 */
export function subirArchivo(
  archivo: File,
  destino: Destino,
  idPlantilla: number,
): Promise<RespuestaSubir> {
  const datos = new FormData()
  datos.append('archivo', archivo)
  datos.append('destino', destino)
  datos.append('id_plantilla', String(idPlantilla))
  return enviarFormulario<RespuestaSubir>('/contabilidad/importador/subir', datos)
}

/**
 * Lo vacío no se manda: significa «detéctalo tú», no «ponlo en blanco». Las dos
 * opciones de lectura del archivo sí van siempre, porque su valor por defecto
 * es una decisión, no una ausencia.
 */
function sinVacios(opciones: Opciones): Record<string, string | boolean | number> {
  const { separador, codificacion, si_existe, sin_cabecera, filas_a_saltar } = opciones
  return {
    ...(separador === '' ? {} : { separador }),
    ...(codificacion === '' ? {} : { codificacion }),
    si_existe,
    sin_cabecera,
    filas_a_saltar,
  }
}

export interface Ejecucion {
  idImportacion: number
  /** Solo para el diario: fuerza el ejercicio. Nulo = el de la fecha de cada asiento. */
  ejercicio: number | null
}

function cuerpoDe(ejecucion: Ejecucion): object {
  return {
    id_importacion: ejecucion.idImportacion,
    ...(ejecucion.ejercicio === null ? {} : { ejercicio: ejecucion.ejercicio }),
  }
}

/** Recorre el archivo entero sin escribir nada y devuelve el informe. */
export function ensayar(ejecucion: Ejecucion): Promise<RespuestaEjecutar> {
  return pedir<RespuestaEjecutar>('/contabilidad/importador/ensayar', cuerpoDe(ejecucion))
}

/** Escribe de verdad. Una importación solo se hace una vez. */
export function importar(ejecucion: Ejecucion): Promise<RespuestaEjecutar> {
  return pedir<RespuestaEjecutar>('/contabilidad/importador/importar', cuerpoDe(ejecucion))
}

/** Las incidencias que empiezan por «Aviso:» no impiden la entrada del registro. */
export function esAviso(incidencia: Incidencia): boolean {
  return incidencia.aviso === true || incidencia.motivo.startsWith('Aviso:')
}

export type Modelo = components['schemas']['Plantilla']

/** El mapeo del modelo, tal y como se guardó: número de columna o nombre. */
export function mapeoDelModelo(modelo: Modelo): Mapeo {
  return aTextos(modelo.mapeo)
}

export function opcionesDelModelo(modelo: Modelo): Opciones {
  const leidas = aTextos(modelo.opciones)
  return {
    separador: leidas.separador ?? '',
    codificacion: leidas.codificacion ?? OPCIONES_POR_DEFECTO.codificacion,
    si_existe: leidas.si_existe ?? OPCIONES_POR_DEFECTO.si_existe,
    sin_cabecera: leidas.sin_cabecera === 'true',
    filas_a_saltar: Number(leidas.filas_a_saltar ?? 0) || 0,
  }
}

export async function listarModelos(destino: Destino | null = null): Promise<Modelo[]> {
  const respuesta = await pedir<components['schemas']['RespuestaListarPlantillas']>(
    '/contabilidad/importador/plantilla/listar',
    destino === null ? {} : { destino },
  )
  return respuesta.plantillas ?? []
}

/** Lo vacío no se guarda: un dato que el archivo no trae se queda sin columna. */
function mapeoLimpio(mapeo: Mapeo): Mapeo {
  return Object.fromEntries(Object.entries(mapeo).filter(([, valor]) => valor.trim() !== ''))
}

export function crearModelo(
  nombre: string,
  destino: Destino,
  mapeo: Mapeo,
  opciones: Opciones,
): Promise<Modelo> {
  return pedir<Modelo>('/contabilidad/importador/plantilla/crear', {
    nombre,
    destino,
    mapeo: mapeoLimpio(mapeo),
    opciones: sinVacios(opciones),
  })
}

/** El destino no se puede cambiar: la API no lo admite al editar. */
export function editarModelo(
  idPlantilla: number,
  nombre: string,
  mapeo: Mapeo,
  opciones: Opciones,
): Promise<Modelo> {
  return pedir<Modelo>('/contabilidad/importador/plantilla/editar', {
    id_plantilla: idPlantilla,
    nombre,
    mapeo: mapeoLimpio(mapeo),
    opciones: sinVacios(opciones),
  })
}

export async function eliminarModelo(idPlantilla: number): Promise<void> {
  await pedir('/contabilidad/importador/plantilla/eliminar', { id_plantilla: idPlantilla })
}
