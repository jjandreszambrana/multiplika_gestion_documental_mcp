import { useCallback, useEffect, useState } from 'react'
import { textoDeError } from '../../api/errores'
import { aDecimal, type ImporteApi } from '../../lib/dinero'
import { formatearImporte } from '../../lib/format'

/** Filas por página en los listados largos (23.000 muestras en un laboratorio con años). */
export const FILAS_POR_PAGINA = 50

/** Un importe para pantalla; vacío si no hay. */
export function importeLab(valor: ImporteApi): string {
  return valor === null || valor === undefined || valor === '' ? '' : `${formatearImporte(aDecimal(valor))} €`
}

/** Fecha y hora de la API (`2026-10-26 13:00:00`) a `26/10/2026 13:00`. */
export function fechaHora(texto: string | null | undefined): string {
  if (!texto) return ''
  const [dia = '', hora = ''] = texto.replace('T', ' ').split(' ')
  const [a, m, d] = dia.split('-')
  return `${d}/${m}/${a}${hora ? ` ${hora.slice(0, 5)}` : ''}`
}

interface Carga<T> {
  datos: T | null
  error: string | null
  cargando: boolean
  recargar: () => void
}

/** Lee algo al montar y cada vez que cambian las dependencias. */
export function useCarga<T>(cargar: () => Promise<T>, dependencias: readonly unknown[]): Carga<T> {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [vuelta, setVuelta] = useState(0)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    cargar()
      .then((d) => vigente && setDatos(d))
      .catch((f: unknown) => vigente && setError(textoDeError(f)))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, vuelta])

  const recargar = useCallback(() => setVuelta((n) => n + 1), [])
  return { datos, error, cargando, recargar }
}

/** La pestaña ocupa el alto que le deja el marco: sus filtros y su pie se quedan fijos. */
export const PESTANA_FIJA = { flex: 1, minHeight: 0 } as const

/** Lo único que se desplaza en una pestaña: la tabla, con su cabecera pegada arriba. */
export const CUERPO_SCROLL = { flex: 1, minHeight: 0, overflow: 'auto' } as const
