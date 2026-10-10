import { Text } from '@mantine/core'
import type { PerdidasYGanancias } from '../../api/informes'
import ColumnaBalance from './ColumnaBalance'

const NOTA_DEL_SIGNO = 'Un resultado positivo es beneficio; negativo, pérdida.'

/**
 * La cuenta de pérdidas y ganancias: una sola columna de epígrafes y, al pie, el
 * resultado.
 *
 * Como en el balance, los importes llegan **ya en positivo** y el resultado lo
 * da la API. Aquí no se suma nada.
 */
export default function VistaPerdidasYGanancias({ cuenta }: { cuenta: PerdidasYGanancias }) {
  return (
    <>
      <ColumnaBalance
        titulo="Cuenta de pérdidas y ganancias"
        epigrafes={cuenta.epigrafes}
        rotuloTotal="Resultado del ejercicio"
        total={cuenta.resultado}
      />
      <Text size="sm" c="dimmed" mt="md">
        {NOTA_DEL_SIGNO}
      </Text>
    </>
  )
}
