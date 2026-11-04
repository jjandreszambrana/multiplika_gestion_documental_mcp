import { Alert, Button, Checkbox, Group, Modal, Stack, Table, Text } from '@mantine/core'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'
import {
  cambiarCuentas,
  type Bien,
  type ResultadoDeCambiarCuentas,
} from '../../api/inmovilizado'
import CasillaDeCuenta from '../../components/CasillaDeCuenta'
import { CasillaFecha } from '../../components/CasillaFecha'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import { fechaParaApi } from '../../lib/fecha'
import { formatearImporte } from '../../lib/format'
import DialogoCuentaAlVuelo from '../diario/DialogoCuentaAlVuelo'

interface Props {
  /** Los bienes elegidos. Se monta solo con el diálogo abierto. */
  bienes: Bien[]
  ancho: number
  /** El del selector de la cabecera: es el plan en el que se crean cuentas. */
  ejercicio: number | null
  alCerrar: () => void
  alHecho: () => void
}

type Campo = 'activo' | 'amortizacion' | 'gasto'

/** Hoy; o el último día del ejercicio elegido, si hoy cae en otro. */
function fechaInicial(ejercicio: number | null): Date {
  const hoy = new Date()
  if (ejercicio === null || ejercicio === hoy.getFullYear()) return hoy
  return new Date(ejercicio, 11, 31)
}

/**
 * Cambiar las cuentas de uno o varios bienes. Nivel `apuntes`.
 *
 * Es la única vía para mover la cuenta del activo o de la amortización de un
 * bien que ya tiene dotaciones. Hace un asiento, así que primero se ensaya:
 * `simular` enseña el asiento propuesto sin escribir nada. Al aceptar, el
 * asiento queda en **borrador** y las fichas cambian cuando se confirma en el
 * diario.
 */
