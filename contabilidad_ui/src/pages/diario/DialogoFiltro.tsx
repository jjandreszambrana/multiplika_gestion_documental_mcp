import {
  Button,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import { listarDiarios, type DiarioContable } from '../../api/diarios'
import { textoDeError } from '../../api/errores'
import { CasillaFecha } from '../../components/CasillaFecha'
import CasillaCuenta from './CasillaCuenta'
import { fechaDeApi, fechaParaApi } from '../../lib/fecha'
import type { Incluir } from '../../api/asientos'
import { importeParaApi, soloDigitos, type Filtro } from './filtro'

interface Props {
  abierto: boolean
  filtro: Filtro
  /** El de entrada, al que vuelve «Quitar el filtro». */
  porDefecto: Filtro
  /** Dígitos de una cuenta de apuntes, para el comodín del punto. */
  ancho: number
  alAplicar: (filtro: Filtro) => void
}

const POSICIONES = [
  { value: 'todas', label: 'Todas' },
  { value: 'borradores', label: 'Borradores' },
  { value: 'confirmadas', label: 'Confirmadas' },
]

/**
 * El filtro del diario, fuera de la pantalla: ocupaba una franja fija de alto
 * que se miraba una vez y estorbaba el resto del rato.
 *
 * Se aplica al cerrar, de cualquiera de las maneras —el botón, la equis o
 * Escape—, para que no haya forma de creer que se ha filtrado y no.
 */
export default function DialogoFiltro({ abierto, filtro, porDefecto, ancho, alAplicar }: Props) {
  const [borrador, setBorrador] = useState(filtro)
  const [diarios, setDiarios] = useState<DiarioContable[]>([])
  const [errorDiarios, setErrorDiarios] = useState<string | null>(null)

  // Los diarios se piden una vez y se quedan: la lista no cambia mientras se
  // trabaja, y el filtro tiene que abrirse sin esperas.
  useEffect(() => {
    listarDiarios(true)
      .then((lista) => {
        setDiarios(lista)
        setErrorDiarios(null)
      })
      .catch((fallo: unknown) => setErrorDiarios(textoDeError(fallo)))
  }, [])

  // Al abrirlo enseña lo que está aplicado, no lo que se tecleó y se descartó.
  useEffect(() => {
    if (abierto) setBorrador(filtro)
  }, [abierto, filtro])

  return (
    <Modal
      opened={abierto}
      onClose={() => alAplicar(borrador)}
      title="Filtro del diario"
      size="md"
    >
      <Stack gap="md">
        <Group grow align="flex-start">
          <CasillaFecha
            label="Desde"
            value={fechaDeApi(borrador.desde)}
            onChange={(valor) => setBorrador({ ...borrador, desde: fechaParaApi(valor) })}
            clearable
          />
          <CasillaFecha
            label="Hasta"
            value={fechaDeApi(borrador.hasta)}
            onChange={(valor) => setBorrador({ ...borrador, hasta: fechaParaApi(valor) })}
            clearable
          />
        </Group>

        <Group grow align="flex-start">
          {/* La misma casilla que la entrada de asientos: se busca por número
              y por título sobre el plan que ya está en memoria. Sin `alCrear`,
              porque en un filtro no hay ninguna cuenta que dar de alta. */}
          <CasillaCuenta
            label="Cuenta"
            size="sm"
            valor={borrador.cuenta}
            ancho={ancho}
            alCambiar={(cuenta) => setBorrador((actual) => ({ ...actual, cuenta }))}
          />
          <Select
            label="Diario"
            // Sin `searchable`: son cuatro o cinco, y con la lista todavía
            // vacía Mantine abría un desplegable en blanco al llegar con el
            // tabulador, que tapaba el diálogo y no dejaba seguir.
            data={diarios.map((d) => ({
              value: d.codigo,
              label: `${d.codigo} · ${d.descripcion}`,
            }))}
            value={borrador.diario === '' ? null : borrador.diario}
            onChange={(valor) => setBorrador({ ...borrador, diario: valor ?? '' })}
            disabled={diarios.length === 0}
            // Dentro del diálogo, igual que el calendario: si la lista se
            // dibujara fuera, quedaría a la vista pero sin poder tocarla.
            comboboxProps={{ withinPortal: false }}
            error={errorDiarios ? `No se pudieron cargar los diarios: ${errorDiarios}` : null}
            clearable
          />
        </Group>

        <TextInput
          label="Concepto"
          value={borrador.concepto}
          onChange={(e) => setBorrador({ ...borrador, concepto: e.currentTarget.value })}
        />

        <TextInput
          label="Documento"
          value={borrador.documento}
          onChange={(e) => setBorrador({ ...borrador, documento: e.currentTarget.value })}
        />

        <Group grow align="flex-start">
          <TextInput
            label="Asiento desde"
            inputMode="numeric"
            value={borrador.asientoDesde}
            onChange={(e) =>
              setBorrador({ ...borrador, asientoDesde: soloDigitos(e.currentTarget.value) })
            }
          />
          <TextInput
            label="Asiento hasta"
            inputMode="numeric"
            value={borrador.asientoHasta}
            onChange={(e) =>
              setBorrador({ ...borrador, asientoHasta: soloDigitos(e.currentTarget.value) })
            }
          />
        </Group>

        <Group grow align="flex-start">
          <TextInput
            label="Importe desde"
            inputMode="decimal"
            value={borrador.importeDesde}
            onChange={(e) => setBorrador({ ...borrador, importeDesde: e.currentTarget.value })}
            onBlur={() =>
              setBorrador((actual) => ({ ...actual, importeDesde: importeParaApi(actual.importeDesde) }))
            }
          />
          <TextInput
            label="Importe hasta"
            inputMode="decimal"
            value={borrador.importeHasta}
            onChange={(e) => setBorrador({ ...borrador, importeHasta: e.currentTarget.value })}
            onBlur={() =>
              setBorrador((actual) => ({ ...actual, importeHasta: importeParaApi(actual.importeHasta) }))
            }
          />
        </Group>

        <Stack gap={2}>
          <Text fz="sm" fw={500}>
            Mostrar
          </Text>
          <SegmentedControl
            value={borrador.incluir}
            onChange={(valor) => setBorrador({ ...borrador, incluir: valor as Incluir })}
            data={POSICIONES}
          />
        </Stack>

        <Group justify="space-between" mt="sm">
          <Button variant="default" onClick={() => alAplicar(porDefecto)}>
            Quitar el filtro
          </Button>
          <Button onClick={() => alAplicar(borrador)}>Aplicar</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
