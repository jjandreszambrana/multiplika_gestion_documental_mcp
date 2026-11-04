import { Alert, Button, Group, Modal, Radio, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'
import { CasillaFecha } from '../../components/CasillaFecha'
import { fechaDeApi, fechaParaApi } from '../../lib/fecha'

export interface OpcionesDuplicado {
  fecha_toma: string
  fecha_entrada: string
  conservarResultados: boolean
}

interface Props {
  cantidad: number
  alDuplicar: (opciones: OpcionesDuplicado) => Promise<void>
  alCerrar: () => void
}

/** Pregunta lo que cambia en las copias: las dos fechas y si se llevan los resultados. */
export default function DialogoDuplicar({ cantidad, alDuplicar, alCerrar }: Props) {
  const [toma, setToma] = useState('')
  const [entrada, setEntrada] = useState('')
  const [resultados, setResultados] = useState('quitar')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function duplicar() {
    setTrabajando(true)
    setError(null)
    try {
      await alDuplicar({ fecha_toma: toma, fecha_entrada: entrada, conservarResultados: resultados === 'mantener' })
      alCerrar()
    } catch (fallo) {
      setError(textoDeError(fallo))
      setTrabajando(false)
    }
  }

  return (
    // Alto mínimo: el calendario se abre dentro del diálogo y, sin sitio, queda cortado.
    <Modal opened onClose={alCerrar} title="Duplicar muestras" closeOnClickOutside={false} styles={{ body: { minHeight: 480 } }}>
      <Stack gap="md">
        <Text size="sm">
          {cantidad === 1 ? 'Se creará 1 muestra nueva' : `Se crearán ${cantidad} muestras nuevas`} con los mismos datos y
          parámetros. Las fechas de informe y prevista quedan vacías.
        </Text>
        <Group grow align="flex-start">
          <CasillaFecha label="Fecha de toma" value={fechaDeApi(toma)} onChange={(f) => setToma(fechaParaApi(f))} clearable />
          <CasillaFecha label="Fecha de entrada" value={fechaDeApi(entrada)} onChange={(f) => setEntrada(fechaParaApi(f))} clearable />
        </Group>
        <Radio.Group label="Valores de los resultados" value={resultados} onChange={setResultados}>
          <Stack gap="xs" mt="xs">
            <Radio value="quitar" label="Eliminarlos: las copias salen con los resultados en blanco" />
            <Radio value="mantener" label="Mantenerlos: las copias llevan los mismos resultados" />
          </Stack>
        </Radio.Group>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar} disabled={trabajando}>
            Cancelar
          </Button>
          <Button onClick={() => void duplicar()} loading={trabajando} disabled={!toma || !entrada}>
            Duplicar
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
