import { Checkbox, Select, TextInput } from '@mantine/core'
import type { Parametro } from '../../api/plantillas'
import { CasillaFecha } from '../../components/CasillaFecha'
import { fechaDeApi, fechaParaApi } from '../../lib/fecha'
import CasillaSubcuenta from './CasillaSubcuenta'
import CasillaTercero from './CasillaTercero'
import type { ValorSimple } from './valores'

interface Props {
  parametro: Parametro
  valor: ValorSimple
  errores: string[] | undefined
  /** Dígitos de una subcuenta en esta empresa, para el punto de la cuenta. */
  ancho: number
  /** Para dar de alta una subcuenta nueva y mirar su mayor. */
  ejercicio: number | null
  alCambiar: (valor: ValorSimple) => void
  /** En una celda de tabla, sin rótulo: el rótulo es la cabecera de la columna. */
  enTabla?: boolean
  /** Lo que se enseña debajo, como la razón social del tercero elegido. */
  nota?: string
}

/**
 * La casilla de un dato de la plantilla, según su tipo. El rótulo y la ayuda
 * los escribe quien diseña la plantilla; aquí no se pone ningún texto propio.
 * Si el valor vale o no lo dice el servidor.
 */
export default function CampoDato({
  parametro: p,
  valor,
  errores,
  ancho,
  ejercicio,
  alCambiar,
  enTabla = false,
  nota,
}: Props) {
  const size = enTabla ? 'xs' : 'sm'
  const label = enTabla ? undefined : p.etiqueta || p.clave
  const description = enTabla ? undefined : p.ayuda || nota || undefined
  const required = !enTabla && p.obligatorio === true
  const error = errores && errores.length > 0 ? errores.join(' ') : undefined
  const texto = typeof valor === 'string' ? valor : ''

  switch (p.tipo) {
    case 'booleano':
      return (
        <Checkbox
          size={size}
          label={label}
          description={description}
          error={error}
          checked={valor === true}
          onChange={(e) => alCambiar(e.currentTarget.checked)}
          mt={enTabla ? 0 : 'xs'}
        />
      )
    case 'fecha':
      return (
        <CasillaFecha
          size={size}
          label={label}
          description={description}
          required={required}
          error={error}
          value={fechaDeApi(texto)}
          onChange={(fecha) => alCambiar(fechaParaApi(fecha))}
          clearable
        />
      )
    case 'seleccion':
      return (
        <Select
          size={size}
          label={label}
          description={description}
          required={required}
          error={error}
          value={texto === '' ? null : texto}
          data={(p.opciones ?? []).map((o) => ({
            value: String(o.valor),
            label: o.etiqueta || String(o.valor),
          }))}
          onChange={(elegido) => alCambiar(elegido ?? '')}
          searchable
          clearable={!p.obligatorio}
        />
      )
    case 'cuenta':
      return (
        <CasillaSubcuenta
          size={size}
          label={label}
          description={description}
          error={error}
          valor={texto}
          ancho={ancho}
          ejercicio={ejercicio}
          alCambiar={alCambiar}
        />
      )
    case 'tercero':
      return (
        <CasillaTercero
          size={size}
          label={label}
          description={description}
          required={required}
          error={error}
          valor={texto}
          alCambiar={alCambiar}
        />
      )
    case 'numero':
    case 'importe':
    case 'porcentaje':
      return (
        <TextInput
          size={size}
          label={label}
          description={description}
          required={required}
          error={error}
          value={texto}
          inputMode="decimal"
          onChange={(e) => alCambiar(e.currentTarget.value)}
          styles={{ input: { textAlign: 'right' } }}
        />
      )
    default:
      return (
        <TextInput
          size={size}
          label={label}
          description={description}
          required={required}
          error={error}
          value={texto}
          maxLength={p.longitud_maxima ?? undefined}
          onChange={(e) => alCambiar(e.currentTarget.value)}
        />
      )
  }
}
