import { Text, TextInput } from '@mantine/core'
import type { CampoDeCuenta, CuentaSugerida } from '../../api/maestros'

interface Props {
  campo: CampoDeCuenta
  /** Lo que regiría si se deja vacía. Vacío = no hereda nada. */
  heredado: string
  /** Lo que el servidor propone para esta casilla, si ya ha llegado. */
  sugerida: CuentaSugerida | undefined
  valor: string
  alEscribir: (valor: string) => void
  alSalir: () => void
  autoFocus: boolean
}

/**
 * Una casilla de cuenta, con lo que el servidor propone debajo.
 *
 * La propuesta se explica siempre que está puesta: un número de cuenta que
 * aparece solo y sin decir de dónde sale no lo acepta nadie que lleve libros.
 * Y donde no hay ninguna que ofrecer se dice por qué, que es información y no
 * un hueco.
 */
export default function CasillaDeCuenta({
  campo,
  heredado,
  sugerida,
  valor,
  alEscribir,
  alSalir,
  autoFocus,
}: Props) {
  const propuesta = sugerida?.sugerencia ?? ''
  const sinTocar = propuesta !== '' && valor === propuesta

  return (
    <div>
      <TextInput
        label={campo.titulo}
        description={
          heredado === '' ? campo.consecuencia : `Si se deja vacía, se aplica la ${heredado}`
        }
        value={valor}
        onChange={(e) => alEscribir(e.currentTarget.value)}
        onBlur={alSalir}
        autoFocus={autoFocus}
      />

      {sinTocar && (
        <Text fz="xs" c="dimmed" mt={4}>
          Propuesta: {sugerida?.origen}
        </Text>
      )}

      {propuesta === '' && (sugerida?.motivo ?? '') !== '' && (
        <Text fz="xs" c="dimmed" mt={4}>
          {sugerida?.motivo}
        </Text>
      )}

      {sinTocar && !sugerida?.existe_en_el_plan && (
        <Text fz="xs" c="dimmed" mt={4}>
          No está en el plan: se dará de alta al guardar.
        </Text>
      )}

      {sinTocar && (sugerida?.ocupada_por ?? '') !== '' && (
        <Text fz="xs" c="orange" mt={4}>
          Esa cuenta ya la usa {sugerida?.ocupada_por}.
        </Text>
      )}
    </div>
  )
}
