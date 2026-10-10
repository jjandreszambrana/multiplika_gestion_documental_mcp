import { Button, Group, Select, Stack, Title } from '@mantine/core'
import { useState } from 'react'
import {
  contabilizarPeriodo,
  EMITIDAS,
  reintentarPendientes,
  type ResultadoPeriodo,
  type ResultadoReintento,
  type TipoFactura,
} from '../../api/contabilizar'
import BotonDeAyuda from '../../components/BotonDeAyuda'
import { alcanza } from '../../api/sesion'
import { formatearEntero } from '../../lib/format'
import BloqueAnulaciones from './BloqueAnulaciones'
import DialogoConfirmar from './DialogoConfirmar'
import TablaEmitidas from './TablaEmitidas'
import TablaRecibidas from './TablaRecibidas'
import { comoSeLlama, MESES, TODO_EL_EJERCICIO } from './meses'
import ResumenTraspaso from './ResumenTraspaso'

interface Props {
  ejercicio: number | null
  tipo: TipoFactura
  nivel: string
  ancho: number
}

const TEXTOS = {
  emitidas: {
    titulo: 'Facturas emitidas',
    vacio: 'No hay facturas emitidas pendientes de contabilizar.',
    confirmar: 'Contabilizar las facturas emitidas',
    reintentar: 'Se van a reintentar las facturas emitidas que quedaron pendientes en',
  },
  recibidas: {
    titulo: 'Facturas recibidas',
    vacio: 'No hay facturas recibidas pendientes de contabilizar.',
    confirmar: 'Contabilizar las facturas recibidas',
    reintentar: 'Se van a reintentar las facturas recibidas que quedaron pendientes en',
  },
}

/**
 * Pasar a asientos las facturas de facturación, un tipo por pantalla.
 *
 * Lo que frena a cada factura se ve en su fila, no en un aviso aparte: la
 * comprobación previa se retiró el 28/08/2026 porque anunciaba que nada frenaba
 * el traspaso al lado de una lista donde no entraba ninguna.
 */
/** La ayuda que pega en cada pantalla; si el servidor no la tiene, no se enseña. */
const AYUDA = {
  emitidas: 'traspaso_facturas_emitidas',
  recibidas: 'traspaso_facturas_recibidas',
}

export default function PantallaTraspasos({ ejercicio, tipo, nivel, ancho }: Props) {
  const textos = tipo === EMITIDAS ? TEXTOS.emitidas : TEXTOS.recibidas
  const [periodo, setPeriodo] = useState(TODO_EL_EJERCICIO)

  const [preguntando, setPreguntando] = useState<'contabilizar' | 'reintentar' | null>(null)
  const [resultado, setResultado] = useState<ResultadoPeriodo | null>(null)
  const [reintento, setReintento] = useState<ResultadoReintento | null>(null)
  // Cuántas van a entrar, que lo cuenta la tabla que esté puesta.
  const [cuantasEntran, setCuantasEntran] = useState(0)
  // Sube al contabilizar, para que la tabla se vuelva a leer y las que hayan
  // entrado desaparezcan.
  const [refresco, setRefresco] = useState(0)

  // El armazón ya avisa cuando la empresa no tiene ningún ejercicio abierto;
  // aquí no hay nada que listar ni nada que contabilizar.
  if (ejercicio === null) return <Title order={3}>{textos.titulo}</Title>

  const puedeApuntar = alcanza(nivel, 'apuntes')
  const esEmitidas = tipo === EMITIDAS

  return (
    <Stack gap="md">
      <Title order={3}>{textos.titulo}</Title>

      <Group align="flex-end" gap="md">
        <Select
          label="Mes"
          data={MESES}
          value={periodo}
          onChange={(valor) => {
            setPeriodo(valor ?? TODO_EL_EJERCICIO)
            setResultado(null)
            setReintento(null)
          }}
          allowDeselect={false}
          w={200}
        />

        {puedeApuntar && (
          <Group gap="sm">
            <Button
              onClick={() => setPreguntando('contabilizar')}
              disabled={cuantasEntran === 0}
            >
              Contabilizar…
            </Button>
            <Button variant="default" onClick={() => setPreguntando('reintentar')}>
              Reintentar las pendientes…
            </Button>
          </Group>
        )}

        {/* Qué cuenta usa cada línea del asiento y qué deja una factura en
            pendientes. La escribe el backend: aquí solo se abre. */}
        <Group h={36} align="center">
          <BotonDeAyuda clave={esEmitidas ? AYUDA.emitidas : AYUDA.recibidas} />
        </Group>
      </Group>

      <ResumenTraspaso resultado={resultado} reintento={reintento} />

      {esEmitidas && <BloqueAnulaciones nivel={nivel} />}

      {esEmitidas ? (
        <TablaEmitidas
          ejercicio={ejercicio}
          periodo={periodo}
          nivel={nivel}
          ancho={ancho}
          refresco={refresco}
          alContar={setCuantasEntran}
        />
      ) : (
        <TablaRecibidas
          ejercicio={ejercicio}
          periodo={periodo}
          nivel={nivel}
          ancho={ancho}
          ejercicioDelPlan={ejercicio}
          refresco={refresco}
          alContar={setCuantasEntran}
        />
      )}

      <DialogoConfirmar
        abierto={preguntando === 'contabilizar'}
        titulo={textos.confirmar}
        texto={`Se van a contabilizar ${formatearEntero(cuantasEntran)} facturas de ${comoSeLlama(
          periodo,
          ejercicio,
        )}. La que no se pueda queda anotada con su motivo y no frena a las demás.`}
        rotulo="Contabilizar"
        alCerrar={() => setPreguntando(null)}
        alConfirmar={async () => {
          setReintento(null)
          setResultado(await contabilizarPeriodo(ejercicio, periodo, tipo))
          setPreguntando(null)
          setRefresco((n) => n + 1)
        }}
      />

      <DialogoConfirmar
        abierto={preguntando === 'reintentar'}
        titulo="Reintentar las pendientes"
        texto={`${textos.reintentar} ${ejercicio}.`}
        rotulo="Reintentar"
        alCerrar={() => setPreguntando(null)}
        alConfirmar={async () => {
          setResultado(null)
          setReintento(await reintentarPendientes(ejercicio, tipo))
          setPreguntando(null)
          setRefresco((n) => n + 1)
        }}
      />
    </Stack>
  )
}
