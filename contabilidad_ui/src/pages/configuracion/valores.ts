import type { CuentasPorDefecto } from '../../api/configuracion'

/** Lo guardado, en la forma que usa el formulario. */
export function valoresDe(cuentas: CuentasPorDefecto): Record<string, string> {
  return Object.fromEntries(
    Object.entries(cuentas).map(([campo, valor]) => [
      campo,
      typeof valor === 'string' ? valor : '',
    ]),
  )
}
