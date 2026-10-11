import type {
  AsientoPlantilla,
  Definicion,
  ErrorCampo,
  Linea,
  Opciones,
  Parametro,
  TipoParametro,
} from '../../../api/plantillas'

/** Cómo llama el contable a cada tipo de dato. */
export const NOMBRE_DE_TIPO: Record<TipoParametro, string> = {
  texto: 'Texto',
  numero: 'Número',
  importe: 'Importe',
  porcentaje: 'Porcentaje',
  fecha: 'Fecha',
  booleano: 'Sí o no',
  seleccion: 'Lista de opciones',
  cuenta: 'Subcuenta',
  tercero: 'Cliente o proveedor',
  tabla: 'Tabla de filas',
}

export const NOMBRE_DE_ORIGEN: Record<string, string> = {
  obras: 'Obras',
  diarios: 'Diarios',
  tipos_iva: 'Tipos de IVA',
}

export function definicionVacia(): Definicion {
  return {
    diario: '',
    parametros: [],
    variables: [],
    asientos: [{ fecha: '', concepto: '', lineas: [lineaVacia(), lineaVacia()] }],
    opciones: { autocuadre: null, reversion: null, estado_inicial: 'borrador' },
  }
}

export function lineaVacia(): Linea {
  return { cuenta: '', debe: '', haber: '' }
}

export function parametroVacio(): Parametro {
  return { clave: '', tipo: 'texto', etiqueta: '' }
}

/** Sube (-1) o baja (+1) un elemento de una lista. Fuera de los bordes, igual. */
export function mover<T>(lista: T[], indice: number, paso: -1 | 1): T[] {
  const destino = indice + paso
  if (destino < 0 || destino >= lista.length) return lista
  const copia = [...lista]
  const [elemento] = copia.splice(indice, 1)
  copia.splice(destino, 0, elemento as T)
  return copia
}

/** Una fórmula o un texto vacío no se manda: el servidor pone su valor por defecto. */
function lleno(valor: string | null | undefined): valor is string {
  return typeof valor === 'string' && valor.trim() !== ''
}

function sinVacios<T extends object>(objeto: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(objeto).filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false),
  ) as Partial<T>
}

function limpiarParametro(p: Parametro, enTabla: boolean): Parametro {
  const base: Parametro = {
    clave: p.clave.trim(),
    tipo: p.tipo,
    ...sinVacios({
      etiqueta: p.etiqueta,
      ayuda: p.ayuda,
      obligatorio: p.obligatorio,
      mensaje_validacion: p.mensaje_validacion,
    }),
  }
  if (lleno(p.defecto)) base.defecto = p.defecto
  if (lleno(p.validacion)) base.validacion = p.validacion
  if (!enTabla && lleno(p.visible_si)) base.visible_si = p.visible_si
  if (p.tipo === 'cuenta' && lleno(p.filtro)) base.filtro = p.filtro.trim()
  if (p.tipo === 'texto' && p.longitud_maxima) base.longitud_maxima = p.longitud_maxima
  if (p.tipo === 'numero' && p.decimales !== null && p.decimales !== undefined)
    base.decimales = p.decimales
  if (p.tipo === 'seleccion') {
    // Con origen, la lista la pone el servidor: las opciones que trae
    // `obtener` no se mandan, o se quedaría congelada.
    if (lleno(p.origen)) base.origen = p.origen
    else base.opciones = (p.opciones ?? []).map((o) => ({ valor: o.valor, etiqueta: o.etiqueta }))
  }
  if (p.tipo === 'tabla') {
    base.columnas = (p.columnas ?? []).map((c) => limpiarParametro(c, true))
    if (p.filas_minimas) base.filas_minimas = p.filas_minimas
    if (p.filas_maximas) base.filas_maximas = p.filas_maximas
  }
  return base
}

function limpiarLinea(l: Linea): Linea {
  const linea: Linea = { cuenta: l.cuenta }
  for (const campo of [
    'debe',
    'haber',
    'concepto',
    'documento',
    'id_obra',
    'id_tipo_iva',
    'si',
    'repetir_por',
  ] as const) {
    const valor = l[campo]
    if (lleno(valor)) linea[campo] = valor
  }
  return linea
}

function limpiarAsiento(a: AsientoPlantilla): AsientoPlantilla {
  return {
    fecha: a.fecha,
    ...(lleno(a.concepto) ? { concepto: a.concepto } : {}),
    ...(lleno(a.diario) ? { diario: a.diario } : {}),
    lineas: a.lineas.map(limpiarLinea),
  }
}

