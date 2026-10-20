// Estado de una factura de venta Verifactu en frases normales, a partir de
// una fila del listado de borradores del SIF: borrador (0) o emitida (1), y
// de la emitida, lo que dijo la AEAT (EstadoRegistro) o en qué va el envío.
const REGISTRO = {
  Correcto: ["green", "Aceptada por la AEAT"],
  AceptadoConErrores: ["yellow", "Aceptada con errores"],
  Incorrecto: ["red", "Rechazada por la AEAT"],
}

export function estadoFactura(f) {
  if (!f.id_estado_msif) return ["gray", "Borrador"]
  if (f.anulada) return ["dark", "Anulada"]
  if (REGISTRO[f.EstadoRegistro]) return REGISTRO[f.EstadoRegistro]
  if (f.EstadoEnvio) return ["blue", `Enviada (${f.EstadoEnvio})`]
  return ["blue", "Emitida, pendiente de enviar"]
}

// El tipo de serie dice qué facturas salen de ella (ver el SIF:
// maestros/series, id_tipo_serie → tipos de factura)
export const TIPO_POR_SERIE = { 0: 0, 1: 3, 2: 1, 3: 2, 4: 7 }
export const SERIES_RECTIFICATIVAS = [1, 4]
