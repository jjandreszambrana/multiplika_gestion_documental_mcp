import { useCallback, useEffect, useState } from 'react'
import { listarApuntes, MAXIMO_POR_PAGINA, type Apunte } from '../../api/asientos'
import type { Filtro as FiltroDelDiario } from './filtro'
import { sustituirAsiento } from './reemplazo'
import { esAbortada } from '../../api/cliente'
import { textoDeError } from '../../api/errores'

/**
 * Todos los apuntes que cumplen el filtro, no una página.
 *
 * El diario no se pagina desde el 27/08/2026: un asiento tiene varias líneas y
 * la paginación lo partía entre dos páginas, que es justo lo que no se puede
 * hacer con un asiento. Desde que la API admite 25.000 por llamada, un
 * ejercicio normal entra en un solo viaje; si aún así no cabe, se pide lo que
 * falte con `offset`.
 */

export interface Filtro {
  ejercicio: number | null
  filtro: FiltroDelDiario
  /** Cambia para volver a pedirlo todo tras tocar un asiento. */
  recarga: number
}

/** De dónde se piden las líneas: el número de asiento, o el borrador. */
export type Destino = { asiento: number } | { idBorrador: number }

export interface Carga {
  apuntes: Apunte[]
  /** Los que cumplen el filtro. Con `cargando`, dice cuánto falta. */
  total: number
  cargando: boolean
  error: string | null
  /**
   * Cambia las líneas de un asiento por las de la API, sin volver a bajar el
   * diario entero. Devuelve las líneas nuevas, o `null` si el asiento no estaba
   * a la vista y hay que recargar del todo.
   */
  refrescarAsiento: (grupo: string, destino: Destino) => Promise<Apunte[] | null>
}

const VACIO = { apuntes: [], total: 0, cargando: true, error: null }

export function useApuntes({ ejercicio, filtro, recarga }: Filtro): Carga {
  const [carga, setCarga] = useState<Omit<Carga, 'refrescarAsiento'>>(VACIO)

  const refrescarAsiento = useCallback(
    async (grupo: string, destino: Destino) => {
      const soloEse =
        'asiento' in destino
          ? { asientoDesde: String(destino.asiento), asientoHasta: String(destino.asiento) }
          : { idBorrador: destino.idBorrador }
      const pagina = await listarApuntes({
        ...filtro,
        ejercicio,
        idBorrador: null,
        ...soloEse,
        offset: 0,
        limit: MAXIMO_POR_PAGINA,
      })
      let estaba = false
      setCarga((anterior) => {
        const sustituidos = sustituirAsiento(anterior.apuntes, grupo, pagina.apuntes)
        if (sustituidos === null) return anterior
        estaba = true
        return { ...anterior, apuntes: sustituidos, total: sustituidos.length }
      })
      return estaba ? pagina.apuntes : null
    },
    [ejercicio, filtro],
  )

  useEffect(() => {
    // Al cambiar el filtro, lo que se estaba bajando ya no vale: se corta de
    // verdad, no solo se ignora. Si no, cada cambio deja una descarga completa
    // del diario ocupando la conexión y la siguiente espera detrás.
    const corte = new AbortController()
    let vigente = true
    // Las filas que ya se están viendo se quedan puestas hasta que llegan las
    // nuevas: vaciarlas antes de pedir hacía que la tabla se repintara entera y
    // la pantalla diera un salto cada vez que se guardaba un asiento.
    setCarga((anterior) => ({ ...anterior, cargando: true, error: null }))

    async function traerTodo() {
      const acumulado: Apunte[] = []
      let total = 0
      // La primera tanda se enseña en cuanto llega solo si no había nada que
      // enseñar. Si ya había filas, se espera a tenerlo todo: verlas crecer a
      // trompicones salta tanto como vaciarlas.
      let publicandoSobreLaMarcha = true

      do {
        const tanda = await listarApuntes(
          {
            ...filtro,
            ejercicio,
            idBorrador: null,
            offset: acumulado.length,
            limit: MAXIMO_POR_PAGINA,
          },
          corte.signal,
        )
        if (!vigente) return

        acumulado.push(...tanda.apuntes)
        total = tanda.total
        if (publicandoSobreLaMarcha) {
          setCarga((anterior) => {
            if (anterior.apuntes.length > 0) {
              publicandoSobreLaMarcha = false
              return anterior
            }
            return { apuntes: [...acumulado], total, cargando: true, error: null }
          })
        }

        // Si una tanda viene vacía con apuntes por delante, se corta: seguir
        // sería pedir lo mismo para siempre.
        if (tanda.apuntes.length === 0) break
      } while (acumulado.length < total)

      // Al terminar se pone todo de una vez: es el único momento en que la
      // tabla cambia, y cambia ya completa.
      if (vigente) setCarga({ apuntes: acumulado, total, cargando: false, error: null })
    }

    traerTodo().catch((fallo: unknown) => {
      if (vigente && !esAbortada(fallo)) {
        // Lo que se estaba viendo era de otra consulta: se suelta, o se estaría
        // enseñando una cosa mientras el aviso dice que no se pudo cargar.
        setCarga({ ...VACIO, cargando: false, error: textoDeError(fallo) })
      }
    })

    return () => {
      vigente = false
      corte.abort()
    }
  }, [ejercicio, filtro, recarga])

  return { ...carga, refrescarAsiento }
}
