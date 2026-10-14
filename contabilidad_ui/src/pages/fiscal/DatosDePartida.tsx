import { Alert, Button, Checkbox, Group, Select, SimpleGrid, Stack, TextInput, Title } from '@mantine/core'
import { useState } from 'react'
import { modificarDeclaracion, type FichaDeclaracion } from '../../api/declaraciones'
import { textoDeError } from '../../api/errores'
import { soloImporte } from '../../lib/dinero'
import { cambiosDePartida, formularioDe, type FormularioPartida } from './declaracion'

interface Props {
  ficha: FichaDeclaracion
  /** Sin permiso o con la declaración cerrada se enseña, pero no se toca. */
  editable: boolean
  alHecho: (ficha: FichaDeclaracion) => void
}

/** Vacío: la API pone la que toca según salga a ingresar o a devolver. */
const FORMAS_DE_PAGO = [
  { value: '', label: 'La habitual (ingreso o transferencia)' },
  { value: 'I', label: 'A ingresar: ingreso en el banco' },
  { value: 'U', label: 'A ingresar: domiciliación' },
  { value: 'G', label: 'A ingresar: cuenta corriente tributaria' },
  { value: 'D', label: 'A devolver: transferencia' },
  { value: 'V', label: 'A devolver: cuenta corriente tributaria' },
]

const MARCAS: { campo: keyof FormularioPartida; texto: string; ayuda?: string }[] = [
  {
    campo: 'solicitar_devolucion',
    texto: 'Pedir la devolución si sale a devolver',
    ayuda: 'Solo en el último periodo del año, salvo con devolución mensual.',
  },
  { campo: 'devolucion_mensual', texto: 'Inscrita en devolución mensual' },
  { campo: 'criterio_caja', texto: 'Acogida al criterio de caja' },
  { campo: 'destinatario_criterio_caja', texto: 'Destinataria de operaciones con criterio de caja' },
  { campo: 'sii_voluntario', texto: 'En el SII por voluntad propia (no obligada)' },
  { campo: 'exonerado_390', texto: 'Exonerada del resumen anual (390)' },
  {
    campo: 'gasolinas',
    texto: 'Deduce pagos a cuenta de gasolinas (modelo 319)',
    ayuda: 'Solo cuenta en declaraciones mensuales, a partir de febrero.',
  },
]

/**
 * Lo que no sale de las facturas y hay que decir: las cuotas pendientes de
 * otros periodos, la forma de pago y las marcas de la empresa. Guardar manda
 * solo lo cambiado y la API recalcula la declaración con las facturas de hoy.
 *
 * El formulario arranca de la ficha; quien lo monta le pone una `key` que
 * cambia con cada ficha nueva para que no se quede con lo de antes.
 */
export default function DatosDePartida({ ficha, editable, alHecho }: Props) {
  const [formulario, setFormulario] = useState<FormularioPartida>(() => formularioDe(ficha))
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cambios = cambiosDePartida(ficha, formulario)
  const hayCambios = Object.keys(cambios).length > 0

  function poner<K extends keyof FormularioPartida>(campo: K, valor: FormularioPartida[K]) {
    setFormulario((antes) => ({ ...antes, [campo]: valor }))
  }

  async function guardar() {
    setError(null)
    setGuardando(true)
    try {
      alHecho(await modificarDeclaracion(ficha.id, cambios))
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Stack gap="sm">
      <Title order={5}>Datos de partida</Title>
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <Stack gap={4}>
          <TextInput
            label="Cuotas a compensar de periodos anteriores (casilla 110)"
            value={formulario.cuotas}
            onChange={(e) => poner('cuotas', soloImporte(e.currentTarget.value))}
            disabled={!editable || formulario.cuotasDeAnterior}
            inputMode="decimal"
          />
          <Checkbox
            label="Tomarlas de la declaración anterior"
            checked={formulario.cuotasDeAnterior}
            onChange={(e) => poner('cuotasDeAnterior', e.currentTarget.checked)}
            disabled={!editable}
          />
        </Stack>
        <Select
          label="Forma de pago o de devolución"
          data={FORMAS_DE_PAGO}
          value={formulario.forma_de_pago}
          onChange={(valor) => poner('forma_de_pago', valor ?? '')}
          allowDeselect={false}
          disabled={!editable}
        />
        <TextInput
          label="IBAN"
          description="Para domiciliar el ingreso o cobrar la devolución. Cuenta española."
          value={formulario.iban}
          onChange={(e) => poner('iban', e.currentTarget.value.toUpperCase())}
          disabled={!editable}
        />
        <TextInput
          label="BIC"
          description="Opcional con una cuenta española."
          value={formulario.bic}
          onChange={(e) => poner('bic', e.currentTarget.value.toUpperCase())}
          disabled={!editable}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        {MARCAS.map(({ campo, texto, ayuda }) => (
          <Checkbox
            key={campo}
            label={texto}
            description={ayuda}
            checked={formulario[campo] as boolean}
            onChange={(e) => poner(campo, e.currentTarget.checked)}
            disabled={!editable}
          />
        ))}
      </SimpleGrid>

      {editable && (
        <Group justify="flex-end">
          <Button
            variant="default"
            disabled={!hayCambios}
            onClick={() => setFormulario(formularioDe(ficha))}
          >
            Deshacer cambios
          </Button>
          <Button disabled={!hayCambios} loading={guardando} onClick={() => void guardar()}>
            Guardar y recalcular
          </Button>
        </Group>
      )}
    </Stack>
  )
}
