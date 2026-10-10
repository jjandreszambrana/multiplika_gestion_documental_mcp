import {
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { useMemo, useState } from 'react'
import type { Empresa } from '../../api/sesion'
import clases from './SelectorEmpresa.module.css'

interface Props {
  empresas: Empresa[]
  alElegir: (empresa: Empresa) => void
  /** Nulo para quien no gestiona empresas ajenas. */
  alActivarOtra: (() => void) | null
}

/** Una asesoría puede tener cientos de clientes: sin buscador no se encuentra. */
export default function SelectorEmpresa({ empresas, alElegir, alActivarOtra }: Props) {
  const [busqueda, setBusqueda] = useState('')

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return empresas
    return empresas.filter((e) =>
      `${e.NombreRazon ?? ''} ${e.NIF ?? ''}`.toLowerCase().includes(texto),
    )
  }, [empresas, busqueda])

  return (
    <Paper withBorder shadow="sm" p="xl" maw={560} mx="auto" mt="10vh">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={3}>Elige la empresa</Title>
          {alActivarOtra && (
            <Button variant="default" size="xs" onClick={alActivarOtra}>
              Activar otra empresa
            </Button>
          )}
        </Group>

        <TextInput
          label="Buscar por nombre o NIF"
          value={busqueda}
          onChange={(e) => setBusqueda(e.currentTarget.value)}
          autoFocus
        />

        {visibles.length === 0 ? (
          <Text c="dimmed">Ninguna empresa coincide con la búsqueda.</Text>
        ) : (
          <Stack gap="xs" className={clases.lista}>
            {visibles.map((empresa) => (
              <UnstyledButton
                key={empresa.id_obligado}
                className={clases.opcion}
                onClick={() => alElegir(empresa)}
              >
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <Text fw={500}>{empresa.NombreRazon ?? `Empresa ${empresa.id_obligado}`}</Text>
                    <Text size="sm" c="dimmed">
                      {empresa.NIF ?? 'Sin NIF'}
                    </Text>
                  </div>
                  <Badge variant="light">{empresa.nivel}</Badge>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  )
}
