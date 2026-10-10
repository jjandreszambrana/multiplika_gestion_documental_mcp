import { Alert, Button, Group, Loader, Stack, Table, Text, Title } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { esAbortada } from '../../api/cliente'
import { textoDeError } from '../../api/errores'
import { apuntesSinFicha, type ApuntePideFicha } from '../../api/inmovilizado'
import { alcanza } from '../../api/sesion'
import { formatearFecha, formatearImporte } from '../../lib/format'
import DialogoBien from './DialogoBien'
import DialogoDescartar from './DialogoDescartar'

interface Props {
  nivel: string
  ancho: number
  /** Para dar de alta una cuenta sin salir del formulario del bien. */
  ejercicio: number | null
}

/**
 * Lo que entró al debe de una cuenta de inmovilizado y no tiene ficha de bien.
 * Nivel `consulta` para verlo, `apuntes` para resolverlo.
 *
 * Es lo que cubre el agujero: todo lo que se contabilizó antes de que la ficha
 * naciera de la factura, y los asientos hechos a mano. Un bien sin ficha no se
 * amortiza nunca y no lo nota nadie hasta que el balance no cuadra.
 *
 * Sin filtros a propósito: son los que quedan, y la lista se vacía sola según
 * se van resolviendo.
 */
export default function PantallaSinFicha({ nivel, ancho, ejercicio }: Props) {
  const [apuntes, setApuntes] = useState<ApuntePideFicha[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creando, setCreando] = useState<ApuntePideFicha | null>(null)
  const [descartando, setDescartando] = useState<ApuntePideFicha | null>(null)
  const [recarga, setRecarga] = useState(0)

  const apunta = alcanza(nivel, 'apuntes')

  const cargar = useCallback(async (senal: AbortSignal) => {
    setError(null)
    setApuntes(null)
    try {
      const { apuntes: filas } = await apuntesSinFicha({}, senal)
      setApuntes(filas)
    } catch (fallo) {
      if (esAbortada(fallo)) return
      setError(textoDeError(fallo))
      setApuntes([])
    }
  }, [])

  useEffect(() => {
    const corte = new AbortController()
    void cargar(corte.signal)
    return () => corte.abort()
  }, [cargar, recarga])

  function rehacer() {
    setCreando(null)
    setDescartando(null)
    setRecarga((n) => n + 1)
  }

  return (
    <Stack gap="md">
      <Title order={3}>Bienes sin ficha</Title>

      <Text size="sm">
        Apuntes en cuentas de inmovilizado que no tienen ficha de bien. Mientras no la tengan, no
        se amortizan.
      </Text>

      {error && (
        <Alert color="red" role="alert" title="No se pudieron cargar los apuntes">
          {error}
        </Alert>
      )}

      {apuntes === null && !error && <Loader size="sm" />}

      {apuntes !== null && apuntes.length === 0 && !error && (
        <Text size="sm" c="dimmed">
          Todo revisado: no hay ningún apunte de inmovilizado sin ficha.
        </Text>
      )}

      {apuntes !== null && apuntes.length > 0 && (
        <Table striped highlightOnHover fz="sm" verticalSpacing={4}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={110}>Fecha</Table.Th>
              <Table.Th w={90}>Asiento</Table.Th>
              <Table.Th w={130}>Cuenta</Table.Th>
              <Table.Th>Concepto</Table.Th>
              <Table.Th w={140}>Documento</Table.Th>
              <Table.Th w={120} ta="right">
                Importe
              </Table.Th>
              <Table.Th w={220} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {apuntes.map((apunte) => (
              <Table.Tr key={apunte.pase}>
                <Table.Td>{formatearFecha(apunte.fecha)}</Table.Td>
                <Table.Td>{apunte.asiento}</Table.Td>
                <Table.Td>{apunte.cuenta}</Table.Td>
                <Table.Td>{apunte.concepto}</Table.Td>
                <Table.Td>{apunte.documento}</Table.Td>
                <Table.Td align="right" ff="monospace">
                  {formatearImporte(apunte.importe)}
                </Table.Td>
                <Table.Td>
                  {apunta && (
                    <Group gap="xs" wrap="nowrap" justify="flex-end">
                      <Button size="xs" onClick={() => setCreando(apunte)}>
                        Crear la ficha…
                      </Button>
                      <Button size="xs" variant="default" onClick={() => setDescartando(apunte)}>
                        No es un bien…
                      </Button>
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {creando !== null && (
        <DialogoBien
          key={creando.pase}
          abierto
          bien={null}
          mejoraDe={null}
          ancho={ancho}
          ejercicio={ejercicio}
          desdeApunte={creando}
          alCerrar={() => setCreando(null)}
          alGuardado={rehacer}
        />
      )}

      <DialogoDescartar
        apunte={descartando}
        alCerrar={() => setDescartando(null)}
        alHecho={rehacer}
      />
    </Stack>
  )
}
