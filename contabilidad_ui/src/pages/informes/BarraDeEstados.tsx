import { ActionIcon, Button, Checkbox, Group, Loader, Select, Tooltip } from '@mantine/core'
import { IconFileSpreadsheet, IconFileTypePdf } from '@tabler/icons-react'
import type { Detalle } from '../../api/informes'
import { CasillaFecha } from '../../components/CasillaFecha'

const ROTULO_EXCEL =
  'Descargar en Excel. Trae las dos hojas: el balance y la cuenta de pérdidas y ganancias.'

const ROTULO_PDF =
  'Descargar en PDF. Trae los dos, cada uno en su página: el balance y la cuenta de ' +
  'pérdidas y ganancias.'

/**
 * Hasta dónde se baja el informe. Entra por `epigrafes`, que es el balance tal y
 * como se presenta; el detalle es para revisar, y quien lo quiere lo pide.
 */
const DETALLES = [
  { value: 'epigrafes', label: 'Solo epígrafes' },
  { value: 'cuentas', label: 'Con cuentas de mayor' },
  { value: 'subcuentas', label: 'Con cuentas y subcuentas' },
]

interface Props {
  hasta: Date | null
  alCambiarHasta: (valor: Date | null) => void
  detalle: Detalle
  alCambiarDetalle: (valor: Detalle) => void
  borradores: boolean
  alCambiarBorradores: (valor: boolean) => void
  /** Nulo cuando no hay ejercicio: sin él no hay nada que consultar. */
  alVer: (() => void) | null
  /** Nulo mientras no haya nada traído que bajar. */
  alBajar: ((que: 'excel' | 'pdf') => void) | null
  /** Cuál se está bajando, si es que hay alguna en marcha. */
  bajando: 'excel' | 'pdf' | null
  cargando: boolean
}

/**
 * El filtro de los estados contables y sus dos descargas, que son comunes a las
 * dos pestañas: se pone una vez y vale para el balance y para pérdidas y
 * ganancias.
 */
export default function BarraDeEstados({
  hasta,
  alCambiarHasta,
  detalle,
  alCambiarDetalle,
  borradores,
  alCambiarBorradores,
  alVer,
  alBajar,
  bajando,
  cargando,
}: Props) {
  return (
    <Group align="flex-end" gap="md" wrap="wrap">
      <CasillaFecha
        label="A fecha"
        value={hasta}
        onChange={(valor) => alCambiarHasta(valor as Date | null)}
        clearable
        w={170}
      />
      <Select
        label="Detalle"
        data={DETALLES}
        value={detalle}
        onChange={(valor) => alCambiarDetalle((valor ?? 'epigrafes') as Detalle)}
        allowDeselect={false}
        w={210}
      />
      <Checkbox
        label="Incluir borradores"
        checked={borradores}
        onChange={(e) => alCambiarBorradores(e.currentTarget.checked)}
        pb={8}
      />
      <Button onClick={() => alVer?.()} disabled={alVer === null}>
        Ver
      </Button>
      <Tooltip label={ROTULO_EXCEL} withArrow multiline maw={320}>
        <ActionIcon
          variant="default"
          size="lg"
          aria-label="Descargar en Excel"
          loading={bajando === 'excel'}
          disabled={alBajar === null}
          onClick={() => alBajar?.('excel')}
          mb={4}
        >
          <IconFileSpreadsheet size={20} color="var(--mantine-color-green-7)" />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={ROTULO_PDF} withArrow multiline maw={320}>
        <ActionIcon
          variant="default"
          size="lg"
          aria-label="Descargar en PDF"
          loading={bajando === 'pdf'}
          disabled={alBajar === null}
          onClick={() => alBajar?.('pdf')}
          mb={4}
        >
          <IconFileTypePdf size={20} color="var(--mantine-color-red-7)" />
        </ActionIcon>
      </Tooltip>
      {cargando && <Loader size="xs" mb={12} />}
    </Group>
  )
}
