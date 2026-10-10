import { Paper, Stack, Table, Text } from '@mantine/core'

interface Props {
  plan: string
  ancho: number
  /** Ya formateados: aquí no se formatea nada. */
  ejerciciosAbiertos: string
  proximoPase: string
  proximoDocumento: string
  activaDesde: string
}

/** Lo que condiciona la pantalla y no se cambia por API. Solo lectura. */
export default function DatosFijos({
  plan,
  ancho,
  ejerciciosAbiertos,
  proximoPase,
  proximoDocumento,
  activaDesde,
}: Props) {
  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Table withRowBorders={false} verticalSpacing={2} horizontalSpacing="md" w="auto">
          <Table.Tbody>
            <Renglon titulo="Plan contable" valor={plan} />
            <Renglon titulo="Dígitos de las cuentas de apuntes" valor={String(ancho)} />
            <Renglon titulo="Ejercicios abiertos" valor={ejerciciosAbiertos} />
            <Renglon titulo="Próximo pase" valor={proximoPase} />
            <Renglon titulo="Próximo documento" valor={proximoDocumento} />
            <Renglon titulo="Contabilidad activa desde" valor={activaDesde} />
          </Table.Tbody>
        </Table>
        <Text size="sm" c="dimmed">
          Estos datos no se cambian desde aquí: el ancho de cuenta exigiría migrar los apuntes, y el
          plan se cambia al abrir el ejercicio siguiente.
        </Text>
      </Stack>
    </Paper>
  )
}

function Renglon({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <Table.Tr>
      <Table.Td>
        <Text fz="sm" c="dimmed">
          {titulo}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text fz="sm" fw={500}>
          {valor}
        </Text>
      </Table.Td>
    </Table.Tr>
  )
}
