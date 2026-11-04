/**
 * Los ocho catálogos del laboratorio. Todos hablan igual (listar, crear,
 * editar, eliminar), así que una sola pantalla los lleva y esta tabla dice qué
 * campos tiene cada uno. Los nombres de los campos son los de la API; lo que
 * ve el usuario son las etiquetas.
 */

export type TipoCampo = 'texto' | 'area' | 'entero' | 'numero' | 'si_no' | 'lista' | 'color'

/** De dónde salen las opciones de un campo que apunta a otra fila. */
export type Origen = { catalogo: string; etiqueta: string } | 'articulos' | { fijas: readonly [string, string][] }

export interface CampoCatalogo {
  clave: string
  etiqueta: string
  tipo: TipoCampo
  obligatorio?: boolean
  origen?: Origen
}

export interface Catalogo {
  id: string
  etiqueta: string
  /** Claves que salen en la tabla, en orden. */
  columnas: string[]
  campos: CampoCatalogo[]
}

const ACTIVO: CampoCatalogo = { clave: 'activo', etiqueta: 'En uso', tipo: 'si_no' }

export const TIPOS_DE_LIMITE: Origen = {
  fijas: [
    ['texto', 'Solo texto'],
    ['maximo', 'Máximo'],
    ['minimo', 'Mínimo'],
    ['rango', 'Rango'],
    ['ausencia', 'Ausencia'],
  ],
}

export const CATALOGOS: Catalogo[] = [
  {
    id: 'parametros',
    etiqueta: 'Parámetros',
    columnas: ['parametro', 'id_grupo', 'id_unidad', 'id_metodo', 'limite_texto', 'activo'],
    campos: [
      { clave: 'parametro', etiqueta: 'Parámetro', tipo: 'texto', obligatorio: true },
      { clave: 'id_grupo', etiqueta: 'Grupo', tipo: 'lista', obligatorio: true, origen: { catalogo: 'grupos_parametros', etiqueta: 'grupo' } },
      { clave: 'id_unidad', etiqueta: 'Unidad', tipo: 'lista', origen: { catalogo: 'unidades', etiqueta: 'unidad' } },
      { clave: 'id_metodo', etiqueta: 'Método', tipo: 'lista', origen: { catalogo: 'metodos', etiqueta: 'codigo' } },
      { clave: 'limite_tipo', etiqueta: 'Tipo de límite', tipo: 'lista', origen: TIPOS_DE_LIMITE },
      { clave: 'limite_minimo', etiqueta: 'Límite mínimo', tipo: 'numero' },
      { clave: 'limite_maximo', etiqueta: 'Límite máximo', tipo: 'numero' },
      { clave: 'limite_texto', etiqueta: 'Límite tal como se imprime', tipo: 'texto' },
      { clave: 'notas', etiqueta: 'Notas', tipo: 'area' },
      ACTIVO,
    ],
  },
  {
    id: 'grupos_parametros',
    etiqueta: 'Grupos de parámetros',
    columnas: ['grupo', 'orden', 'activo'],
    campos: [
      { clave: 'grupo', etiqueta: 'Grupo', tipo: 'texto', obligatorio: true },
      { clave: 'orden', etiqueta: 'Orden', tipo: 'entero' },
      { clave: 'notas', etiqueta: 'Notas', tipo: 'area' },
      ACTIVO,
    ],
  },
  {
    id: 'unidades',
    etiqueta: 'Unidades',
    columnas: ['unidad', 'denominacion'],
    campos: [
      { clave: 'unidad', etiqueta: 'Unidad', tipo: 'texto', obligatorio: true },
      { clave: 'denominacion', etiqueta: 'Denominación', tipo: 'texto' },
    ],
  },
  {
    id: 'metodos',
    etiqueta: 'Métodos',
    columnas: ['codigo', 'descripcion', 'activo'],
    campos: [
      { clave: 'codigo', etiqueta: 'Código', tipo: 'texto', obligatorio: true },
      { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'area' },
      ACTIVO,
    ],
  },
  {
    id: 'estados',
    etiqueta: 'Estados',
    columnas: ['codigo', 'denominacion', 'color', 'orden', 'publica_cliente', 'activo'],
    campos: [
      { clave: 'codigo', etiqueta: 'Código', tipo: 'entero', obligatorio: true },
      { clave: 'denominacion', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true },
      { clave: 'color', etiqueta: 'Color de la fila', tipo: 'color' },
      { clave: 'orden', etiqueta: 'Orden', tipo: 'entero' },
      { clave: 'publica_cliente', etiqueta: 'El cliente ve sus informes en este estado', tipo: 'si_no' },
      ACTIVO,
    ],
  },
  {
    id: 'textos_normativa',
    etiqueta: 'Textos de normativa',
    columnas: ['etiqueta', 'titulo'],
    campos: [
      { clave: 'etiqueta', etiqueta: 'Etiqueta', tipo: 'texto', obligatorio: true },
      { clave: 'titulo', etiqueta: 'Título', tipo: 'texto', obligatorio: true },
      { clave: 'texto', etiqueta: 'Texto', tipo: 'area' },
    ],
  },
  {
    id: 'laboratorios_externos',
    etiqueta: 'Laboratorios externos',
    columnas: ['nombre', 'activo'],
    campos: [{ clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true }, ACTIVO],
  },
  {
    id: 'tarifas',
    etiqueta: 'Tarifas',
    columnas: ['concepto', 'id_articulo', 'precio', 'activo'],
    campos: [
      { clave: 'concepto', etiqueta: 'Concepto', tipo: 'texto', obligatorio: true },
      { clave: 'id_articulo', etiqueta: 'Artículo que se factura', tipo: 'lista', obligatorio: true, origen: 'articulos' },
      { clave: 'precio', etiqueta: 'Precio (€)', tipo: 'numero' },
      ACTIVO,
    ],
  },
]