export default function DialogoCambiarCuentas({
  bienes,
  ancho,
  ejercicio,
  alCerrar,
  alHecho,
}: Props) {
  const plan = usePlanEnMemoria()
  const [cuentas, setCuentas] = useState<Record<Campo, string>>({
    activo: '',
    amortizacion: '',
    gasto: '',
  })
  const [fecha, setFecha] = useState<Date | null>(() => fechaInicial(ejercicio))
  const [soloFichas, setSoloFichas] = useState(false)
  const [ensayo, setEnsayo] = useState<ResultadoDeCambiarCuentas | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [creandoCuenta, setCreandoCuenta] = useState<{ campo: Campo; codigo: string } | null>(
    null,
  )

  const sinCuentas = Object.values(cuentas).every((c) => c.trim() === '')

  function cambiar(campo: Campo, valor: string) {
    setCuentas((previas) => ({ ...previas, [campo]: valor }))
    setEnsayo(null)
  }

  async function lanzar(simular: boolean) {
    setError(null)
    setTrabajando(true)
    try {
      const salida = await cambiarCuentas({
        ids: bienes.map((bien) => bien.id),
        cuenta_activo: cuentas.activo.trim(),
        cuenta_amortizacion: cuentas.amortizacion.trim(),
        cuenta_gasto: cuentas.gasto.trim(),
        fecha: fechaParaApi(fecha),
        simular,
        solo_fichas: soloFichas,
      })
      if (simular) setEnsayo(salida)
      else alHecho()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  /** Las cuentas que tienen ahora; si los bienes no coinciden, todas las distintas. */
  const actuales = (campo: Campo): string => {
    const clave = { activo: 'cuenta_activo', amortizacion: 'cuenta_amortizacion', gasto: 'cuenta_gasto' }[campo] as
      | 'cuenta_activo'
      | 'cuenta_amortizacion'
      | 'cuenta_gasto'
    const distintas = [...new Set(bienes.map((b) => b[clave]).filter(Boolean))]
    return distintas.length > 0 ? distintas.join(', ') : 'ninguna'
  }

  const casilla = (campo: Campo, rotulo: string) => (
    <Stack gap={2}>
    <Text size="xs" c="dimmed">
      Ahora: {actuales(campo)}
    </Text>
    <CasillaDeCuenta
      id={`cambiar-cuenta-${campo}`}
      label={rotulo}
      obligatoria={false}
      valor={cuentas[campo]}
      ancho={ancho}
      alCambiar={(valor) => cambiar(campo, valor)}
      alCrear={(codigo) => setCreandoCuenta({ campo, codigo })}
    />
    </Stack>
  )

  return (
    <Modal opened onClose={alCerrar} title="Cambiar las cuentas" size="xl" centered>
      <Stack gap="md">
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        <Text size="sm" fw={600}>
          {bienes.length === 1
            ? bienes[0].descripcion
            : `${bienes.length} bienes: ${bienes.map((b) => b.descripcion).join(', ')}`}
        </Text>

        <Text size="sm">
          Deja en blanco las cuentas que no quieras cambiar. Sus mejoras que estén en la misma
          cuenta se mueven con ellos.
        </Text>

        <Group grow align="flex-start">
          {casilla('activo', 'Cuenta nueva del activo')}
          {casilla('amortizacion', 'Cuenta nueva de amortización')}
          {casilla('gasto', 'Cuenta nueva de gasto')}
        </Group>

        <Text size="xs" c="dimmed">
          La de gasto no lleva asiento: lo ya dotado se queda donde está y la nueva vale para las
          dotaciones que vengan.
        </Text>

        <Group align="flex-end">
          <CasillaFecha
            label="Fecha del asiento"
            value={fecha}
            onChange={(valor) => {
              setFecha(valor as Date | null)
              setEnsayo(null)
            }}
            required
          />
        </Group>

        <Checkbox
          label="Ya lo he corregido a mano en el diario: cambiar solo las fichas, sin asiento"
          checked={soloFichas}
          onChange={(e) => {
            setSoloFichas(e.currentTarget.checked)
            setEnsayo(null)
          }}
        />

        {ensayo !== null && <Propuesta salida={ensayo} />}

        <Alert color="yellow" variant="light" role="note" title="Antes de guardar">
          {soloFichas
            ? 'Las fichas cambiarán ahora mismo y no se hará ningún asiento. Asegúrate de que el traslado ya está en el diario.'
            : 'Se creará un asiento en borrador que traslada el saldo de estos bienes entre las cuentas. Hasta que lo confirmes en el diario, los bienes no cambian de cuentas ni se pueden tocar.'}
        </Alert>

        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button
            variant="default"
            disabled={sinCuentas || fecha === null}
            loading={trabajando && ensayo === null}
            onClick={() => void lanzar(true)}
          >
            Ver cómo quedaría
          </Button>
          <Button
            disabled={ensayo === null}
            loading={trabajando && ensayo !== null}
            onClick={() => void lanzar(false)}
          >
            {soloFichas ? 'Cambiar las fichas' : 'Crear el borrador'}
          </Button>
        </Group>
      </Stack>

      <DialogoCuentaAlVuelo
        codigo={creandoCuenta?.codigo ?? null}
        ejercicio={ejercicio}
        alCerrar={() => setCreandoCuenta(null)}
        alCreada={(cuenta) => {
          if (creandoCuenta !== null) cambiar(creandoCuenta.campo, cuenta.codigo)
          setCreandoCuenta(null)
          plan.refrescar()
        }}
      />
    </Modal>
  )
}

function Propuesta({ salida }: { salida: ResultadoDeCambiarCuentas }) {
  return (
    <Stack gap="xs">
      {salida.avisos.map((aviso) => (
        <Alert key={aviso} color="orange" variant="light" role="note">
          {aviso}
        </Alert>
      ))}
      {salida.lineas.length === 0 ? (
        <Text size="sm">
          Ningún bien tiene saldo que trasladar: solo cambian las fichas, ahora mismo.
        </Text>
      ) : (
        <>
          <Text fw={500} size="sm">
            Asiento propuesto, a {salida.fecha}
          </Text>
          <Table fz="sm" verticalSpacing={4}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Cuenta</Table.Th>
                <Table.Th>Concepto</Table.Th>
                <Table.Th ta="right">Debe</Table.Th>
                <Table.Th ta="right">Haber</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {salida.lineas.map((linea, i) => (
                <Table.Tr key={`${linea.id_inmovilizado}-${linea.cuenta}-${i}`}>
                  <Table.Td>{linea.cuenta}</Table.Td>
                  <Table.Td>{linea.concepto}</Table.Td>
                  <Table.Td align="right">
                    {linea.debe.isZero() ? '' : formatearImporte(linea.debe)}
                  </Table.Td>
                  <Table.Td align="right">
                    {linea.haber.isZero() ? '' : formatearImporte(linea.haber)}
                  </Table.Td>
                </Table.Tr>
              ))}
              <Table.Tr fw={600}>
                <Table.Td colSpan={2}>Total</Table.Td>
                <Table.Td align="right">{formatearImporte(salida.total_debe)}</Table.Td>
                <Table.Td align="right">{formatearImporte(salida.total_haber)}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </>
      )}
    </Stack>
  )
}
