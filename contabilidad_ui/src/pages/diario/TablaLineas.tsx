import { ActionIcon, Group, Table, Text, TextInput, Tooltip } from '@mantine/core'
import { IconBook, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import { expandirCuenta } from '../../lib/cuenta'
import CasillaCuenta from './CasillaCuenta'
import type { LineaEnEdicion } from './lineas'

interface Props {
  lineas: LineaEnEdicion[]
  /** Dígitos de una cuenta de apuntes en esta empresa. */
  ancho: number
  alCambiar: (clave: number, campo: keyof LineaEnEdicion, valor: string) => void
  alQuitar: (clave: number) => void
  /** Se llama al pedir el alta de una cuenta que no existe, desde su casilla. */
  alCrearCuenta: (codigo: string) => void
  /** Abre el mayor de una cuenta sin salir del asiento. */
  alVerMayor: (cuenta: string) => void
}

const ANCHOS = { cuenta: 168, documento: 130, importe: 120, acciones: 44 }

/**
 * Las líneas del asiento. Se teclea seguido: cada casilla es un campo normal y
 * el tabulador va por el orden en que se escribe, cuenta, concepto, documento,
 * debe y haber.
 */
export default function TablaLineas({
  lineas,
  ancho,
  alCambiar,
  alQuitar,
  alCrearCuenta,
  alVerMayor,
}: Props) {
  // Dónde está el cursor, para decir de qué cuenta se trata sin que haya que
  // salir del asiento a mirarlo. La casilla enseña el número; el título es lo
  // que dice si es la cuenta que se quería.
  const [enFoco, setEnFoco] = useState<number | null>(null)
  const plan = usePlanEnMemoria()

  /**
   * Un asiento repite el mismo concepto y el mismo documento línea tras línea.
   * La casilla vacía enseña en gris lo de la línea de encima, y al salir de
   * ella se queda con ese valor: quien quiera otra cosa, la escribe.
   */
  function heredar(linea: LineaEnEdicion, indice: number, campo: 'concepto' | 'documento') {
    if (linea[campo].trim() !== '') return
    const anterior = lineas[indice - 1]?.[campo] ?? ''
    if (anterior.trim() === '') return
    alCambiar(linea.clave, campo, anterior)
  }

  const linea = lineas.find((l) => l.clave === enFoco)
  const cuenta =
    linea && linea.cuenta.trim() !== ''
      ? plan.porCodigo.get(expandirCuenta(linea.cuenta, ancho))
      : undefined

  return (
    <>
      <Table striped withTableBorder verticalSpacing={2} horizontalSpacing="xs" fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={ANCHOS.cuenta}>Cuenta</Table.Th>
            <Table.Th>Concepto</Table.Th>
            <Table.Th w={ANCHOS.documento}>Documento</Table.Th>
            <Table.Th w={ANCHOS.importe} ta="right">
              Debe
            </Table.Th>
            <Table.Th w={ANCHOS.importe} ta="right">
              Haber
            </Table.Th>
            <Table.Th w={ANCHOS.acciones} />
          </Table.Tr>
        </Table.Thead>

        <Table.Tbody>
          {lineas.map((linea, indice) => (
            <Table.Tr key={linea.clave} onFocusCapture={() => setEnFoco(linea.clave)}>
              <Table.Td>
                <Group gap={2} wrap="nowrap">
                  <CasillaCuenta
                    valor={linea.cuenta}
                    ancho={ancho}
                    alCambiar={(valor) => alCambiar(linea.clave, 'cuenta', valor)}
                    alCrear={alCrearCuenta}
                  />
                  {/* No le quita el foco a la casilla: al cerrar el mayor se
                      sigue tecleando donde se estaba. */}
                  <Tooltip label="Ver el mayor…" withArrow>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="gray"
                      aria-label="Ver el mayor…"
                      disabled={linea.cuenta.trim() === ''}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => alVerMayor(expandirCuenta(linea.cuenta, ancho))}
                    >
                      <IconBook size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Table.Td>
              <Table.Td>
                <TextInput
                  size="xs"
                  value={linea.concepto}
                  placeholder={lineas[indice - 1]?.concepto ?? ''}
                  onChange={(e) => alCambiar(linea.clave, 'concepto', e.currentTarget.value)}
                  onBlur={() => heredar(linea, indice, 'concepto')}
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  size="xs"
                  value={linea.documento}
                  placeholder={lineas[indice - 1]?.documento ?? ''}
                  onChange={(e) => alCambiar(linea.clave, 'documento', e.currentTarget.value)}
                  onBlur={() => heredar(linea, indice, 'documento')}
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  size="xs"
                  value={linea.debe}
                  onChange={(e) => alCambiar(linea.clave, 'debe', e.currentTarget.value)}
                  styles={{ input: { textAlign: 'right', fontFamily: 'monospace' } }}
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  size="xs"
                  value={linea.haber}
                  onChange={(e) => alCambiar(linea.clave, 'haber', e.currentTarget.value)}
                  styles={{ input: { textAlign: 'right', fontFamily: 'monospace' } }}
                />
              </Table.Td>
              <Table.Td>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="red"
                  aria-label="Quitar la línea"
                  title="Quitar la línea"
                  onClick={() => alQuitar(linea.clave)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {/* Alto reservado siempre: si apareciera y desapareciera, la tabla daría un
          salto cada vez que el cursor cambia de fila. */}
      <Text size="xs" c="dimmed" ff="monospace" mt={4} h={18}>
        {cuenta ? `${cuenta.codigo} · ${cuenta.descripcion ?? ''}` : '\u00a0'}
      </Text>
    </>
  )
}
