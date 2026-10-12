import { Button, Group, Stack, Tabs, Title } from '@mantine/core'
import { useState } from 'react'
import { FACTURAS, MOVIMIENTOS } from '../../api/bandeja'
import { alcanza } from '../../api/sesion'
import DialogoTraerCodiplika from './DialogoTraerCodiplika'
import ListaBandeja from './ListaBandeja'
import TablaLecturas from './TablaLecturas'

interface Props {
  ejercicio: number | null
  nivel: string
  nombreEmpresa: string
  /** Lleva al diario con la lista de borradores abierta. */
  alVerBorradores: () => void
}

const TITULO = 'Bandeja de Codiplika'

/**
 * Lo que llega de Codiplika antes de entrar en la contabilidad: facturas,
 * cobros y pagos, y cada vez que se trajeron.
 *
 * Nada pasa al libro desde aquí. Contabilizar crea borradores, que se
 * confirman en el diario; una factura que ya está en la facturación no se
 * contabiliza dos veces.
 */
export default function PantallaBandeja({ ejercicio, nivel, nombreEmpresa, alVerBorradores }: Props) {
  const [trayendo, setTrayendo] = useState(false)
  // Sube al traer o deshacer una lectura: las tres pestañas vuelven a leer.
  const [refresco, setRefresco] = useState(0)

  // El armazón ya avisa cuando la empresa no tiene ningún ejercicio abierto.
  if (ejercicio === null) return <Title order={3}>{TITULO}</Title>

  const recargar = () => setRefresco((n) => n + 1)

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>{TITULO}</Title>
        {alcanza(nivel, 'apuntes') && (
          <Button onClick={() => setTrayendo(true)}>Traer de Codiplika…</Button>
        )}
      </Group>

      {/* Las tres se quedan montadas: al cambiar de pestaña cada una
          conserva su filtro y su página. */}
      <Tabs defaultValue={FACTURAS}>
        <Tabs.List mb="md">
          <Tabs.Tab value={FACTURAS}>Facturas</Tabs.Tab>
          <Tabs.Tab value={MOVIMIENTOS}>Cobros y pagos</Tabs.Tab>
          <Tabs.Tab value="lecturas">Lecturas</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value={FACTURAS}>
          <ListaBandeja
            tipo={FACTURAS}
            ejercicio={ejercicio}
            nivel={nivel}
            refresco={refresco}
            alVerBorradores={alVerBorradores}
          />
        </Tabs.Panel>
        <Tabs.Panel value={MOVIMIENTOS}>
          <ListaBandeja
            tipo={MOVIMIENTOS}
            ejercicio={ejercicio}
            nivel={nivel}
            refresco={refresco}
            alVerBorradores={alVerBorradores}
          />
        </Tabs.Panel>
        <Tabs.Panel value="lecturas">
          <TablaLecturas nivel={nivel} refresco={refresco} alDeshecha={recargar} />
        </Tabs.Panel>
      </Tabs>

      <DialogoTraerCodiplika
        abierto={trayendo}
        ejercicio={ejercicio}
        nombreEmpresa={nombreEmpresa}
        alCerrar={() => setTrayendo(false)}
        alTraido={recargar}
      />
    </Stack>
  )
}
