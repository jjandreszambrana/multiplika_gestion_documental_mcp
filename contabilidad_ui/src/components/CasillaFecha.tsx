import { DateInput, type DateInputProps } from '@mantine/dates'
import { useState } from 'react'
import { fechaDeApi, fechaParaApi, parsearFechaEscrita } from '../lib/fecha'

/**
 * Desde Mantine 8 el `DateInput` devuelve la fecha como cadena `aaaa-mm-dd`.
 * Aquí se sigue dando y recibiendo un `Date`, como en el resto de la
 * aplicación: la cadena se convierte en este único punto, con la fecha local.
 */
interface Props extends Omit<DateInputProps, 'onChange'> {
  onChange?: (valor: Date | null) => void
  /** Se llama al cerrarse el calendario, que es cuando se ha elegido un día. */
  alCerrarCalendario?: () => void
}

/**
 * La casilla de fecha de toda la aplicación. Trae puesto el formato español y
 * el parseo de lo tecleado: el `DateInput` de Mantine, a pelo, entiende lo
 * escrito a la americana y convierte un 03/09/2026 en 9 de marzo.
 *
 * **El calendario solo se abre a propósito**: pinchando en la casilla o con la
 * flecha abajo. De fábrica, el `DateInput` lo abre en cuanto el campo recibe el
 * foco, así que al recorrer un formulario con el tabulador saltaba un panel
 * blanco que tapaba los campos de debajo y no dejaba seguir. Se cierra al salir
 * del campo, con Escape y al elegir un día.
 *
 * Los nombres de los meses y de los días salen en español por el
 * `DatesProvider` de `main.tsx`, que vale para toda la aplicación.
 *
 * No pongas un `DateInput` suelto en ninguna pantalla: usa esta.
 */
export function CasillaFecha({
  alCerrarCalendario,
  onClick,
  onKeyDown,
  onBlur,
  onChange,
  popoverProps,
  ...resto
}: Props) {
  const [abierto, setAbierto] = useState(false)

  function cerrar() {
    if (!abierto) return
    setAbierto(false)
    alCerrarCalendario?.()
  }

  return (
    <DateInput
      valueFormat="DD/MM/YYYY"
      // Mantine 8 maneja las fechas como cadena `aaaa-mm-dd`: devolver un Date
      // aquí hacía que lo tecleado no llegara nunca a `onChange` y la casilla
      // se vaciara al salir.
      dateParser={(texto) => {
        const fecha = parsearFechaEscrita(texto)
        return fecha ? fechaParaApi(fecha) : null
      }}
      onClick={(e) => {
        setAbierto(true)
        onClick?.(e)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') setAbierto(true)
        if (e.key === 'Escape') cerrar()
        onKeyDown?.(e)
      }}
      onBlur={(e) => {
        cerrar()
        onBlur?.(e)
      }}
      onChange={(valor) => {
        onChange?.(fechaDeApi(valor))
        // Elegir un día en el calendario lo cierra; teclear no lo abre, así que
        // aquí solo se llega desde el calendario.
        cerrar()
      }}
      popoverProps={{
        opened: abierto,
        onChange: setAbierto,
        // Dentro del propio campo: fuera, y con la casilla en un diálogo, el
        // diálogo retiene el foco y el calendario queda a la vista pero muerto.
        withinPortal: false,
        ...popoverProps,
      }}
      {...resto}
    />
  )
}
