import { useEffect, useState } from 'react'
import { esAbortada } from '../../api/cliente'
import { tablaDeAmortizacion, type TablaDeAmortizacion } from '../../api/inmovilizado'

/**
 * La tabla de la Ley del Impuesto sobre Sociedades, que casi nunca cambia: se
 * pide una vez al abrir el formulario y se guarda mientras esté abierto.
 *
 * Si no se puede traer, el formulario sigue funcionando: el porcentaje se
 * teclea a mano, que es lo que se hacía antes de que existiera la tabla. Por
 * eso el fallo no se enseña como un error de la pantalla.
 */
export function useTablaAmortizacion(activo: boolean): TablaDeAmortizacion | null {
  const [tabla, setTabla] = useState<TablaDeAmortizacion | null>(null)

  useEffect(() => {
    if (!activo || tabla !== null) return
    let vigente = true
    tablaDeAmortizacion()
      .then((traida) => vigente && setTabla(traida))
      .catch((fallo: unknown) => {
        if (!esAbortada(fallo)) setTabla(null)
      })
    return () => {
      vigente = false
    }
  }, [activo, tabla])

  return tabla
}
