import type { AsientoCalculado, ErrorCampo } from '../../api/plantillas'

/** Los errores de los datos, repartidos por donde se pintan. */
export interface ErroresRepartidos {
  /** De un dato suelto, o de una tabla entera, por su clave. */
  porDato: Map<string, string[]>
  /** De una celda de tabla: `detalle[2].importe`, con la fila desde 1. */
  porCelda: Map<string, string[]>
  /** De una línea calculada, por `claveDeLinea`. */
  porLinea: Map<string, string[]>
  /** De un asiento calculado entero, por su `orden`. */
  porAsiento: Map<number, string[]>
  /** Los que no tienen un sitio donde ponerse. */
  generales: string[]
}

const DATO = /^parametros\.([a-z_][a-z0-9_]*)(?:\[\d+\])?$/
const CELDA = /^parametros\.([a-z_][a-z0-9_]*)\[(\d+)\]\.([a-z_][a-z0-9_]*)$/
const LINEA = /^asientos\[(\d+)\]\.lineas\[(\d+)\]/
const ASIENTO = /^asientos\[(\d+)\]/

function anadir<K>(mapa: Map<K, string[]>, clave: K, mensaje: string) {
  mapa.set(clave, [...(mapa.get(clave) ?? []), mensaje])
}

/** La clave con la que se busca el error de una celda. */
export function claveDeCelda(dato: string, fila: number, columna: string): string {
  return `${dato}[${fila}].${columna}`
}

/** La clave con la que se busca el error de una línea calculada. */
export function claveDeLinea(orden: number, indice: number): string {
  return `${orden}:${indice}`
}

/** El asiento calculado que sale de la posición `i` de la plantilla; antes el principal. */
function asientoDe(asientos: AsientoCalculado[], i: number): AsientoCalculado | undefined {
  const deEsa = asientos.filter((a) => a.asientoPlantilla === i)
  return deEsa.find((a) => a.papel === 'principal') ?? deEsa[0]
}

/**
 * Cada error va junto a su campo según la ruta que manda el servidor. Las de
 * las líneas (`asientos[i].lineas[j]`) son posiciones de la PLANTILLA: se casan
 * con la línea calculada por `lineaPlantilla` y `fila`. Si la línea no ha
 * salido (por ejemplo, porque daba cero), el error va al asiento; y lo que no
 * encaja en ningún sitio, arriba. Un error nunca se pierde.
 */
export function repartirErrores(
  errores: ErrorCampo[],
  asientos: AsientoCalculado[],
): ErroresRepartidos {
  const r: ErroresRepartidos = {
    porDato: new Map(),
    porCelda: new Map(),
    porLinea: new Map(),
    porAsiento: new Map(),
    generales: [],
  }
  for (const e of errores) {
    const celda = CELDA.exec(e.ruta)
    if (celda?.[1] && celda[2] && celda[3]) {
      anadir(r.porCelda, claveDeCelda(celda[1], Number(celda[2]), celda[3]), e.mensaje)
      continue
    }
    const dato = DATO.exec(e.ruta)
    if (dato?.[1]) {
      anadir(r.porDato, dato[1], e.mensaje)
      continue
    }
    const linea = LINEA.exec(e.ruta)
    if (linea) {
      const asiento = asientoDe(asientos, Number(linea[1]))
      const j = Number(linea[2])
      const indice =
        asiento?.lineas.findIndex(
          (l) => l.lineaPlantilla === j && (e.fila == null || l.fila === e.fila),
        ) ?? -1
      if (asiento && indice >= 0) anadir(r.porLinea, claveDeLinea(asiento.orden, indice), e.mensaje)
      else if (asiento) anadir(r.porAsiento, asiento.orden, e.mensaje)
      else r.generales.push(e.mensaje)
      continue
    }
    const deAsiento = ASIENTO.exec(e.ruta)
    if (deAsiento) {
      const asiento = asientoDe(asientos, Number(deAsiento[1]))
      if (asiento) anadir(r.porAsiento, asiento.orden, e.mensaje)
      else r.generales.push(e.mensaje)
      continue
    }
    if (e.ruta.startsWith('opciones.reversion')) {
      const reversion = asientos.find((a) => a.papel === 'reversion')
      if (reversion) anadir(r.porAsiento, reversion.orden, e.mensaje)
      else r.generales.push(e.mensaje)
      continue
    }
    if (e.ruta.startsWith('opciones.autocuadre')) {
      const conCuadre = asientos.find((a) => a.lineas.some((l) => l.autocuadre))
      const indice = conCuadre?.lineas.findIndex((l) => l.autocuadre) ?? -1
      if (conCuadre && indice >= 0)
        anadir(r.porLinea, claveDeLinea(conCuadre.orden, indice), e.mensaje)
      else r.generales.push(e.mensaje)
      continue
    }
    r.generales.push(e.mensaje)
  }
  return r
}
