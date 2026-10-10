import { Alert, Button, Group, Stack, Table, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import {
  anulacionesPendientes,
  revertirAnulaciones,
  type Anulacion,
  type ResultadoReversion,
} from '../../api/contabilizar'
import { textoDeError } from '../../api/errores'
import { alcanza } from '../../api/sesion'
import { formatearEntero, formatearFecha } from '../../lib/format'
import DialogoConfirmar from './DialogoConfirmar'

interface Props {
  nivel: string
}

function Listado({ anulaciones }: { anulaciones: Anulacion[] }) {
  return (
    <Table withTableBorder striped fz="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th w={110}>Fecha</Table.Th>
          <Table.Th>Factura</Table.Th>
          <Table.Th>Motivo</Table.Th>
          <Table.Th w={120}>Asiento</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {anulaciones.map((anulacion) => (
          <Table.Tr key={anulacion.id}>
            <Table.Td>{formatearFecha(anulacion.fecha_emision)}</Table.Td>
            <Table.Td>{anulacion.numero_factura ?? ''}</Table.Td>
            <Table.Td>{anulacion.motivo_anulacion ?? ''}</Table.Td>
            <Table.Td>{anulacion.asiento_original}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}

/**
 * Ventas anuladas que siguen teniendo asiento: la contabilidad las da por
 * buenas y ya no existen. Va aparte del traspaso del periodo porque no tiene
 * ejercicio ni mes, y porque merece verse aunque no se esté contabilizando.
 */
export default function BloqueAnulaciones({ nivel }: Props) {
  const [anulaciones, setAnulaciones] = useState<Anulacion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [preguntando, setPreguntando] = useState(false)
  const [hecho, setHecho] = useState<ResultadoReversion | null>(null)

  const traer = () => {
    anulacionesPendientes()
      .then((lista) => {
        setAnulaciones(lista)
        setError(null)
      })
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
  }

  useEffect(traer, [])

  if (error) {
    return (
      <Alert color="red" title="No se pudieron cargar las anulaciones" role="alert">
        {error}
      </Alert>
    )
  }

  if (anulaciones.length === 0 && !hecho) return null

  return (
    <Stack gap="sm">
      {hecho && (
        <Alert color="blue">
          Revertidas {formatearEntero(hecho.revertidas)} anulaciones.
          {hecho.pendientes > 0 && ` Quedan ${formatearEntero(hecho.pendientes)} sin revertir.`}
        </Alert>
      )}

      {anulaciones.length > 0 && (
        <Alert color="red" title="Ventas anuladas con asiento">
          <Stack gap="sm">
            <Text size="sm">
              Hay {formatearEntero(anulaciones.length)} facturas anuladas que siguen en los libros.
            </Text>

            <Listado anulaciones={anulaciones} />

            {alcanza(nivel, 'apuntes') && (
              <Group>
                <Button color="red" variant="light" onClick={() => setPreguntando(true)}>
                  Revertir…
                </Button>
              </Group>
            )}
          </Stack>
        </Alert>
      )}

      <DialogoConfirmar
        abierto={preguntando}
        titulo="Revertir las anulaciones"
        texto="Se genera un asiento inverso por cada anulación. El asiento original no se borra."
        rotulo="Revertir"
        alCerrar={() => setPreguntando(false)}
        alConfirmar={async () => {
          setHecho(await revertirAnulaciones())
          setPreguntando(false)
          traer()
        }}
      />
    </Stack>
  )
}
