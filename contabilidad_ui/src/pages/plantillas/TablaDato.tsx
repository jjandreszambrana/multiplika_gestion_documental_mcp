import { ActionIcon, Button, Group, Stack, Table, Text, Tooltip } from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import type { Parametro } from '../../api/plantillas'
import CampoDato from './CampoDato'
import { claveDeCelda } from './errores'
import { filaVacia, textoDeResuelto, type FilaTabla, type ValorSimple } from './valores'

interface Props {
  parametro: Parametro
  filas: FilaTabla[]
  /** Las filas tal y como las ha resuelto el servidor, con los defectos puestos. */
  resueltas: unknown
  errores: string[] | undefined
  erroresDeCelda: Map<string, string[]>
  ancho: number
  alCambiar: (filas: FilaTabla[]) => void
}

/** Lo que el servidor ha resuelto para una celda, si la fila ha llegado. */
function celdaResuelta(resueltas: unknown, indice: number, columna: string): unknown {
  if (!Array.isArray(resueltas)) return null
  const fila: unknown = resueltas[indice]
  if (typeof fila !== 'object' || fila === null) return null
  return (fila as Record<string, unknown>)[columna]
}

/**
 * Un dato que son varias filas, como los empleados de una nómina o las bases
 * de una factura con varios tipos de IVA. Cada fila saca sus propias líneas.
 */
export default function TablaDato({
  parametro: p,
  filas,
  resueltas,
  errores,
  erroresDeCelda,
  ancho,
  alCambiar,
}: Props) {
  const columnas = p.columnas ?? []
  const minimo = p.filas_minimas ?? 0
  const maximo = p.filas_maximas ?? 200

  function cambiarCelda(indice: number, columna: string, valor: ValorSimple) {
    alCambiar(filas.map((f, i) => (i === indice ? { ...f, [columna]: valor } : f)))
  }

  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>
        {p.etiqueta || p.clave}
        {p.obligatorio && <Text span c="red"> *</Text>}
      </Text>
      {p.ayuda && (
        <Text size="xs" c="dimmed">
          {p.ayuda}
        </Text>
      )}
      <Table withTableBorder verticalSpacing={2} horizontalSpacing="xs" fz="sm">
        <Table.Thead>
          <Table.Tr>
            {columnas.map((c) => (
              <Table.Th key={c.clave}>{c.etiqueta || c.clave}</Table.Th>
            ))}
            <Table.Th w={36} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filas.map((fila, i) => (
            <Table.Tr key={i}>
              {columnas.map((c) => {
                const propio = fila[c.clave]
                // Una celda vacía enseña lo que el servidor puso por defecto.
                const vacia = propio === '' || propio === undefined
                const valor =
                  vacia && c.tipo !== 'booleano'
                    ? textoDeResuelto(c, celdaResuelta(resueltas, i, c.clave))
                    : (propio ?? '')
                return (
                  <Table.Td key={c.clave}>
                    <CampoDato
                      parametro={c}
                      valor={valor}
                      errores={erroresDeCelda.get(claveDeCelda(p.clave, i + 1, c.clave))}
                      ancho={ancho}
                      alCambiar={(v) => cambiarCelda(i, c.clave, v)}
                      enTabla
                    />
                  </Table.Td>
                )
              })}
              <Table.Td>
                {filas.length > minimo && (
                  <Tooltip label="Quitar fila">
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      aria-label="Quitar fila"
                      onClick={() => alCambiar(filas.filter((_, j) => j !== i))}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Group justify="space-between">
        {filas.length < maximo ? (
          <Button
            size="compact-xs"
            variant="subtle"
            leftSection={<IconPlus size={14} />}
            onClick={() => alCambiar([...filas, filaVacia(p)])}
          >
            Añadir fila
          </Button>
        ) : (
          <span />
        )}
        {errores && errores.length > 0 && (
          <Text size="xs" c="red">
            {errores.join(' ')}
          </Text>
        )}
      </Group>
    </Stack>
  )
}
