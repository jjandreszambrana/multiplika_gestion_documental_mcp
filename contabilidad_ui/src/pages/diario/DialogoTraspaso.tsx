import { Alert, Button, Group, Modal, Radio, Select, Stack, Text, TextInput } from '@mantine/core'
import { useEffect, useState } from 'react'
import { listarBorradores, traspasarLineas, type Borrador } from '../../api/borradores'
import { listarDiarios, type DiarioContable } from '../../api/diarios'
import { textoDeError } from '../../api/errores'
import { CasillaFecha } from '../../components/CasillaFecha'
import { fechaDeApi, fechaParaApi } from '../../lib/fecha'

interface Props {
  abierto: boolean
  ejercicio: number | null
  /** Borrador del que salen las líneas. */
  origen: number
  /** Las líneas marcadas, por su `pase`. */
  pases: number[]
  alCerrar: () => void
  /** Se llama con el borrador de destino, ya hecho el traspaso. */
  alTraspasado: (idDestino: number) => void
}

const EXISTE = 'existe'
const NUEVO = 'nuevo'

/**
 * Mueve las líneas marcadas a otro borrador, o a uno nuevo para partir un
 * asiento en dos.
 *
 * **Aquí no se suma nada**: si lo que se traspasa no cuadra, lo rechaza la API
 * con un 400 y su texto se enseña tal cual.
 */
export default function DialogoTraspaso({
  abierto,
  ejercicio,
  origen,
  pases,
  alCerrar,
  alTraspasado,
}: Props) {
  const [donde, setDonde] = useState(EXISTE)
  const [destino, setDestino] = useState<string | null>(null)
  const [fecha, setFecha] = useState('')
  const [diario, setDiario] = useState<string | null>(null)
  const [concepto, setConcepto] = useState('')
  const [borradores, setBorradores] = useState<Borrador[]>([])
  const [diarios, setDiarios] = useState<DiarioContable[]>([])
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setError(null)
    setDestino(null)
    setFecha('')
    setDiario(null)
    setConcepto('')

    listarBorradores({ ejercicio, soloCuadrados: false, soloMios: false, offset: 0, limit: 500 })
      .then((pagina) => setBorradores(pagina.borradores.filter((b) => b.id !== origen)))
      .catch((fallo: unknown) => setError(textoDeError(fallo)))

    listarDiarios(false)
      .then(setDiarios)
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
  }, [abierto, ejercicio, origen])

  async function traspasar() {
    setError(null)
    setTrabajando(true)
    try {
      const hecho = await traspasarLineas({
        id: origen,
        pases,
        idDestino: donde === NUEVO || destino === null ? null : Number(destino),
        fecha: donde === NUEVO ? fecha : '',
        diario: donde === NUEVO ? (diario ?? '') : '',
        concepto: donde === NUEVO ? concepto.trim() : '',
      })
      alTraspasado(hecho.idDestino)
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  const listo = donde === NUEVO || destino !== null

  return (
    <Modal opened={abierto} onClose={alCerrar} title="Traspasar apuntes" size="md">
      <Stack gap="md">
        <Text size="sm">
          {`Se van a mover ${pases.length} ${pases.length === 1 ? 'apunte' : 'apuntes'} del borrador ${origen}.`}
        </Text>

        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        <Radio.Group value={donde} onChange={setDonde}>
          <Stack gap="xs">
            <Radio value={EXISTE} label="A un borrador que ya existe" />
            <Radio value={NUEVO} label="A un borrador nuevo" />
          </Stack>
        </Radio.Group>

        {donde === EXISTE ? (
          <Select
            label="Borrador"
            data={borradores.map((b) => ({
              value: String(b.id),
              label: `${b.id} · ${b.fecha} · ${b.concepto}`,
            }))}
            value={destino}
            onChange={setDestino}
            comboboxProps={{ withinPortal: false }}
            searchable
          />
        ) : (
          <Stack gap="md">
            <Group grow align="flex-start">
              <CasillaFecha
                label="Fecha"
                value={fechaDeApi(fecha)}
                onChange={(valor) => setFecha(fechaParaApi(valor))}
                clearable
              />
              <Select
                label="Diario"
                data={diarios.map((d) => ({
                  value: d.codigo,
                  label: `${d.codigo} · ${d.descripcion}`,
                }))}
                value={diario}
                onChange={setDiario}
                comboboxProps={{ withinPortal: false }}
                clearable
              />
            </Group>
            <TextInput
              label="Concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.currentTarget.value)}
            />
            <Text size="xs" c="dimmed">
              Lo que dejes en blanco se copia del borrador de origen.
            </Text>
          </Stack>
        )}

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button onClick={() => void traspasar()} loading={trabajando} disabled={!listo}>
            Traspasar
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
