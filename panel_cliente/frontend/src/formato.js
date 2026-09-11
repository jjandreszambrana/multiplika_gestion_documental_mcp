// El backend manda fechas en ISO (YYYY-MM-DD para las columnas DATE,
// YYYY-MM-DDTHH:MM:SS[...] para las TIMESTAMP) — esto las pasa a
// dd/mm/yyyy o dd/mm/yyyy hh:mm:ss para mostrarlas en el panel.
//
// Las fechas sin hora se parsean a mano (split, no `new Date`): un DATE
// de Postgres no lleva zona horaria, y `new Date("2026-09-11")` lo
// interpreta como medianoche UTC — en una zona horaria por detrás de UTC
// eso se muestra como el día anterior.
export function formatearFecha(valor) {
  if (!valor) return "—"

  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(valor)
  if (soloFecha) {
    const [anio, mes, dia] = valor.split("-")
    return `${dia}/${mes}/${anio}`
  }

  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return valor

  const dosDigitos = (n) => String(n).padStart(2, "0")
  const fechaFormateada = `${dosDigitos(fecha.getDate())}/${dosDigitos(fecha.getMonth() + 1)}/${fecha.getFullYear()}`
  const horaFormateada = `${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}:${dosDigitos(fecha.getSeconds())}`
  return `${fechaFormateada} ${horaFormateada}`
}
