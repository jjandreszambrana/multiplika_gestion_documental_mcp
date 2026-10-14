import { Alert, Button, Group, Loader, Modal, Stack, Table, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { esAbortada } from '../../api/cliente'
import {
  documentosDeCasilla,
  type CasillaDeclarada,
  type PaginaDeDocumentos,
} from '../../api/declaraciones'
import { textoDeError } from '../../api/errores'
import { formatearEntero, formatearImporte } from '../../lib/format'

interface Props {
  idDeclaracion: number
  /** Nula con el diálogo cerrado. */
  casilla: CasillaDeclarada | null
  alCerrar: () => void
}

const POR_PAGINA = 50

const TIPOS: Record<string, string> = {
  factura_emitida: 'Emitida',
  factura_emitida_sii: 'Emitida (SII)',
  factura_recibida_sii: 'Recibida (SII)',
}

/**
 * De una casilla a las facturas que la suman: lo que pide Hacienda en un
 * requerimiento. Una misma factura puede salir dos veces si una línea fue a
 * dos casillas (la compra intracomunitaria va al devengado y al deducible).
 */
export default function DialogoFacturasCasilla({ idDeclaracion, casilla, alCerrar }: Props) {
  const [desplazamiento, setDesplazamiento] = useState(0)
  const [pagina, setPagina] = useState<PaginaDeDocumentos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const numero = casilla?.casilla ?? null

  // Al cerrar se vuelve a la primera página: la próxima casilla empieza por el principio.
  function cerrar() {
    setDesplazamiento(0)
    alCerrar()
  }

  useEffect(() => {
    if (numero === null) return
    const corte = new AbortController()
    setPagina(null)
    setError(null)
    documentosDeCasilla(idDeclaracion, numero, POR_PAGINA, desplazamiento, corte.signal)
      .then(setPagina)
      .catch((fallo: unknown) => {
        if (!esAbortada(fallo)) setError(textoDeError(fallo))
      })
    return () => corte.abort()
  }, [idDeclaracion, numero, desplazamiento])

  const hasta = pagina ? desplazamiento + pagina.documentos.length : 0

  return (
    <Modal
      opened={casilla !== null}
      onClose={cerrar}
      title={casilla ? `Casilla ${casilla.casilla} · ${casilla.descripcion}` : ''}
      size="xl"
      centered
    >
      <Stack gap="md">
        {error !== null ? (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        ) : pagina === null ? (
          <Loader size="sm" />
        ) : pagina.total === 0 ? (
          <Text size="sm" c="dimmed">
            Ninguna factura va directamente a esta casilla: es un total, sale de otras casillas o
            se ha puesto a mano.
          </Text>
        ) : (
          <>
            <Table fz="sm" striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Factura</Table.Th>
                  <Table.Th>Referencia</Table.Th>
                  <Table.Th>Casillas</Table.Th>
                  <Table.Th ta="right">Base</Table.Th>
                  <Table.Th ta="right">Cuota</Table.Th>
                  <Table.Th ta="right">Recargo</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {pagina.documentos.map((doc) => (
                  <Table.Tr key={`${doc.ref_tipo}-${doc.ref_id}-${doc.id_linea}-${doc.parte}`}>
                    <Table.Td>{TIPOS[doc.ref_tipo] ?? doc.ref_tipo}</Table.Td>
                    <Table.Td>
                      {doc.ref_id}
                      {doc.id_linea === 0 && (
                        <Text span size="xs" c="dimmed">
                          {' '}
                          (importe de la cabecera)
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {[doc.casilla_base, doc.casilla_cuota].filter(Boolean).join(' y ')}
                    </Table.Td>
                    <Table.Td ta="right" ff="monospace">
                      {formatearImporte(doc.base)}
                    </Table.Td>
                    <Table.Td ta="right" ff="monospace">
                      {formatearImporte(doc.cuota)}
                    </Table.Td>
                    <Table.Td ta="right" ff="monospace">
                      {doc.recargo.isZero() ? '' : formatearImporte(doc.recargo)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                {formatearEntero(desplazamiento + 1)} a {formatearEntero(hasta)} de{' '}
                {formatearEntero(pagina.total)}
              </Text>
              <Group gap="xs">
                <Button
                  variant="default"
                  size="xs"
                  disabled={desplazamiento === 0}
                  onClick={() => setDesplazamiento(Math.max(0, desplazamiento - POR_PAGINA))}
                >
                  Anteriores
                </Button>
                <Button
                  variant="default"
                  size="xs"
                  disabled={hasta >= pagina.total}
                  onClick={() => setDesplazamiento(desplazamiento + POR_PAGINA)}
                >
                  Siguientes
                </Button>
              </Group>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  )
}