function limpiarOpciones(o: Opciones | undefined): Opciones {
  const salida: Opciones = { estado_inicial: o?.estado_inicial ?? 'borrador' }
  if (o?.autocuadre) {
    salida.autocuadre = {
      cuenta: o.autocuadre.cuenta,
      ...(lleno(o.autocuadre.concepto) ? { concepto: o.autocuadre.concepto } : {}),
    }
  }
  if (o?.reversion) {
    salida.reversion = {
      fecha: o.reversion.fecha,
      ...(lleno(o.reversion.concepto) ? { concepto: o.reversion.concepto } : {}),
    }
  }
  return salida
}

/**
 * La definición tal y como se manda: sin lo vacío, y sin lo que no pinta en
 * cada tipo de dato (el servidor rechaza cualquier campo que sobre). Lo que
 * sí tiene que estar —una cuenta, una fecha— se manda aunque esté vacío, para
 * que el servidor diga dónde falta.
 */
export function definicionParaEnviar(d: Definicion): Definicion {
  return {
    diario: (d.diario ?? '').trim(),
    parametros: d.parametros.map((p) => limpiarParametro(p, false)),
    variables: (d.variables ?? []).map((v) => ({ clave: v.clave.trim(), expr: v.expr })),
    asientos: d.asientos.map(limpiarAsiento),
    opciones: limpiarOpciones(d.opciones),
  }
}

/** Los errores por ruta, para que cada casilla busque los suyos. */
export function erroresPorRuta(errores: ErrorCampo[]): Map<string, string[]> {
  const mapa = new Map<string, string[]>()
  for (const e of errores) mapa.set(e.ruta, [...(mapa.get(e.ruta) ?? []), e.mensaje])
  return mapa
}

const NOMBRE_DE_CAMPO: Record<string, string> = {
  clave: 'Clave',
  tipo: 'Tipo',
  etiqueta: 'Rótulo',
  ayuda: 'Ayuda',
  obligatorio: 'Obligatorio',
  defecto: 'Valor por defecto',
  visible_si: 'Cuándo se ve',
  validacion: 'Comprobación',
  mensaje_validacion: 'Mensaje si no se cumple',
  filtro: 'Empieza por',
  opciones: 'Opciones',
  origen: 'Lista de',
  columnas: 'Columnas',
  filas_minimas: 'Filas mínimas',
  filas_maximas: 'Filas máximas',
  longitud_maxima: 'Largo máximo',
  decimales: 'Decimales',
  expr: 'Fórmula',
  fecha: 'Fecha',
  concepto: 'Concepto',
  diario: 'Diario',
  lineas: 'Líneas',
  cuenta: 'Cuenta',
  debe: 'Debe',
  haber: 'Haber',
  documento: 'Documento',
  id_obra: 'Obra',
  id_tipo_iva: 'Tipo de IVA',
  si: 'Solo si',
  repetir_por: 'Una por cada fila de',
  estado_inicial: 'Cómo se graba',
}

/**
 * Dónde está un error, dicho para el contable: «Dato «valor» › Valor por
 * defecto», «Asiento 1 › Línea 2 › Debe». Para la lista de arriba del editor.
 */
export function dondeEsta(ruta: string, d: Definicion): string {
  if (ruta === 'general') return 'La plantilla'
  const partes: string[] = []
  const trozos = ruta.match(/[a-z_]+(?:\[\d+\])?/g) ?? []
  let parametros: Parametro[] | undefined = d.parametros
  for (const trozo of trozos) {
    const m = /^([a-z_]+)(?:\[(\d+)\])?$/.exec(trozo)
    if (!m?.[1]) continue
    const nombre = m[1]
    const i = m[2] === undefined ? null : Number(m[2])
    if ((nombre === 'parametros' || nombre === 'columnas') && i !== null) {
      const p: Parametro | undefined = parametros?.[i]
      const quien = nombre === 'parametros' ? 'Dato' : 'Columna'
      partes.push(p?.clave ? `${quien} «${p.clave}»` : `${quien} ${i + 1}`)
      parametros = p?.columnas ?? undefined
    } else if (nombre === 'variables' && i !== null) {
      const v = d.variables?.[i]
      partes.push(v?.clave ? `Cálculo «${v.clave}»` : `Cálculo ${i + 1}`)
    } else if (nombre === 'asientos' && i !== null) {
      partes.push(`Asiento ${i + 1}`)
    } else if (nombre === 'lineas' && i !== null) {
      partes.push(`Línea ${i + 1}`)
    } else if (nombre === 'opciones') {
      continue
    } else if (nombre === 'autocuadre') {
      partes.push('Línea de cuadre')
    } else if (nombre === 'reversion') {
      partes.push('Asiento que deshace al principal')
    } else {
      partes.push(NOMBRE_DE_CAMPO[nombre] ?? nombre)
    }
  }
  return partes.join(' › ')
}
